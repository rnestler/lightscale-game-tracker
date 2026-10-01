import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { decodeRow, evaluate, referencedNames, toColumnValue } from './migration-backfill.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(scriptDir, 'migrations');
const dataFile = path.join(scriptDir, 'data.sql');
const helpersFile = path.join(scriptDir, 'migration-helpers.sql');

const PACKAGE_SHAPE = 3;
const SHAPE_CONVERSIONS = ["convert-unstamped.sql","convert-shape-1.sql","convert-shape-2.sql"];
const MIGRATIONS_TABLE = 'schema_migrations';
const SHAPE_TABLE = 'schema_shape';
const LAYOUT_SCHEMA = '_migration_layout';
const BACKUP_PREFIX = '$OLD_';
const BATCH_SIZE = 1000;
const MIGRATION_LOCK = 'lightscale-migrate';
const REPORTED_DIFFERENCES = 30;
const NULL_ADMISSION = 'null admission of column ';
const RAW_TYPE_IDS = [20, 1082, 1700];
const RAW_ARRAY_TYPE_IDS = [1016, 1182, 1231];

for (const typeId of RAW_TYPE_IDS) {
  pg.types.setTypeParser(typeId, function (value) { return value; });
}
for (const typeId of RAW_ARRAY_TYPE_IDS) {
  pg.types.setTypeParser(typeId, pg.types.getTypeParser(1009));
}

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const text = readFileSync(path.join(scriptDir, '..', '.env'), 'utf-8');
  for (const line of text.split('\n')) {
    const match = line.match(/^DATABASE_URL=(.+)$/);
    if (match) {
      return match[1].trim().replace(/^"(.*)"$/, '$1');
    }
  }
  throw new Error('DATABASE_URL is not set');
}

function quoteIdentifier(name) {
  return '"' + name.replace(/"/g, '""') + '"';
}

function readMigrationFile(version, name) {
  return readFileSync(path.join(migrationsDir, version, name), 'utf-8');
}

function packageVersions() {
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter(function (entry) { return entry.isDirectory(); })
    .map(function (entry) { return entry.name; })
    .sort();
}

function versionNumber(version) {
  const number = Number.parseInt(version.split('__')[0], 10);
  if (Number.isNaN(number)) {
    throw new Error('Migration ' + version + ' has no numeric version prefix');
  }
  return number;
}

function highestVersion(versions) {
  let highest = 0;
  for (const version of versions) {
    highest = Math.max(highest, versionNumber(version));
  }
  return highest;
}

function packageVersionAt(versions, number) {
  const version = versions.find(function (candidate) { return versionNumber(candidate) === number; });
  if (version === undefined) {
    throw new Error(
      'The database is at release ' + number + ', which this package does not contain. ' +
      'A fresh-install package only sets up an empty database; apply a package with the full migration history.'
    );
  }
  return version;
}

function requireKnownVersions(appliedNumber, versions) {
  if (appliedNumber > highestVersion(versions)) {
    throw new Error(
      'The database is at release ' + appliedNumber + ', which is newer than this package. ' +
      'Apply that release or a later one.'
    );
  }
}

async function applySql(client, sql) {
  if (sql.trim() !== '') {
    await client.query(sql);
  }
}

async function useSchema(client, schema) {
  await client.query('SET LOCAL search_path TO ' + quoteIdentifier(schema));
}

async function appliedVersions(client) {
  await client.query(
    'CREATE TABLE IF NOT EXISTS ' + MIGRATIONS_TABLE + ' ("version" text PRIMARY KEY, "appliedAt" timestamptz NOT NULL)'
  );
  const result = await client.query('SELECT version FROM ' + MIGRATIONS_TABLE + ' ORDER BY version');
  return result.rows.map(function (entry) { return entry.version; });
}

async function recordedShape(client) {
  await client.query('CREATE TABLE IF NOT EXISTS ' + SHAPE_TABLE + ' ("shape" integer NOT NULL)');
  const result = await client.query('SELECT shape FROM ' + SHAPE_TABLE);
  if (result.rows.length > 1) {
    throw new Error('The table ' + SHAPE_TABLE + ' holds more than one layout version');
  }
  return result.rows.length === 0 ? null : result.rows[0].shape;
}

function requireKnownShape(shape) {
  if (shape !== null && shape > PACKAGE_SHAPE) {
    throw new Error(
      'The database records layout version ' + shape + ', but this package writes layout version ' + PACKAGE_SHAPE + '. ' +
      'Apply a package of that layout version or a later one. The database was not changed.'
    );
  }
}

function pendingConversions(shape) {
  return SHAPE_CONVERSIONS.slice(shape === null ? 0 : shape);
}

async function stampShape(client) {
  await client.query('DELETE FROM ' + SHAPE_TABLE);
  await client.query('INSERT INTO ' + SHAPE_TABLE + ' ("shape") VALUES ($1)', [PACKAGE_SHAPE]);
}

async function tableColumnTypes(client, table) {
  const result = await client.query(
    "SELECT attname AS name, format_type(atttypid, atttypmod) AS type FROM pg_attribute WHERE attrelid = to_regclass(format('%I', $1::text)) AND attnum > 0 AND NOT attisdropped",
    [table]
  );
  const types = new Map();
  for (const row of result.rows) {
    types.set(row.name, row.type);
  }
  return types;
}

function evaluateRow(table, entries, types, row) {
  const update = { id: row.id };
  for (const entry of entries) {
    try {
      update[entry.column] = toColumnValue(evaluate(entry.expression, row, {}), types.get(entry.column));
    } catch (error) {
      throw new Error('Migration backfill of "' + table + '"."' + entry.column + '" failed for row ' + row.id + ': ' + error.message);
    }
  }
  return update;
}

async function backfillTable(client, table, entries) {
  const types = await tableColumnTypes(client, table);
  for (const entry of entries) {
    if (!types.has(entry.column)) {
      throw new Error('Migration backfill targets the missing column "' + table + '"."' + entry.column + '"');
    }
  }
  const sources = referencedNames(entries.map(function (entry) { return entry.expression; }))
    .filter(function (name) { return types.has(name) && name !== 'id'; });
  const selection = ['id'].concat(sources).map(quoteIdentifier).join(', ');
  const targets = ['"id" text'].concat(entries.map(function (entry) {
    return quoteIdentifier(entry.column) + ' ' + types.get(entry.column);
  })).join(', ');
  const assignments = entries.map(function (entry) {
    return quoteIdentifier(entry.column) + ' = source.' + quoteIdentifier(entry.column);
  }).join(', ');
  let after = null;
  let full = true;
  while (full) {
    const result = await client.query(
      'SELECT ' + selection + ' FROM ' + quoteIdentifier(table) + (after === null ? '' : ' WHERE "id" > $1') + ' ORDER BY "id" LIMIT ' + BATCH_SIZE,
      after === null ? [] : [after]
    );
    if (result.rows.length > 0) {
      const updates = result.rows.map(function (raw) {
        return evaluateRow(table, entries, types, decodeRow(table, result.fields, raw));
      });
      await client.query(
        'UPDATE ' + quoteIdentifier(table) + ' AS target SET ' + assignments + ' FROM json_to_recordset($1::json) AS source(' + targets + ') WHERE target."id" = source."id"',
        [JSON.stringify(updates)]
      );
      after = result.rows[result.rows.length - 1].id;
    }
    full = result.rows.length === BATCH_SIZE;
  }
}

async function applyBackfill(client, entries) {
  const byTable = new Map();
  for (const entry of entries) {
    const list = byTable.get(entry.table) || [];
    list.push(entry);
    byTable.set(entry.table, list);
  }
  for (const [table, list] of byTable) {
    await backfillTable(client, table, list);
  }
}

function versionSteps(version) {
  const steps = readdirSync(path.join(migrationsDir, version), { withFileTypes: true })
    .filter(function (entry) { return entry.isDirectory() && entry.name.startsWith('step-'); })
    .map(function (entry) { return entry.name; })
    .sort();
  if (steps.length === 0) {
    throw new Error('Migration ' + version + ' has no steps');
  }
  return steps;
}

function reconciliation(version) {
  const file = path.join(migrationsDir, version, 'reconcile.sql');
  return existsSync(file) ? readFileSync(file, 'utf-8') : '';
}

function lastStepUpkeep(version) {
  const steps = versionSteps(version);
  return readMigrationFile(version, path.join(steps[steps.length - 1], 'upkeep.sql'));
}

async function replayStep(client, version, step) {
  const backfill = JSON.parse(readMigrationFile(version, path.join(step, 'backfill.json')));
  await applySql(client, readMigrationFile(version, path.join(step, 'up.sql')));
  await applyBackfill(client, backfill.assignments);
  await applySql(client, readMigrationFile(version, path.join(step, 'finalize.sql')));
  await applySql(client, readMigrationFile(version, path.join(step, 'upkeep.sql')));
}

async function replayVersion(client, version) {
  for (const step of versionSteps(version)) {
    await replayStep(client, version, step);
  }
}

async function applyVersion(client, version) {
  console.log('Applying migration ' + version);
  await replayVersion(client, version);
  await client.query('INSERT INTO ' + MIGRATIONS_TABLE + ' ("version", "appliedAt") VALUES ($1, $2)', [
    version,
    new Date().toISOString(),
  ]);
}

async function replayLayout(client, versions) {
  await useSchema(client, LAYOUT_SCHEMA);
  for (const version of versions) {
    await replayVersion(client, version);
  }
}

function isBackup(name) {
  return name.startsWith(BACKUP_PREFIX);
}

function touchesBackup(columns) {
  return columns.some(isBackup);
}

function addEntry(catalog, table, entry) {
  const entries = catalog.get(table) || [];
  entries.push(entry);
  catalog.set(table, entries);
}

async function catalogOf(client, schema) {
  await useSchema(client, schema);
  const namespace = '(SELECT oid FROM pg_namespace WHERE nspname = $1)';
  const columns = await client.query(
    'SELECT relation.relname AS table, attribute.attname AS name, format_type(attribute.atttypid, attribute.atttypmod) AS type, attribute.attnotnull AS required, ' +
    'pg_get_expr(definition.adbin, definition.adrelid) AS fallback, attribute.attidentity::text AS identity, attribute.attgenerated::text AS generated ' +
    'FROM pg_attribute attribute JOIN pg_class relation ON relation.oid = attribute.attrelid ' +
    'LEFT JOIN pg_attrdef definition ON definition.adrelid = attribute.attrelid AND definition.adnum = attribute.attnum ' +
    "WHERE relation.relnamespace = " + namespace + " AND relation.relkind IN ('r', 'p') AND attribute.attnum > 0 AND NOT attribute.attisdropped",
    [schema]
  );
  const constraints = await client.query(
    'SELECT relation.relname AS table, entry.contype::text AS kind, pg_get_constraintdef(entry.oid) AS definition, ' +
    'ARRAY(SELECT attname::text FROM pg_attribute WHERE attrelid = entry.conrelid AND attnum = ANY (entry.conkey)) AS columns ' +
    'FROM pg_constraint entry JOIN pg_class relation ON relation.oid = entry.conrelid ' +
    "WHERE relation.relnamespace = " + namespace + " AND entry.contype <> 'n'",
    [schema]
  );
  const indexes = await client.query(
    "SELECT relation.relname AS table, replace(pg_get_indexdef(entry.indexrelid), ' ON ' || quote_ident($1::text) || '.', ' ON ') AS definition, " +
    'ARRAY(SELECT attname::text FROM pg_attribute WHERE attrelid = entry.indrelid AND attnum = ANY (entry.indkey::smallint[])) AS columns ' +
    'FROM pg_index entry JOIN pg_class relation ON relation.oid = entry.indrelid ' +
    'WHERE relation.relnamespace = ' + namespace,
    [schema]
  );
  const parentKeys = new Set();
  for (const row of constraints.rows) {
    if (row.kind === 'f') {
      for (const column of row.columns) {
        parentKeys.add(row.table + '.' + column);
      }
    }
  }
  const catalog = new Map();
  for (const row of columns.rows) {
    if (!isBackup(row.name)) {
      addEntry(catalog, row.table, 'column ' + quoteIdentifier(row.name) + ' ' + row.type +
        (row.fallback === null ? '' : ' DEFAULT ' + row.fallback) +
        (row.identity === '' ? '' : ' IDENTITY ' + row.identity) +
        (row.generated === '' ? '' : ' GENERATED ' + row.generated));
      if (!row.required && !parentKeys.has(row.table + '.' + row.name)) {
        addEntry(catalog, row.table, NULL_ADMISSION + quoteIdentifier(row.name));
      }
    }
  }
  for (const row of constraints.rows) {
    if (!touchesBackup(row.columns)) {
      addEntry(catalog, row.table, 'constraint ' + row.definition.replace(/ NOT VALID$/, ''));
    }
  }
  for (const row of indexes.rows) {
    if (!touchesBackup(row.columns)) {
      addEntry(catalog, row.table, 'index ' + row.definition);
    }
  }
  return catalog;
}

function isComparedTable(table) {
  return !isBackup(table) && table !== MIGRATIONS_TABLE && table !== SHAPE_TABLE;
}

function countEntries(entries) {
  const counts = new Map();
  for (const entry of entries) {
    counts.set(entry, (counts.get(entry) || 0) + 1);
  }
  return counts;
}

function entryDifferences(table, expected, live) {
  const differences = [];
  const liveCounts = countEntries(live);
  const expectedCounts = countEntries(expected);
  for (const [entry, count] of expectedCounts) {
    if ((liveCounts.get(entry) || 0) < count) {
      differences.push('"' + table + '" lacks ' + entry);
    }
  }
  for (const [entry, count] of liveCounts) {
    if ((expectedCounts.get(entry) || 0) < count) {
      differences.push('"' + table + '" has an unexpected ' + entry);
    }
  }
  return differences;
}

function layoutDifferences(required, expected, live) {
  const differences = [];
  for (const table of required) {
    if (!live.has(table)) {
      differences.push('table "' + table + '" is missing');
    }
  }
  for (const [table, entries] of expected) {
    if (isComparedTable(table) && live.has(table)) {
      differences.push(...entryDifferences(table, entries, live.get(table)));
    }
  }
  return differences;
}

async function verifyLayout(client, schema, version, stamped) {
  const required = Object.keys(JSON.parse(readMigrationFile(version, 'schema.json')));
  const expected = await catalogOf(client, LAYOUT_SCHEMA);
  const live = await catalogOf(client, schema);
  await useSchema(client, schema);
  const differences = layoutDifferences(required, expected, live);
  if (differences.length > 0) {
    const origin = stamped
      ? 'It was changed by hand or set up from a different release chain'
      : 'It records no layout version, so a package generated before layout versions were recorded set it up, or it was changed by hand';
    throw new Error(
      'The database does not match migration ' + version + ' of this package:\n  ' +
      differences.slice(0, REPORTED_DIFFERENCES).join('\n  ') +
      (differences.length > REPORTED_DIFFERENCES ? '\n  ... and ' + (differences.length - REPORTED_DIFFERENCES) + ' more' : '') + '\n' +
      origin + '. No migration is applied to it, and the database was not changed. ' +
      'See "When migrate refuses the database" in SELF-HOSTING.md.'
    );
  }
}

async function loadInitialData(client, applied) {
  if (!existsSync(dataFile)) {
    return;
  }
  if (applied.length === 0) {
    console.log('Loading data.sql');
    await applySql(client, readFileSync(dataFile, 'utf-8'));
  } else {
    console.log('Skipping data.sql: The database already holds data, and data.sql is only loaded into a new database.');
  }
}

async function currentSchema(client) {
  const result = await client.query('SELECT current_schema() AS name');
  return result.rows[0].name;
}

async function migrate(client) {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [MIGRATION_LOCK]);
  const schema = await currentSchema(client);
  await applySql(client, readFileSync(helpersFile, 'utf-8'));
  const versions = packageVersions();
  const applied = await appliedVersions(client);
  const appliedNumber = highestVersion(applied);
  requireKnownVersions(appliedNumber, versions);
  const shape = await recordedShape(client);
  requireKnownShape(shape);
  const history = versions.filter(function (version) { return versionNumber(version) <= appliedNumber; });
  const pending = versions.filter(function (version) { return versionNumber(version) > appliedNumber; });
  await client.query('CREATE SCHEMA ' + quoteIdentifier(LAYOUT_SCHEMA));
  if (appliedNumber > 0) {
    const current = packageVersionAt(versions, appliedNumber);
    await replayLayout(client, history);
    await useSchema(client, schema);
    for (const conversion of pendingConversions(shape)) {
      await applySql(client, readMigrationFile(current, conversion));
    }
    await applySql(client, lastStepUpkeep(current));
    await applySql(client, reconciliation(current));
    await verifyLayout(client, schema, current, shape !== null);
  }
  if (pending.length > 0) {
    await useSchema(client, schema);
    for (const version of pending) {
      await applyVersion(client, version);
    }
    await loadInitialData(client, applied);
    await replayLayout(client, pending);
    await verifyLayout(client, schema, versions[versions.length - 1], true);
  }
  await client.query('DROP SCHEMA ' + quoteIdentifier(LAYOUT_SCHEMA) + ' CASCADE');
  await useSchema(client, schema);
  await stampShape(client);
  return pending.length;
}

async function run() {
  const client = new pg.Client({ connectionString: loadDatabaseUrl() });
  await client.connect();
  try {
    await client.query('BEGIN');
    const applied = await migrate(client);
    await client.query('COMMIT');
    console.log(applied === 0 ? 'Database already up to date.' : 'Applied ' + applied + ' migration(s).');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

run().catch(function (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
