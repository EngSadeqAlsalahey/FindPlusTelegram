import { beforeEach, describe, expect, it } from "vitest";
import { loadCatalog } from "@/core/catalog/loader";
import { search } from "@/core/search/engine";
import { buildSearchResponse } from "@/core/search/web-handler";
import { searchRequestSchema } from "@/core/validation/search";
import {
  BOT_RESULTS_PER_PAGE,
  buildBotSearchRequest,
  runBotSearch,
} from "@/bot/handlers/search";

const CATALOG_PATH = `${process.cwd()}/data/catalog.json`;

const QUERIES = [
  "tech",
  "تقنية",
  "football",
  "@findpulse_sample_crypto",
  "design",
  "لا يوجد تطابق",
];

const LIMIT = BOT_RESULTS_PER_PAGE;

beforeEach(() => {
  loadCatalog(CATALOG_PATH);
});

describe("web ↔ bot search parity", () => {
  it("both adapters funnel through the same engine request", () => {
    for (const query of QUERIES) {
      const webRequest = searchRequestSchema.parse({ q: query, limit: LIMIT });
      const botRequest = buildBotSearchRequest(query, { limit: LIMIT });

      expect(botRequest.query).toBe(webRequest.q);
      expect(botRequest.type).toBe(webRequest.type);
      expect(botRequest.limit).toBe(webRequest.limit);
      expect(botRequest.offset).toBe(webRequest.offset);
    }
  });

  it("produces identical result sequences for the same query and page", () => {
    for (const query of QUERIES) {
      const web = buildSearchResponse({
        q: query,
        type: "all",
        category: undefined,
        language: undefined,
        limit: LIMIT,
        offset: 0,
      });

      // runBotSearch is the async path the bot handler actually calls.
      return runBotSearch(query, { limit: LIMIT }).then((bot) => {
        expect(bot.total).toBe(web.total);
        expect(bot.hasMore).toBe(web.hasMore);
        expect(bot.entries.map((entry) => entry.id)).toEqual(
          web.entries.map((entry) => entry.id),
        );
      });
    }
  });

  it("stays in sync across pages", () => {
    const query = "";
    for (let offset = 0; offset < 15; offset += LIMIT) {
      const web = buildSearchResponse({
        q: query,
        type: "all",
        category: undefined,
        language: undefined,
        limit: LIMIT,
        offset,
      });
      const engine = search({
        query,
        type: "all",
        limit: LIMIT,
        offset,
      });

      expect(web.entries.map((entry) => entry.id)).toEqual(
        engine.entries.map((entry) => entry.id),
      );
    }
  });

  it("agrees on the query-length ceiling, each with its own boundary behaviour", () => {
    const long = "x".repeat(200);

    // The bot is conversational: it truncates and still answers.
    const botRequest = buildBotSearchRequest(long);
    expect(botRequest.query.length).toBe(100);

    // The web API is strict: it rejects oversize requests with HTTP 400.
    const webParsed = searchRequestSchema.safeParse({ q: long });
    expect(webParsed.success).toBe(false);
  });
});

describe("bot pagination payloads", () => {
  it("builds requests for arbitrary offsets", () => {
    const request = buildBotSearchRequest("tech", { offset: 10, limit: 5 });
    expect(request.offset).toBe(10);
    expect(request.limit).toBe(5);
    expect(request.type).toBe("all");
  });
});
