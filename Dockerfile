FROM node:20-slim

WORKDIR /app

# python3/make/g++/cmake: better-sqlite3 + whisper.cpp (via nodejs-whisper) build from source.
# ffmpeg: nodejs-whisper shells out to it to convert voice notes to 16kHz mono WAV.
# curl: nodejs-whisper shells out to it to download the ggml model file.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ cmake git ffmpeg curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

ENV NODE_ENV=production
ENV WHISPER_MODEL_ROOT=/app/whisper-models
ENV WHISPER_MODEL=base

# Compile whisper.cpp (cmake) and download the model now, baked into the image,
# so the first real voice message in production isn't the one paying for it.
RUN ffmpeg -f lavfi -i anullsrc=r=16000:cl=mono -t 1 -c:a pcm_s16le /tmp/prewarm.wav \
    && node dist/scripts/prewarmWhisper.js /tmp/prewarm.wav \
    && rm -f /tmp/prewarm.wav

EXPOSE 3000

CMD ["node", "dist/index.js"]
