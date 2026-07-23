import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { nodewhisper } from "nodejs-whisper";
import { whisperModel, whisperModelRoot } from "./whisperConfig.js";

// whisper.cpp (via nodejs-whisper) prints timestamped segments to stdout —
// there's no plain-text stdout mode exposed, so strip the "[00:00:00.000 -->
// 00:00:02.000]" prefix ourselves and join what's left.
const TIMESTAMP_PREFIX = /^\[\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}\]\s*/;

function stripTimestamps(raw: string): string {
  return raw
    .split("\n")
    .map((line) => line.replace(TIMESTAMP_PREFIX, "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

export async function transcribeVoice(oggBuffer: Buffer): Promise<string> {
  const tempPath = path.join(os.tmpdir(), `voice-${Date.now()}-${Math.random().toString(36).slice(2)}.ogg`);
  fs.writeFileSync(tempPath, oggBuffer);

  try {
    const raw = await nodewhisper(tempPath, {
      modelName: whisperModel,
      modelRootPath: whisperModelRoot,
      autoDownloadModelName: whisperModel,
      removeWavFileAfterTranscription: true,
      whisperOptions: {},
    });

    const text = stripTimestamps(raw);
    if (!text) {
      throw new Error("Whisper returned an empty transcript.");
    }
    return text;
  } finally {
    fs.rmSync(tempPath, { force: true });
  }
}
