# Dockerfile for the standby deployment (e.g. Render, Fly.io).
# Railway continues to build via nixpacks.toml — this file is not used there.
# Mirrors nixpacks.toml exactly: Node 20 + ffmpeg (needed for TTS audio
# transcoding) + the same install/build/start commands.
FROM node:20-bookworm-slim

# ffmpeg is required at runtime to transcode Gemini TTS PCM output to MP3.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN NODE_ENV=development npm install --legacy-peer-deps

COPY . .

# Render automatically translates its auto-injected RENDER_EXTERNAL_URL env
# var (this service's own https://xxx.onrender.com URL) into a same-named
# Docker build ARG — no manual configuration needed. We bridge it to the
# app's own generic env var names so the app code stays platform-agnostic:
#  - VITE_API_BASE_URL is read by Vite at build time and baked into the
#    client bundle, so the frontend calls ITSELF instead of Railway.
#  - PUBLIC_BASE_URL is read by the server at runtime for generating
#    self-referential audio/image serve links.
# On any other Docker host (e.g. Fly.io) without RENDER_EXTERNAL_URL, pass
# --build-arg RENDER_EXTERNAL_URL=https://your-public-url instead.
ARG RENDER_EXTERNAL_URL
ENV VITE_API_BASE_URL=${RENDER_EXTERNAL_URL}
ENV PUBLIC_BASE_URL=${RENDER_EXTERNAL_URL}

RUN npm run build

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "dist/index.cjs"]
