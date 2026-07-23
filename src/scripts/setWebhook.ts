import { config } from "../config.js";
import { setWebhook } from "../telegramApi.js";

if (!config.publicUrl) {
  throw new Error("Set PUBLIC_URL in .env to your deployed HTTPS URL first (e.g. https://your-app.up.railway.app)");
}

const url = `${config.publicUrl.replace(/\/$/, "")}${config.telegramWebhookPath}`;
await setWebhook(url);
console.log(`Webhook set to ${url}`);
