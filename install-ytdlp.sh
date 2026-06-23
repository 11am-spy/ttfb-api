#!/bin/bash
set -e

echo "▶ Install yt-dlp..."
mkdir -p bin
curl -sSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o bin/yt-dlp
chmod +x bin/yt-dlp
echo "✅ yt-dlp $(bin/yt-dlp --version)"

echo "▶ Install npm dependencies..."
npm install

echo "✅ Build selesai!"
