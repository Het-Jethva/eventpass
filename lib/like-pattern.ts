/**
 * Escapes `\`, `%`, and `_` so a search value is a literal ILIKE substring.
 * Callers wrap the result in `%` and write `column ILIKE pattern ESCAPE '\'`
 * with the pattern as a bound parameter. The clause is required: PostgreSQL's
 * default escape is a backslash, but an explicit escape is what makes a
 * backslash in the pattern mean itself.
 */
export function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
