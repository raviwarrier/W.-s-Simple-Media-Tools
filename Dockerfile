# syntax=docker/dockerfile:1
FROM node:20-bookworm-slim

# Install system dependencies: FFmpeg, ffprobe, curl, python3 (for yt-dlp)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    python3 \
    ca-certificates \
    && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests and install packages
COPY package*.json ./
RUN npm install

# Copy application source code and build production bundles
COPY . .
RUN npm run build

# Ensure persistent data directory exists
RUN mkdir -p data

EXPOSE 4261

ENV NODE_ENV=production
ENV PORT=4261

CMD ["npm", "start"]
