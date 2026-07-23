import fs from "node:fs";
import path from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { config } from "./config.js";
import { getSessionId, saveSessionId } from "./db.js";
import { editMessageReplyMarkup, editMessageText, sendDocument, sendLongMessage, sendMessage } from "./telegramApi.js";
import { waitForConfirmation } from "./confirmations.js";
import { isDangerousBashCommand } from "./dangerous.js";
import { filesChangedSince, snapshotFiles } from "./files.js";

const SYSTEM_PROMPT_APPEND = `
You are reached exclusively through a private Telegram chat with your one operator — there is no terminal on the other end.
Keep replies concise and readable as a Telegram message (plain text, short paragraphs, no huge unbroken code dumps — attach long files instead of pasting them).
You may read/write files and run shell commands inside your working directory freely.
Bash commands that look destructive or irreversible (deleting data, force-pushing, spending money) will pause and ask the operator to confirm in the chat before they run — proceed normally otherwise.
`;

const MODEL = "claude-sonnet-4-5";

// Serial per-chat queue so a chat never has two overlapping agent turns / session resumes.
const chatQueues = new Map<number, Promise<void>>();

export function enqueueForChat(chatId: number, task: () => Promise<void>): void {
  const prev = chatQueues.get(chatId) ?? Promise.resolve();
  const next = prev.then(task, task);
  chatQueues.set(
    chatId,
    next.catch((err) => {
      console.error(`[chat ${chatId}] agent turn failed`, err);
    })
  );
}

function describeToolUse(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case "Bash":
      return `\`${String(input.command ?? "").slice(0, 300)}\``;
    case "Read":
      return `читаю ${input.file_path}`;
    case "Write":
      return `пишу файл ${input.file_path}`;
    case "Edit":
      return `редактирую ${input.file_path}`;
    case "Grep":
      return `ищу по коду: ${input.pattern}`;
    case "Glob":
      return `ищу файлы: ${input.pattern}`;
    case "WebSearch":
      return `ищу в интернете: ${input.query}`;
    case "WebFetch":
      return `открываю: ${input.url}`;
    default:
      return String(toolName);
  }
}

export async function runAgentTurn(chatId: number, prompt: string): Promise<void> {
  const sessionId = getSessionId(chatId);
  const filesBefore = snapshotFiles(config.agentWorkdir);

  let progressMessageId: number | null = null;
  let progressText = "";

  async function appendProgress(line: string): Promise<void> {
    progressText = progressText ? `${progressText}\n${line}` : line;
    if (progressText.length > 3500) {
      progressText = progressText.slice(progressText.length - 3500);
    }
    if (progressMessageId === null) {
      const msg = await sendMessage(chatId, progressText, { disableNotification: true });
      progressMessageId = msg.message_id;
    } else {
      await editMessageText(chatId, progressMessageId, progressText);
    }
  }

  const agentQuery = query({
    prompt,
    options: {
      systemPrompt: { type: "preset", preset: "claude_code", append: SYSTEM_PROMPT_APPEND },
      model: MODEL,
      cwd: config.agentWorkdir,
      resume: sessionId ?? undefined,
      settingSources: [],
      allowedTools: ["Read", "Write", "Edit", "Grep", "Glob", "WebSearch", "WebFetch"],
      permissionMode: "default",
      canUseTool: async (toolName: string, input: Record<string, unknown>) => {
        if (toolName !== "Bash") {
          return { behavior: "allow" as const, updatedInput: input };
        }

        const command = String(input.command ?? "");
        if (!isDangerousBashCommand(command)) {
          return { behavior: "allow" as const, updatedInput: input };
        }

        const confirmMsg = await sendMessage(
          chatId,
          `⚠️ Хочу выполнить потенциально опасную команду:\n\`${command}\`\n\nПодтвердить?`,
          {
            replyMarkup: [
              [
                { text: "✅ Разрешить", callback_data: "confirm:allow" },
                { text: "🚫 Отклонить", callback_data: "confirm:deny" },
              ],
            ],
          }
        );

        const approved = await waitForConfirmation(chatId);
        await editMessageReplyMarkup(chatId, confirmMsg.message_id);

        if (approved) {
          await appendProgress(`✅ Подтверждено: \`${command.slice(0, 300)}\``);
          return { behavior: "allow" as const, updatedInput: input };
        }
        await appendProgress(`🚫 Отклонено: \`${command.slice(0, 300)}\``);
        return { behavior: "deny" as const, message: "The operator declined this command via Telegram." };
      },
    },
  });

  let finalText = "";
  let newSessionId = sessionId;

  for await (const message of agentQuery as AsyncGenerator<any, void>) {
    switch (message.type) {
      case "tool_use":
        await appendProgress(`🔧 ${describeToolUse(message.tool_name, message.tool_input ?? {})}`);
        break;
      case "tool_result":
        if (message.is_error) {
          await appendProgress("❌ инструмент вернул ошибку");
        }
        break;
      case "result":
        newSessionId = message.session_id ?? newSessionId;
        finalText = typeof message.result === "string" ? message.result : finalText;
        break;
      default:
        break;
    }
  }

  saveSessionId(chatId, newSessionId ?? null);
  await sendLongMessage(chatId, finalText || "Готово.");

  const changedFiles = filesChangedSince(config.agentWorkdir, filesBefore);
  for (const filePath of changedFiles) {
    try {
      const buffer = fs.readFileSync(filePath);
      await sendDocument(chatId, buffer, path.relative(config.agentWorkdir, filePath));
    } catch (err) {
      console.error(`Failed to send file ${filePath}`, err);
    }
  }
}
