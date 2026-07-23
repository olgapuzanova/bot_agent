// Run once at Docker build time so whisper.cpp is compiled (cmake) and the
// model is downloaded into the image layer — the first real voice message in
// production shouldn't have to pay for either.
import { nodewhisper } from "nodejs-whisper";
import { whisperModel, whisperModelRoot } from "../whisperConfig.js";

const filePath = process.argv[2];
if (!filePath) {
  throw new Error("Usage: prewarmWhisper.js <path-to-short-audio-file>");
}

await nodewhisper(filePath, {
  modelName: whisperModel,
  modelRootPath: whisperModelRoot,
  autoDownloadModelName: whisperModel,
  removeWavFileAfterTranscription: true,
});

console.log("Whisper prewarm complete.");
