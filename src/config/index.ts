import { z } from "zod";

/**
 * Typed, validated access to environment configuration.
 *
 * NOTE: the bot token lives here and must NEVER be exposed to the browser. Do
 * not import this module from any client component, and never prefix the token
 * variable with NEXT_PUBLIC_.
 */
const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().trim().default(""),
  NEXT_PUBLIC_APP_URL: z.string().trim().default("http://localhost:3000"),
  NODE_ENV: z.string().trim().default("development"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    `Invalid environment configuration: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
  );
}

export const env = {
  telegramBotToken: parsed.data.TELEGRAM_BOT_TOKEN,
  appUrl: parsed.data.NEXT_PUBLIC_APP_URL,
  nodeEnv: parsed.data.NODE_ENV,
};

export const isProduction = env.nodeEnv === "production";
