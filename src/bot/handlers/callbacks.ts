import type { Context } from "grammy";
import { decodePageCallback } from "@/core/telegram/format";
import { buildMenuKeyboard } from "@/bot/keyboards/menu";
import { buildResultsKeyboard } from "@/bot/keyboards/results";
import {
  MENU_TEXT,
  formatNoResultsMessage,
  formatSearchResultMessage,
} from "@/bot/messages";
import { runBotSearch } from "./search";

const NO_PREVIEW = { is_disabled: true } as const;

/** Pagination buttons (`pg:...`). Re-runs the stored query at a new offset. */
export async function handlePageCallback(ctx: Context): Promise<void> {
  const decoded = decodePageCallback(ctx.callbackQuery?.data);

  if (!decoded) {
    await ctx.answerCallbackQuery({
      text: "This search has expired — please search again.",
    });
    return;
  }

  await ctx.answerCallbackQuery();

  const result = await runBotSearch(decoded.query, { offset: decoded.offset });

  if (result.entries.length === 0) {
    await ctx.editMessageText(formatNoResultsMessage(decoded.query), {
      parse_mode: "HTML",
      reply_markup: buildMenuKeyboard(),
      link_preview_options: NO_PREVIEW,
    });
    return;
  }

  await ctx.editMessageText(formatSearchResultMessage(result), {
    parse_mode: "HTML",
    reply_markup: buildResultsKeyboard(result),
    link_preview_options: NO_PREVIEW,
  });
}

/** "🏠 Menu" button — replace the message with the main menu. */
export async function handleMenuCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(MENU_TEXT, {
    parse_mode: "HTML",
    reply_markup: buildMenuKeyboard(),
    link_preview_options: NO_PREVIEW,
  });
}

/** "🗂 Browse directory" button — first page of the whole directory. */
export async function handleBrowseCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const result = await runBotSearch("");
  await ctx.editMessageText(formatSearchResultMessage(result), {
    parse_mode: "HTML",
    reply_markup: buildResultsKeyboard(result),
    link_preview_options: NO_PREVIEW,
  });
}
