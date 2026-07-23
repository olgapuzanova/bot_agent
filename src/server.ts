import express from "express";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { downloadFile, getFilePath, sendMessage, answerCallbackQuery } from "./telegramApi.js";
import { enqueueForChat, runAgentTurn } from "./agentRunner.js";
import { hasPendingConfirmation, resolvePendingConfirmation } from "./confirmations.js";
import { transcribeVoice } from "./voice.js";

interface TelegramMessage {
  message_id: number;
  chat: { id: number };
  from?: { id: number };
  text?: string;
  voice?: { file_id: string };
  document?: { file_id: string; file_name?: string };
  photo?: Array<{ file_id: string }>;
  caption?: string;
}

interface TelegramUpdate {
  message?: TelegramMessage;
  callback_query?: {
    id: string;
    from: { id: number };
    message?: { chat: { id: number } };
    data?: string;
  };
}

export const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.send("ok"));

app.post(config.telegramWebhookPath, async (req, res) => {
  const secret = req.header("X-Telegram-Bot-Api-Secret-Token");
  if (secret !== config.telegramWebhookSecret) {
    res.sendStatus(401);
    return;
  }

  // Ack immediately — Telegram retries if the webhook is slow, and the agent
  // turn can take much longer than that.
  res.sendStatus(200);

  const update = req.body as TelegramUpdate;
  try {
    await handleUpdate(update);
  } catch (err) {
    console.error("Failed to handle update", err);
  }
});

async function handleUpdate(update: TelegramUpdate): Promise<void> {
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
    return;
  }
  if (update.message) {
    await handleMessage(update.message);
  }
}

async function handleCallbackQuery(cq: NonNullable<TelegramUpdate["callback_query"]>): Promise<void> {
  if (cq.from.id !== config.telegramOwnerId) {
    await answerCallbackQuery(cq.id, "Not authorized");
    return;
  }
  const chatId = cq.message?.chat.id;
  if (chatId === undefined || !cq.data?.startsWith("confirm:")) {
    await answerCallbackQuery(cq.id);
    return;
  }
  const approved = cq.data === "confirm:allow";
  const resolved = resolvePendingConfirmation(chatId, approved);
  await answerCallbackQuery(cq.id, resolved ? (approved ? "Разрешено" : "Отклонено") : "Уже обработано");
}

async function handleMessage(message: TelegramMessage): Promise<void> {
  const fromId = message.from?.id;
  const chatId = message.chat.id;

  if (fromId !== config.telegramOwnerId) {
    return; // silently ignore anyone who isn't the owner
  }

  if (hasPendingConfirmation(chatId)) {
    await sendMessage(chatId, "Сначала подтвердите или отклоните предыдущую операцию кнопками выше.");
    return;
  }

  let prompt: string | null = null;

  if (message.voice) {
    await sendMessage(chatId, "🎤 Расшифровываю голосовое...", { disableNotification: true });
    const filePath = await getFilePath(message.voice.file_id);
    const buffer = await downloadFile(filePath);
    prompt = await transcribeVoice(buffer);
  } else if (message.document || message.photo) {
    const fileId = message.document?.file_id ?? message.photo?.at(-1)?.file_id;
    if (fileId) {
      const filePath = await getFilePath(fileId);
      const buffer = await downloadFile(filePath);
      const filename = message.document?.file_name ?? path.basename(filePath);
      const inboxDir = path.join(config.agentWorkdir, "inbox");
      fs.mkdirSync(inboxDir, { recursive: true });
      const savedPath = path.join(inboxDir, filename);
      fs.writeFileSync(savedPath, buffer);
      prompt = `${message.caption ?? "Вот файл, посмотри его."}\n\n(Файл сохранён в ${savedPath})`;
    }
  } else if (message.text) {
    prompt = message.text;
  }

  if (!prompt) return;

  await sendMessage(chatId, "🤖 Принял, начинаю работу...", { disableNotification: true });
  enqueueForChat(chatId, () => runAgentTurn(chatId, prompt as string));
}
