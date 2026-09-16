import type { Pool } from 'pg';
import { MANAGEMENT_ROLES, ROW_POLICIES } from './access-policy.js';
import type { RowGrant, RowParent, RowPolicy } from './access-policy.js';
import type { Queryable } from './db.js';

export async function loadUserRoles(pool: Pool, userId: string): Promise<string[]> {
  const { rows } = await pool.query(
    'SELECT r.id FROM "app_role" r INNER JOIN "app_user_role" ur ON ur."roleId" = r.id WHERE ur."userId" = $1 ORDER BY r.id ASC',
    [userId]
  );
  return rows
    .map((row: Record<string, unknown>) => row['id'])
    .filter((id: unknown): id is string => typeof id === 'string');
}

export async function getAssignedUserRoles(pool: Pool, userId: string): Promise<string[]> {
  const roles = await loadUserRoles(pool, userId);
  return roles.length === 0 ? ['unassigned'] : roles;
}

export async function getEffectiveUserRoles(pool: Pool, userId: string): Promise<string[]> {
  const assigned = await getAssignedUserRoles(pool, userId);
  return assigned.includes('guest') ? assigned : [...assigned, 'guest'];
}

export function hasAppAccess(roles: string[]): boolean {
  return roles.some((role) => role !== 'guest' && role !== 'unassigned');
}

export function isAdmin(roles: string[]): boolean {
  return roles.includes('admin');
}

export function hasAnyRole(roles: string[], granted: string[]): boolean {
  return granted.some((role) => roles.includes(role));
}

export function hasManagementAccess(roles: string[]): boolean {
  return isAdmin(roles) || hasAnyRole(roles, MANAGEMENT_ROLES);
}

type Row = Record<string, unknown>;

export type GrantOperation = 'read' | 'create' | 'update' | 'delete';

export type AdmittedColumns = Set<string> | null | 'denied';

export type RowColumns = Map<string, Set<string> | null>;

export interface Caller {
  userId: string | null;
  roles: string[];
}

export interface AdmittedRow {
  row: Row;
  columns: Set<string> | null;
}

export interface WrittenRow {
  row: Row;
}

export interface WriteRefusal {
  status: number;
  error: string;
}

export type WriteOutcome = WrittenRow | WriteRefusal;

export const OWNED_COLUMN = '__owned';

function rowPolicy(path: string): RowPolicy {
  const policy = ROW_POLICIES[path];
  if (policy === undefined) {
    throw new Error(`No access policy governs '${path}'`);
  }
  return policy;
}

function parentOf(path: string): RowParent {
  const { parent } = rowPolicy(path);
  if (parent === null) {
    throw new Error(`'${path}' is no nested collection`);
  }
  return parent;
}

function matchingGrants(path: string, operation: GrantOperation, roles: string[]): RowGrant[] {
  const matching: RowGrant[] = [];
  for (const grant of rowPolicy(path)[operation]) {
    if (roles.includes(grant.role)) {
      matching.push(grant);
    }
  }
  return matching;
}

function isUnrestricted(grant: RowGrant): boolean {
  return grant.scope === 'all' && grant.where === null;
}

function unrestricted(path: string, operation: GrantOperation, roles: string[]): boolean {
  if (isAdmin(roles)) {
    return true;
  }
  for (const grant of matchingGrants(path, operation, roles)) {
    if (isUnrestricted(grant)) {
      return true;
    }
  }
  return false;
}

function selfContained(grants: RowGrant[]): boolean {
  for (const grant of grants) {
    if (grant.owner !== null || grant.where !== null) {
      return true;
    }
  }
  return false;
}

function wholeRecord(path: string, roles: string[]): boolean {
  return isAdmin(roles) || rowPolicy(path).individual;
}

export function hasGrant(path: string, operation: GrantOperation, roles: string[]): boolean {
  return isAdmin(roles) || matchingGrants(path, operation, roles).length > 0;
}

export function sqlParameter(values: unknown[], value: unknown): string {
  values.push(value);
  return `$${values.length}`;
}

function anyOf(clauses: string[]): string {
  if (clauses.length === 0) {
    return 'FALSE';
  }
  return clauses.length === 1 ? clauses[0] : `(${clauses.join(' OR ')})`;
}

export function conditions(clauses: Array<string | null>): string[] {
  const present: string[] = [];
  for (const clause of clauses) {
    if (clause !== null) {
      present.push(clause);
    }
  }
  return present;
}

export function whereClause(clauses: Array<string | null>): string {
  const present = conditions(clauses);
  return present.length === 0 ? '' : ` WHERE ${present.join(' AND ')}`;
}

function valueScopeClause(
  where: Record<string, string | boolean>,
  alias: string,
  values: unknown[]
): string {
  const comparisons: string[] = [];
  for (const [column, value] of Object.entries(where)) {
    comparisons.push(`${alias}."${column}" = ${sqlParameter(values, value)}`);
  }
  return `(${comparisons.join(' AND ')})`;
}

function membershipClause(
  policy: RowPolicy,
  userId: string,
  alias: string,
  values: unknown[]
): string {
  return policy.membership === null
    ? 'FALSE'
    : policy.membership(alias, sqlParameter(values, userId));
}

function recordOwnership(
  path: string,
  userId: string,
  roles: string[],
  alias: string,
  values: unknown[]
): string {
  const clauses: string[] = [];
  let plainOwn = false;
  for (const grant of matchingGrants(path, 'read', roles)) {
    if (grant.scope === 'own' && grant.owner !== null) {
      clauses.push(grant.owner(alias, sqlParameter(values, userId)));
    } else if (grant.scope === 'own') {
      plainOwn = true;
    }
  }
  if (clauses.length === 0 || plainOwn) {
    clauses.push(membershipClause(rowPolicy(path), userId, alias, values));
  }
  return anyOf(clauses);
}

function plainOwnership(
  path: string,
  userId: string,
  roles: string[],
  alias: string,
  values: unknown[]
): string {
  const policy = rowPolicy(path);
  const { parent } = policy;
  if (parent === null) {
    return membershipClause(policy, userId, alias, values);
  }
  if (rowPolicy(parent.path).parent !== null) {
    throw new Error(`Ownership of '${path}' rows is resolved through its top-level record only`);
  }
  const parentAlias = `${alias}_parent`;
  return `EXISTS (SELECT 1 FROM "${parent.table}" ${parentAlias} WHERE ${parentAlias}.id = ${parent.key(alias)} AND ${recordOwnership(parent.path, userId, roles, parentAlias, values)})`;
}

export function ownershipClause(
  path: string,
  operation: GrantOperation,
  caller: Caller,
  alias: string,
  values: unknown[]
): string {
  const { userId, roles } = caller;
  if (userId === null) {
    return 'FALSE';
  }
  const clauses: string[] = [];
  for (const grant of matchingGrants(path, operation, roles)) {
    if (grant.scope === 'own') {
      clauses.push(
        grant.owner === null
          ? plainOwnership(path, userId, roles, alias, values)
          : grant.owner(alias, sqlParameter(values, userId))
      );
    }
  }
  return anyOf(clauses);
}

export function ownedColumn(
  path: string,
  operation: GrantOperation,
  caller: Caller,
  alias: string,
  values: unknown[]
): string {
  return `COALESCE(${ownershipClause(path, operation, caller, alias, values)}, FALSE) AS "${OWNED_COLUMN}"`;
}

export function admissionClause(
  path: string,
  operation: GrantOperation,
  caller: Caller,
  alias: string,
  values: unknown[]
): string | null {
  if (unrestricted(path, operation, caller.roles)) {
    return null;
  }
  const grants = matchingGrants(path, operation, caller.roles);
  if (rowPolicy(path).parent !== null && !selfContained(grants)) {
    return null;
  }
  const owned = ownershipClause(path, operation, caller, alias, values);
  const clauses = owned === 'FALSE' ? [] : [owned];
  for (const grant of grants) {
    if (grant.scope === 'all' && grant.where !== null) {
      clauses.push(valueScopeClause(grant.where, alias, values));
    }
  }
  return anyOf(clauses);
}

export function parentAdmissionClause(
  path: string,
  operation: GrantOperation,
  caller: Caller,
  alias: string,
  values: unknown[]
): string | null {
  const parent = parentOf(path);
  const { userId, roles } = caller;
  if (!unrestricted(path, operation, roles)) {
    if (selfContained(matchingGrants(path, operation, roles))) {
      return null;
    }
    return userId === null ? 'FALSE' : recordOwnership(parent.path, userId, roles, alias, values);
  }
  const parentGrants = matchingGrants(parent.path, 'read', roles);
  if (unrestricted(parent.path, 'read', roles) || parentGrants.length === 0) {
    return null;
  }
  const clauses: string[] = [];
  for (const grant of parentGrants) {
    if (grant.scope === 'all' && grant.where !== null) {
      clauses.push(valueScopeClause(grant.where, alias, values));
    }
  }
  if (userId !== null) {
    clauses.push(recordOwnership(parent.path, userId, roles, alias, values));
  }
  return anyOf(clauses);
}

export async function parentAdmitted(
  client: Queryable,
  path: string,
  operation: GrantOperation,
  caller: Caller,
  parentId: string
): Promise<boolean> {
  const parent = parentOf(path);
  const values: unknown[] = [parentId];
  const clause = parentAdmissionClause(path, operation, caller, 'r', values);
  if (clause === null) {
    return true;
  }
  const { rows } = await client.query<Row>(
    `SELECT 1 FROM "${parent.table}" r WHERE r.id = $1 AND ${clause}`,
    values
  );
  return rows.length > 0;
}

function rowInValueScope(row: Row, where: Record<string, string | boolean> | null): boolean {
  if (where === null) {
    return true;
  }
  for (const [column, value] of Object.entries(where)) {
    if (row[column] !== value) {
      return false;
    }
  }
  return true;
}

function grantedColumns(grants: RowGrant[], operation: GrantOperation): Set<string> | null {
  const columns = new Set<string>();
  for (const grant of grants) {
    if (grant.fields === null) {
      return null;
    }
    for (const field of grant.fields) {
      columns.add(field);
    }
    if (operation === 'read' && grant.where !== null) {
      for (const column of Object.keys(grant.where)) {
        columns.add(column);
      }
    }
  }
  return columns;
}

export function admittedColumns(
  path: string,
  operation: GrantOperation,
  roles: string[],
  row: Row,
  owned: boolean
): AdmittedColumns {
  if (wholeRecord(path, roles)) {
    return null;
  }
  const admitting: RowGrant[] = [];
  for (const grant of matchingGrants(path, operation, roles)) {
    if (grant.scope === 'all' ? rowInValueScope(row, grant.where) : owned) {
      admitting.push(grant);
    }
  }
  return admitting.length === 0 ? 'denied' : grantedColumns(admitting, operation);
}

export function readColumns(
  path: string,
  roles: string[],
  row: Row,
  owned: boolean
): Set<string> | null {
  const columns = admittedColumns(path, 'read', roles, row, owned);
  return columns === 'denied' ? new Set<string>() : columns;
}

export function readableFieldSet(path: string, roles: string[]): Set<string> | null {
  return wholeRecord(path, roles)
    ? null
    : grantedColumns(matchingGrants(path, 'read', roles), 'read');
}

export function readableFieldSetAllScope(path: string, roles: string[]): Set<string> | null {
  if (wholeRecord(path, roles)) {
    return null;
  }
  const grants: RowGrant[] = [];
  for (const grant of matchingGrants(path, 'read', roles)) {
    if (isUnrestricted(grant)) {
      grants.push(grant);
    }
  }
  return grantedColumns(grants, 'read');
}

export function queryableFieldSet(path: string, roles: string[]): Set<string> | null {
  if (wholeRecord(path, roles)) {
    return null;
  }
  const grants = matchingGrants(path, 'read', roles);
  const allScope: RowGrant[] = [];
  for (const grant of grants) {
    if (grant.scope === 'all') {
      allScope.push(grant);
    }
  }
  return grantedColumns(allScope.length > 0 ? allScope : grants, 'read');
}

export function writableFieldSet(path: string, roles: string[]): Set<string> | null {
  return wholeRecord(path, roles)
    ? null
    : grantedColumns(matchingGrants(path, 'update', roles), 'update');
}

export function creatableFieldSet(path: string, roles: string[]): Set<string> | null {
  return wholeRecord(path, roles)
    ? null
    : grantedColumns(matchingGrants(path, 'create', roles), 'create');
}

export function unwritableField(
  path: string,
  roles: string[],
  row: Row,
  owned: boolean,
  body: Row
): string | null {
  const columns = admittedColumns(path, 'update', roles, row, owned);
  if (columns === null) {
    return null;
  }
  for (const key of Object.keys(body)) {
    if (columns === 'denied' || !columns.has(key)) {
      return key;
    }
  }
  return null;
}

export function projectReadableFields(row: Row, readable: Set<string> | null): Row {
  const result: Row = {};
  for (const [key, value] of Object.entries(row)) {
    if (
      key !== OWNED_COLUMN &&
      (readable === null || key === 'id' || key === '_frozen' || readable.has(key))
    ) {
      result[key] = value;
    }
  }
  return result;
}

export function ownedFlag(row: Row): boolean {
  const owned = row[OWNED_COLUMN];
  if (typeof owned !== 'boolean') {
    throw new Error('A row read under the access gate carries no ownership flag');
  }
  return owned;
}

export function admitRows(
  path: string,
  operation: GrantOperation,
  roles: string[],
  rows: Row[]
): RowColumns {
  const columns: RowColumns = new Map();
  for (const row of rows) {
    const admitted = admittedColumns(path, operation, roles, row, ownedFlag(row));
    if (admitted === 'denied') {
      throw new Error(`A row of '${path}' passed the access gate without an admitting grant`);
    }
    columns.set(String(row.id), admitted);
  }
  return columns;
}

export function projectRows(rows: Row[], columns: RowColumns): Row[] {
  const projected: Row[] = [];
  for (const row of rows) {
    const admitted = columns.get(String(row.id));
    if (admitted === undefined) {
      throw new Error('A row lost its admission while it was enriched');
    }
    projected.push(projectReadableFields(row, admitted));
  }
  return projected;
}

export function projectRow(row: Row, columns: RowColumns): Row {
  const [projected] = projectRows([row], columns);
  return projected;
}

function writtenRowSource(path: string, parentId: string | null, values: unknown[]): string {
  const policy = rowPolicy(path);
  const { parent } = policy;
  if (parent === null && parentId === null) {
    return `"${policy.table}" f WHERE f.id = $1`;
  }
  if (parent === null || parentId === null) {
    throw new Error(`A written row of '${path}' is located without its parent`);
  }
  return `${parent.source('f')} WHERE f.id = $1 AND ${parent.key('f')} = ${sqlParameter(values, parentId)}`;
}

export async function writtenColumns(
  client: Queryable,
  path: string,
  caller: Caller,
  row: Row,
  parentId: string | null
): Promise<Set<string> | null> {
  if (wholeRecord(path, caller.roles)) {
    return null;
  }
  const values: unknown[] = [row.id];
  const source = writtenRowSource(path, parentId, values);
  const ownership = ownershipClause(path, 'read', caller, 'f', values);
  if (ownership === 'FALSE') {
    return readColumns(path, caller.roles, row, false);
  }
  const { rows } = await client.query<Row>(
    `SELECT COALESCE(${ownership}, FALSE) AS "${OWNED_COLUMN}" FROM ${source}`,
    values
  );
  if (rows.length === 0) {
    throw new Error(`The written row of '${path}' is gone`);
  }
  return readColumns(path, caller.roles, row, ownedFlag(rows[0]));
}

function storesFile(stored: unknown, fileId: string): boolean {
  return Array.isArray(stored) ? stored.includes(fileId) : stored === fileId;
}

export function rowsExposeFile(
  path: string,
  roles: string[],
  rows: Row[],
  fileFields: string[],
  fileId: string
): boolean {
  for (const row of rows) {
    const admitted = admittedColumns(path, 'read', roles, row, ownedFlag(row));
    if (admitted === 'denied') {
      throw new Error(`A row of '${path}' passed the access gate without an admitting grant`);
    }
    for (const field of fileFields) {
      if (storesFile(row[field], fileId) && (admitted === null || admitted.has(field))) {
        return true;
      }
    }
  }
  return false;
}

async function ownedRowIds(
  client: Queryable,
  path: string,
  caller: Caller,
  rows: Row[]
): Promise<Set<string>> {
  const owned = new Set<string>();
  const policy = rowPolicy(path);
  if (policy.parent !== null || rows.length === 0 || wholeRecord(path, caller.roles)) {
    return owned;
  }
  const ids: string[] = [];
  for (const row of rows) {
    ids.push(String(row.id));
  }
  const values: unknown[] = [ids];
  const clause = ownershipClause(path, 'read', caller, 'f', values);
  if (clause === 'FALSE') {
    return owned;
  }
  const result = await client.query<Row>(
    `SELECT f.id FROM "${policy.table}" f WHERE f.id = ANY($1) AND ${clause}`,
    values
  );
  for (const row of result.rows) {
    owned.add(String(row.id));
  }
  return owned;
}

export interface CallPermission {
  role: string;
  target: string | null;
  scope: 'all' | 'own';
}

export interface RecordParameter {
  name: string;
  path: string;
  table: string;
}

async function recordMatches(
  client: Queryable,
  path: string,
  clause: string,
  values: unknown[]
): Promise<boolean> {
  const { rows } = await client.query<Row>(
    `SELECT 1 FROM "${rowPolicy(path).table}" f WHERE f.id = $1 AND ${clause}`,
    values
  );
  return rows.length > 0;
}

function callerMayReadRecord(
  client: Queryable,
  path: string,
  caller: Caller,
  recordId: string
): Promise<boolean> {
  const { userId, roles } = caller;
  if (unrestricted(path, 'read', roles)) {
    return Promise.resolve(true);
  }
  if (!hasGrant(path, 'read', roles)) {
    return Promise.resolve(false);
  }
  const values: unknown[] = [recordId];
  const clauses: string[] = [];
  for (const grant of matchingGrants(path, 'read', roles)) {
    if (grant.scope === 'all' && grant.where !== null) {
      clauses.push(valueScopeClause(grant.where, 'f', values));
    }
  }
  if (userId !== null) {
    clauses.push(recordOwnership(path, userId, roles, 'f', values));
  }
  return recordMatches(client, path, anyOf(clauses), values);
}

function callerOwnsRecord(
  client: Queryable,
  path: string,
  caller: Caller,
  recordId: string
): Promise<boolean> {
  const { userId, roles } = caller;
  if (userId === null) {
    return Promise.resolve(false);
  }
  const values: unknown[] = [recordId];
  return recordMatches(client, path, recordOwnership(path, userId, roles, 'f', values), values);
}

function recordIds(parameters: RecordParameter[], table: string, body: Row): string[] {
  const ids: string[] = [];
  for (const parameter of parameters) {
    const value = body[parameter.name];
    if (parameter.table === table && typeof value === 'string' && value !== '') {
      ids.push(value);
    }
  }
  return ids;
}

async function unreadableParameter(
  client: Queryable,
  caller: Caller,
  granted: CallPermission[],
  parameters: RecordParameter[],
  body: Row
): Promise<string | null> {
  const covered = new Set<string>();
  for (const permission of granted) {
    if (permission.target !== null) {
      covered.add(rowPolicy(permission.target.split('.')[0]).table);
    }
  }
  for (const parameter of parameters) {
    const value = body[parameter.name];
    if (
      !covered.has(parameter.table) &&
      typeof value === 'string' &&
      value !== '' &&
      !(await callerMayReadRecord(client, parameter.path, caller, value))
    ) {
      return parameter.name;
    }
  }
  return null;
}

async function ownsCallTargets(
  client: Queryable,
  caller: Caller,
  granted: CallPermission[],
  parameters: RecordParameter[],
  body: Row
): Promise<boolean> {
  const targets = new Set<string>();
  for (const permission of granted) {
    if (permission.target !== null) {
      targets.add(permission.target);
    }
  }
  for (const target of targets) {
    let grantsAll = false;
    for (const permission of granted) {
      grantsAll ||= permission.target === target && permission.scope === 'all';
    }
    const root = target.split('.')[0];
    const ids = recordIds(parameters, rowPolicy(root).table, body);
    if (!grantsAll && ids.length === 0) {
      return false;
    }
    for (const id of grantsAll ? [] : ids) {
      if (!(await callerOwnsRecord(client, root, caller, id))) {
        return false;
      }
    }
  }
  return true;
}

export async function refuseCall(
  client: Queryable,
  caller: Caller,
  permissions: CallPermission[],
  parameters: RecordParameter[],
  body: Row
): Promise<string | null> {
  if (isAdmin(caller.roles)) {
    return null;
  }
  const granted: CallPermission[] = [];
  for (const permission of permissions) {
    if (caller.roles.includes(permission.role)) {
      granted.push(permission);
    }
  }
  if (granted.length === 0) {
    return 'Insufficient permissions to call this transaction';
  }
  const unreadable = await unreadableParameter(client, caller, granted, parameters, body);
  if (unreadable !== null) {
    return `Insufficient permissions to read parameter '${unreadable}'`;
  }
  for (const permission of granted) {
    if (permission.target === null) {
      return null;
    }
  }
  const owned = await ownsCallTargets(client, caller, granted, parameters, body);
  return owned ? null : 'Insufficient permissions to call this transaction';
}

export async function admitDerivedRows(
  client: Queryable,
  path: string,
  value: unknown,
  caller: Caller
): Promise<AdmittedRow[]> {
  if (!Array.isArray(value)) {
    throw new Error(`The derived rows of '${path}' are no list`);
  }
  if (!hasGrant(path, 'read', caller.roles)) {
    return [];
  }
  const rows: Row[] = [];
  for (const entry of value as unknown[]) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error(`A derived row of '${path}' is no record`);
    }
    rows.push({ ...(entry as Row) });
  }
  const owned = await ownedRowIds(client, path, caller, rows);
  const admitted: AdmittedRow[] = [];
  for (const row of rows) {
    const columns = admittedColumns(path, 'read', caller.roles, row, owned.has(String(row.id)));
    if (columns !== 'denied') {
      admitted.push({ row, columns });
    }
  }
  return admitted;
}

export interface CreateRefusal {
  status: number;
  error: string;
}

export interface RefusalBody {
  json(body: Record<string, unknown>): unknown;
}

export interface RefusalAnswer {
  status(code: number): RefusalBody;
}

export interface CarriedCollectionRule {
  key: string;
  path: string;
  createRoles: string[];
  childInternal: string[];
}

export interface CreateBodyRule {
  path: string;
  collections: CarriedCollectionRule[];
  emptyListKeys: string[];
}

function fieldNotCreatable(creatable: Set<string>, key: string, path: string): CreateRefusal {
  const allowed = creatable.size > 0 ? [...creatable].join(', ') : 'No fields';
  return {
    status: 403,
    error: `Field '${key}' is not creatable on '${path}'; this role may supply: ${allowed}`,
  };
}

function refuseCarriedCollection(
  value: unknown,
  collection: CarriedCollectionRule,
  creatable: Set<string>,
  roles: string[]
): CreateRefusal | null {
  if (!Array.isArray(value) || value.length === 0 || creatable.has(collection.key)) {
    return null;
  }
  if (!isAdmin(roles) && !hasAnyRole(roles, collection.createRoles)) {
    return { status: 403, error: `Insufficient permissions for create on ${collection.path}` };
  }
  const nestedCreatable = creatableFieldSet(collection.path, roles);
  if (nestedCreatable === null) {
    return null;
  }
  for (const entry of value) {
    for (const key of Object.keys(entry as Record<string, unknown>)) {
      if (!collection.childInternal.includes(key) && !nestedCreatable.has(key)) {
        return fieldNotCreatable(nestedCreatable, key, collection.path);
      }
    }
  }
  return null;
}

export function refuseCreateBody(
  body: Record<string, unknown>,
  rule: CreateBodyRule,
  roles: string[],
  creatable: Set<string> | null
): CreateRefusal | null {
  if (creatable === null) {
    return null;
  }
  for (const collection of rule.collections) {
    const refusal = refuseCarriedCollection(body[collection.key], collection, creatable, roles);
    if (refusal !== null) {
      return refusal;
    }
  }
  const collectionKeys = new Set(rule.collections.map((collection) => collection.key));
  for (const [key, value] of Object.entries(body)) {
    const emptyList =
      rule.emptyListKeys.includes(key) && Array.isArray(value) && value.length === 0;
    if (!collectionKeys.has(key) && !emptyList && !creatable.has(key)) {
      return fieldNotCreatable(creatable, key, rule.path);
    }
  }
  return null;
}
