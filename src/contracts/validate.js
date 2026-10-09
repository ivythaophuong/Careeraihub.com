// Strict validation helpers shared by the contracts. Nothing here converts a value: a string where a
// number is required is an error, never silently turned into a number.

export const err = (path, code, message) => ({ path, code, message });

export const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
export const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;
// typeof check on purpose: "0.8" and NaN and Infinity are not numbers for a contract.
export const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);

// Reports unknown keys too, so a misspelt field (e.g. `confidance`) is caught instead of ignored.
export function checkKeys(obj, path, required, optional = []) {
  const errors = [];
  for (const k of required) if (!(k in obj)) errors.push(err(`${path}.${k}`, 'missing_field', `${k} is required`));
  const allowed = new Set([...required, ...optional]);
  for (const k of Object.keys(obj)) if (!allowed.has(k)) errors.push(err(`${path}.${k}`, 'unknown_field', `${k} is not part of the contract`));
  return errors;
}

export const result = (errors) => ({ ok: errors.length === 0, errors });

// Same data -> same text, whatever the key order. Used to test "same input -> same output".
export function canonicalStringify(v) {
  if (Array.isArray(v)) return `[${v.map(canonicalStringify).join(',')}]`;
  if (isObject(v)) return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonicalStringify(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
