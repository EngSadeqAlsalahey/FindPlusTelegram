// Single source of truth for shared application types.
// CatalogEntry/CatalogFile are derived from the Zod catalog schema so that the
// validation schema and the runtime type can never drift apart.

import type { CatalogEntryRecord } from "@/core/catalog/schema";

export type CatalogEntry = CatalogEntryRecord;
export type CatalogFile = import("@/core/catalog/schema").CatalogFile;

export type EntryType = CatalogEntry["type"];
export type SearchType = "all" | EntryType;

export interface SearchRequest {
  query: string;
  type: SearchType;
  category?: string;
  language?: string;
  limit: number;
  offset: number;
}

export interface ScoredEntry {
  entry: CatalogEntry;
  score: number;
}

export interface SearchResult {
  /** The (trimmed) query that produced these results. */
  query: string;
  entries: CatalogEntry[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  durationMs: number;
}

export interface SearchFacets {
  categories: string[];
  languages: string[];
}

export interface SearchApiResponse extends SearchResult {
  facets: SearchFacets;
}
