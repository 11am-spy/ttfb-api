const express  = require("express");
const cors     = require("cors");
const { execFile } = require("child_process");
const path     = require("path");
const fs       = require("fs");

const app  = express();
const PORT = process.env.PORT || 3000;

// ── CORS: izinkan domain Vercel kamu ─────────────────────────────────────────
// Ganti dengan URL Vercel kamu setelah deploy frontend
const ALLOWED_ORIGINS = [
  /\.vercel\.app$/,          // semua subdomain vercel (termasuk preview)
  /^http:\/\/localhost/,     // local dev
  /^http:\/\/127\.0\.0\.1/,
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // curl / Postman
    if (ALLOWED_ORIGINS.some(r => r.test(origin))) return cb(null, true);
    cb(new Error("CORS: origin tidak diizinkan → " + origin));
  },
}));

app.use(express.json());

// ── Cari yt-dlp binary ───────────────────────────────────────────────────────
function ytdlpBin() {
  if (process.env.YTDLP_PATH) return process.env.YTDLP_PATH;
  const local = path.join(__dirname, "bin", "yt-dlp");
  return fs.existsSync(local) ? local : "yt-dlp";
}

// ── Ambil direct URL video via yt-dlp ────────────────────────────────────────
function getVideoUrl(videoUrl) {
  return new Promise((resolve, reject) => {
    const args = [
      "--get-url",
      "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
      "--no-playlist",
      "--no-warnings",
      videoUrl,
    ];

    execFile(ytdlpBin(), args, { timeout: 30_000 }, (err, stdout, stderr) => {
      if (err) {
        console.error("[yt-dlp]", stderr || err.message);
        return reject(new Error("Gagal memproses video. Pastikan link benar & video publik."));
      }
      const url = stdout.trim().split("\n").filter(Boolean)[0];
      if (!url?.startsWith("http")) return reject(new Error("Tidak dapat link video."));
      resolve(url);
    });
  });
}

// ── Validasi ─────────────────────────────────────────────────────────────────
const isTikTok   = url => /tiktok\.com|vm\.tiktok\.com/i.test(url);
const isFacebook = url => /facebook\.com|fb\.watch|fb\.com/i.test(url);

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/", (_req, res) => res.json({ status: "ok", message: "API aktif 🚀" }));

// ── TikTok ───────────────────────────────────────────────────────────────────
app.post("/api/download", async (req, res) => {
  const { url } = req.body ?? {};
  if (!url) return res.status(400).json({ success: false, message: "URL kosong." });
  if (!isTikTok(url)) return res.status(400).json({ success: false, message: "Bukan link TikTok." });

  try {
    const downloadUrl = await getVideoUrl(url);
    res.json({ success: true, downloadUrl });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Facebook ─────────────────────────────────────────────────────────────────
app.post("/api/facebook", async (req, res) => {
  const { url } = req.body ?? {};
  if (!url) return res.status(400).json({ success: false, message: "URL kosong." });
  if (!isFacebook(url)) return res.status(400).json({ success: false, message: "Bukan link Facebook." });

  try {
    const downloadUrl = await getVideoUrl(url);
    res.json({ success: true, downloadUrl });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server jalan di port ${PORT}`);
  console.log(`   yt-dlp: ${ytdlpBin()}`);
});
