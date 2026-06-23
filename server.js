const express = require("express");
const cors    = require("cors");
const https   = require("https");
const http    = require("http");

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

function fetchRaw(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const lib = urlStr.startsWith("https") ? https : http;
    const req = lib.request(urlStr, options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    });
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// ── TikTok via tikwm.com ──────────────────────────────────────────────────────
async function getTikTokUrl(videoUrl) {
  const postData = `url=${encodeURIComponent(videoUrl)}&hd=1`;
  const result = await fetchRaw("https://www.tikwm.com/api/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(postData),
    },
    body: postData,
  });

  const json = JSON.parse(result.body);
  if (json?.code !== 0) throw new Error("Gagal ambil video TikTok.");
  const url = json.data?.play || json.data?.wmplay;
  if (!url) throw new Error("Link video TikTok tidak ditemukan.");
  return url;
}

// ── Facebook via fdown.net ────────────────────────────────────────────────────
async function getFacebookUrl(videoUrl) {
  // Step 1: ambil token dari halaman fdown.net
  const page = await fetchRaw("https://fdown.net/", {
    method: "GET",
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  });

  const tokenMatch = page.body.match(/name="token"\s+value="([^"]+)"/);
  if (!tokenMatch) throw new Error("Gagal ambil token Facebook downloader.");
  const token = tokenMatch[1];

  // Step 2: submit URL
  const postData = `URLz=${encodeURIComponent(videoUrl)}&token=${encodeURIComponent(token)}`;
  const result = await fetchRaw("https://fdown.net/download.php", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(postData),
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Referer": "https://fdown.net/",
    },
    body: postData,
  });

  // Cari link download HD atau SD
  const hdMatch = result.body.match(/href="(https:\/\/[^"]+\.mp4[^"]*)"[^>]*>\s*Download\s*\(HD\)/i);
  const sdMatch = result.body.match(/href="(https:\/\/[^"]+\.mp4[^"]*)"[^>]*>\s*Download\s*\(SD\)/i);
  const url = hdMatch?.[1] || sdMatch?.[1];

  if (!url) throw new Error("Gagal ambil video Facebook. Pastikan video publik.");
  return url;
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
