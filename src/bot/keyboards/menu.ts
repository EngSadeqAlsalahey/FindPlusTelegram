import { InlineKeyboard } from "grammy";
import { env } from "@/config";

/**
 * Main menu keyboard. The website link is only offered when a public app URL is
 * configured; otherwise the row is skipped.
 */
export function buildMenuKeyboard(): InlineKeyboard {
  const keyboard = new InlineKeyboard().text("🗂 Browse directory", "browse");

  if (env.appUrl) {
    keyboard.row().url("🌐 Open website", env.appUrl);
  }

  return keyboard;
}
