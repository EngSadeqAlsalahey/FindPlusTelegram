import type { Context } from "grammy";
import { buildMenuKeyboard } from "@/bot/keyboards/menu";
import { HELP_TEXT } from "@/bot/messages";

const NO_PREVIEW = { is_disabled: true } as const;

export async function handleHelp(ctx: Context): Promise<void> {
  await ctx.reply(HELP_TEXT, {
    parse_mode: "HTML",
    reply_markup: buildMenuKeyboard(),
    link_preview_options: NO_PREVIEW,
  });
}
