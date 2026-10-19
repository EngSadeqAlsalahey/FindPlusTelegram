import type { CatalogEntry } from "@/types";
import { stripAt } from "@/core/telegram/urls";
import { normalizeText, tokenize } from "./normalize";

export interface ScoredEntry {
  entry: CatalogEntry;
  score: number;
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True when `needle` appears at the start of a word inside `haystack`. */
function wordStartsWith(haystack: string, needle: string): boolean {
  if (!needle || !haystack) return false;
  return new RegExp(`(^|\\s)${escapeRegExp(needle)}`, "u").test(haystack);
}

/**
 * Score how well an entry matches a single (already raw) query string.
 *
 * Ranking tiers, best first:
 *   exact title           100
 *   title starts with q    70
 *   word-boundary title     45   (query starts a word inside the title)
 *   substring in title      35
 *   exact username          90
 *   username starts with q  60
 *   substring in username   35
 *   exact description       25
 *   word-boundary desc.     15
 *   substring in desc.      10
 *   per-token bonus          8 / 6 / 4 (title / username / description)
 *
 * Only entries with score > 0 count as matches for a non-empty query.
 */
export function scoreEntry(entry: CatalogEntry, rawQuery: string): number {
  const query = normalizeText(rawQuery);
  if (!query) return 0;

  const title = normalizeText(entry.title);
  // Handles are compared without the leading "@", on both sides of the match.
  const username = normalizeText(stripAt(entry.username));
  const handleQuery = normalizeText(stripAt(query));
  const description = normalizeText(entry.description);

  let score = 0;

  if (title === query) score += 100;
  else if (title.startsWith(query)) score += 70;
  else if (wordStartsWith(title, query)) score += 45;
  else if (title.includes(query)) score += 35;

  if (handleQuery && username === handleQuery) score += 90;
  else if (handleQuery && username.startsWith(handleQuery)) score += 60;
  else if (handleQuery && username.includes(handleQuery)) score += 35;

  if (description === query) score += 25;
  else if (wordStartsWith(description, query)) score += 15;
  else if (description.includes(query)) score += 10;

  // Multi-token queries: reward entries that cover EVERY token somewhere, using
  // word-boundary matching so short particles inside longer words do not count
  // (e.g. the token "no" must not match the word "technology").
  const tokens = tokenize(query);
  if (tokens.length > 1) {
    let bonus = 0;
    let coveredAll = true;
    for (const token of tokens) {
      let tokenScore = 0;
      if (wordStartsWith(title, token)) tokenScore = Math.max(tokenScore, 8);
      if (username.includes(token)) tokenScore = Math.max(tokenScore, 6);
      if (wordStartsWith(description, token)) tokenScore = Math.max(tokenScore, 4);
      if (tokenScore === 0) {
        coveredAll = false;
        break;
      }
      bonus += tokenScore;
    }
    if (coveredAll) score += bonus;
  }

  return score;
}

/** Deterministic tie-break ordering: score desc, then normalized title asc, then id asc. */
export function compareScored(a: ScoredEntry, b: ScoredEntry): number {
  if (b.score !== a.score) return b.score - a.score;
  const titleCmp = normalizeText(a.entry.title).localeCompare(
    normalizeText(b.entry.title),
    "en",
    { sensitivity: "base" },
  );
  if (titleCmp !== 0) return titleCmp;
  return a.entry.id.localeCompare(b.entry.id);
}
