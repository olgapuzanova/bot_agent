import "dotenv/config";
import path from "node:path";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const config = {
  telegramBotToken: required("TELEGRAM_BOT_TOKEN"),
  telegramOwnerId: Number(required("TELEGRAM_OWNER_ID")),
  telegramWebhookSecret: required("TELEGRAM_WEBHOOK_SECRET"),
  telegramWebhookPath: process.env.TELEGRAM_WEBHOOK_PATH ?? "/webhook",
  agentWorkdir: path.resolve(process.env.AGENT_WORKDIR ?? "./workspace"),
  dbPath: path.resolve(process.env.DB_PATH ?? "./data/bot.sqlite"),
  port: Number(process.env.PORT ?? 3000),
  publicUrl: process.env.PUBLIC_URL ?? "",
};

if (Number.isNaN(config.telegramOwnerId)) {
  throw new Error("TELEGRAM_OWNER_ID must be a numeric Telegram user id");
}

// The claude-agent-sdk subprocess reads these directly from process.env itself
// (ANTHROPIC_API_KEY, or CLAUDE_CODE_OAUTH_TOKEN from `claude setup-token` for
// Pro/Max/Team/Enterprise subscribers) — we only need to check one is present.
if (!process.env.ANTHROPIC_API_KEY && !process.env.CLAUDE_CODE_OAUTH_TOKEN) {
  throw new Error(
    "Set either ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN (from `claude setup-token`) in the environment."
  );
}
