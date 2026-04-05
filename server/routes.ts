import type { Express } from "express";
import { type Server } from "http";
import path from "path";
import fs from "fs";
import { execFile, execFileSync } from "child_process";
import { promisify } from "util";
import { createHmac, randomBytes as cryptoRandomBytes } from "crypto";
import QRCode from "qrcode";

// Resolve ffmpeg binary: system PATH first, then ffmpeg-static npm package
function resolveFfmpeg(): string {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return 'ffmpeg'; // system ffmpeg works
  } catch {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ffmpegStatic = require('ffmpeg-static') as string;
      if (ffmpegStatic && fs.existsSync(ffmpegStatic)) return ffmpegStatic;
    } catch {}
    return 'ffmpeg'; // best effort fallback
  }
}
const FFMPEG_BIN = resolveFfmpeg();
import multer from "multer";
import sharp from "sharp";
import { storage } from "./storage";
import { uploadToR2, deleteFromR2, isR2Configured } from "./r2";
import { insertUserProgressSchema, insertTourSiteSchema, insertAttractionSchema } from "@shared/schema";

// ── Image compression helper ─────────────────────────────────────────────────
// Resizes to max 1200px wide/tall and compresses to WebP (quality 82).
// Falls back to original buffer if sharp fails for any reason.
async function compressImage(buffer: Buffer, mimeType: string): Promise<{ buf: Buffer; mime: string }> {
  try {
    const compressed = await sharp(buffer)
      .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    return { buf: compressed, mime: "image/webp" };
  } catch (err) {
    console.warn("[compressImage] sharp failed, using original:", err);
    return { buf: buffer, mime: mimeType };
  }
}

const execFileAsync = promisify(execFile);

// ─── Audio transcoding helper ─────────────────────────────────────────────────
// Converts any audio buffer (PCM/WAV/MP3/etc) to browser-compatible MP3
// (MPEG-1, 44.1kHz, 128kbps mono). Uses ffmpeg.
async function transcodeToMp3(inputBuf: Buffer, inputFormat?: string): Promise<Buffer> {
  const tmpIn = path.join(AUDIO_DIR_LAZY, `tmp_in_${Date.now()}.raw`);
  const tmpOut = path.join(AUDIO_DIR_LAZY, `tmp_out_${Date.now()}.mp3`);
  try {
    fs.writeFileSync(tmpIn, inputBuf);
    const inputArgs = inputFormat ? ["-f", inputFormat] : [];
    await execFileAsync(FFMPEG_BIN, [
      "-y",
      ...inputArgs,
      "-i", tmpIn,
      "-ar", "44100",
      "-ab", "128k",
      "-ac", "1",
      "-f", "mp3",
      tmpOut,
    ]);
    return fs.readFileSync(tmpOut);
  } finally {
    try { fs.unlinkSync(tmpIn); } catch {}
    try { fs.unlinkSync(tmpOut); } catch {}
  }
}

// Lazy-init AUDIO_DIR path so it's accessible in transcodeToMp3 before route registration
const AUDIO_DIR_LAZY = path.join(process.cwd(), "data", "audio");

// ─── Supported languages ─────────────────────────────────────────────────────
const SUPPORTED_LANGS = ["en", "al", "gr", "it", "es", "de", "fr", "ar", "sl", "pt", "cn"] as const;
type SupportedLang = typeof SUPPORTED_LANGS[number];

function audioField(lang: SupportedLang): string {
  const map: Record<SupportedLang, string> = {
    en: "audioUrlEn", al: "audioUrlAl", gr: "audioUrlGr",
    it: "audioUrlIt", es: "audioUrlEs", de: "audioUrlDe",
    fr: "audioUrlFr", ar: "audioUrlAr", sl: "audioUrlSl",
  };
  return map[lang];
}

// ─── Gemini translation helper ────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

async function translateWithGemini(text: string, targetLang: string): Promise<string> {
  const langNames: Record<string, string> = {
    al: "Albanian", gr: "Greek", it: "Italian", es: "Spanish",
    de: "German", fr: "French", ar: "Arabic",
    sl: "Slovenian (standard Slavic reference language)",
    pt: "Portuguese",
    cn: "Simplified Chinese",
  };
  const langName = langNames[targetLang] || targetLang;

  // Use fetch to call Gemini REST API
  const prompt = `Translate the following tourism description text into ${langName}.
Keep the tone warm, friendly, and natural — like a knowledgeable local guide speaking to a visitor.
Do NOT use em-dashes (—), avoid ellipses (...), avoid parentheses where possible.
Write in complete natural sentences. Do not add any explanation or commentary, only output the translated text.

Text to translate:
${text}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Gemini API error ${resp.status}: ${err}`);
  }

  const data = await resp.json() as any;
  const translated = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return translated.trim();
}

// ─── Listen counter (in-memory, resets on redeploy — future: persist to DB) ───────────
// Key: siteId (number) | Value: total listens this deployment
const listenCounts = new Map<number, number>();
function incrementListenCount(siteId: number) {
  listenCounts.set(siteId, (listenCounts.get(siteId) || 0) + 1);
}

// ─── Config ───────────────────────────────────────────────────────────────────
// Absolute base URL used to form persistent media URLs stored in the DB.
// On Railway this resolves to the public domain; locally it falls back to localhost.
// RAILWAY_BASE: used ONLY for generating serve URLs for images and audio.
// MUST always be the Railway direct URL — never albaniaaudiotours.com.
// GoDaddy forwarding strips URL paths, breaking all /api/images/db/... requests.
// Do NOT use RAILWAY_PUBLIC_DOMAIN here — that domain goes through forwarding.
const RAILWAY_BASE = "https://albania-audio-tours-production.up.railway.app";

// ─── Auth ─────────────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "AlbaTour2026!";
const ADMIN_TOKEN = "albatour-admin-secret-token"; // simple shared token

function requireAdmin(req: any, res: any, next: any) {
  const auth = req.headers["x-admin-token"] || req.query.token;
  if (auth !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// 2-step protection: all DELETE routes require this header in addition to admin token.
// The admin UI must show a confirmation dialog and set x-confirm-delete: yes.
// Prevents any accidental data wipe — media, text, tours, itineraries are never
// deleted without explicit admin intent AND header confirmation.
function requireDeleteConfirmation(req: any, res: any, next: any) {
  const confirm = req.headers["x-confirm-delete"];
  if (confirm !== "yes") {
    return res.status(403).json({
      error: "Destructive action requires 2-step confirmation.",
      hint: "Set header x-confirm-delete: yes after confirming in the admin panel."
    });
  }
  next();
}

// ─── Upload dirs ─────────────────────────────────────────────────────────────
const AUDIO_DIR = path.join(process.cwd(), "data", "audio");
const IMAGE_DIR = path.join(process.cwd(), "data", "images");
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });
if (!fs.existsSync(IMAGE_DIR)) fs.mkdirSync(IMAGE_DIR, { recursive: true });
// Clear any legacy image files on disk on every startup.
// All images are stored in the DB as base64 — files on disk are stale leftovers.
try {
  const legacyFiles = fs.readdirSync(IMAGE_DIR);
  if (legacyFiles.length > 0) {
    legacyFiles.forEach(f => { try { fs.unlinkSync(path.join(IMAGE_DIR, f)); } catch {} });
    console.log(`[startup] Cleared ${legacyFiles.length} legacy image file(s) from disk.`);
  }
} catch { /* non-fatal */ }

const audioStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });
    cb(null, AUDIO_DIR);
  },
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}_${safe}`);
  },
});

// Use memory storage for images — stored as base64 in DB, never filesystem
const imageStorage = multer.memoryStorage();

const upload = multer({
  storage: audioStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("audio/") || file.mimetype === "application/octet-stream") {
      cb(null, true);
    } else {
      cb(new Error("Only audio files are allowed"));
    }
  },
});

const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

const AUDIO_LANGS = ['En','Al','Gr','It','Es','De','Fr','Ar','Sl'] as const;

// Strip large data URIs and replace with lightweight serve URLs.
// KEY RULE: gallery[0] is always the hero image shown to visitors.
// imageUrl is kept for legacy compatibility but gallery takes precedence.
function stripImageData(obj: any, type: 'attraction'|'site'): any {
  if (!obj) return obj;
  const out = { ...obj };

  // Replace imageUrl data URI with a proper serve URL
  if (out.imageUrl && out.imageUrl.startsWith('data:')) {
    out.imageUrl = `${RAILWAY_BASE}/api/images/db/${type}/${obj.id}`;
  }
  // Clear ONLY stale self-referencing serve URLs that point to the legacy single-image endpoint
  // (those are now superseded by gallery[0]). Keep gallery serve URLs — they are valid.
  // A stale URL looks like: .../api/images/db/site/1  (no /gallery/ segment)
  if (out.imageUrl) {
    const hasGallery = out.imageUrl.includes('/gallery/');
    const isServeUrl = out.imageUrl.includes('/api/images/db/');
    const isLegacyRailway = out.imageUrl.includes('railway.app') && isServeUrl && !hasGallery;
    if (isServeUrl && !hasGallery && !isLegacyRailway) {
      // Stale single-image serve URL — clear it so gallery[0] takes over below
      out.imageUrl = null;
    }
    // Note: gallery serve URLs (/api/images/db/.../gallery/N) are kept as-is
  }

  // Replace gallery data URIs with serve URLs
  if (Array.isArray(out.images) && out.images.length > 0) {
    out.images = out.images.map((img: string, idx: number) =>
      img && img.startsWith('data:')
        ? `${RAILWAY_BASE}/api/images/db/${type}/${obj.id}/gallery/${idx}`
        : img
    );
    // gallery[0] is always the canonical hero image
    if (!out.imageUrl) {
      out.imageUrl = out.images[0];
    }
  }

  return out;
}

// Replace any data URI audio fields with a lightweight serve URL
function stripAudioData(obj: any, type: 'attraction'|'site'): any {
  if (!obj) return obj;
  const out = { ...obj };
  for (const lang of AUDIO_LANGS) {
    const field = `audioUrl${lang}` as string;
    const val: string | null = out[field];
    if (val && val.startsWith('data:')) {
      // Use b64 length as version to bust browser cache when audio is re-uploaded
      const b64 = val.split(',')[1] || '';
      out[field] = `${RAILWAY_BASE}/api/audio/serve/${type}/${obj.id}/${lang.toLowerCase()}?v=${b64.length}`;
    }
  }
  return out;
}

// ── Startup migration: strip external/placeholder imageUrls from DB ──────────
// Wipes any imageUrl or images[] entries that are NOT admin-uploaded gallery
// serve URLs (i.e. not /api/images/db/.../gallery/N).
// This removes Unsplash, picsum, and any other external defaults permanently.
async function runStartupImageCleanup(): Promise<void> {
  try {
    const isExternal = (url: string | null | undefined): boolean => {
      if (!url) return false;
      // Keep valid gallery serve URLs — these are admin-uploaded
      if (url.includes('/api/images/db/') && url.includes('/gallery/')) return false;
      // Keep data URIs (raw uploaded images not yet migrated)
      if (url.startsWith('data:')) return false;
      // Everything else (Unsplash, picsum, http(s):// external) is external placeholder
      return url.startsWith('http://') || url.startsWith('https://');
    };

    const sites = await storage.getAllSites();
    for (const site of sites) {
      const s = site as any;
      const cleanedImages: string[] = (s.images || []).filter((img: string) => !isExternal(img));
      const imagesChanged = cleanedImages.length !== (s.images || []).length;
      const imageUrlChanged = isExternal(s.imageUrl);
      if (imagesChanged || imageUrlChanged) {
        const newImageUrl = imageUrlChanged
          ? (cleanedImages[0] || null)
          : s.imageUrl;
        await storage.updateSite(s.id, {
          images: imagesChanged ? cleanedImages : s.images,
          imageUrl: newImageUrl,
        } as any);
        console.log(`[startup] Cleaned external image(s) from site ${s.id} (${s.nameEn || s.slug})`);
      }
    }

    const attractions = await storage.getAllAttractions();
    for (const attr of attractions) {
      const a = attr as any;
      const cleanedImages: string[] = (a.images || []).filter((img: string) => !isExternal(img));
      const imagesChanged = cleanedImages.length !== (a.images || []).length;
      const imageUrlChanged = isExternal(a.imageUrl);
      if (imagesChanged || imageUrlChanged) {
        const newImageUrl = imageUrlChanged
          ? (cleanedImages[0] || null)
          : a.imageUrl;
        await storage.updateAttraction(a.id, {
          images: imagesChanged ? cleanedImages : a.images,
          imageUrl: newImageUrl,
        } as any);
        console.log(`[startup] Cleaned external image(s) from attraction ${a.id} (${a.nameEn || a.slug})`);
      }
    }
    console.log('[startup] Image cleanup complete.');
  } catch (err) {
    console.error('[startup] Image cleanup error (non-fatal):', err);
  }
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Run image cleanup on every server start — idempotent, non-destructive to gallery uploads
  runStartupImageCleanup();

  // ── Public API ──────────────────────────────────────────────────────────────
  app.get("/api/sites", async (_req, res) => {
    const sites = await storage.getAllSites();
    res.json(sites.map(s => stripImageData(stripAudioData(s, 'site'), 'site')));
  });

  app.get("/api/sites/:slug", async (req, res) => {
    const site = await storage.getSiteBySlug(req.params.slug);
    if (!site) return res.status(404).json({ error: "Not found" });
    res.json(stripImageData(stripAudioData(site, 'site'), 'site'));
  });

  app.get("/api/progress/:sessionId", async (req, res) => {
    const progress = await storage.getProgress(req.params.sessionId);
    res.json(progress);
  });

  app.post("/api/progress", async (req, res) => {
    const parsed = insertUserProgressSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    const record = await storage.addProgress(parsed.data);
    res.json(record);
  });

  app.get("/api/leaderboard", async (_req, res) => {
    const lb = await storage.getLeaderboard();
    res.json(lb);
  });

  // Serve uploaded audio files (legacy file-based)
  app.use("/api/audio", (req, res, next) => {
    // Skip the new serve routes
    if (req.path.startsWith('/serve/')) return next();
    const filePath = path.join(AUDIO_DIR, req.path.replace(/^\//, ""));
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      next();
    }
  });

  // ── Dedicated audio serve endpoint (reads data URI from DB) ───────────────
  app.get("/api/audio/serve/:type/:id/:lang", async (req, res) => {
    const { type, id, lang } = req.params;
    const entityId = parseInt(id);
    if (isNaN(entityId)) return res.status(400).send('Invalid id');
    const cap = lang.charAt(0).toUpperCase() + lang.slice(1);
    const field = `audioUrl${cap}`;
    let val: string | null | undefined;
    try {
      if (type === 'site') {
        const site = await storage.getSiteById(entityId);
        val = site ? (site as any)[field] : null;
      } else {
        const attr = await storage.getAttractionById(entityId);
        val = attr ? (attr as any)[field] : null;
      }
    } catch { val = null; }
    if (!val) return res.status(404).send('Audio not found');
    if (val.startsWith('data:')) {
      // Detect MIME type from the data URI (audio/wav or audio/mpeg)
      const mimeMatch = val.match(/^data:(audio\/[^;]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'audio/wav';
      const b64 = val.split(',')[1];
      const buf = Buffer.from(b64, 'base64');
      // Support HTTP range requests — required for browsers to stream <audio> elements
      const totalSize = buf.length;
      const rangeHeader = req.headers['range'];
      res.set('Content-Type', mimeType);
      res.set('Accept-Ranges', 'bytes');
      res.set('Cache-Control', 'public, max-age=3600, must-revalidate');

      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
        const start = match?.[1] ? parseInt(match[1]) : 0;
        const end = match?.[2] ? parseInt(match[2]) : totalSize - 1;
        const chunkSize = end - start + 1;
        res.set('Content-Range', `bytes ${start}-${end}/${totalSize}`);
        res.set('Content-Length', chunkSize.toString());
        res.status(206);
        return res.send(buf.slice(start, end + 1));
      }
      res.set('Content-Length', totalSize.toString());
      return res.send(buf);
    }
    // Legacy: redirect to file URL
    res.redirect(val);
  });

  // ── Serve image from DB base64 (permanent — survives all redeploys) ──────────
  // GET /api/images/db/site/:id  or  /api/images/db/attraction/:id
  app.get("/api/images/db/:type/:id", async (req, res) => {
    const { type, id } = req.params;
    const numId = parseInt(id);
    let imageData: string | null = null;
    if (type === "site") {
      const site = await storage.getSiteById(numId);
      imageData = (site as any)?.imageUrl || null;
    } else if (type === "attraction") {
      const attr = await storage.getAttractionById(numId);
      imageData = (attr as any)?.imageUrl || null;
    }
    if (!imageData) return res.status(404).json({ error: "Image not found" });
    if (imageData.startsWith("data:")) {
      const mimeMatch = imageData.match(/^data:([^;]+);base64,/);
      const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
      const b64 = imageData.split(",")[1];
      const buf = Buffer.from(b64, "base64");
      res.setHeader("Content-Type", mime);
      // Cache at edge (Cloudflare) for 1 year — safe because uploads always use
      // a cache-busted URL (?_t=timestamp), so replaced images get a new URL.
      // The browser must revalidate each session (no-cache) but Cloudflare serves
      // from edge without hitting Railway on repeat visits.
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      // ETag for conditional requests
      const etag = `"${Buffer.from(b64.slice(0, 32)).toString("hex")}"` ;
      res.setHeader("ETag", etag);
      if (req.headers["if-none-match"] === etag) return res.status(304).end();
      return res.send(buf);
    }
    // Prevent infinite redirect loops for self-referencing serve URLs
    if (imageData.includes("/api/images/db/")) {
      return res.status(404).json({ error: "Image not found — please re-upload via gallery" });
    }
    // Redirect to external URL (e.g. Unsplash)
    res.redirect(imageData);
  });

  // GET /api/images/db/site/:id/gallery/:index  — serve gallery image by index
  // GET /api/images/db/attraction/:id/gallery/:index
  app.get("/api/images/db/:type/:id/gallery/:index", async (req, res) => {
    const { type, id, index } = req.params;
    const numId  = parseInt(id);
    const numIdx = parseInt(index);
    let entity: any = null;
    if (type === "site") {
      entity = await storage.getSiteById(numId);
    } else if (type === "attraction") {
      entity = await storage.getAttractionById(numId);
    }
    const gallery: string[] = entity?.images || [];
    const imageData = gallery[numIdx] || null;
    if (!imageData) return res.status(404).json({ error: "Gallery image not found" });
    if (imageData.startsWith("data:")) {
      const mimeMatch = imageData.match(/^data:([^;]+);base64,/);
      const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
      const b64  = imageData.split(",")[1];
      const buf  = Buffer.from(b64, "base64");
      res.setHeader("Content-Type", mime);
      // Cache at edge (Cloudflare) for 1 year — safe because uploads always use
      // a cache-busted URL (?_t=timestamp), so replaced images get a new URL.
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      const etag = `"${Buffer.from(b64.slice(0, 32)).toString("hex")}"` ;
      res.setHeader("ETag", etag);
      if (req.headers["if-none-match"] === etag) return res.status(304).end();
      return res.send(buf);
    }
    // Prevent redirect loops: if the stored gallery value is itself a serve URL,
    // it means the image was stored incorrectly. Return 404.
    if (imageData.includes("/api/images/db/")) {
      return res.status(404).json({ error: "Gallery image not found — please re-upload" });
    }
    res.redirect(imageData);
  });

  // Serve uploaded image files (legacy filesystem — kept for backward compat)
  app.use("/api/images", (req, res, next) => {
    const filePath = path.join(IMAGE_DIR, req.path.replace(/^\//, ""));
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      next();
    }
  });

  // ── Public: Attractions ────────────────────────────────────────────────────
  app.get("/api/attractions", async (_req, res) => {
    const attrs = await storage.getAllAttractions();
    res.json(attrs.map(a => stripImageData(stripAudioData(a, 'attraction'), 'attraction')));
  });

  app.get("/api/attractions/:destinationSlug", async (req, res) => {
    const attrs = await storage.getAttractionsByDestination(req.params.destinationSlug);
    res.json(attrs.map(a => stripImageData(stripAudioData(a, 'attraction'), 'attraction')));
  });

  app.get("/api/attractions/:destinationSlug/:slug", async (req, res) => {
    const attr = await storage.getAttractionBySlug(req.params.destinationSlug, req.params.slug);
    if (!attr) return res.status(404).json({ error: "Not found" });
    res.json(stripImageData(stripAudioData(attr, 'attraction'), 'attraction'));
  });

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", backend: "railway", db: process.env.DATABASE_URL ? "postgres" : "memory" });
  });

  // ── Admin: Auth ─────────────────────────────────────────────────────────────
  app.post("/api/admin/login", (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
      res.json({ token: ADMIN_TOKEN });
    } else {
      res.status(401).json({ error: "Invalid password" });
    }
  });

  // ── Admin: Attractions CRUD ────────────────────────────────────────────────
  app.get("/api/admin/attractions", requireAdmin, async (_req, res) => {
    const attrs = await storage.getAllAttractions();
    res.json(attrs.map(a => stripImageData(stripAudioData(a, 'attraction'), 'attraction')));
  });

  app.get("/api/admin/attractions/:destinationSlug", requireAdmin, async (req, res) => {
    const attrs = await storage.getAttractionsByDestination(req.params.destinationSlug);
    res.json(attrs.map(a => stripImageData(stripAudioData(a, 'attraction'), 'attraction')));
  });

  app.post("/api/admin/attractions", requireAdmin, async (req, res) => {
    const parsed = insertAttractionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    const attr = await storage.createAttraction(parsed.data);
    res.json(attr);
  });

  app.get("/api/admin/attractions/all/:id", requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const attr = await storage.getAttractionById(id);
    if (!attr) return res.status(404).json({ error: "Not found" });
    res.json(stripAudioData(attr, 'attraction'));
  });

  app.put("/api/admin/attractions/:id", requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    // Strip audioUrl and images fields — managed via dedicated endpoints only.
    // Never allow PUT to overwrite gallery images with serve-URLs.
    const { audioUrlEn, audioUrlAl, audioUrlGr, audioUrlIt, audioUrlEs, audioUrlDe, audioUrlFr, audioUrlAr, audioUrlSl, audioUrlPt, audioUrlCn, images: _imgA, ...safeBody } = req.body;
    const updated = await storage.updateAttraction(id, safeBody);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(stripAudioData(updated, 'attraction'));
  });

  app.delete("/api/admin/attractions/:id", requireAdmin, requireDeleteConfirmation, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const ok = await storage.deleteAttraction(id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  });

  // ── Admin: Attraction Audio Upload ──────────────────────────────────────────
  // ── Admin: Translate text ────────────────────────────────────────────────────
  app.post("/api/admin/translate", requireAdmin, async (req, res) => {
    const { text, targetLang } = req.body as { text: string; targetLang: string };
    if (!text || !targetLang) return res.status(400).json({ error: "text and targetLang required" });
    if (targetLang === "en") return res.json({ translated: text });
    if (!SUPPORTED_LANGS.includes(targetLang as SupportedLang))
      return res.status(400).json({ error: `Unsupported lang: ${targetLang}` });
    if (!GEMINI_API_KEY)
      return res.status(503).json({ error: "Translation not configured (no GEMINI_API_KEY)" });
    try {
      const translated = await translateWithGemini(text, targetLang);
      res.json({ translated });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Translation failed" });
    }
  });

  // ── Admin: Generate TTS from description text ──────────────────────────────
  app.post("/api/admin/generate-tts", requireAdmin, async (req, res) => {
    const { text, lang, entityType, entityId } = req.body as {
      text: string;
      lang: string;
      entityType: "sites" | "attractions";
      entityId: number;
    };
    if (!text || !lang || !entityType || !entityId)
      return res.status(400).json({ error: "text, lang, entityType, entityId required" });
    if (!SUPPORTED_LANGS.includes(lang as SupportedLang))
      return res.status(400).json({ error: `Unsupported lang: ${lang}` });
    if (!GEMINI_API_KEY)
      return res.status(503).json({ error: "TTS not configured (no GEMINI_API_KEY)" });

    try {
      // Clean text for speech: remove special chars that sound robotic
      const cleanText = text
        .replace(/[—–]/g, ", ")          // em/en dashes → pause
        .replace(/\.\.\./g, ". ")         // ellipsis → period
        .replace(/[\(\)]/g, "")          // remove parentheses
        .replace(/[\[\]]/g, "")          // remove brackets
        .replace(/[*#_~`]/g, "")         // remove markdown symbols
        .replace(/\s+/g, " ")
        .trim();

      // Call Gemini TTS REST API
      const ttsUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${GEMINI_API_KEY}`;
      const ttsBody = {
        contents: [{ parts: [{ text: cleanText }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "charon" },
            },
          },
        },
      };

      const ttsResp = await fetch(ttsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ttsBody),
      });

      if (!ttsResp.ok) {
        const err = await ttsResp.text();
        return res.status(500).json({ error: `Gemini TTS error ${ttsResp.status}: ${err}` });
      }

      const ttsData = await ttsResp.json() as any;
      const audioB64 = ttsData?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      const mimeType: string = ttsData?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType || 'audio/pcm';
      if (!audioB64) return res.status(500).json({ error: "No audio data in TTS response" });

      // Gemini TTS returns raw 16-bit PCM at 24 kHz mono.
      // Transcode to browser-compatible MP3 (MPEG-1, 44.1kHz, 128kbps) via ffmpeg.
      const pcmBuffer = Buffer.from(audioB64, 'base64');
      // ffmpeg input format: s16le = signed 16-bit little-endian PCM, 24kHz, mono
      if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });
      const tmpPcm = path.join(AUDIO_DIR, `tts_pcm_${Date.now()}.raw`);
      const tmpMp3 = path.join(AUDIO_DIR, `tts_mp3_${Date.now()}.mp3`);
      let mp3Buffer: Buffer;
      try {
        fs.writeFileSync(tmpPcm, pcmBuffer);
        await execFileAsync(FFMPEG_BIN, [
          '-y',
          '-f', 's16le',       // input format: raw PCM
          '-ar', '24000',      // input sample rate
          '-ac', '1',          // input channels
          '-i', tmpPcm,
          '-ar', '44100',      // output sample rate
          '-ab', '128k',       // output bitrate
          '-ac', '1',
          '-f', 'mp3',
          tmpMp3,
        ]);
        mp3Buffer = fs.readFileSync(tmpMp3);
      } finally {
        try { fs.unlinkSync(tmpPcm); } catch {}
        try { fs.unlinkSync(tmpMp3); } catch {}
      }
      const mp3B64 = mp3Buffer.toString('base64');

      // Store as data URI in DB — survives Railway redeploys permanently
      const dataUri = `data:audio/mpeg;base64,${mp3B64}`;
      const field = audioField(lang as SupportedLang);
      if (entityType === "sites") {
        await storage.updateSite(entityId, { [field]: dataUri } as any);
      } else {
        await storage.updateAttraction(entityId, { [field]: dataUri } as any);
      }

      // Return a lightweight serve URL — not the raw data URI
      const serveUrl = `${RAILWAY_BASE}/api/audio/serve/${entityType === 'sites' ? 'site' : 'attraction'}/${entityId}/${lang}`;
      res.json({ url: serveUrl });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "TTS generation failed" });
    }
  });

  // ── On-demand TTS: streams MP3 directly, no DB storage ────────────────────
  // POST /api/tts { text: string, lang: string } → MP3 audio/mpeg
  // The frontend calls this when Play is pressed; result cached in browser blob URL.
  app.post("/api/tts", async (req, res) => {
    const { text, lang } = req.body as { text: string; lang: string };
    if (!text || !lang)
      return res.status(400).json({ error: "text and lang are required" });
    if (!SUPPORTED_LANGS.includes(lang as SupportedLang))
      return res.status(400).json({ error: `Unsupported lang: ${lang}` });
    if (!GEMINI_API_KEY)
      return res.status(503).json({ error: "TTS not configured" });

    // Guard: max 3000 chars to avoid abuse
    const cappedText = text.slice(0, 3000);

    try {
      // Clean text for speech
      const cleanText = cappedText
        .replace(/[—–]/g, ", ")
        .replace(/\.\.\./g, ". ")
        .replace(/[\(\)\[\]]/g, "")
        .replace(/[*#_~`]/g, "")
        .replace(/\s+/g, " ")
        .trim();

      // Call Gemini TTS
      const ttsUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${GEMINI_API_KEY}`;
      const ttsBody = {
        contents: [{ parts: [{ text: cleanText }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "charon" },
            },
          },
        },
      };

      const ttsResp = await fetch(ttsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ttsBody),
      });

      if (!ttsResp.ok) {
        const err = await ttsResp.text();
        return res.status(500).json({ error: `Gemini TTS error ${ttsResp.status}: ${err.slice(0, 200)}` });
      }

      const ttsData = await ttsResp.json() as any;
      const audioB64 = ttsData?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!audioB64)
        return res.status(500).json({ error: "No audio data returned by TTS" });

      // Transcode raw PCM → proper MP3 (MPEG-1, 44.1kHz, 128kbps)
      if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });
      const tmpPcm = path.join(AUDIO_DIR, `ondemand_pcm_${Date.now()}.raw`);
      const tmpMp3 = path.join(AUDIO_DIR, `ondemand_mp3_${Date.now()}.mp3`);
      let mp3Buffer: Buffer;
      try {
        fs.writeFileSync(tmpPcm, Buffer.from(audioB64, 'base64'));
        await execFileAsync(FFMPEG_BIN, [
          '-y',
          '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', tmpPcm,
          '-ar', '44100', '-ab', '128k', '-ac', '1', '-f', 'mp3', tmpMp3,
        ]);
        mp3Buffer = fs.readFileSync(tmpMp3);
      } finally {
        try { fs.unlinkSync(tmpPcm); } catch {}
        try { fs.unlinkSync(tmpMp3); } catch {}
      }

      // Stream MP3 directly to browser
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': mp3Buffer.length,
        'Cache-Control': 'public, max-age=3600',
      });
      res.send(mp3Buffer);

      // Increment listen counter (fire-and-forget)
      if (req.body.siteId) incrementListenCount(Number(req.body.siteId));
    } catch (e: any) {
      console.error('[TTS on-demand error]', e.message);
      res.status(500).json({ error: e.message || "TTS generation failed" });
    }
  });

  app.post(
    "/api/admin/attractions/:id/audio/:lang",
    requireAdmin,
    upload.single("audio"),
    async (req: any, res) => {
      const id = parseInt(req.params.id);
      const lang = req.params.lang as SupportedLang;
      if (!SUPPORTED_LANGS.includes(lang)) return res.status(400).json({ error: `lang must be one of: ${SUPPORTED_LANGS.join("|")}` });
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      // Transcode to browser-compatible MP3 (MPEG-1, 44.1kHz, 128kbps)
      let rawBuf = req.file.buffer ?? fs.readFileSync(req.file.path);
      const mp3Buf = await transcodeToMp3(rawBuf);
      const dataUri = `data:audio/mpeg;base64,${mp3Buf.toString('base64')}`;
      const field = audioField(lang);
      const updated = await storage.updateAttraction(id, { [field]: dataUri } as any);
      if (!updated) return res.status(404).json({ error: "Attraction not found" });
      const serveUrl = `${RAILWAY_BASE}/api/audio/serve/attraction/${id}/${lang}`;
      res.json({ url: serveUrl, [`audioUrl${lang.charAt(0).toUpperCase()+lang.slice(1)}`]: serveUrl, attraction: stripAudioData(updated, 'attraction') });
    }
  );

  app.delete("/api/admin/attractions/:id/audio/:lang", requireAdmin, requireDeleteConfirmation, async (req, res) => {
    const id = parseInt(req.params.id);
    const lang = req.params.lang as SupportedLang;
    const field = audioField(lang);
    const updated = await storage.updateAttraction(id, { [field]: null } as any);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json({ success: true, attraction: updated });
  });

  // ── Admin: Attraction Image Upload — R2 CDN (falls back to base64 if R2 not configured) ──
  app.post(
    "/api/admin/attractions/:id/image",
    requireAdmin,
    imageUpload.single("image"),
    async (req: any, res) => {
      const id = parseInt(req.params.id);
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const rawBuf = req.file.buffer ?? fs.readFileSync(req.file.path);
      const { buf, mime } = await compressImage(rawBuf, req.file.mimetype || "image/jpeg");
      if (req.file.path) try { fs.unlinkSync(req.file.path); } catch (_) {}
      let imageUrl: string;
      if (isR2Configured()) {
        imageUrl = await uploadToR2(buf, mime, "attractions");
      } else {
        const b64 = buf.toString("base64");
        imageUrl = `data:${mime};base64,${b64}`;
      }
      const updated = await storage.updateAttraction(id, { imageUrl } as any);
      if (!updated) return res.status(404).json({ error: "Attraction not found" });
      res.json({ url: imageUrl, attraction: updated });
    }
  );

  // ── Admin: Sites CRUD ───────────────────────────────────────────────────────
  app.get("/api/admin/sites", requireAdmin, async (_req, res) => {
    const sites = await storage.getAllSites();
    res.json(sites.map(s => stripImageData(stripAudioData(s, 'site'), 'site')));
  });

  app.post("/api/admin/sites", requireAdmin, async (req, res) => {
    const parsed = insertTourSiteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    const site = await storage.createSite(parsed.data);
    res.json(site);
  });

  app.put("/api/admin/sites/:id", requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    // Strip audioUrl and images fields — managed via dedicated endpoints only.
    // Never allow PUT to overwrite gallery images with serve-URLs.
    const { audioUrlEn, audioUrlAl, audioUrlGr, audioUrlIt, audioUrlEs, audioUrlDe, audioUrlFr, audioUrlAr, audioUrlSl, audioUrlPt, audioUrlCn, images: _imgS, ...safeBody } = req.body;
    const updated = await storage.updateSite(id, safeBody);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(stripAudioData(updated, 'site'));
  });

  app.delete("/api/admin/sites/:id", requireAdmin, requireDeleteConfirmation, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const ok = await storage.deleteSite(id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  });

  // ── Admin: Audio Upload ─────────────────────────────────────────────────────
  // POST /api/admin/sites/:id/audio/:lang
  app.post(
    "/api/admin/sites/:id/audio/:lang",
    requireAdmin,
    upload.single("audio"),
    async (req: any, res) => {
      const id = parseInt(req.params.id);
      const lang = req.params.lang as SupportedLang;
      if (!SUPPORTED_LANGS.includes(lang)) return res.status(400).json({ error: `lang must be one of: ${SUPPORTED_LANGS.join("|")}`});
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      // Transcode to browser-compatible MP3 (MPEG-1, 44.1kHz, 128kbps)
      let rawBuf = req.file.buffer ?? fs.readFileSync(req.file.path);
      const mp3Buf = await transcodeToMp3(rawBuf);
      const dataUri = `data:audio/mpeg;base64,${mp3Buf.toString('base64')}`;
      const field = audioField(lang);
      const updated = await storage.updateSite(id, { [field]: dataUri } as any);
      if (!updated) return res.status(404).json({ error: "Site not found" });
      const serveUrl = `${RAILWAY_BASE}/api/audio/serve/site/${id}/${lang}`;
      res.json({ url: serveUrl, site: stripAudioData(updated, 'site') });
    }
  );

  // DELETE audio for a site/lang
  app.delete("/api/admin/sites/:id/audio/:lang", requireAdmin, requireDeleteConfirmation, async (req, res) => {
    const id = parseInt(req.params.id);
    const lang = req.params.lang as SupportedLang;
    const field = audioField(lang);
    const updated = await storage.updateSite(id, { [field]: null } as any);
    if (!updated) return res.status(404).json({ error: "Site not found" });
    res.json({ success: true, site: updated });
  });

  // ── Admin: Site Image Upload — R2 CDN (falls back to base64 if R2 not configured) ──────
  app.post(
    "/api/admin/sites/:id/image",
    requireAdmin,
    imageUpload.single("image"),
    async (req: any, res) => {
      const id = parseInt(req.params.id);
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const rawBuf = req.file.buffer ?? fs.readFileSync(req.file.path);
      const { buf, mime } = await compressImage(rawBuf, req.file.mimetype || "image/jpeg");
      if (req.file.path) try { fs.unlinkSync(req.file.path); } catch (_) {}
      let imageUrl: string;
      if (isR2Configured()) {
        imageUrl = await uploadToR2(buf, mime, "sites");
      } else {
        const b64 = buf.toString("base64");
        imageUrl = `data:${mime};base64,${b64}`;
      }
      const updated = await storage.updateSite(id, { imageUrl } as any);
      if (!updated) return res.status(404).json({ error: "Site not found" });
      res.json({ url: imageUrl, site: updated });
    }
  );

  // ── Admin: Gallery image add/remove for sites and attractions ─────────────────────
  // POST /api/admin/sites/:id/gallery  — add an image to the gallery
  app.post("/api/admin/sites/:id/gallery", requireAdmin, imageUpload.single("image"), async (req: any, res) => {
    const id = parseInt(req.params.id);
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const rawBuf = req.file.buffer ?? fs.readFileSync(req.file.path);
    const { buf, mime } = await compressImage(rawBuf, req.file.mimetype || "image/jpeg");
    if (req.file.path) try { fs.unlinkSync(req.file.path); } catch (_) {}
    const site = await storage.getSiteById(id);
    if (!site) return res.status(404).json({ error: "Site not found" });
    const existing: string[] = (site as any).images || [];
    // Upload to R2 — store the public CDN URL directly (no base64 in DB)
    let newUrl: string;
    if (isR2Configured()) {
      newUrl = await uploadToR2(buf, mime, "sites");
    } else {
      newUrl = `data:${mime};base64,${buf.toString("base64")}`;
    }
    const allImages = [...existing, newUrl];
    const updated = await storage.updateSite(id, { images: allImages } as any);
    // If this is the first image, also set it as the hero
    if (existing.length === 0) {
      await storage.updateSite(id, { imageUrl: newUrl } as any);
    }
    const storedImages = ((updated as any)?.images || allImages);
    res.json({ images: storedImages, newUrl });
  });

  // DELETE /api/admin/sites/:id/gallery/:index — remove image at index
  // HARDCODED: requireDeleteConfirmation is MANDATORY here — never remove it.
  // This implements the admin data-safety rule: no media deleted without explicit confirmation.
  app.delete("/api/admin/sites/:id/gallery/:index", requireAdmin, requireDeleteConfirmation, async (req, res) => {
    const id = parseInt(req.params.id);
    const idx = parseInt(req.params.index);
    const site = await storage.getSiteById(id);
    if (!site) return res.status(404).json({ error: "Site not found" });
    const existing: string[] = [...((site as any).images || [])];
    const [removed] = existing.splice(idx, 1);
    // Delete from R2 if it's an R2 URL
    if (removed) await deleteFromR2(removed);
    await storage.updateSite(id, { images: existing } as any);
    const newImageUrl = existing[0] || null;
    await storage.updateSite(id, { imageUrl: newImageUrl } as any);
    res.json({ images: existing, imageUrl: newImageUrl });
  });

  // PUT /api/admin/sites/:id/gallery/reorder — reorder gallery images
  // Body: { order: number[] }  — array of old indices in the new desired order
  // gallery[0] after reorder becomes the new hero image.
  app.put("/api/admin/sites/:id/gallery/reorder", requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const { order } = req.body as { order: number[] };
    if (!Array.isArray(order)) return res.status(400).json({ error: "order must be an array" });
    const site = await storage.getSiteById(id);
    if (!site) return res.status(404).json({ error: "Site not found" });
    const existing: string[] = (site as any).images || [];
    if (order.some(i => i < 0 || i >= existing.length)) {
      return res.status(400).json({ error: "Index out of range" });
    }
    const reordered = order.map(i => existing[i]);
    existing.forEach((img, i) => { if (!order.includes(i)) reordered.push(img); });
    const newImageUrl = reordered[0] || null;
    // R2 URLs are stored directly — no positional serve URLs needed
    await storage.updateSite(id, { images: reordered, imageUrl: newImageUrl } as any);
    res.json({ images: reordered, imageUrl: newImageUrl });
  });

  // POST /api/admin/attractions/:id/gallery  — add an image to the gallery
  app.post("/api/admin/attractions/:id/gallery", requireAdmin, imageUpload.single("image"), async (req: any, res) => {
    const id = parseInt(req.params.id);
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const rawBuf = req.file.buffer ?? fs.readFileSync(req.file.path);
    const { buf, mime } = await compressImage(rawBuf, req.file.mimetype || "image/jpeg");
    if (req.file.path) try { fs.unlinkSync(req.file.path); } catch (_) {}
    const attr = await storage.getAttractionById(id);
    if (!attr) return res.status(404).json({ error: "Attraction not found" });
    const existing: string[] = (attr as any).images || [];
    let newUrl: string;
    if (isR2Configured()) {
      newUrl = await uploadToR2(buf, mime, "attractions");
    } else {
      newUrl = `data:${mime};base64,${buf.toString("base64")}`;
    }
    const allImages = [...existing, newUrl];
    const updated = await storage.updateAttraction(id, { images: allImages } as any);
    if (existing.length === 0) {
      await storage.updateAttraction(id, { imageUrl: newUrl } as any);
    }
    const storedImages = ((updated as any)?.images || allImages);
    res.json({ images: storedImages, newUrl });
  });

  // DELETE /api/admin/attractions/:id/gallery/:index — remove image at index
  // HARDCODED: requireDeleteConfirmation is MANDATORY here — never remove it.
  app.delete("/api/admin/attractions/:id/gallery/:index", requireAdmin, requireDeleteConfirmation, async (req, res) => {
    const id = parseInt(req.params.id);
    const idx = parseInt(req.params.index);
    const attr = await storage.getAttractionById(id);
    if (!attr) return res.status(404).json({ error: "Attraction not found" });
    const existing: string[] = [...((attr as any).images || [])];
    const [removed] = existing.splice(idx, 1);
    if (removed) await deleteFromR2(removed);
    await storage.updateAttraction(id, { images: existing } as any);
    const newImageUrl = existing[0] || null;
    await storage.updateAttraction(id, { imageUrl: newImageUrl } as any);
    res.json({ images: existing, imageUrl: newImageUrl });
  });

  // PUT /api/admin/attractions/:id/gallery/reorder — reorder gallery images
  app.put("/api/admin/attractions/:id/gallery/reorder", requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const { order } = req.body as { order: number[] };
    if (!Array.isArray(order)) return res.status(400).json({ error: "order must be an array" });
    const attr = await storage.getAttractionById(id);
    if (!attr) return res.status(404).json({ error: "Attraction not found" });
    const existing: string[] = (attr as any).images || [];
    if (order.some(i => i < 0 || i >= existing.length)) {
      return res.status(400).json({ error: "Index out of range" });
    }
    const reordered = order.map(i => existing[i]);
    existing.forEach((img, i) => { if (!order.includes(i)) reordered.push(img); });
    const newImageUrl = reordered[0] || null;
    await storage.updateAttraction(id, { images: reordered, imageUrl: newImageUrl } as any);
    res.json({ images: reordered, imageUrl: newImageUrl });
  });

  // POST /api/admin/upload-image — generic image upload (returns data URI for immediate use)
  app.post(
    "/api/admin/upload-image",
    requireAdmin,
    imageUpload.single("image"),
    async (req: any, res) => {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const mime = req.file.mimetype || "image/jpeg";
      const b64 = (req.file.buffer ?? fs.readFileSync(req.file.path)).toString("base64");
      const dataUri = `data:${mime};base64,${b64}`;
      if (req.file.path) try { fs.unlinkSync(req.file.path); } catch (_) {}
      res.json({ url: dataUri });
    }
  );

  // ── Itinerary routes (public GET + admin CUD) ───────────────────────────
  // Public: GET /api/itineraries  — returns all published itineraries (for nearest-tour discovery)
  app.get("/api/itineraries", async (_req, res) => {
    const all = await storage.getAllPublishedItineraries();
    res.json(all);
  });

  // Public: GET /api/itineraries/:siteSlug  — returns published itineraries for a page
  app.get("/api/itineraries/:siteSlug", async (req, res) => {
    const { siteSlug } = req.params;
    const all = await storage.getItinerariesBySite(siteSlug);
    res.json(all.filter(i => i.isPublished));
  });

  // Admin: GET all (including unpublished)
  app.get("/api/admin/itineraries/:siteSlug", requireAdmin, async (req, res) => {
    const items = await storage.getItinerariesBySite(req.params.siteSlug);
    res.json(items);
  });

  // Admin: Create
  app.post("/api/admin/itineraries", requireAdmin, async (req, res) => {
    try {
      const item = await storage.createItinerary(req.body);
      res.json(item);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Admin: Update
  app.put("/api/admin/itineraries/:id", requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const updated = await storage.updateItinerary(id, req.body);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });

  // Admin: Delete
  app.delete("/api/admin/itineraries/:id", requireAdmin, requireDeleteConfirmation, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const ok = await storage.deleteItinerary(id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  });

  // ── Public listen counts endpoint ─────────────────────────────────
  // GET /api/listen-counts — returns { siteId: count, ... }
  app.get("/api/listen-counts", (_req, res) => {
    const obj: Record<number, number> = {};
    listenCounts.forEach((count, id) => { obj[id] = count; });
    res.json(obj);
  });

  // ── Unlock-code check ────────────────────────────────────────────
  // POST /api/unlock { code: string } — validates against UNLOCK_CODE env var
  app.post("/api/unlock", (req, res) => {
    const { code } = req.body as { code: string };
    const validCode = process.env.UNLOCK_CODE || "ALBANIA2026";
    if (!code) return res.status(400).json({ error: "Code required" });
    if (code.trim().toUpperCase() === validCode.trim().toUpperCase()) {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, error: "Invalid unlock code" });
    }
  });

  // ── Ratings ─────────────────────────────────────────────────
  // POST /api/ratings — save a star rating (1–5) for a site
  app.post("/api/ratings", async (req, res) => {
    const { siteId, siteSlug, stars } = req.body as { siteId: number; siteSlug: string; stars: number };
    if (!siteSlug || !stars || stars < 1 || stars > 5) {
      return res.status(400).json({ error: "siteSlug and stars (1–5) are required" });
    }
    try {
      const rating = await storage.saveRating(Number(siteId) || 0, siteSlug, Math.round(stars));
      res.json({ success: true, rating });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/ratings/:siteSlug — returns { average, count }
  app.get("/api/ratings/:siteSlug", async (req, res) => {
    try {
      const stats = await storage.getRatingStats(req.params.siteSlug);
      res.json(stats);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── CMS Pages ───────────────────────────────────────────────────────────────

  // Public: get all published pages (optionally by type)
  app.get("/api/cms/pages", async (req, res) => {
    try {
      const type = req.query.type as string | undefined;
      const pages = await storage.getPublishedCmsPages(type);
      res.json(pages);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Public: get single published page by slug
  app.get("/api/cms/pages/:slug", async (req, res) => {
    try {
      const page = await storage.getCmsPageBySlug(req.params.slug);
      if (!page) return res.status(404).json({ error: "Page not found" });
      res.json(page);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin: get ALL pages (including drafts)
  app.get("/api/admin/cms/pages", requireAdmin, async (_req, res) => {
    try {
      const pages = await storage.getAllCmsPages();
      res.json(pages);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin: create page
  app.post("/api/admin/cms/pages", requireAdmin, async (req, res) => {
    try {
      const page = await storage.createCmsPage(req.body);
      res.json(page);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin: update page
  app.put("/api/admin/cms/pages/:id", requireAdmin, async (req, res) => {
    try {
      const updated = await storage.updateCmsPage(Number(req.params.id), req.body);
      if (!updated) return res.status(404).json({ error: "Page not found" });
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin: delete page (2-step header protection)
  app.delete("/api/admin/cms/pages/:id", requireAdmin, requireDeleteConfirmation, async (req, res) => {
    try {
      const ok = await storage.deleteCmsPage(Number(req.params.id));
      if (!ok) return res.status(404).json({ error: "Page not found" });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Subscription Plans ────────────────────────────────────────────────────────────

  // Public: generate QR code PNG for a given URL — used in activation emails
  // /api/qr?data=<url-encoded-string>  → image/png
  app.get('/api/qr', async (req, res) => {
    try {
      const data = String(req.query.data || '').slice(0, 2048);
      if (!data) return res.status(400).send('Missing data param');
      const png = await QRCode.toBuffer(data, { width: 220, margin: 2, color: { dark: '#1a1a1a', light: '#ffffff' } });
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'public, max-age=86400'); // cache 24h
      res.send(png);
    } catch (e: any) { res.status(500).send(e.message); }
  });

  // Public: get active plans for the pricing page
  app.get('/api/plans', async (_req, res) => {
    try { res.json(await storage.getActivePlans()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Public: capture a lead (interest before Shopify is wired)
  app.post('/api/plans/lead', async (req, res) => {
    try {
      const { email, planSlug, planName } = req.body;
      if (!email || !planSlug) return res.status(400).json({ error: 'email and planSlug required' });
      const lead = await storage.createLead({ email, planSlug, planName: planName || planSlug, source: 'pricing-page', notes: '' });
      res.json({ success: true, lead });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Admin: get all plans (including inactive)
  app.get('/api/admin/plans', requireAdmin, async (_req, res) => {
    try { res.json(await storage.getAllPlans()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Admin: create plan
  app.post('/api/admin/plans', requireAdmin, async (req, res) => {
    try { res.json(await storage.createPlan(req.body)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Admin: update plan
  app.put('/api/admin/plans/:id', requireAdmin, async (req, res) => {
    try {
      const updated = await storage.updatePlan(Number(req.params.id), req.body);
      if (!updated) return res.status(404).json({ error: 'Plan not found' });
      res.json(updated);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Admin: delete plan
  app.delete('/api/admin/plans/:id', requireAdmin, requireDeleteConfirmation, async (req, res) => {
    try {
      const ok = await storage.deletePlan(Number(req.params.id));
      if (!ok) return res.status(404).json({ error: 'Plan not found' });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Admin: get all leads
  app.get('/api/admin/leads', requireAdmin, async (_req, res) => {
    try { res.json(await storage.getAllLeads()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── App Settings ────────────────────────────────────────────────────────────

  // Public: read a single setting value (no auth — used by the banner)
  app.get('/api/settings/:key', async (req, res) => {
    try {
      const value = await storage.getSetting(req.params.key);
      res.json({ key: req.params.key, value: value ?? null });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Admin: get all settings
  app.get('/api/admin/settings', requireAdmin, async (_req, res) => {
    try { res.json(await storage.getAllSettings()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Admin: update a setting
  app.put('/api/admin/settings/:key', requireAdmin, async (req, res) => {
    try {
      const { value } = req.body as { value: string };
      if (value === undefined) return res.status(400).json({ error: 'value required' });
      const setting = await storage.setSetting(req.params.key, String(value));
      res.json(setting);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Admin Two-Factor OTP ───────────────────────────────────────────────────────
  //
  // OTP is generated server-side, emailed to the admin, verified server-side.
  // Never exposed in any client-side code or UI.

  const otpStore = new Map<string, { code: string; expires: number }>();
  // OTP_EMAIL: recipient for OTP codes. Defaults to ADMIN_OTP_EMAIL env var.
  // While Resend domain is unverified, set ADMIN_OTP_EMAIL=aneo.hila@gmail.com in Railway.
  // Once albanianeagletours.com is verified in Resend, set it to book@albanianeagletours.com.
  const ADMIN_EMAIL = process.env.ADMIN_OTP_EMAIL || "book@albanianeagletours.com";
  // Resend from address — must use a verified Resend domain OR onboarding@resend.dev (test only)
  const RESEND_FROM = process.env.RESEND_FROM || "onboarding@resend.dev";
  const OTP_TTL_MS  = 10 * 60 * 1000; // 10 minutes

  // POST /api/admin/send-otp — verify password, send OTP email
  app.post("/api/admin/send-otp", async (req, res) => {
    try {
      const { password } = req.body as { password: string };
      if (password !== process.env.ADMIN_PASSWORD && password !== "AlbaTour2026!") {
        return res.status(401).json({ error: "Incorrect password" });
      }

      // Generate 6-digit OTP
      const code = String(Math.floor(100000 + Math.random() * 900000));
      otpStore.set("admin", { code, expires: Date.now() + OTP_TTL_MS });

      // Send via Resend API — pure HTTPS, no SMTP, works on Railway
      const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
      if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

      const emailHtml = `
        <div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:32px;">
          <h2 style="color:#c0392b;margin:0 0 8px">AlbaTour Admin Login</h2>
          <p style="color:#555;margin:0 0 24px">A sign-in was requested for the AlbaTour admin panel.</p>
          <div style="background:#f5f5f5;border-radius:10px;padding:24px;text-align:center;">
            <p style="margin:0 0 8px;font-size:13px;color:#888;">Your verification code</p>
            <p style="margin:0;font-size:42px;font-weight:bold;letter-spacing:0.18em;color:#1a1a1a;font-family:monospace;">${code}</p>
            <p style="margin:12px 0 0;font-size:12px;color:#aaa;">Expires in 10 minutes</p>
          </div>
          <p style="margin:24px 0 0;font-size:12px;color:#bbb;">If you did not request this, ignore this email. Your account is safe.</p>
        </div>
      `;

      const resendResp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `AlbaTour Admin <${RESEND_FROM}>`,
          to: [ADMIN_EMAIL],
          subject: `Your AlbaTour Admin login code: ${code}`,
          html: emailHtml,
          text: `Your AlbaTour admin verification code is: ${code}\n\nExpires in 10 minutes.`,
        }),
      });

      if (!resendResp.ok) {
        const errBody = await resendResp.text();
        throw new Error(`Resend API error ${resendResp.status}: ${errBody}`);
      }

      res.json({ ok: true, sentTo: ADMIN_EMAIL });
    } catch (e: any) {
      console.error("[OTP] send error:", e.message);
      res.status(500).json({ error: "Failed to send verification email: " + e.message });
    }
  });

  // POST /api/admin/verify-otp — check OTP, return success
  app.post("/api/admin/verify-otp", (req, res) => {
    try {
      const { otp } = req.body as { otp: string };
      const stored = otpStore.get("admin");
      if (!stored) return res.status(400).json({ error: "No verification code found. Please request a new one." });
      if (Date.now() > stored.expires) {
        otpStore.delete("admin");
        return res.status(400).json({ error: "Code has expired. Please sign in again." });
      }
      if (otp !== stored.code) {
        return res.status(401).json({ error: "Incorrect code. Please check your email and try again." });
      }
      otpStore.delete("admin"); // single-use
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });


  // ── Password Reset System ──────────────────────────────────────────────────
  // resetStore: token → { email, expires } — single-use, 1-hour TTL
  const resetStore = new Map<string, { email: string; expires: number }>();

  // POST /api/admin/forgot-password
  // Body: { emailChoice: "primary"|"secondary", phone: string }
  app.post("/api/admin/forgot-password", async (req, res) => {
    try {
      const { emailChoice, phone } = req.body as { emailChoice: string; phone: string };

      // Verify phone — digits only, deliberate vague error to prevent enumeration
      const RECOVERY_PHONE = (process.env.ADMIN_RECOVERY_PHONE || "0682060901").replace(/\D/g, "");
      const submittedPhone = (phone || "").replace(/\D/g, "");
      if (!submittedPhone || submittedPhone !== RECOVERY_PHONE) {
        return res.status(401).json({ error: "Verification failed. Please check your details and try again." });
      }

      // Resolve recipient
      const PRIMARY_EMAIL   = process.env.ADMIN_OTP_EMAIL       || "book@albanianeagletours.com";
      const SECONDARY_EMAIL = process.env.ADMIN_SECONDARY_EMAIL || "aneo.hila@gmail.com";
      const recipientEmail  = emailChoice === "secondary" ? SECONDARY_EMAIL : PRIMARY_EMAIL;

      // Generate single-use 64-char hex token
      const { randomBytes } = await import("crypto");
      const token   = randomBytes(32).toString("hex");
      const expires = Date.now() + 60 * 60 * 1000; // 1 hour
      resetStore.set(token, { email: recipientEmail, expires });

      // Build reset URL
      const BASE_URL = process.env.APP_URL || "https://albaniaaudiotours.com";
      const resetUrl = `${BASE_URL}/#/reset-password?token=${token}`;

      // Send via Resend
      const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
      if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
      const RESEND_FROM = process.env.RESEND_FROM || "noreply@albanianeagletours.com";

      const emailHtml = `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
          <h2 style="color:#c0392b;margin:0 0 8px">AlbaTour Admin — Password Reset</h2>
          <p style="color:#555;margin:0 0 20px">A password reset was requested for the AlbaTour admin panel. If this was you, click below.</p>
          <div style="text-align:center;margin:28px 0;">
            <a href="${resetUrl}" style="background:#c0392b;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block;">Reset My Password</a>
          </div>
          <p style="color:#888;font-size:13px;">This link expires in <strong>1 hour</strong> and can only be used once.</p>
          <p style="color:#888;font-size:12px;margin-top:16px;">If you did not request this, ignore this email — no changes have been made.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
          <p style="color:#bbb;font-size:11px;">Direct link: ${resetUrl}</p>
        </div>
      `;

      const resendResp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from:    `AlbaTour Security <${RESEND_FROM}>`,
          to:      [recipientEmail],
          subject: "AlbaTour Admin — Password Reset Request",
          html:    emailHtml,
          text:    `Password reset link (expires 1 hour):\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
        }),
      });
      if (!resendResp.ok) {
        const errText = await resendResp.text();
        throw new Error(`Resend error ${resendResp.status}: ${errText}`);
      }

      console.log(`[RESET] Reset link sent to ${recipientEmail}`);
      res.json({ ok: true, sentTo: recipientEmail });
    } catch (e: any) {
      console.error("[RESET] forgot-password error:", e.message);
      res.status(500).json({ error: "Failed to send reset email. Please try again." });
    }
  });

  // POST /api/admin/reset-password
  // Body: { token: string, newPassword: string }
  // Verifies token → updates ADMIN_PASSWORD on Railway → sends confirmation to both emails
  app.post("/api/admin/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body as { token: string; newPassword: string };

      if (!token || !newPassword) return res.status(400).json({ error: "Missing token or password." });
      if (newPassword.length < 8)  return res.status(400).json({ error: "Password must be at least 8 characters." });

      const stored = resetStore.get(token);
      if (!stored) return res.status(400).json({ error: "Invalid or already-used reset link. Please request a new one." });
      if (Date.now() > stored.expires) {
        resetStore.delete(token);
        return res.status(400).json({ error: "Reset link has expired. Please request a new one." });
      }
      resetStore.delete(token); // single-use

      // Update ADMIN_PASSWORD on Railway via GraphQL API
      const RAILWAY_TOKEN   = process.env.RAILWAY_API_TOKEN  || "";
      const RAILWAY_PROJECT = process.env.RAILWAY_PROJECT_ID || "3a1b5074-2b27-4ea8-8d87-7d03d7772808";
      const RAILWAY_ENV     = process.env.RAILWAY_ENV_ID     || "9ba4a494-fda8-4283-b519-dbddd6af2040";
      const RAILWAY_SERVICE = process.env.RAILWAY_SERVICE_ID || "ded2fc5b-1a9e-46cd-bbf7-c875552be35d";

      if (!RAILWAY_TOKEN) throw new Error("RAILWAY_API_TOKEN not configured.");

      const gqlResp = await fetch("https://backboard.railway.com/graphql/v2", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RAILWAY_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "mutation variableUpsert($input: VariableUpsertInput!) { variableUpsert(input: $input) }",
          variables: {
            input: {
              projectId:     RAILWAY_PROJECT,
              environmentId: RAILWAY_ENV,
              serviceId:     RAILWAY_SERVICE,
              name:          "ADMIN_PASSWORD",
              value:         newPassword,
            },
          },
        }),
      });

      const gqlData = await gqlResp.json() as any;
      if (gqlData.errors?.length) throw new Error(`Railway API: ${JSON.stringify(gqlData.errors[0]?.message || gqlData.errors)}`);

      console.log("[RESET] ADMIN_PASSWORD updated on Railway — redeploy triggered automatically");

      // Send confirmation to BOTH addresses
      const RESEND_API_KEY  = process.env.RESEND_API_KEY       || "";
      const RESEND_FROM     = process.env.RESEND_FROM          || "noreply@albanianeagletours.com";
      const PRIMARY_EMAIL   = process.env.ADMIN_OTP_EMAIL      || "book@albanianeagletours.com";
      const SECONDARY_EMAIL = process.env.ADMIN_SECONDARY_EMAIL || "aneo.hila@gmail.com";

      const confirmHtml = `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
          <h2 style="color:#27ae60;margin:0 0 8px">✅ AlbaTour Admin Password Changed</h2>
          <p style="color:#555;">Your AlbaTour admin password was successfully updated.</p>
          <p style="color:#555;">Railway will automatically redeploy in <strong>2–3 minutes</strong>. Your new password will be active after that.</p>
          <p style="color:#888;font-size:13px;margin-top:20px;">If you did not make this change, contact support immediately at book@albanianeagletours.com</p>
        </div>
      `;

      if (RESEND_API_KEY) {
        const sendConfirm = (to: string) =>
          fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from:    `AlbaTour Security <${RESEND_FROM}>`,
              to:      [to],
              subject: "✅ AlbaTour Admin — Password Successfully Changed",
              html:    confirmHtml,
              text:    "Your AlbaTour admin password was successfully updated. Railway will redeploy in 2-3 minutes.",
            }),
          }).catch(err => console.error(`[RESET] Confirm email to ${to} failed:`, err.message));

        sendConfirm(PRIMARY_EMAIL);
        sendConfirm(SECONDARY_EMAIL);
      }

      res.json({ ok: true, message: "Password updated. Railway will redeploy in 2–3 minutes. You can then log in with your new password." });
    } catch (e: any) {
      console.error("[RESET] reset-password error:", e.message);
      res.status(500).json({ error: e.message || "Failed to reset password. Please try again." });
    }
  });

  // ── Subscription System ────────────────────────────────────────────────────────────
  // ── Shopify orders/paid webhook ────────────────────────────────────────────
  // Receives orders/paid from Shopify, verifies HMAC, creates subscription.
  // Set SHOPIFY_WEBHOOK_SECRET in Railway env vars.
  app.post('/api/webhooks/shopify/orders-paid', async (req: any, res) => {
      try {
        // HMAC verification
        const secret = process.env.SHOPIFY_WEBHOOK_SECRET || '';
        const hmacHeader = (req.headers['x-shopify-hmac-sha256'] as string) || '';
        if (secret && req.rawBody) {
          const computed = createHmac('sha256', secret).update(req.rawBody).digest('base64');
          if (computed !== hmacHeader) {
            return res.status(401).json({ error: 'HMAC verification failed' });
          }
        }

        const order = req.body;
        const orderId = String(order.id);
        const email = (order.contact_email || order.email || order.customer?.email || '').toLowerCase();
        if (!email || !orderId) return res.status(400).json({ error: 'Missing email or order ID' });

        // Idempotency: skip if already processed
        const existing = await storage.getSubscriptionByOrderId(orderId);
        if (existing) return res.status(200).json({ ok: true, duplicate: true });

        // Identify which AlbaTour plan was purchased by variant ID
        const plans = await storage.getAllPlans();
        let matchedPlan = null;
        for (const item of (order.line_items || [])) {
          const variantId = String(item.variant_id);
          matchedPlan = plans.find(p => p.shopifyVariantId === variantId);
          if (matchedPlan) break;
        }
        if (!matchedPlan) {
          // Log unmatched but still return 200 to prevent Shopify retries
          console.warn('[webhook] No plan matched for order', orderId, 'variants:', order.line_items?.map((l: any) => l.variant_id));
          return res.status(200).json({ ok: true, warning: 'No matching plan' });
        }

        // Calculate expiry
        const now = new Date();
        const expiresAt = new Date(now);
        if (matchedPlan.billingPeriod === '7-day')   expiresAt.setDate(expiresAt.getDate() + 7);
        else if (matchedPlan.billingPeriod === 'month') expiresAt.setMonth(expiresAt.getMonth() + 1);
        else expiresAt.setFullYear(expiresAt.getFullYear() + 1); // year (default)

        // Generate session token (crypto random, 32 bytes hex)
        const sessionToken = cryptoRandomBytes(32).toString('hex');

        // Generate short human-readable access code: ALB-XXXX (4 uppercase alphanumeric chars)
        const codeChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I ambiguity
        const accessCode = 'ALB-' + Array.from({ length: 4 }, () =>
          codeChars[Math.floor(Math.random() * codeChars.length)]
        ).join('');

        // Read device limit from plan (with fallback)
        const deviceLimit = (matchedPlan as any).deviceLimit || 2;

        const sub = await storage.createSubscription({
          email,
          planSlug: matchedPlan.slug,
          planName: matchedPlan.name,
          shopifyOrderId: orderId,
          priceEur: matchedPlan.priceEur,
          startsAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
          isActive: true,
          deviceCount: 0,
          devices: '[]',
          sessionToken,
          notes: '',
          createdAt: now.toISOString(),
          ...(({ deviceLimit, accessCode } as any)),
        } as any);

        console.log(`[webhook] Subscription created: ${email} → ${matchedPlan.name} code=${accessCode} expires ${expiresAt.toISOString()}`);

        // ── Send activation email via Resend ──────────────────────────────────
        const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
        const RESEND_FROM_ADDR = process.env.RESEND_FROM || 'noreply@albanianeagletours.com';
        if (RESEND_API_KEY && email) {
          const activateUrl = `https://albaniaaudiotours.com/#/activate?order_id=${orderId}&email=${encodeURIComponent(email)}`;
          const expiryStr = expiresAt.toLocaleDateString
            ? expiresAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
            : expiresAt.toISOString().slice(0,10);

          // QR served from Railway — avoids Gmail's block on data: URIs and external image services
          const qrEndpointUrl = `https://albaniaaudiotours.com/api/qr?data=${encodeURIComponent(activateUrl)}`;
          const qrImgTag = `<img src="${qrEndpointUrl}" width="180" height="180" alt="Scan to activate" style="border-radius:8px;border:4px solid #c0392b;display:block;margin:0 auto;" />`;

          const deviceNote = deviceLimit > 1
            ? `Share this code with up to <strong>${deviceLimit - 1}</strong> travel companion${deviceLimit > 2 ? 's' : ''} — each opens the app and enters the same code.`
            : 'This code activates on 1 device.';

          const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:24px 0;">
<tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:520px;width:100%;">

  <!-- Header -->
  <tr><td style="background:#c0392b;padding:24px 32px;text-align:center;">
    <h1 style="color:#fff;font-size:22px;margin:0;letter-spacing:-0.5px;">&#127911; Your AlbaTour is Ready!</h1>
    <p style="color:rgba(255,255,255,0.85);font-size:14px;margin:6px 0 0;">Thank you for subscribing — your audio tours are activated.</p>
  </td></tr>

  <!-- Plan details -->
  <tr><td style="padding:24px 32px 0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:10px;border:1px solid #eee;">
      <tr>
        <td style="padding:14px 20px;border-bottom:1px solid #eee;">
          <span style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.06em;">Plan</span><br>
          <strong style="font-size:16px;color:#1a1a1a;">${matchedPlan.name}</strong>
        </td>
        <td style="padding:14px 20px;border-bottom:1px solid #eee;text-align:right;">
          <span style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.06em;">Access Until</span><br>
          <strong style="font-size:16px;color:#1a1a1a;">${expiryStr}</strong>
        </td>
      </tr>
      <tr>
        <td colspan="2" style="padding:14px 20px;">
          <span style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.06em;">Devices</span><br>
          <strong style="font-size:16px;color:#1a1a1a;">${deviceLimit} device${deviceLimit > 1 ? 's' : ''} allowed</strong>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Step 1: QR Code -->
  <tr><td style="padding:28px 32px 0;text-align:center;">
    <p style="font-size:13px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.08em;margin:0 0 12px;">Step 1 — Scan with your phone</p>
    ${qrImgTag}
    <p style="font-size:12px;color:#888;margin:10px 0 0;">Point your camera at the QR code — no app needed.</p>
  </td></tr>

  <!-- Divider -->
  <tr><td style="padding:20px 32px;">
    <table width="100%"><tr>
      <td style="border-top:1px solid #eee;"></td>
      <td style="padding:0 12px;white-space:nowrap;font-size:12px;color:#aaa;">OR</td>
      <td style="border-top:1px solid #eee;"></td>
    </tr></table>
  </td></tr>

  <!-- Step 2: Button -->
  <tr><td style="padding:0 32px;text-align:center;">
    <p style="font-size:13px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.08em;margin:0 0 12px;">Step 2 — Tap the button</p>
    <a href="${activateUrl}" style="display:inline-block;background:#c0392b;color:#ffffff;padding:16px 36px;border-radius:10px;font-size:16px;font-weight:700;text-decoration:none;letter-spacing:-.3px;">Activate My Subscription &rarr;</a>
    <p style="font-size:12px;color:#888;margin:10px 0 0;">Opens the activation page on this device.</p>
  </td></tr>

  <!-- Divider -->
  <tr><td style="padding:20px 32px;">
    <table width="100%"><tr>
      <td style="border-top:1px solid #eee;"></td>
      <td style="padding:0 12px;white-space:nowrap;font-size:12px;color:#aaa;">OR</td>
      <td style="border-top:1px solid #eee;"></td>
    </tr></table>
  </td></tr>

  <!-- Step 3: Access Code -->
  <tr><td style="padding:0 32px 28px;">
    <p style="font-size:13px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.08em;margin:0 0 12px;text-align:center;">Step 3 — Enter your access code</p>
    <div style="background:#fff8f0;border:2px dashed #e67e22;border-radius:12px;padding:20px 24px;text-align:center;">
      <p style="margin:0 0 6px;font-size:12px;color:#92400e;font-weight:600;text-transform:uppercase;letter-spacing:.06em;">Your Access Code</p>
      <p style="margin:0;font-size:40px;font-weight:900;letter-spacing:.25em;color:#1a1a1a;font-family:'Courier New',monospace;line-height:1.1;">${accessCode}</p>
      <p style="margin:12px 0 4px;font-size:13px;color:#92400e;">Go to <strong>albaniaaudiotours.com/#/activate</strong></p>
      <p style="margin:0;font-size:12px;color:#b45309;">${deviceNote}</p>
    </div>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f9f9f9;border-top:1px solid #eee;padding:16px 32px;text-align:center;">
    <p style="font-size:12px;color:#999;margin:0;line-height:1.6;">
      Purchased by ${email} &middot; Order #${orderId}<br>
      Need help? <a href="mailto:book@albanianeagletours.com" style="color:#c0392b;text-decoration:none;">book@albanianeagletours.com</a>
    </p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;

          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: `AlbaTour <${RESEND_FROM_ADDR}>`,
              to: [email],
              subject: `\u{1F511} Your AlbaTour Access Code: ${accessCode}`,
              html: emailHtml,
              text: `Your AlbaTour subscription is active!\n\nPlan: ${matchedPlan.name}\nAccess until: ${expiryStr}\nDevices: ${deviceLimit}\n\nACCESS CODE: ${accessCode}\n\nActivate by:\n1. Scan the QR code in the HTML version of this email\n2. Click: ${activateUrl}\n3. Go to albaniaaudiotours.com/#/activate and enter code: ${accessCode}\n\nQuestions? book@albanianeagletours.com`,
            }),
          }).catch(e => console.error('[webhook] Activation email failed:', e.message));
        }

        res.status(200).json({ ok: true, subscriptionId: sub.id });
      } catch (e: any) {
        console.error('[webhook] Error:', e.message);
        res.status(500).json({ error: e.message });
      }
  });

  // ── Activate subscription (post-checkout page calls this) ────────────────
  // Client sends { orderId, email } — server returns session token + subscription info
  app.post('/api/subscription/activate', async (req, res) => {
    try {
      const { orderId, email } = req.body as { orderId: string; email: string };
      if (!orderId || !email) return res.status(400).json({ error: 'orderId and email required' });

      const sub = await storage.getSubscriptionByOrderId(String(orderId));
      if (!sub) return res.status(404).json({ error: 'Subscription not found. The webhook may still be processing — try again in a moment.' });
      if (!sub.isActive) return res.status(403).json({ error: 'Subscription has been revoked.' });
      if (sub.email !== email.toLowerCase()) return res.status(403).json({ error: 'Email does not match order.' });

      const now = new Date().toISOString();
      if (sub.expiresAt < now) return res.status(403).json({ error: 'Subscription has expired.' });

      // Register device — limit from plan (defaults to 2 if not set)
      const deviceLimit = (sub as any).deviceLimit || 2;
      const deviceFingerprint = req.headers['x-device-id'] as string || req.ip || 'unknown';
      const devices: string[] = JSON.parse(sub.devices || '[]');
      if (!devices.includes(deviceFingerprint)) {
        if (devices.length >= deviceLimit) {
          return res.status(403).json({
            error: `Device limit reached. This subscription allows ${deviceLimit} device${deviceLimit > 1 ? 's' : ''}. Contact support to manage devices.`,
            code: 'DEVICE_LIMIT',
            deviceLimit,
          });
        }
        devices.push(deviceFingerprint);
        await storage.updateSubscription(sub.id, { devices: JSON.stringify(devices), deviceCount: devices.length });
      }

      res.json({
        ok: true,
        token: sub.sessionToken,
        email: sub.email,
        planName: sub.planName,
        planSlug: sub.planSlug,
        expiresAt: sub.expiresAt,
        deviceCount: devices.length,
        deviceLimit,
        accessCode: (sub as any).accessCode || '',
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Activate by access code (family / shared code flow) ────────────────────
  app.post('/api/subscription/activate-by-code', async (req, res) => {
    try {
      const { code } = req.body as { code: string };
      if (!code) return res.status(400).json({ error: 'Access code required' });

      const sub = await storage.getSubscriptionByCode(code.trim().toUpperCase());
      if (!sub) return res.status(404).json({ error: 'Access code not found. Check the code and try again.' });
      if (!sub.isActive) return res.status(403).json({ error: 'This subscription has been revoked.' });
      const now = new Date().toISOString();
      if (sub.expiresAt < now) return res.status(403).json({ error: 'This subscription has expired.' });

      const deviceLimit = (sub as any).deviceLimit || 2;
      const deviceFingerprint = req.headers['x-device-id'] as string || req.ip || 'unknown';
      const devices: string[] = JSON.parse(sub.devices || '[]');

      if (!devices.includes(deviceFingerprint)) {
        if (devices.length >= deviceLimit) {
          return res.status(403).json({
            error: `All ${deviceLimit} device slot${deviceLimit > 1 ? 's' : ''} are used. Contact support to reset.`,
            code: 'DEVICE_LIMIT',
            deviceLimit,
          });
        }
        devices.push(deviceFingerprint);
        await storage.updateSubscription(sub.id, { devices: JSON.stringify(devices), deviceCount: devices.length });
      }

      res.json({
        ok: true,
        token: sub.sessionToken,
        email: sub.email,
        planName: sub.planName,
        planSlug: sub.planSlug,
        expiresAt: sub.expiresAt,
        deviceCount: devices.length,
        deviceLimit,
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Check subscription by token (client polls on load) ───────────────────
  app.get('/api/subscription/check', async (req, res) => {
    try {
      const token = (req.headers['x-subscription-token'] as string) || '';
      if (!token) return res.json({ active: false });
      const sub = await storage.getSubscriptionByToken(token);
      if (!sub || !sub.isActive) return res.json({ active: false });
      const now = new Date().toISOString();
      if (sub.expiresAt < now) return res.json({ active: false, expired: true, expiresAt: sub.expiresAt });
      // Deferred start: subscription not yet active if startsAt is in the future
      if (sub.startsAt && sub.startsAt > now) return res.json({
        active: false, pending: true, startsAt: sub.startsAt,
        message: `Your tour access starts on ${new Date(sub.startsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`
      });
      res.json({
        active: true,
        planName: sub.planName,
        planSlug: sub.planSlug,
        expiresAt: sub.expiresAt,
        startsAt: sub.startsAt,
        email: sub.email,
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Admin: list all subscribers ────────────────────────────────────────────
  app.get('/api/admin/subscriptions', requireAdmin, async (_req, res) => {
    try { res.json(await storage.getAllSubscriptions()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });


  // ── Admin: patch a subscription (set accessCode, deviceLimit, notes) ──────
  app.put('/api/admin/subscriptions/:id/patch', requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const allowed = ['accessCode', 'deviceLimit', 'devices', 'deviceCount', 'notes'];
      const patch: Record<string, any> = {};
      for (const key of allowed) { if (key in req.body) patch[key] = req.body[key]; }
      if (!Object.keys(patch).length) return res.status(400).json({ error: 'No valid fields' });
      const updated = await storage.updateSubscription(id, patch as any);
      if (!updated) return res.status(404).json({ error: 'Subscription not found' });
      res.json(updated);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Admin: resend activation email for a subscription ──────────────────────
  app.post('/api/admin/subscriptions/:id/resend-email', requireAdmin, async (req, res) => {
    try {
      const sub = await storage.getAllSubscriptions().then(all => all.find(s => s.id === Number(req.params.id)));
      if (!sub) return res.status(404).json({ error: 'Subscription not found' });

      const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
      const RESEND_FROM_ADDR = process.env.RESEND_FROM || 'noreply@albanianeagletours.com';
      if (!RESEND_API_KEY) return res.status(500).json({ error: 'RESEND_API_KEY not configured' });

      const orderId = sub.shopifyOrderId;
      const email = sub.email;
      const accessCode = (sub as any).accessCode || '';
      const deviceLimit = (sub as any).deviceLimit || 2;
      const expiresAt = new Date(sub.expiresAt);
      const expiryStr = expiresAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      const activateUrl = `https://albaniaaudiotours.com/#/activate?order_id=${orderId}&email=${encodeURIComponent(email)}`;

      // QR served from Railway — works in all email clients including Gmail
      const qrEndpointUrl = `https://albaniaaudiotours.com/api/qr?data=${encodeURIComponent(activateUrl)}`;
      const qrImgTag = `<img src="${qrEndpointUrl}" width="180" height="180" alt="Scan to activate" style="border-radius:8px;border:4px solid #c0392b;display:block;margin:0 auto;" />`;
      const deviceNote = deviceLimit > 1
        ? `Share this code with up to <strong>${deviceLimit - 1}</strong> travel companion${deviceLimit > 2 ? 's' : ''} — each opens the app and enters the same code.`
        : 'This code activates on 1 device.';

      const emailHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:24px 0;"><tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;max-width:520px;width:100%;">
  <tr><td style="background:#c0392b;padding:24px 32px;text-align:center;">
    <h1 style="color:#fff;font-size:22px;margin:0;">&#127911; Your AlbaTour is Ready!</h1>
    <p style="color:rgba(255,255,255,0.85);font-size:14px;margin:6px 0 0;">Here are your activation details — 3 ways to get started.</p>
  </td></tr>
  <tr><td style="padding:24px 32px 0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:10px;border:1px solid #eee;">
      <tr>
        <td style="padding:14px 20px;border-bottom:1px solid #eee;">
          <span style="font-size:11px;color:#888;text-transform:uppercase;">Plan</span><br>
          <strong style="font-size:16px;color:#1a1a1a;">${sub.planName}</strong>
        </td>
        <td style="padding:14px 20px;border-bottom:1px solid #eee;text-align:right;">
          <span style="font-size:11px;color:#888;text-transform:uppercase;">Access Until</span><br>
          <strong style="font-size:16px;color:#1a1a1a;">${expiryStr}</strong>
        </td>
      </tr>
      <tr><td colspan="2" style="padding:14px 20px;">
        <span style="font-size:11px;color:#888;text-transform:uppercase;">Devices</span><br>
        <strong style="font-size:16px;color:#1a1a1a;">${deviceLimit} device${deviceLimit > 1 ? 's' : ''} allowed</strong>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:28px 32px 0;text-align:center;">
    <p style="font-size:13px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.08em;margin:0 0 12px;">Step 1 — Scan with your phone</p>
    ${qrImgTag}
    <p style="font-size:12px;color:#888;margin:10px 0 0;">Point your camera at the QR code — no app needed.</p>
  </td></tr>
  <tr><td style="padding:16px 32px;"><table width="100%"><tr>
    <td style="border-top:1px solid #eee;"></td><td style="padding:0 12px;white-space:nowrap;font-size:12px;color:#aaa;">OR</td><td style="border-top:1px solid #eee;"></td>
  </tr></table></td></tr>
  <tr><td style="padding:0 32px;text-align:center;">
    <p style="font-size:13px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.08em;margin:0 0 12px;">Step 2 — Tap the button</p>
    <a href="${activateUrl}" style="display:inline-block;background:#c0392b;color:#fff;padding:16px 36px;border-radius:10px;font-size:16px;font-weight:700;text-decoration:none;">Activate My Subscription &rarr;</a>
    <p style="font-size:12px;color:#888;margin:10px 0 0;">Opens the activation page on this device.</p>
  </td></tr>
  <tr><td style="padding:16px 32px;"><table width="100%"><tr>
    <td style="border-top:1px solid #eee;"></td><td style="padding:0 12px;white-space:nowrap;font-size:12px;color:#aaa;">OR</td><td style="border-top:1px solid #eee;"></td>
  </tr></table></td></tr>
  <tr><td style="padding:0 32px 28px;">
    <p style="font-size:13px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.08em;margin:0 0 12px;text-align:center;">Step 3 — Enter your access code</p>
    <div style="background:#fff8f0;border:2px dashed #e67e22;border-radius:12px;padding:20px 24px;text-align:center;">
      <p style="margin:0 0 6px;font-size:12px;color:#92400e;font-weight:600;text-transform:uppercase;">Your Access Code</p>
      <p style="margin:0;font-size:40px;font-weight:900;letter-spacing:.25em;color:#1a1a1a;font-family:'Courier New',monospace;">${accessCode || 'N/A'}</p>
      <p style="margin:12px 0 4px;font-size:13px;color:#92400e;">Go to <strong>albaniaaudiotours.com/#/activate</strong></p>
      <p style="margin:0;font-size:12px;color:#b45309;">${deviceNote}</p>
    </div>
  </td></tr>
  <tr><td style="background:#f9f9f9;border-top:1px solid #eee;padding:16px 32px;text-align:center;">
    <p style="font-size:12px;color:#999;margin:0;line-height:1.6;">
      Purchased by ${email} &middot; Order #${orderId}<br>
      Need help? <a href="mailto:book@albanianeagletours.com" style="color:#c0392b;text-decoration:none;">book@albanianeagletours.com</a>
    </p>
  </td></tr>
</table></td></tr></table></body></html>`;

      const emailResp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `AlbaTour <${RESEND_FROM_ADDR}>`,
          to: [email],
          subject: `🔑 Your AlbaTour Access Code: ${accessCode}`,
          html: emailHtml,
          text: `Your AlbaTour subscription is active!\n\nPlan: ${sub.planName}\nAccess until: ${expiryStr}\nDevices: ${deviceLimit}\n\nACCESS CODE: ${accessCode}\n\nActivate:\n1. Click: ${activateUrl}\n2. Go to albaniaaudiotours.com/#/activate and enter: ${accessCode}`,
        }),
      });
      const emailResult = await emailResp.json();
      if (!emailResp.ok) return res.status(500).json({ error: 'Email send failed', details: emailResult });
      res.json({ ok: true, emailId: emailResult.id, sentTo: email });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });


  // ── Admin: revoke a subscription ───────────────────────────────────────
  app.put('/api/admin/subscriptions/:id/revoke', requireAdmin, async (req, res) => {
    try {
      const ok = await storage.revokeSubscription(Number(req.params.id));
      if (!ok) return res.status(404).json({ error: 'Subscription not found' });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Admin: manual test activation (no Shopify needed) ──────────────────
  app.post('/api/admin/subscriptions/test-activate', requireAdmin, async (req, res) => {
    try {
      const { email, planSlug, daysFromNow = 7 } = req.body as { email: string; planSlug: string; daysFromNow?: number };
      if (!email || !planSlug) return res.status(400).json({ error: 'email and planSlug required' });
      const plan = await storage.getPlanBySlug(planSlug);
      if (!plan) return res.status(404).json({ error: 'Plan not found' });
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setDate(expiresAt.getDate() + daysFromNow);
      const sub = await storage.createSubscription({
        email: email.toLowerCase(), planSlug, planName: plan.name,
        shopifyOrderId: `TEST-${cryptoRandomBytes(8).toString('hex')}`,
        priceEur: plan.priceEur, startsAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(), isActive: true,
        deviceCount: 0, devices: '[]',
        sessionToken: cryptoRandomBytes(32).toString('hex'),
        notes: 'TEST ACTIVATION', createdAt: now.toISOString(),
      });
      res.json({ success: true, sub });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Admin: manual code generator — creates a real subscription with access code + email ───────
  // Body: { email, planId, startsAt? (ISO date), notes? }
  app.post('/api/admin/subscriptions/generate-code', requireAdmin, async (req, res) => {
    try {
      const { email, planId, startsAt: startsAtInput, notes: adminNotes } =
        req.body as { email: string; planId: number; startsAt?: string; notes?: string };
      if (!email || !planId) return res.status(400).json({ error: 'email and planId required' });

      // Load plan
      const plans = await storage.getAllPlans();
      const plan = plans.find(p => p.id === Number(planId));
      if (!plan) return res.status(404).json({ error: 'Plan not found' });

      // Calculate dates
      const startsAt = startsAtInput ? new Date(startsAtInput) : new Date();
      const expiresAt = new Date(startsAt);
      if (plan.billingPeriod === '7-day')   expiresAt.setDate(expiresAt.getDate() + 7);
      else if (plan.billingPeriod === 'month') expiresAt.setMonth(expiresAt.getMonth() + 1);
      else expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      // Generate code and token
      const codeChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const accessCode = 'ALB-' + Array.from({ length: 4 }, () =>
        codeChars[Math.floor(Math.random() * codeChars.length)]
      ).join('');
      const sessionToken = cryptoRandomBytes(32).toString('hex');
      const orderId = `MANUAL-${cryptoRandomBytes(6).toString('hex').toUpperCase()}`;
      const deviceLimit = (plan as any).deviceLimit || 2;

      const sub = await storage.createSubscription({
        email: email.toLowerCase(),
        planSlug: plan.slug, planName: plan.name,
        shopifyOrderId: orderId,
        priceEur: plan.priceEur,
        startsAt: startsAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        isActive: true, deviceCount: 0, devices: '[]',
        sessionToken,
        notes: `MANUAL${adminNotes ? ' — ' + adminNotes : ''}`,
        createdAt: new Date().toISOString(),
        ...(({ accessCode, deviceLimit } as any)),
      } as any);

      // Send activation email
      const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
      const RESEND_FROM_ADDR = process.env.RESEND_FROM || 'noreply@albanianeagletours.com';
      let emailSent = false;
      if (RESEND_API_KEY) {
        const activateUrl = `https://albania-audio-tours-production.up.railway.app/#/activate?order_id=${orderId}&email=${encodeURIComponent(email.toLowerCase())}`;
        const startStr  = startsAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        const expiryStr = expiresAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        const qrUrl = `https://albania-audio-tours-production.up.railway.app/api/qr?data=${encodeURIComponent(activateUrl)}`;
        const isPending = startsAt > new Date();
        const deviceNote = deviceLimit > 1
          ? `Share this code with up to <strong>${deviceLimit - 1}</strong> travel companion${deviceLimit > 2 ? 's' : ''} — each opens the app and enters the same code.`
          : 'This code activates on 1 device.';

        const emailHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:24px 0;"><tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;max-width:520px;width:100%;">
  <tr><td style="background:#c0392b;padding:24px 32px;text-align:center;">
    <h1 style="color:#fff;font-size:22px;margin:0;">&#127911; Your AlbaTour Access Code</h1>
    <p style="color:rgba(255,255,255,0.85);font-size:14px;margin:6px 0 0;">${isPending ? 'Your tour is booked — here are your activation details.' : 'Here are 3 ways to activate your audio tour access.'}</p>
  </td></tr>
  <tr><td style="padding:24px 32px 0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:10px;border:1px solid #eee;">
      <tr>
        <td style="padding:14px 20px;border-bottom:1px solid #eee;">
          <span style="font-size:11px;color:#888;text-transform:uppercase;">Plan</span><br>
          <strong style="font-size:16px;color:#1a1a1a;">${plan.name}</strong>
        </td>
        <td style="padding:14px 20px;border-bottom:1px solid #eee;text-align:right;">
          <span style="font-size:11px;color:#888;text-transform:uppercase;">${isPending ? 'Tour Starts' : 'Access Until'}</span><br>
          <strong style="font-size:16px;color:#1a1a1a;">${isPending ? startStr : expiryStr}</strong>
        </td>
      </tr>
      ${isPending ? `<tr><td colspan="2" style="padding:14px 20px;border-bottom:1px solid #eee;">
        <span style="font-size:11px;color:#888;text-transform:uppercase;">Access Until</span><br>
        <strong style="font-size:16px;color:#1a1a1a;">${expiryStr}</strong>
      </td></tr>` : ''}
      <tr><td colspan="2" style="padding:14px 20px;">
        <span style="font-size:11px;color:#888;text-transform:uppercase;">Devices</span><br>
        <strong style="font-size:16px;color:#1a1a1a;">${deviceLimit} device${deviceLimit > 1 ? 's' : ''} allowed</strong>
      </td></tr>
    </table>
    ${isPending ? `<div style="margin-top:16px;padding:14px 20px;background:#fef3c7;border:1px solid #f59e0b;border-radius:10px;">
      <p style="margin:0;font-size:13px;color:#92400e;">&#128197; <strong>Your code is ready now</strong> but audio tour access begins on <strong>${startStr}</strong>. Save this email and activate when your trip starts.</p>
    </div>` : ''}
  </td></tr>
  <tr><td style="padding:28px 32px 0;text-align:center;">
    <p style="font-size:13px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.08em;margin:0 0 12px;">Step 1 — Scan with your phone</p>
    <img src="${qrUrl}" width="180" height="180" alt="Scan to activate" style="border-radius:8px;border:4px solid #c0392b;display:block;margin:0 auto;" />
    <p style="font-size:12px;color:#888;margin:10px 0 0;">Point your camera at the QR code — no app needed.</p>
  </td></tr>
  <tr><td style="padding:16px 32px;"><table width="100%"><tr><td style="border-top:1px solid #eee;"></td><td style="padding:0 12px;white-space:nowrap;font-size:12px;color:#aaa;">OR</td><td style="border-top:1px solid #eee;"></td></tr></table></td></tr>
  <tr><td style="padding:0 32px;text-align:center;">
    <p style="font-size:13px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.08em;margin:0 0 12px;">Step 2 — Tap the button</p>
    <a href="${activateUrl}" style="display:inline-block;background:#c0392b;color:#fff;padding:16px 36px;border-radius:10px;font-size:16px;font-weight:700;text-decoration:none;">Activate My Subscription &rarr;</a>
  </td></tr>
  <tr><td style="padding:16px 32px;"><table width="100%"><tr><td style="border-top:1px solid #eee;"></td><td style="padding:0 12px;white-space:nowrap;font-size:12px;color:#aaa;">OR</td><td style="border-top:1px solid #eee;"></td></tr></table></td></tr>
  <tr><td style="padding:0 32px 28px;">
    <p style="font-size:13px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.08em;margin:0 0 12px;text-align:center;">Step 3 — Enter your access code</p>
    <div style="background:#fff8f0;border:2px dashed #e67e22;border-radius:12px;padding:20px 24px;text-align:center;">
      <p style="margin:0 0 6px;font-size:12px;color:#92400e;font-weight:600;text-transform:uppercase;">Your Access Code</p>
      <p style="margin:0;font-size:40px;font-weight:900;letter-spacing:.25em;color:#1a1a1a;font-family:'Courier New',monospace;">${accessCode}</p>
      <p style="margin:12px 0 4px;font-size:13px;color:#92400e;">Go to <strong>albaniaaudiotours.com/#/activate</strong></p>
      <p style="margin:0;font-size:12px;color:#b45309;">${deviceNote}</p>
    </div>
  </td></tr>
  <tr><td style="background:#f9f9f9;border-top:1px solid #eee;padding:16px 32px;text-align:center;">
    <p style="font-size:12px;color:#999;margin:0;line-height:1.6;">Issued by AlbaTour Admin &middot; Order ref: ${orderId}<br>Questions? <a href="mailto:book@albanianeagletours.com" style="color:#c0392b;text-decoration:none;">book@albanianeagletours.com</a></p>
  </td></tr>
</table></td></tr></table></body></html>`;

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: `AlbaTour <${RESEND_FROM_ADDR}>`,
            to: [email.toLowerCase()],
            subject: `\u{1F511} Your AlbaTour Access Code: ${accessCode}`,
            html: emailHtml,
            text: `Your AlbaTour access code is: ${accessCode}\n\nPlan: ${plan.name}\n${isPending ? 'Starts: ' + startStr + '\n' : ''}Expires: ${expiryStr}\n\nActivate at: ${activateUrl}\nOr go to albaniaaudiotours.com/#/activate and enter: ${accessCode}`,
          }),
        }).then(() => { emailSent = true; }).catch(e => console.error('[generate-code] Email failed:', e.message));
      }

      res.json({ success: true, sub, accessCode, emailSent });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  return httpServer;
}
