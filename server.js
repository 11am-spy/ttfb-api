const express = require("express");
const cors    = require("cors");
const https   = require("https");
const http    = require("http");

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ── Helper fetch ──────────────────────────────────────────────────────────────
function fetchJson(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const lib = urlStr.startsWith("https") ? https : http;
    const req = lib.request(urlStr, options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// ── TikTok via tikwm.com ──────────────────────────────────────────────────────
async function getTikTokUrl(videoUrl) {
  const postData = `url=${encodeURIComponent(videoUrl)}&hd=1`;
  const result = await fetchJson("https://www.tikwm.com/api/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(postData),
    },
    body: postData,
  });

  if (result.body?.code !== 0) throw new Error("Gagal ambil video TikTok.");
  const data = result.body.data;
  const url = data?.play || data?.wmplay;
  if (!url) throw new Error("Link video TikTok tidak ditemukan.");
  return url;
}

// ── Facebook via SaveFrom API ─────────────────────────────────────────────────
async function getFacebookUrl(videoUrl) {
  const postData = `url=${encodeURIComponent(videoUrl)}`;
  const result = await fetchJson("https://savefrom.net/api/convert", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(postData),
      "User-Agent": "Mozilla/5.0",
    },
    body: postData,
  });

  // Coba ambil URL HD atau SD
  const links = result.body?.url;
  if (!links || !Array.isArray(links) || links.length === 0) {
    throw new Error("Gagal ambil video Facebook. Pastikan video publik.");
  }

  const best = links.find(l => l.ext === "mp4") || links[0];
  if (!best?.url) throw new Error("Link video Facebook tidak ditemukan.");
  return best.url;
}

// ── Validasi ──────────────────────────────────────────────────────────────────
const isTikTok   = url => /tiktok\.com|vm\.tiktok\.com/i.test(url);
const isFacebook = url => /facebook\.com|fb\.watch|fb\.com/i.test(url);

// ── Routes ────────────────────────────────────────────────────────────────────
app.get("/", (_req, res) => res.json({ status: "ok", message: "API aktif 🚀" }));

app.post("/api/download", async (req, res) => {
  const { url } = req.body ?? {};
  if (!url) return res.status(400).json({ success: false, message: "URL kosong." });
  if (!isTikTok(url)) return res.status(400).json({ success: false, message: "Bukan link TikTok." });
  try {
    const downloadUrl = await getTikTokUrl(url);
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
    const downloadUrl = await getFacebookUrl(url);
    res.json({ success: true, downloadUrl });
  } catch (err) {
    console.error("[Facebook]", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => console.log(`✅ Server jalan di port ${PORT}`));
