/** Minimal class-name joiner (avoids pulling in a dependency for this). */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter((value): value is string => Boolean(value)).join(" ");
}
