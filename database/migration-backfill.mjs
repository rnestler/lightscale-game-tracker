const INTEGER_TYPE_IDS = new Set([20, 1016]);
const NUMERIC_TYPE_IDS = new Set([1700, 1231]);
const DOCUMENT_COLUMN_TYPE = 'jsonb';

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

function requireList(value, role) {
  if (!Array.isArray(value)) {
    throw new Error(role + ' requires a collection');
  }
  return value;
}

function recordId(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return typeof value.id === 'string' ? value.id : null;
}

function elementIdentity(value) {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return typeof value + ':' + String(value);
  }
  const id = recordId(value);
  if (id !== null) {
    return 'id:' + id;
  }
  return 'value:' + JSON.stringify(value);
}

function distinctElements(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const identity = elementIdentity(value);
    if (!seen.has(identity)) {
      seen.add(identity);
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
      return distinctElements(asArray(value));
    default:
      throw new Error('Unknown method: ' + op);
  }
}

function requireNumber(value) {
  if (typeof value === 'number') {
    return value;
  }
  throw new Error('Numeric operand expected');
}

function isSet(value) {
  return value !== null && value !== '';
}

function keyText(value) {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function compareKeys(left, right) {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }
  if (typeof left === 'boolean' && typeof right === 'boolean') {
    return Number(left) - Number(right);
  }
  const leftText = keyText(left);
  const rightText = keyText(right);
  if (leftText < rightText) {
    return -1;
  }
  return leftText > rightText ? 1 : 0;
}

function compareIdentity(left, right) {
  if (typeof left === 'object' || typeof right === 'object') {
    return compareKeys(elementIdentity(left), elementIdentity(right));
  }
  return compareKeys(left, right);
}

function compareKeyed(left, right, descending) {
  const leftUnset = !isSet(left.key);
  const rightUnset = !isSet(right.key);
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

function groupByKey(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const identity = elementIdentity(entry.key);
    const group = groups.get(identity);
    if (group === undefined) {
      groups.set(identity, { key: entry.key, items: [entry.element] });
    } else {
      group.items.push(entry.element);
    }
  }
  return Array.from(groups.values()).map(function (group) { return { key: group.key, items: group.items }; });
}

function extendScope(scope, name, value) {
  const next = Object.assign({}, scope);
  next[name] = value;
  return next;
}

function pad(value) {
  return value.toString().padStart(2, '0');
}

function momentText(value, withClock) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const day = date.getUTCFullYear() + '-' + pad(date.getUTCMonth() + 1) + '-' + pad(date.getUTCDate());
  return withClock ? day + ' ' + pad(date.getUTCHours()) + ':' + pad(date.getUTCMinutes()) + ' UTC' : day;
}

function formatTemporal(value, kind) {
  switch (kind) {
    case 'time':
      return value.replace(/\.000$/, '').replace(/^([0-9]{2}:[0-9]{2}):00$/, '$1');
    case 'localdatetime':
      return value
        .replace('T', ' ')
        .replace(/\.000$/, '')
        .replace(/([0-9]{2}:[0-9]{2}):00$/, '$1');
    case 'date':
      return momentText(value, false);
    case 'datetime':
      return momentText(value, true);
    default:
      throw new Error('Unknown temporal kind: ' + kind);
  }
}

function applyConvert(target, operand, from) {
  switch (target) {
    case 'integer':
      return Math.trunc(requireNumber(operand));
    case 'decimal':
      return requireNumber(operand);
    case 'string':
      if (from !== undefined && typeof operand === 'string') {
        return formatTemporal(operand, from);
      }
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

function selectElements(expr, row, scope) {
  const elements = asArray(evaluate(expr.source, row, scope));
  if (expr.predicate === null) {
    return elements;
  }
  return elements.filter(function (element) {
    return Boolean(evaluate(expr.predicate, row, extendScope(scope, expr.variable, element)));
  });
}

export function evaluate(expr, row, scope) {
  switch (expr.kind) {
    case 'ref':
      if (expr.name in scope) {
        return scope[expr.name] ?? null;
      }
      return row[expr.name] ?? null;
    case 'integer':
    case 'decimal':
    case 'string':
    case 'boolean':
      return expr.value;
    case 'convert':
      return applyConvert(expr.target, evaluate(expr.operand, row, scope), expr.from);
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
      return object[expr.field] ?? null;
    }
    case 'record': {
      const result = {};
      for (const name of Object.keys(expr.fields)) {
        result[name] = evaluate(expr.fields[name], row, scope);
      }
      return result;
    }
    case 'map': {
      const selected = selectElements(expr, row, scope);
      const ordered = expr.order === null
        ? selected
        : orderByKey(selected.map(function (element) {
            return { element: element, key: evaluate(expr.order.key, row, extendScope(scope, expr.variable, element)) };
          }), expr.order.descending);
      return ordered.map(function (element) {
        return evaluate(expr.body, row, extendScope(scope, expr.variable, element));
      });
    }
    case 'group':
      return groupByKey(selectElements(expr, row, scope).map(function (element) {
        return { element: element, key: evaluate(expr.key, row, extendScope(scope, expr.variable, element)) };
      }));
    case 'flatten': {
      const result = [];
      for (const inner of asArray(evaluate(expr.source, row, scope))) {
        result.push(...requireList(inner, "'flatten' element"));
      }
      return result;
    }
    case 'zip': {
      const first = asArray(evaluate(expr.first, row, scope));
      const second = asArray(evaluate(expr.second, row, scope));
      const result = [];
      const length = Math.min(first.length, second.length);
      for (let index = 0; index < length; index++) {
        result.push({ first: first[index] ?? null, second: second[index] ?? null });
      }
      return result;
    }
    case 'concat':
      return asArray(evaluate(expr.first, row, scope)).concat(asArray(evaluate(expr.second, row, scope)));
    default:
      throw new Error('Unsupported migration expression: ' + String(expr.kind));
  }
}

function collectNames(value, names) {
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectNames(entry, names);
    }
  } else if (value !== null && typeof value === 'object') {
    if (value.kind === 'ref' && typeof value.name === 'string') {
      names.add(value.name);
    }
    for (const entry of Object.values(value)) {
      collectNames(entry, names);
    }
  }
}

export function referencedNames(expressions) {
  const names = new Set();
  collectNames(expressions, names);
  return Array.from(names);
}

function scalarColumnValue(value) {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error('The transform yields ' + String(value) + ', which no column stores');
  }
  if (value !== null && typeof value === 'object') {
    return JSON.stringify(value);
  }
  return value;
}

export function toColumnValue(value, columnType) {
  if (columnType === DOCUMENT_COLUMN_TYPE) {
    return value;
  }
  return Array.isArray(value) ? value.map(scalarColumnValue) : scalarColumnValue(value);
}

function decodeValue(typeId, value, place) {
  if (value === null) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.map(function (element) { return decodeValue(typeId, element, place); });
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (INTEGER_TYPE_IDS.has(typeId)) {
    const number = Number(value);
    if (!Number.isSafeInteger(number)) {
      throw new Error(place + ' holds ' + value + ', beyond the safe integer range a migration transform computes with');
    }
    return number;
  }
  if (NUMERIC_TYPE_IDS.has(typeId)) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      throw new Error(place + ' holds ' + value + ', which is not a finite number');
    }
    return number;
  }
  return value;
}

export function decodeRow(table, fields, raw) {
  const decoded = {};
  for (const field of fields) {
    const place = '"' + table + '"."' + field.name + '" of row ' + raw.id;
    decoded[field.name] = decodeValue(field.dataTypeID, raw[field.name], place);
  }
  return decoded;
}
