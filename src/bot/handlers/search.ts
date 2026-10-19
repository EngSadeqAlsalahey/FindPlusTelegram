import type { Context } from "grammy";
import { search } from "@/core/search/engine";
import { MAX_QUERY_LENGTH } from "@/core/validation/search";
import { buildMenuKeyboard } from "@/bot/keyboards/menu";
import { buildResultsKeyboard } from "@/bot/keyboards/results";
import {
  NO_QUERY_TEXT,
  formatNoResultsMessage,
  formatSearchResultMessage,
} from "@/bot/messages";
import type { SearchRequest, SearchResult } from "@/types";

export const BOT_RESULTS_PER_PAGE = 5;

/**
 * Build the engine request for a bot-originated query. This is the bot's only
 * adapter into the shared search engine, so its behaviour is identical to the
 * web API's by construction (see tests/parity.test.ts).
 */
export function buildBotSearchRequest(
  query: string,
  opts: { offset?: number; limit?: number } = {},
): SearchRequest {
  const trimmed = query.trim();
  return {
    query: trimmed.slice(0, MAX_QUERY_LENGTH),
    type: "all",
    limit: opts.limit ?? BOT_RESULTS_PER_PAGE,
    offset: Math.max(0, Math.floor(opts.offset ?? 0)),
  };
}

export async function runBotSearch(
  query: string,
  opts: { offset?: number; limit?: number } = {},
): Promise<SearchResult> {
  return search(buildBotSearchRequest(query, opts));
}

const NO_PREVIEW = { is_disabled: true } as const;

export async function replyWithSearch(ctx: Context, rawQuery: string): Promise<void> {
  const query = rawQuery.trim();

  if (!query) {
    await ctx.reply(NO_QUERY_TEXT, {
      parse_mode: "HTML",
      reply_markup: buildMenuKeyboard(),
      link_preview_options: NO_PREVIEW,
    });
    return;
  }

  const wasTruncated = query.length > MAX_QUERY_LENGTH;
  const usable = query.slice(0, MAX_QUERY_LENGTH);

  await ctx.replyWithChatAction("typing");

  const result = await runBotSearch(usable);

  if (result.entries.length === 0) {
    await ctx.reply(formatNoResultsMessage(usable), {
      parse_mode: "HTML",
      reply_markup: buildMenuKeyboard(),
      link_preview_options: NO_PREVIEW,
    });
    return;
  }

  const notice = wasTruncated
    ? `\n\nℹ️ Query trimmed to ${MAX_QUERY_LENGTH} characters.`
    : "";

  await ctx.reply(formatSearchResultMessage(result) + notice, {
    parse_mode: "HTML",
    reply_markup: buildResultsKeyboard(result),
    link_preview_options: NO_PREVIEW,
  });
}

export async function handleSearchCommand(ctx: Context): Promise<void> {
  const match = ctx.match;
  await replyWithSearch(ctx, typeof match === "string" ? match : "");
}

export async function handleTextMessage(ctx: Context): Promise<void> {
  await replyWithSearch(ctx, ctx.message?.text ?? "");
}
