/**
 * Connectivity check: verifies the configured bot token against Telegram by
 * calling getMe. Run with `npm run check:bot` after setting TELEGRAM_BOT_TOKEN.
 *
 * Exits non-zero when the token is missing or Telegram rejects it.
 */
import { Bot } from "grammy";
import { env } from "@/config";

async function main(): Promise<void> {
  if (!env.telegramBotToken) {
    console.error("✗ TELEGRAM_BOT_TOKEN is not set — nothing to check.");
    process.exit(1);
  }

  const bot = new Bot(env.telegramBotToken);

  try {
    const me = await bot.api.getMe();
    console.info(
      `✓ Telegram reachable. Bot: @${me.username} (id ${me.id}, name "${me.first_name}").`,
    );
    process.exit(0);
  } catch (error) {
    console.error("✗ Telegram rejected the token or is unreachable:", error);
    process.exit(1);
  }
}

main();
