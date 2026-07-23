// Deliberately separate from config.ts: this has no required env vars, so it
// can be imported by the Docker-build-time prewarm script without the rest
// of the (validated) app config being present.
export const whisperModel = process.env.WHISPER_MODEL ?? "base";
export const whisperModelRoot = process.env.WHISPER_MODEL_ROOT ?? "/app/whisper-models";
