/**
 * Live handler smoke test: invokes the REAL bot handlers against the real
 * catalog and search engine, capturing what each handler would send to
 * Telegram. Run with: npx tsx --env-file-if-exists=.env scripts/smoke-handlers.ts
 *
 * This exercises actual handler code, message formatting, keyboard building,
 * and pagination decode/encode — without needing a Telegram client.
 */
import { loadCatalog } from "@/core/catalog/loader";
import { handleHelp } from "@/bot/handlers/help";
import { handleStart } from "@/bot/handlers/start";
import {
  handleSearchCommand,
  handleTextMessage,
} from "@/bot/handlers/search";
import {
  handleBrowseCallback,
  handleMenuCallback,
  handlePageCallback,
} from "@/bot/handlers/callbacks";
import { decodePageCallback } from "@/core/telegram/format";
import { BOT_COMMANDS } from "@/bot/commands";

loadCatalog();

interface Captured {
  text: string;
  buttons: string[];
}

function makeCtx(captured: Captured[]) {
  return {
    reply: async (text: string, opts?: { reply_markup?: unknown }) => {
      const kb = (opts?.reply_markup as { inline_keyboard?: unknown[][] })?.inline_keyboard;
      captured.push({
        text,
        buttons: (kb ?? []).flat().map((b) => JSON.stringify(b)),
      });
    },
    editMessageText: async (text: string, opts?: { reply_markup?: unknown }) => {
      const kb = (opts?.reply_markup as { inline_keyboard?: unknown[][] })?.inline_keyboard;
      captured.push({
        text,
        buttons: (kb ?? []).flat().map((b) => JSON.stringify(b)),
      });
    },
    replyWithChatAction: async () => undefined,
    answerCallbackQuery: async () => undefined,
  } as never;
}

function summarize(label: string, captured: Captured[]) {
  console.log(`\n--- ${label} ---`);
  if (captured.length === 0) {
    console.log("  (no reply produced)");
    return;
  }
  for (const c of captured) {
    console.log(`  text[0..90]: ${c.text.slice(0, 90).replace(/\n/g, " | ")}`);
    console.log(`  buttons:     ${c.buttons.length}`);
    for (const b of c.buttons.slice(0, 4)) {
      console.log(`    ${b.slice(0, 110)}`);
    }
  }
}

async function main() {
  const tokenOk = !!process.env.TELEGRAM_BOT_TOKEN;
  console.log(`token present: ${tokenOk}`);

  // 1. /start
  let cap: Captured[] = [];
  await handleStart(makeCtx(cap));
  summarize("/start", cap);
  const startHasMenu = cap[0]?.buttons.some((b) => b.includes("browse")) ?? false;

  // 2. /help
  cap = [];
  await handleHelp(makeCtx(cap));
  summarize("/help", cap);
  const helpMentionsSearch = cap[0]?.text.includes("/search") ?? false;

  // 3. /search tech  (ctx.match holds the argument after the command)
  cap = [];
  await handleSearchCommand({
    ...makeCtx(cap),
    match: "tech",
  } as never);
  summarize("/search tech", cap);
  const searchHasOpen = cap[0]?.buttons.some((b) => b.includes("t.me")) ?? false;
  const searchCount = (cap[0]?.text.match(/<b>(\d+)<\/b> results/) ?? [])[1];

  // 4. free-text Arabic message
  cap = [];
  await handleTextMessage({
    ...makeCtx(cap),
    message: { text: "تقنية" },
  } as never);
  summarize("free-text 'تقنية'", cap);
  const arabicOk = cap[0]?.text.includes("تقنية") ?? false;

  // 5. free-text no-match
  cap = [];
  await handleTextMessage({
    ...makeCtx(cap),
    message: { text: "zzzqqq no match zzz" },
  } as never);
  summarize("free-text no-match", cap);
  const emptyOk = cap[0]?.text.includes("No results") ?? false;

  // 6. pagination callback (take the Next payload from the browse listing,
  //    which has 15 entries across 3 pages)
  const browseCap: Captured[] = [];
  await handleBrowseCallback(makeCtx(browseCap));
  const nextBtn = browseCap[0]?.buttons.find((b) => b.includes('"pg:'));
  const payload = nextBtn ? (JSON.parse(nextBtn).callback_data as string) : "";
  cap = [];
  await handlePageCallback({
    ...makeCtx(cap),
    callbackQuery: { data: payload },
  } as never);
  summarize(`page callback (${payload})`, cap);
  const pageDecoded = JSON.stringify(decodePageCallback(payload));
  const page2Ok = cap[0]?.text.includes("Showing 6") ?? false;

  // 6b. previous button on a middle page points back
  const page2Next = cap[0]?.buttons.find((b) => b.includes('"pg:0'));
  const hasPrevButton = Boolean(page2Next);

  // 6c. last page: Next must disappear
  const lastCap: Captured[] = [];
  await handlePageCallback({
    ...makeCtx(lastCap),
    callbackQuery: { data: "pg:10|all|" },
  } as never);
  const lastHasNoNext = !lastCap[0]?.buttons.some((b) => b.includes('"pg:15'));

  // 7. browse + menu callbacks
  cap = [];
  await handleBrowseCallback(makeCtx(cap));
  summarize("browse callback", cap);
  const browseOk = cap[0]?.text.includes("entries in the directory") ?? false;

  cap = [];
  await handleMenuCallback(makeCtx(cap));
  summarize("menu callback", cap);
  const menuOk = cap[0]?.text.includes("FindPulse") ?? false;

  // 8. malformed callback
  cap = [];
  await handlePageCallback({
    ...makeCtx(cap),
    callbackQuery: { data: "pg:bogus" },
  } as never);
  summarize("malformed callback (pg:bogus)", cap);

  console.log("\n=== ASSERTIONS ===");
  const results: [string, boolean][] = [
    ["/start shows menu with browse", startHasMenu],
    ["/help documents /search", helpMentionsSearch],
    ["/search returns Open buttons", searchHasOpen],
    ["/search reports a result count", Boolean(searchCount)],
    [`/search found ${searchCount ?? 0} results`, Number(searchCount) > 0],
    ["Arabic query matches", arabicOk],
    ["no-match shows empty state", emptyOk],
    ["pagination payload decodes", pageDecoded !== "null"],
    ["page 2 offset is correct", page2Ok],
    ["middle page has a previous button", hasPrevButton],
    ["last page has no next button", lastHasNoNext],
    ["browse lists directory", browseOk],
    ["menu callback renders menu", menuOk],
  ];
  let failed = 0;
  for (const [name, ok] of results) {
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
    if (!ok) failed++;
  }

  console.log(`\nRegistered commands: ${BOT_COMMANDS.map((c) => "/" + c.command).join(", ")}`);
  console.log(failed === 0 ? "\nALL HANDLER SMOKE CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
