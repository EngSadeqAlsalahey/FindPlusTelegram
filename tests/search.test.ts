import { beforeEach, describe, expect, it } from "vitest";
import { loadCatalog } from "@/core/catalog/loader";
import { search, searchEntries } from "@/core/search/engine";
import { normalizeText } from "@/core/search/normalize";
import { getEnabledEntries } from "@/core/catalog/loader";
import type { CatalogEntry, SearchRequest } from "@/types";

const CATALOG_PATH = `${process.cwd()}/data/catalog.json`;

function req(partial: Partial<SearchRequest>): SearchRequest {
  return {
    query: "",
    type: "all",
    limit: 20,
    offset: 0,
    ...partial,
  };
}

function titles(result: { entries: CatalogEntry[] }): string[] {
  return result.entries.map((entry) => entry.title);
}

beforeEach(() => {
  loadCatalog(CATALOG_PATH);
});

describe("normalizeText", () => {
  it("is case-insensitive and trims whitespace", () => {
    expect(normalizeText("  TeCh  ")).toBe("tech");
  });

  it("collapses Arabic diacritics and alef variants", () => {
    expect(normalizeText("تقنية")).toBe(normalizeText("تِقْنِيَّة"));
    expect(normalizeText("أخبار")).toBe(normalizeText("اخبار"));
    expect(normalizeText("مجموعة")).toBe(normalizeText("مجموعه"));
  });

  it("replaces punctuation and repeated spaces with a single space", () => {
    expect(normalizeText("hello   ///  world")).toBe("hello world");
  });
});

describe("search by title / username / description", () => {
  it("finds entries by English title keyword", () => {
    const result = search(req({ query: "football" }));
    expect(result.entries.length).toBeGreaterThan(0);
    expect(titles(result)).toContain("Football Fans Hub");
  });

  it("finds entries by Arabic title keyword", () => {
    const result = search(req({ query: "تقنية" }));
    expect(titles(result)).toContain("تقنية اليوم");
  });

  it("finds entries by Arabic title regardless of diacritics in the query", () => {
    const result = search(req({ query: "تِقْنِيَة" }));
    expect(titles(result)).toContain("تقنية اليوم");
  });

  it("finds entries by username with and without the leading @", () => {
    expect(titles(search(req({ query: "@findpulse_sample_tech" })))).toContain(
      "TechPulse Daily",
    );
    expect(titles(search(req({ query: "findpulse_sample_tech" })))).toContain(
      "TechPulse Daily",
    );
  });

  it("finds entries by a word that only appears in the description", () => {
    const result = search(req({ query: "blockchain" }));
    expect(titles(result)).toContain("Crypto Talk");
  });

  it("rewards multi-token queries that match across fields", () => {
    const result = search(req({ query: "arabic learners" }));
    expect(titles(result)).toContain("Arabic Learners Lounge");
  });
});

describe("search filters", () => {
  it("filters to channels only", () => {
    const result = search(req({ query: "pulse", type: "channel" }));
    expect(result.entries.length).toBeGreaterThan(0);
    expect(result.entries.every((entry) => entry.type === "channel")).toBe(true);
  });

  it("filters to groups only", () => {
    const result = search(req({ query: "dev", type: "group" }));
    expect(result.entries.length).toBeGreaterThan(0);
    expect(result.entries.every((entry) => entry.type === "group")).toBe(true);
  });

  it("filters by category", () => {
    const result = search(req({ query: "", category: "Design" }));
    expect(result.entries.length).toBeGreaterThan(0);
    expect(result.entries.every((entry) => entry.category === "Design")).toBe(true);
  });

  it("filters by language", () => {
    const result = search(req({ query: "", language: "ar" }));
    expect(result.entries.length).toBeGreaterThan(0);
    expect(result.entries.every((entry) => entry.language === "ar")).toBe(true);
  });

  it("combines type and category filters", () => {
    const result = search(req({ query: "", type: "group", category: "Programming" }));
    expect(result.entries.length).toBeGreaterThan(0);
    for (const entry of result.entries) {
      expect(entry.type).toBe("group");
      expect(entry.category).toBe("Programming");
    }
  });

  it("excludes disabled entries", () => {
    const result = search(req({ query: "أخبار الرياضة" }));
    expect(titles(result)).not.toContain("أخبار الرياضة");

    const directly = getEnabledEntries().find((entry) => entry.id === "akthbaar-riyada-disabled");
    expect(directly).toBeUndefined();
  });

  it("ignores case and surrounding whitespace in the query", () => {
    const a = search(req({ query: "cinema" }));
    const b = search(req({ query: "   CINEMA   " }));
    expect(titles(a)).toEqual(titles(b));
  });
});

describe("empty results", () => {
  it("does not match short tokens buried inside longer words", () => {
    // "no" is a substring of "technology" but must not count as a hit.
    const result = search(req({ query: "zzzqqq no match zzz" }));
    expect(result.total).toBe(0);
  });

  it("returns zero results when a filter excludes everything", () => {
    const result = search(req({ query: "cinema", language: "ar" }));
    expect(result.total).toBe(0);
  });
});

describe("ranking", () => {
  it("ranks an exact username match above a description match", () => {
    const scored = searchEntries(req({ query: "findpulse_sample_crypto" }));
    expect(scored.length).toBeGreaterThan(0);
    expect(scored[0]?.entry.username).toBe("@findpulse_sample_crypto");
  });

  it("ranks an exact title match above a partial title match", () => {
    const scored = searchEntries(req({ query: "football fans hub" }));
    const first = scored[0];
    expect(first).toBeDefined();
    expect(first?.score).toBeGreaterThan(scored[1]?.score ?? 0);
  });

  it("orders equal scores deterministically by title then id", () => {
    const scored = searchEntries(req({ query: "" }));
    for (let index = 0; index < scored.length - 1; index++) {
      const current = scored[index];
      const next = scored[index + 1];
      if (current && next && current.score === next.score) {
        // Mirror the engine's collation exactly ("en", base sensitivity).
        const titleCmp = normalizeText(current.entry.title).localeCompare(
          normalizeText(next.entry.title),
          "en",
          { sensitivity: "base" },
        );
        expect(titleCmp).toBeLessThanOrEqual(0);
        if (titleCmp === 0) {
          expect(current.entry.id.localeCompare(next.entry.id)).toBeLessThanOrEqual(0);
        }
      }
    }
  });
});

describe("pagination", () => {
  it("respects limit and offset over the full result set", () => {
    const pageSize = 3;
    const all = searchEntries(req({ query: "" }));
    const firstPage = search(req({ query: "", limit: pageSize, offset: 0 }));
    const secondPage = search(req({ query: "", limit: pageSize, offset: pageSize }));

    expect(firstPage.entries.length).toBe(pageSize);
    expect(firstPage.total).toBe(all.length);
    expect(firstPage.offset).toBe(0);
    expect(firstPage.hasMore).toBe(true);
    expect(secondPage.offset).toBe(pageSize);
    expect(secondPage.hasMore).toBe(pageSize + pageSize < all.length);
  });

  it("never duplicates entries across pages", () => {
    const seen = new Set<string>();
    for (let offset = 0; offset < 200; offset += 5) {
      const page = search(req({ query: "", limit: 5, offset }));
      if (page.entries.length === 0) break;
      for (const entry of page.entries) {
        expect(seen.has(entry.id)).toBe(false);
        seen.add(entry.id);
      }
    }
  });

  it("returns an empty page past the end", () => {
    const far = search(req({ query: "", limit: 20, offset: 10_000 }));
    expect(far.entries.length).toBe(0);
    expect(far.total).toBeGreaterThan(0);
  });
});
