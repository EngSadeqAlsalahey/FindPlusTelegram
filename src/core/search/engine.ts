import type { CatalogEntry, SearchRequest, SearchResult, ScoredEntry } from "@/types";
import { getEnabledEntries } from "@/core/catalog/loader";
import { normalizeText } from "./normalize";
import { compareScored, scoreEntry, type ScoredEntry as Scored } from "./score";

export type { ScoredEntry };

/**
 * The single shared search engine used by BOTH interfaces (web API + bot).
 *
 * Scope reminder: this engine searches the LOCAL curated catalog only. It does
 * not (and, with the Bot API alone, cannot) search Telegram posts or messages.
 */

function matchesType(entry: CatalogEntry, request: SearchRequest): boolean {
  return request.type === "all" || entry.type === request.type;
}

function matchesFilters(entry: CatalogEntry, request: SearchRequest): boolean {
  if (!matchesType(entry, request)) return false;
  if (request.category) {
    if (normalizeText(entry.category) !== normalizeText(request.category)) return false;
  }
  if (request.language) {
    if (normalizeText(entry.language) !== normalizeText(request.language)) return false;
  }
  return true;
}

function compareByTitle(a: Scored, b: Scored): number {
  const cmp = normalizeText(a.entry.title).localeCompare(
    normalizeText(b.entry.title),
    "en",
    { sensitivity: "base" },
  );
  if (cmp !== 0) return cmp;
  return a.entry.id.localeCompare(b.entry.id);
}

/**
 * Score and rank every matching entry (no pagination applied).
 *
 * Pass an explicit `entries` pool to search a custom dataset (used by tests);
 * by default the enabled catalog is used.
 */
export function searchEntries(
  request: SearchRequest,
  entries?: CatalogEntry[],
): Scored[] {
  const pool = entries ?? getEnabledEntries();
  const query = normalizeText(request.query);

  const filtered = pool.filter((entry) => matchesFilters(entry, request));

  // Empty query = "browse mode": rank-neutral listing ordered by title.
  if (!query) {
    return filtered.map((entry) => ({ entry, score: 0 })).sort(compareByTitle);
  }

  return filtered
    .map((entry) => ({ entry, score: scoreEntry(entry, request.query) }))
    .filter((scored) => scored.score > 0)
    .sort(compareScored);
}

/** Run a search and apply pagination. The hot path for both interfaces. */
export function search(
  request: SearchRequest,
  entries?: CatalogEntry[],
): SearchResult {
  const start = nowMs();
  const all = searchEntries(request, entries);

  const total = all.length;
  const limit = Number.isFinite(request.limit) ? Math.max(1, Math.floor(request.limit)) : 20;
  const offset = Number.isFinite(request.offset) ? Math.max(0, Math.floor(request.offset)) : 0;

  const page = all.slice(offset, offset + limit);

  return {
    query: request.query.trim(),
    entries: page.map((scored) => scored.entry),
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
    durationMs: Math.max(0, Math.round((nowMs() - start) * 1000) / 1000),
  };
}

function nowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}
