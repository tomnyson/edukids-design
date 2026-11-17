import { DesignVariable } from '../../../types/pen-ast';

/** Keys whose strings are text, never variable references */
const LITERAL_KEYS = new Set(['id', 'name', 'content', 'ref', 'context', 'url', 'href', 'geometry', 'icon']);

/** Bound on variables pointing at variables, so a cycle cannot hang the load */
const MAX_DEPTH = 8;

/** A variable's value for the default theme: the entry without a theme, else the first */
function defaultValue(variable: DesignVariable): unknown {
  if (!Array.isArray(variable.value)) return variable.value;
  const plain = variable.value.find((entry) => entry.theme === undefined || Object.keys(entry.theme).length === 0);
  return (plain ?? variable.value[0])?.value;
}

export type VariableResolver = (value: unknown) => unknown;

/**
 * Replaces "$name" strings with the variable's value, at any depth. Strings
 * naming no variable are left as they are.
 */
export function createVariableResolver(variables: Record<string, DesignVariable> | undefined): VariableResolver {
  const lookup = (value: string, depth: number): unknown => {
    const variable = variables?.[value.slice(1)];
    if (!variable || depth >= MAX_DEPTH) return value;
    const next = defaultValue(variable);
    return typeof next === 'string' && next.startsWith('$') ? lookup(next, depth + 1) : next;
  };

  const resolve = (value: unknown): unknown => {
    if (typeof value === 'string') return value.startsWith('$') ? lookup(value, 0) : value;
    if (Array.isArray(value)) return value.map(resolve);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, inner]) => [key, LITERAL_KEYS.has(key) ? inner : resolve(inner)])
      );
    }
    return value;
  };

  return variables && Object.keys(variables).length > 0 ? resolve : (value) => value;
}
