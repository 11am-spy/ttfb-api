const express    = require("express");
const cors       = require("cors");
const YTDlpWrap  = require("yt-dlp-wrap").default;

const app  = express();
const PORT = process.env.PORT || 3000;

// Izinkan semua origin
app.use(cors());
app.use(express.json());

const ytDlp = new YTDlpWrap();

async function ensureYtDlp() {
  try {
    await ytDlp.getVersion();
  } catch {
    console.log("Downloading yt-dlp binary...");
    await YTDlpWrap.downloadFromGithub();
    console.log("yt-dlp ready!");
  }
}

async function getVideoUrl(videoUrl) {
  const output = await ytDlp.execPromise([
    videoUrl,
    "--get-url",
    "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
    "--no-playlist",
    "--no-warnings",
  ]);

  const url = output.trim().split("\n").filter(Boolean)[0];
  if (!url?.startsWith("http")) throw new Error("Tidak dapat link video.");
  return url;
}

const isTikTok   = url => /tiktok\.com|vm\.tiktok\.com/i.test(url);
const isFacebook = url => /facebook\.com|fb\.watch|fb\.com/i.test(url);

app.get("/", (_req, res) => res.json({ status: "ok", message: "API aktif 🚀" }));

app.post("/api/download", async (req, res) => {
  const { url } = req.body ?? {};
  if (!url) return res.status(400).json({ success: false, message: "URL kosong." });
  if (!isTikTok(url)) return res.status(400).json({ success: false, message: "Bukan link TikTok." });

  try {
    const downloadUrl = await getVideoUrl(url);
    res.json({ success: true, downloadUrl });
  } catch (err) {
    console.error("[TikTok]", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/facebook", async (req, res) => {
  const { url } = req.body ?? {};
  if (!url) return res.status(400).json({ success: false, message: "URL kosong." });
  if (!isFacebook(url)) return res.status(400).json({ success: false, message: "Bukan link Facebook." });

  try {
    const downloadUrl = await getVideoUrl(url);
    res.json({ success: true, downloadUrl });
  } catch (err) {
    console.error("[Facebook]", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(PORT, async () => {
  console.log(`✅ Server jalan di port ${PORT}`);
  await ensureYtDlp();
});
