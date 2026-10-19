import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { z } from "zod";
import {
  catalogFileSchema,
  type CatalogEntryRecord,
  type CatalogFile,
} from "./schema";

const DEFAULT_CATALOG_PATH = resolve(process.cwd(), "data", "catalog.json");

export class CatalogLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogLoadError";
  }
}

let cached: CatalogFile | null = null;

/**
 * Read, parse and validate the catalog JSON file.
 *
 * Throws {@link CatalogLoadError} for malformed JSON or any schema violation,
 * so a broken catalog fails loudly at startup instead of silently degrading
 * search results.
 */
export function loadCatalog(path: string = DEFAULT_CATALOG_PATH): CatalogFile {
  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch (err) {
    throw new CatalogLoadError(
      `Cannot read catalog file ${path}: ${(err as Error).message}`,
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new CatalogLoadError(
      `Catalog file ${path} is not valid JSON: ${(err as Error).message}`,
    );
  }

  const parsed = catalogFileSchema.safeParse(json);
  if (!parsed.success) {
    throw new CatalogLoadError(
      `Catalog validation failed for ${path}: ${formatZodError(parsed.error)}`,
    );
  }

  assertUniqueIds(parsed.data.entries);
  assertUniqueUsernames(parsed.data.entries);

  cached = parsed.data;
  return cached;
}

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
}

function assertUniqueIds(entries: CatalogEntryRecord[]): void {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.id)) {
      throw new CatalogLoadError(`Duplicate catalog id: "${entry.id}"`);
    }
    seen.add(entry.id);
  }
}

function assertUniqueUsernames(entries: CatalogEntryRecord[]): void {
  const seen = new Set<string>();
  for (const entry of entries) {
    const handle = entry.username.toLowerCase();
    if (seen.has(handle)) {
      throw new CatalogLoadError(
        `Duplicate catalog username: "${entry.username}" (id ${entry.id})`,
      );
    }
    seen.add(handle);
  }
}

/** Returns the loaded catalog, loading it lazily on first access. */
export function getCatalog(): CatalogFile {
  if (cached === null) {
    loadCatalog();
  }
  return cached as CatalogFile;
}

/** All catalog entries, including disabled ones. */
export function getEntries(): CatalogEntryRecord[] {
  return getCatalog().entries;
}

/** Only entries that should be visible to searchers. */
export function getEnabledEntries(): CatalogEntryRecord[] {
  return getEntries().filter((entry) => entry.enabled);
}

/** Distinct, sorted list of categories among enabled entries (for filters). */
export function getCategories(): string[] {
  return uniqueSorted(getEnabledEntries().map((entry) => entry.category));
}

/** Distinct, sorted list of language codes among enabled entries (for filters). */
export function getLanguages(): string[] {
  return uniqueSorted(getEnabledEntries().map((entry) => entry.language));
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

/** Clears the in-memory cache. Intended for tests. */
export function resetCatalogCache(): void {
  cached = null;
}
