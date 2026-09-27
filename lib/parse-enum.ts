export function parseEnum<const T extends string>(
  value: string,
  allowed: readonly T[],
  label: string,
): T {
  for (const candidate of allowed) {
    if (candidate === value) return candidate;
  }
  throw new Error(`Unknown ${label}: ${value}`);
}
