import { config } from "./config.js";

const API_BASE = `https://api.telegram.org/bot${config.telegramBotToken}`;
const FILE_BASE = `https://api.telegram.org/file/bot${config.telegramBotToken}`;

async function call<T = unknown>(method: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_BASE}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as { ok: boolean; result: T; description?: string };
  if (!data.ok) {
    throw new Error(`Telegram API ${method} failed: ${data.description}`);
  }
  return data.result;
}

export interface InlineButton {
  text: string;
  callback_data: string;
}

export async function sendMessage(
  chatId: number,
  text: string,
  opts?: { replyMarkup?: InlineButton[][]; disableNotification?: boolean }
): Promise<{ message_id: number }> {
  return call("sendMessage", {
    chat_id: chatId,
    text,
    disable_notification: opts?.disableNotification ?? false,
    reply_markup: opts?.replyMarkup ? { inline_keyboard: opts.replyMarkup } : undefined,
  });
}

export async function editMessageText(chatId: number, messageId: number, text: string): Promise<void> {
  try {
    await call("editMessageText", { chat_id: chatId, message_id: messageId, text });
  } catch {
    // message may be unchanged or too old to edit — non-fatal for progress updates
  }
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  await call("answerCallbackQuery", { callback_query_id: callbackQueryId, text });
}

export async function editMessageReplyMarkup(chatId: number, messageId: number): Promise<void> {
  try {
    await call("editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } });
  } catch {
    // ignore
  }
}

export async function sendDocument(chatId: number, buffer: Buffer, filename: string, caption?: string): Promise<void> {
  const form = new FormData();
  form.set("chat_id", String(chatId));
  if (caption) form.set("caption", caption);
  form.set("document", new Blob([new Uint8Array(buffer)]), filename);
  const res = await fetch(`${API_BASE}/sendDocument`, { method: "POST", body: form });
  const data = (await res.json()) as { ok: boolean; description?: string };
  if (!data.ok) throw new Error(`Telegram sendDocument failed: ${data.description}`);
}

export async function getFilePath(fileId: string): Promise<string> {
  const result = await call<{ file_path: string }>("getFile", { file_id: fileId });
  return result.file_path;
}

export async function downloadFile(filePath: string): Promise<Buffer> {
  const res = await fetch(`${FILE_BASE}/${filePath}`);
  if (!res.ok) throw new Error(`Failed to download file ${filePath}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function setWebhook(url: string): Promise<void> {
  await call("setWebhook", {
    url,
    secret_token: config.telegramWebhookSecret,
    allowed_updates: ["message", "callback_query"],
  });
}

export async function deleteWebhook(): Promise<void> {
  await call("deleteWebhook", {});
}
