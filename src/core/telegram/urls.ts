/**
 * Telegram URL helpers.
 *
 * These are intentionally Bot-API-agnostic string utilities: they only encode
 * the public `https://t.me/<handle>` format, which is the only link format the
 * catalog is allowed to carry (verified against the username in the schema).
 */

/** Remove any leading "@" characters and surrounding whitespace from a handle. */
export function stripAt(username: string): string {
  return username.replace(/^@+/, "").trim();
}

/** Build the canonical public URL for a Telegram handle, e.g. https://t.me/example */
export function buildPublicUrl(username: string): string {
  return `https://t.me/${stripAt(username)}`;
}

/** True when the string looks like a Telegram public handle (with or without @). */
export function looksLikeHandle(input: string): boolean {
  return /^@?[A-Za-z0-9_]{4,64}$/.test(input.trim());
}
