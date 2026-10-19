import { Bot } from "grammy";
import { env } from "@/config";
import { BOT_COMMANDS } from "@/bot/commands";
import {
  handleBrowseCallback,
  handleMenuCallback,
  handlePageCallback,
} from "@/bot/handlers/callbacks";
import { handleHelp } from "@/bot/handlers/help";
import { handleSearchCommand, handleTextMessage } from "@/bot/handlers/search";
import { handleStart } from "@/bot/handlers/start";

/**
 * FindPulse Telegram bot entrypoint.
 *
 * Runs as its own process (`npm run bot`) using long polling, and shares the
 * exact same search engine as the web app via `@/core/search`.
 */
async function main(): Promise<void> {
  if (!env.telegramBotToken) {
    console.error(
      "TELEGRAM_BOT_TOKEN is not set.\nCopy .env.example to .env and paste a token from @BotFather.",
    );
    process.exit(1);
  }

  const bot = new Bot(env.telegramBotToken);

  bot.command("start", handleStart);
  bot.command("help", handleHelp);
  bot.command("search", handleSearchCommand);
  bot.callbackQuery(/^pg:/, handlePageCallback);
  bot.callbackQuery("menu", handleMenuCallback);
  bot.callbackQuery("browse", handleBrowseCallback);
  bot.on("message:text", handleTextMessage);

  bot.catch(({ error }) => {
    console.error("[bot] handler error:", error);
  });

  const me = await bot.api.getMe();
  await bot.api.setMyCommands(BOT_COMMANDS);
  console.info(`[bot] connected as @${me.username} (id ${me.id})`);

  bot.start({
    allowed_updates: ["message", "callback_query"],
    onStart: (info) => {
      console.info(`[bot] long polling started for @${info.username}`);
    },
  });

  const shutdown = async (): Promise<void> => {
    console.info("[bot] shutting down…");
    bot.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("[bot] fatal:", error);
  process.exit(1);
});
