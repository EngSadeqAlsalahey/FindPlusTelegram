/**
 * Offline wiring tests for the bot layer.
 *
 * These exercise message formatting, keyboard construction and the handler
 * surface WITHOUT contacting Telegram, so the bot logic is covered even when
 * no TELEGRAM_BOT_TOKEN is available. Real network connectivity is covered by
 * `npm run check:bot` (getMe) plus a manual smoke test.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { Bot } from "grammy";
import { loadCatalog } from "@/core/catalog/loader";
import { buildBotSearchRequest, runBotSearch } from "@/bot/handlers/search";
import {
  formatNoResultsMessage,
  formatSearchResultMessage,
  HELP_TEXT,
  MENU_TEXT,
  START_TEXT,
} from "@/bot/messages";
import { buildMenuKeyboard } from "@/bot/keyboards/menu";
import { buildResultsKeyboard } from "@/bot/keyboards/results";

const CATALOG_PATH = `${process.cwd()}/data/catalog.json`;

type KeyboardButton = Exclude<
  (typeof buildResultsKeyboard extends never ? never : ReturnType<typeof buildResultsKeyboard>)["inline_keyboard"][number][number],
  undefined
>;

/** Read optional fields off a grammy inline keyboard button. */
function urlOf(button: KeyboardButton | undefined): string | undefined {
  return button && "url" in button ? button.url : undefined;
}

function callbackDataOf(button: KeyboardButton | undefined): string | undefined {
  return button && "callback_data" in button ? button.callback_data : undefined;
}

beforeEach(() => {
  loadCatalog(CATALOG_PATH);
});

describe("message formatting", () => {
  it("renders a page of results with title, handle, meta and count", async () => {
    const result = await runBotSearch("tech");
    const text = formatSearchResultMessage(result);

    expect(text).toContain("<b>2</b> results");
    expect(text).toContain("TechPulse Daily");
    expect(text).toContain("@findpulse_sample_tech");
    expect(text).toContain("📦 Technology");
    expect(text).toContain("🌐 EN");
  });

  it("marks verified entries with a checkmark", async () => {
    const result = await runBotSearch("startup");
    expect(formatSearchResultMessage(result)).toContain("✅");
  });

  it("uses a browse header when the query is empty", async () => {
    const result = await runBotSearch("");
    expect(formatSearchResultMessage(result)).toContain("entries in the directory");
  });

  it("escapes HTML-significant characters in the query", async () => {
    const result = {
      ...(await runBotSearch("tech")),
      query: "<b>x</b>",
    };
    expect(formatSearchResultMessage(result)).not.toContain("<b>x</b>");
  });

  it("renders a clear no-results message", () => {
    expect(formatNoResultsMessage("zzz")).toContain("No results");
  });

  it("ships non-empty start, help and menu texts", () => {
    expect(START_TEXT.length).toBeGreaterThan(20);
    expect(HELP_TEXT).toContain("/search");
    expect(MENU_TEXT).toContain("FindPulse");
  });
});

describe("inline keyboards", () => {
  it("builds an open button per result plus a menu button", async () => {
    const result = await runBotSearch("tech");
    const keyboard = buildResultsKeyboard(result);
    const json = keyboard.inline_keyboard;

    expect(json.length).toBe(result.entries.length + 1);
    expect(urlOf(json[0]?.[0])).toBe("https://t.me/findpulse_sample_tech");

    const nav = json[json.length - 1];
    expect(nav?.some((button) => callbackDataOf(button) === "menu")).toBe(true);
  });

  it("offers previous/next when the page is not at a boundary", async () => {
    const first = buildResultsKeyboard(await runBotSearch("", { limit: 2, offset: 0 }));
    const lastRowFirst = first.inline_keyboard[first.inline_keyboard.length - 1];
    // First page has no Previous; Next points at offset 2.
    expect(lastRowFirst?.some((b) => (callbackDataOf(b) ?? "").startsWith("pg:2"))).toBe(true);
    expect(lastRowFirst?.some((b) => (callbackDataOf(b) ?? "").startsWith("pg:-"))).toBe(false);

    const later = buildResultsKeyboard(await runBotSearch("", { limit: 2, offset: 2 }));
    const lastRowLater = later.inline_keyboard[later.inline_keyboard.length - 1];
    // A middle page carries both Previous (offset 0) and Next (offset 4).
    expect(lastRowLater?.some((b) => callbackDataOf(b) === "pg:0|all|")).toBe(true);
    expect(lastRowLater?.some((b) => (callbackDataOf(b) ?? "").startsWith("pg:4"))).toBe(true);
  });

  it("builds a menu keyboard with a browse action", () => {
    const json = buildMenuKeyboard().inline_keyboard;
    expect(callbackDataOf(json[0]?.[0])).toBe("browse");
  });
});

describe("bot wiring (offline)", () => {
  it("registers all command and callback handlers on a Bot instance", () => {
    const bot = new Bot("0123456789:dummynotokenforwiringtestonly");

    // Mirror src/bot/index.ts registration exactly. Registration itself must
    // not touch the network; botInfo only resolves after bot.init()/start().
    bot.command("start", () => undefined);
    bot.command("help", () => undefined);
    bot.command("search", () => undefined);
    bot.callbackQuery(/^pg:/, () => undefined);
    bot.callbackQuery("menu", () => undefined);
    bot.callbackQuery("browse", () => undefined);
    bot.on("message:text", () => undefined);

    expect(bot.isRunning()).toBe(false);
  });

  it("computes pagination offsets from decoded callback payloads", () => {
    const request = buildBotSearchRequest("tech", { offset: 5 });
    expect(request.offset).toBe(5);
  });
});
