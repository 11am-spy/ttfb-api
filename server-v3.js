const express = require("express");
const cors    = require("cors");
const youtubeDl = require("youtube-dl-exec");

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

async function getVideoUrl(videoUrl) {
  const result = await youtubeDl(videoUrl, {
    getUrl: true,
    format: "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
    noPlaylist: true,
    noWarnings: true,
  });

  // result bisa string atau array
  const url = Array.isArray(result) ? result[0] : result.toString().trim().split("\n")[0];
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

app.listen(PORT, () => {
  console.log(`✅ Server jalan di port ${PORT}`);
});
