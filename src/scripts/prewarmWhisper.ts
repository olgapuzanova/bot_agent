// Run once at Docker build time so whisper.cpp is compiled (cmake) and the
// model is downloaded into the image layer — the first real voice message in
// production shouldn't have to pay for either.
import { nodewhisper } from "nodejs-whisper";
import { whisperModel, whisperModelRoot } from "../whisperConfig.js";

const filePath = process.argv[2];
if (!filePath) {
  throw new Error("Usage: prewarmWhisper.js <path-to-short-audio-file>");
}

try {
  await nodewhisper(filePath, {
    modelName: whisperModel,
    modelRootPath: whisperModelRoot,
    autoDownloadModelName: whisperModel,
    removeWavFileAfterTranscription: true,
  });
} catch (err) {
  const message = (err as Error).message ?? "";
  // The prewarm file is silent audio, so whisper.cpp legitimately produces no
  // segments and nodejs-whisper treats that as an error — but by this point
  // the cmake build and model download (the actual point of this script)
  // have already happened, so there's nothing left to retry. Any other error
  // (build/download actually failing) should still fail the Docker build.
  if (!message.includes("produced no output")) {
    throw err;
  }
  console.log("Whisper prewarm: build/model download done, empty transcript on silent audio is expected.");
}

console.log("Whisper prewarm complete.");
