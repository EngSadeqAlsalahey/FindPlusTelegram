/**
 * Telegram command description, as accepted by setMyCommands.
 * (grammy does not re-export this Telegram type, so it is declared here.)
 */
export interface BotCommand {
  command: string;
  description: string;
}

/**
 * Command menu published to Telegram on bot startup via setMyCommands.
 */
export const BOT_COMMANDS: BotCommand[] = [
  { command: "start", description: "Open the FindPulse menu" },
  { command: "help", description: "Show how to search" },
  { command: "search", description: "Search: /search <keyword>" },
];
