import type { SearchType } from "@/types";

/**
 * Telegram text and payload formatting helpers.
 *
 * Telegram enforces a hard 64-byte limit on `callback_data`, so pagination
 * payloads must be compact. Very long queries are truncated to fit (the engine
 * simply searches the truncated text on later pages).
 */

export const CALLBACK_DATA_MAX_BYTES = 64;
const CALLBACK_PREFIX = "pg:";
const VALID_TYPES: SearchType[] = ["all", "channel", "group"];

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escape user-controlled text before inserting it into an HTML-formatted message. */
export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

/** Truncate on a character boundary, appending an ellipsis. */
export function truncateText(input: string, max: number): string {
  if (input.length <= max) return input;
  return `${input.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

/** Truncate so the UTF-8 byte length never exceeds `maxBytes` (no split multibyte chars). */
export function truncateToBytes(input: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  if (encoder.encode(input).length <= maxBytes) return input;

  let used = 0;
  let output = "";
  for (const char of input) {
    const size = encoder.encode(char).length;
    if (used + size > maxBytes) break;
    used += size;
    output += char;
  }
  return output;
}

export interface PageCallbackPayload {
  query: string;
  offset: number;
  type: SearchType;
}

export function encodePageCallback(payload: PageCallbackPayload): string {
  const data = `${CALLBACK_PREFIX}${payload.offset}|${payload.type}|${payload.query}`;
  return truncateToBytes(data, CALLBACK_DATA_MAX_BYTES);
}

export function decodePageCallback(
  data: string | undefined,
): PageCallbackPayload | null {
  if (!data || !data.startsWith(CALLBACK_PREFIX)) return null;

  const parts = data.slice(CALLBACK_PREFIX.length).split("|");
  if (parts.length < 3) return null;

  const offset = Number.parseInt(parts[0] ?? "", 10);
  if (!Number.isInteger(offset) || offset < 0) return null;

  const type = parts[1] as SearchType;
  if (!VALID_TYPES.includes(type)) return null;

  // The query is last so any "|" characters it contains survive the round trip.
  const query = parts.slice(2).join("|");
  return { query, offset, type };
}
