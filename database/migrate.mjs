import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(scriptDir, 'migrations');
const dataFile = path.join(scriptDir, 'data.sql');
const upkeepFile = path.join(scriptDir, 'platform-upkeep.sql');

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

function asString(value) {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asInteger(value) {
  return typeof value === 'number' ? Math.trunc(value) : 0;
}

function identityOf(value) {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return typeof value + ':' + String(value);
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value) && typeof value.id === 'string') {
    return 'id:' + value.id;
  }
  return 'value:' + JSON.stringify(value);
}

function distinct(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const key = identityOf(value);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(value);
    }
  }
  return result;
}

function applyMethod(op, value, args) {
  switch (op) {
    case 'before': {
      const text = asString(value);
      const index = text.indexOf(asString(args[0]));
      return index < 0 ? text : text.slice(0, index);
    }
    case 'after': {
      const text = asString(value);
      const separator = asString(args[0]);
      const index = text.indexOf(separator);
      return index < 0 ? '' : text.slice(index + separator.length);
    }
    case 'substring':
      return asString(value).slice(asInteger(args[0]), asInteger(args[0]) + asInteger(args[1]));
    case 'lowercase':
      return asString(value).toLowerCase();
    case 'uppercase':
      return asString(value).toUpperCase();
    case 'split': {
      const text = asString(value);
      return text === '' ? [] : text.split(asString(args[0]));
    }
    case 'join':
      return asArray(value).map(function (element) { return asString(element); }).join(asString(args[0]));
    case 'length':
      return typeof value === 'string' ? value.length : asArray(value).length;
    case 'take':
      return asArray(value).slice(0, asInteger(args[0]));
    case 'drop':
      return asArray(value).slice(asInteger(args[0]));
    case 'slice':
      return asArray(value).slice(asInteger(args[0]), asInteger(args[0]) + asInteger(args[1]));
    case 'reverse':
      return asArray(value).slice().reverse();
    case 'distinct':
      return distinct(asArray(value));
    default:
      throw new Error('Unknown migration method: ' + op);
  }
}

function requireNumber(value) {
  if (typeof value === 'number') {
    return value;
  }
  throw new Error('Numeric operand expected');
}

function isUnset(value) {
  return value === null || value === undefined || value === '';
}

function compareKeys(left, right) {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }
  if (typeof left === 'boolean' && typeof right === 'boolean') {
    return Number(left) - Number(right);
  }
  const leftText = String(left);
  const rightText = String(right);
  if (leftText < rightText) {
    return -1;
  }
  return leftText > rightText ? 1 : 0;
}

function compareIdentity(left, right) {
  if (typeof left === 'object' || typeof right === 'object') {
    return compareKeys(identityOf(left), identityOf(right));
  }
  return compareKeys(left, right);
}

function compareKeyed(left, right, descending) {
  const leftUnset = isUnset(left.key);
  const rightUnset = isUnset(right.key);
  if (leftUnset !== rightUnset) {
    return leftUnset ? 1 : -1;
  }
  const byKey = leftUnset ? 0 : compareKeys(left.key, right.key);
  if (byKey !== 0) {
    return descending ? -byKey : byKey;
  }
  return compareIdentity(left.element, right.element);
}

function orderByKey(entries, descending) {
  return entries
    .slice()
    .sort(function (left, right) { return compareKeyed(left, right, descending); })
    .map(function (entry) { return entry.element; });
}

function extendScope(scope, name, value) {
  const next = Object.assign({}, scope);
  next[name] = value;
  return next;
}

function applyConvert(target, operand) {
  switch (target) {
    case 'integer':
      return Math.trunc(requireNumber(operand));
    case 'decimal':
      return requireNumber(operand);
    case 'string':
      if (typeof operand === 'string') {
        return operand;
      }
      if (typeof operand === 'number' || typeof operand === 'boolean') {
        return String(operand);
      }
      return '';
    default:
      throw new Error('Unknown convert target: ' + target);
  }
}

function applyBinary(op, left, right) {
  switch (op) {
    case 'and':
      return Boolean(left) && Boolean(right);
    case 'or':
      return Boolean(left) || Boolean(right);
    case '==':
      return left === right;
    case '!=':
      return left !== right;
    case '<':
      return requireNumber(left) < requireNumber(right);
    case '<=':
      return requireNumber(left) <= requireNumber(right);
    case '>':
      return requireNumber(left) > requireNumber(right);
    case '>=':
      return requireNumber(left) >= requireNumber(right);
    case '+':
      if (typeof left === 'string' && typeof right === 'string') {
        return left + right;
      }
      return requireNumber(left) + requireNumber(right);
    case '-':
      return requireNumber(left) - requireNumber(right);
    case '*':
      return requireNumber(left) * requireNumber(right);
    case '/': {
      const divisor = requireNumber(right);
      if (divisor === 0) {
        throw new Error('Division by zero');
      }
      return requireNumber(left) / divisor;
    }
    case 'modulo': {
      const divisor = requireNumber(right);
      if (divisor === 0) {
        throw new Error('Modulo by zero');
      }
      return requireNumber(left) % divisor;
    }
    default:
      throw new Error('Unsupported migration operator: ' + op);
  }
}

function evaluate(expr, row, scope) {
  switch (expr.kind) {
    case 'ref':
      if (expr.name in scope) {
        return scope[expr.name] === undefined ? null : scope[expr.name];
      }
      return row[expr.name] === undefined ? null : row[expr.name];
    case 'integer':
    case 'decimal':
    case 'string':
    case 'boolean':
      return expr.value;
    case 'convert':
      return applyConvert(expr.target, evaluate(expr.operand, row, scope));
    case 'binary':
      return applyBinary(expr.op, evaluate(expr.left, row, scope), evaluate(expr.right, row, scope));
    case 'unary': {
      const operand = evaluate(expr.operand, row, scope);
      if (expr.op === 'not') {
        return !operand;
      }
      if (expr.op === '-') {
        return -requireNumber(operand);
      }
      return requireNumber(operand);
    }
    case 'conditional':
      return evaluate(expr.condition, row, scope)
        ? evaluate(expr.then, row, scope)
        : evaluate(expr.else, row, scope);
    case 'method':
      return applyMethod(
        expr.op,
        evaluate(expr.value, row, scope),
        expr.arguments.map(function (argument) { return evaluate(argument, row, scope); })
      );
    case 'field': {
      const object = evaluate(expr.object, row, scope);
      if (object === null || typeof object !== 'object') {
        throw new Error(
          `Migration transform cannot read '${expr.field}': the value it reads from is an id or a scalar, not a record`
        );
      }
      return object[expr.field] === undefined ? null : object[expr.field];
    }
    case 'record': {
      const result = {};
      for (const name of Object.keys(expr.fields)) {
        result[name] = evaluate(expr.fields[name], row, scope);
      }
      return result;
    }
    case 'map': {
      let elements = asArray(evaluate(expr.source, row, scope));
      if (expr.predicate !== null) {
        elements = elements.filter(function (element) {
          return evaluate(expr.predicate, row, extendScope(scope, expr.variable, element));
        });
      }
      if (expr.order !== null) {
        const keyed = elements.map(function (element) {
          return { element: element, key: evaluate(expr.order.key, row, extendScope(scope, expr.variable, element)) };
        });
        elements = orderByKey(keyed, expr.order.descending);
      }
      return elements.map(function (element) {
        return evaluate(expr.body, row, extendScope(scope, expr.variable, element));
      });
    }
    case 'group': {
      let elements = asArray(evaluate(expr.source, row, scope));
      if (expr.predicate !== null) {
        elements = elements.filter(function (element) {
          return evaluate(expr.predicate, row, extendScope(scope, expr.variable, element));
        });
      }
      const groups = new Map();
      for (const element of elements) {
        const key = evaluate(expr.key, row, extendScope(scope, expr.variable, element));
        const id = identityOf(key);
        const group = groups.get(id);
        if (group === undefined) {
          groups.set(id, { key: key, items: [element] });
        } else {
          group.items.push(element);
        }
      }
      return Array.from(groups.values());
    }
    case 'flatten': {
      const source = asArray(evaluate(expr.source, row, scope));
      const result = [];
      for (const inner of source) {
        for (const element of asArray(inner)) {
          result.push(element);
        }
      }
      return result;
    }
    case 'zip': {
      const first = asArray(evaluate(expr.first, row, scope));
      const second = asArray(evaluate(expr.second, row, scope));
      const result = [];
      const length = Math.min(first.length, second.length);
      for (let index = 0; index < length; index++) {
        result.push({ first: first[index], second: second[index] });
      }
      return result;
    }
    case 'concat':
      return asArray(evaluate(expr.first, row, scope)).concat(asArray(evaluate(expr.second, row, scope)));
    default:
      throw new Error('Unsupported migration expression: ' + String(expr.kind));
  }
}

function toColumnValue(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value !== null && typeof value === 'object') {
    return JSON.stringify(value);
  }
  return value;
}

function quoteIdentifier(name) {
  return '"' + name.replace(/"/g, '""') + '"';
}

const DATE_TYPE_ID = 1082;
const NUMERIC_TYPE_IDS = new Set([20, 1700]);

function pad(value) {
  return value < 10 ? '0' + value : String(value);
}

function toDateOnly(date) {
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
}

function decodeCell(dataTypeId, raw) {
  if (raw instanceof Date) {
    return dataTypeId === DATE_TYPE_ID ? toDateOnly(raw) : raw.toISOString();
  }
  if (typeof raw === 'string' && NUMERIC_TYPE_IDS.has(dataTypeId)) {
    return Number(raw);
  }
  return raw;
}

function decodeRow(fields, raw) {
  const decoded = {};
  for (const field of fields) {
    decoded[field.name] = decodeCell(field.dataTypeID, raw[field.name]);
  }
  return decoded;
}

async function applyBackfill(client, entries) {
  const byTable = new Map();
  for (const entry of entries) {
    const list = byTable.get(entry.table) || [];
    list.push(entry);
    byTable.set(entry.table, list);
  }
  for (const [table, list] of byTable) {
    const result = await client.query('SELECT * FROM ' + quoteIdentifier(table));
    for (const raw of result.rows) {
      const row = decodeRow(result.fields, raw);
      const assignments = [];
      const values = [];
      for (const entry of list) {
        values.push(toColumnValue(evaluate(entry.expression, row, {})));
        assignments.push(quoteIdentifier(entry.column) + ' = $' + values.length);
      }
      values.push(row.id);
      await client.query(
        'UPDATE ' + quoteIdentifier(table) + ' SET ' + assignments.join(', ') + ' WHERE "id" = $' + values.length,
        values
      );
    }
  }
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

async function appliedVersions(client) {
  await client.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations ("version" text PRIMARY KEY, "appliedAt" timestamptz NOT NULL)'
  );
  const result = await client.query('SELECT version FROM schema_migrations ORDER BY version');
  return result.rows.map(function (entry) { return entry.version; });
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

function requireKnownVersions(applied, versions) {
  const appliedNumber = highestVersion(applied);
  if (appliedNumber > highestVersion(versions)) {
    throw new Error(
      'The database is at release ' + appliedNumber + ', which is newer than this package. ' +
      'Apply that release or a later one.'
    );
  }
}

async function liveLayout(client) {
  const result = await client.query(
    'SELECT table_name, column_name, udt_name FROM information_schema.columns WHERE table_schema = current_schema()'
  );
  const layout = {};
  for (const row of result.rows) {
    const columns = layout[row.table_name] || {};
    columns[row.column_name] = row.udt_name;
    layout[row.table_name] = columns;
  }
  return layout;
}

function layoutDifferences(expected, live) {
  const differences = [];
  for (const table of Object.keys(expected)) {
    const liveColumns = live[table];
    if (liveColumns === undefined) {
      differences.push('table "' + table + '" is missing');
    } else {
      for (const column of Object.keys(expected[table])) {
        const expectedType = expected[table][column];
        const liveType = liveColumns[column];
        if (liveType === undefined) {
          differences.push('column "' + table + '"."' + column + '" is missing');
        } else if (liveType !== expectedType) {
          differences.push('column "' + table + '"."' + column + '" is ' + liveType + ', expected ' + expectedType);
        }
      }
    }
  }
  return differences;
}

async function verifyLayout(client, version) {
  const expected = JSON.parse(readMigrationFile(version, 'schema.json'));
  const differences = layoutDifferences(expected, await liveLayout(client));
  if (differences.length > 0) {
    throw new Error(
      'The database does not match migration ' + version + ':\n  ' + differences.join('\n  ') + '\n' +
      'It was not set up from this release chain, or its schema was changed by hand, so no migration can be applied to it. ' +
      'Restore a database that matches, or set up a fresh one.'
    );
  }
}

async function applySql(client, sql) {
  if (sql.trim() !== '') {
    await client.query(sql);
  }
}

async function applyVersion(client, version) {
  console.log('Applying migration ' + version);
  await applySql(client, readMigrationFile(version, 'up.sql'));
  await applyBackfill(client, JSON.parse(readMigrationFile(version, 'backfill.json')));
  await applySql(client, readMigrationFile(version, 'finalize.sql'));
  await client.query('INSERT INTO schema_migrations ("version", "appliedAt") VALUES ($1, $2)', [
    version,
    new Date().toISOString(),
  ]);
}

async function loadInitialData(client) {
  if (existsSync(dataFile)) {
    console.log('Loading data.sql');
    await applySql(client, readFileSync(dataFile, 'utf-8'));
  }
}

async function applyPending(client, versions, applied, pending) {
  await client.query('BEGIN');
  try {
    for (const version of pending) {
      await applyVersion(client, version);
    }
    if (applied.length === 0) {
      await loadInitialData(client);
    }
    await applySql(client, readFileSync(upkeepFile, 'utf-8'));
    await verifyLayout(client, versions[versions.length - 1]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function run() {
  const client = new pg.Client({ connectionString: loadDatabaseUrl() });
  await client.connect();
  try {
    const versions = packageVersions();
    const applied = await appliedVersions(client);
    requireKnownVersions(applied, versions);
    const appliedNumber = highestVersion(applied);
    if (appliedNumber > 0) {
      await verifyLayout(client, packageVersionAt(versions, appliedNumber));
    }
    const pending = versions.filter(function (version) { return versionNumber(version) > appliedNumber; });
    await applyPending(client, versions, applied, pending);
    console.log(pending.length === 0 ? 'Database already up to date.' : 'Applied ' + pending.length + ' migration(s).');
  } finally {
    await client.end();
  }
}

run().catch(function (error) {
  console.error(error);
  process.exit(1);
});
