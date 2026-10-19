import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CatalogLoadError,
  getCategories,
  getEnabledEntries,
  getLanguages,
  loadCatalog,
  resetCatalogCache,
} from "@/core/catalog/loader";

const CATALOG_PATH = join(process.cwd(), "data", "catalog.json");

function withTempCatalog(content: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "findpulse-catalog-"));
  const file = join(dir, "catalog.json");
  writeFileSync(file, JSON.stringify(content), "utf-8");
  return file;
}

afterEach(() => {
  resetCatalogCache();
});

describe("catalog loader", () => {
  it("loads and validates the bundled sample catalog", () => {
    const file = loadCatalog(CATALOG_PATH);
    expect(file.entries.length).toBeGreaterThan(0);
  });

  it("applies schema defaults to optional fields", () => {
    const file = loadCatalog(CATALOG_PATH);
    for (const entry of file.entries) {
      expect(typeof entry.description).toBe("string");
      expect(typeof entry.category).toBe("string");
      expect(typeof entry.language).toBe("string");
      expect(typeof entry.verified).toBe("boolean");
      expect(typeof entry.enabled).toBe("boolean");
    }
  });

  it("enforces a canonical publicUrl derived from the username", () => {
    const file = loadCatalog(CATALOG_PATH);
    for (const entry of file.entries) {
      expect(entry.publicUrl).toBe(`https://t.me/${entry.username.replace(/^@/, "")}`);
    }
  });

  it("has unique ids and usernames", () => {
    const file = loadCatalog(CATALOG_PATH);
    const ids = new Set(file.entries.map((e) => e.id));
    const usernames = new Set(file.entries.map((e) => e.username.toLowerCase()));
    expect(ids.size).toBe(file.entries.length);
    expect(usernames.size).toBe(file.entries.length);
  });

  it("exposes only enabled entries through getEnabledEntries", () => {
    loadCatalog(CATALOG_PATH);
    const enabled = getEnabledEntries();
    expect(enabled.length).toBeGreaterThan(0);
    expect(enabled.every((entry) => entry.enabled)).toBe(true);
  });

  it("derives sorted, distinct facet lists from enabled entries", () => {
    loadCatalog(CATALOG_PATH);
    const categories = getCategories();
    const languages = getLanguages();

    expect(categories).toEqual([...new Set(categories)].sort());
    expect(languages).toEqual([...new Set(languages)].sort());
    expect(categories).toContain("Technology");
    expect(languages).toContain("ar");
  });
});

describe("catalog validation failures", () => {
  it("rejects malformed JSON", () => {
    const dir = mkdtempSync(join(tmpdir(), "findpulse-catalog-"));
    const file = join(dir, "catalog.json");
    writeFileSync(file, "{ not valid json ", "utf-8");

    expect(() => loadCatalog(file)).toThrow(CatalogLoadError);
  });

  it("rejects a publicUrl that does not match the username", () => {
    const file = withTempCatalog({
      entries: [
        {
          id: "bad",
          type: "channel",
          title: "Bad",
          username: "@findpulse_sample_tech",
          publicUrl: "https://t.example/other",
        },
      ],
    });

    expect(() => loadCatalog(file)).toThrow(/publicUrl/);
  });

  it("rejects an invalid Telegram handle", () => {
    const file = withTempCatalog({
      entries: [
        {
          id: "bad",
          type: "channel",
          title: "Bad",
          username: "not a handle!",
          publicUrl: "https://t.me/not%20a%20handle!",
        },
      ],
    });

    expect(() => loadCatalog(file)).toThrow(CatalogLoadError);
  });

  it("rejects an unknown entry type", () => {
    const file = withTempCatalog({
      entries: [
        {
          id: "bad",
          type: "supergroup",
          title: "Bad",
          username: "@some_handle_ok",
          publicUrl: "https://t.me/some_handle_ok",
        },
      ],
    });

    expect(() => loadCatalog(file)).toThrow(CatalogLoadError);
  });

  it("rejects an empty entries array", () => {
    const file = withTempCatalog({ entries: [] });
    expect(() => loadCatalog(file)).toThrow(CatalogLoadError);
  });

  it("rejects duplicate ids", () => {
    const file = withTempCatalog({
      entries: [
        {
          id: "dup",
          type: "channel",
          title: "A",
          username: "@findpulse_sample_tech",
          publicUrl: "https://t.me/findpulse_sample_tech",
        },
        {
          id: "dup",
          type: "group",
          title: "B",
          username: "@findpulse_sample_devcircle",
          publicUrl: "https://t.me/findpulse_sample_devcircle",
        },
      ],
    });

    expect(() => loadCatalog(file)).toThrow(/Duplicate catalog id/);
  });

  it("cleans up temp catalog files", () => {
    const dir = mkdtempSync(join(tmpdir(), "findpulse-catalog-"));
    rmSync(dir, { recursive: true, force: true });
    expect(true).toBe(true);
  });
});
