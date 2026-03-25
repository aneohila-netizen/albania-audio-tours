import type { Express } from "express";
import { type Server } from "http";
import path from "path";
import fs from "fs";
import { execFile, execFileSync } from "child_process";
import { promisify } from "util";

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
import { storage } from "./storage";
import { insertUserProgressSchema, insertTourSiteSchema, insertAttractionSchema } from "@shared/schema";

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
const RAILWAY_BASE = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : process.env.PUBLIC_URL
  || "https://albania-audio-tours-production.up.railway.app";

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

// ─── Upload dirs ─────────────────────────────────────────────────────────────
const AUDIO_DIR = path.join(process.cwd(), "data", "audio");
const IMAGE_DIR = path.join(process.cwd(), "data", "images");
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });
if (!fs.existsSync(IMAGE_DIR)) fs.mkdirSync(IMAGE_DIR, { recursive: true });

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

const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(IMAGE_DIR)) fs.mkdirSync(IMAGE_DIR, { recursive: true });
    cb(null, IMAGE_DIR);
  },
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}_${safe}`);
  },
});

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

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // ── Public API ──────────────────────────────────────────────────────────────
  app.get("/api/sites", async (_req, res) => {
    const sites = await storage.getAllSites();
    res.json(sites.map(s => stripAudioData(s, 'site')));
  });

  app.get("/api/sites/:slug", async (req, res) => {
    const site = await storage.getSiteBySlug(req.params.slug);
    if (!site) return res.status(404).json({ error: "Not found" });
    res.json(stripAudioData(site, 'site'));
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

  // Serve uploaded image files
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
    res.json(attrs.map(a => stripAudioData(a, 'attraction')));
  });

  app.get("/api/attractions/:destinationSlug", async (req, res) => {
    const attrs = await storage.getAttractionsByDestination(req.params.destinationSlug);
    res.json(attrs.map(a => stripAudioData(a, 'attraction')));
  });

  app.get("/api/attractions/:destinationSlug/:slug", async (req, res) => {
    const attr = await storage.getAttractionBySlug(req.params.destinationSlug, req.params.slug);
    if (!attr) return res.status(404).json({ error: "Not found" });
    res.json(stripAudioData(attr, 'attraction'));
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
    res.json(attrs.map(a => stripAudioData(a, 'attraction')));
  });

  app.get("/api/admin/attractions/:destinationSlug", requireAdmin, async (req, res) => {
    const attrs = await storage.getAttractionsByDestination(req.params.destinationSlug);
    res.json(attrs.map(a => stripAudioData(a, 'attraction')));
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
    // Strip audioUrl fields — audio is managed via dedicated upload/TTS endpoints.
    // If we allow the form to overwrite them with serve-URLs, audio gets corrupted.
    const { audioUrlEn, audioUrlAl, audioUrlGr, audioUrlIt, audioUrlEs, audioUrlDe, audioUrlFr, audioUrlAr, audioUrlSl, audioUrlPt, audioUrlCn, ...safeBody } = req.body;
    const updated = await storage.updateAttraction(id, safeBody);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(stripAudioData(updated, 'attraction'));
  });

  app.delete("/api/admin/attractions/:id", requireAdmin, async (req, res) => {
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

  app.delete("/api/admin/attractions/:id/audio/:lang", requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    const lang = req.params.lang as SupportedLang;
    const field = audioField(lang);
    const updated = await storage.updateAttraction(id, { [field]: null } as any);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json({ success: true, attraction: updated });
  });

  // ── Admin: Attraction Image Upload ──────────────────────────────────────────
  app.post(
    "/api/admin/attractions/:id/image",
    requireAdmin,
    imageUpload.single("image"),
    async (req: any, res) => {
      const id = parseInt(req.params.id);
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const imageUrl = `${RAILWAY_BASE}/api/images/${req.file.filename}`;
      const updated = await storage.updateAttraction(id, { imageUrl } as any);
      if (!updated) return res.status(404).json({ error: "Attraction not found" });
      res.json({ url: imageUrl, attraction: updated });
    }
  );

  // ── Admin: Sites CRUD ───────────────────────────────────────────────────────
  app.get("/api/admin/sites", requireAdmin, async (_req, res) => {
    const sites = await storage.getAllSites();
    res.json(sites.map(s => stripAudioData(s, 'site')));
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
    // Strip audioUrl fields — audio managed via dedicated upload/TTS endpoints.
    const { audioUrlEn, audioUrlAl, audioUrlGr, audioUrlIt, audioUrlEs, audioUrlDe, audioUrlFr, audioUrlAr, audioUrlSl, audioUrlPt, audioUrlCn, ...safeBody } = req.body;
    const updated = await storage.updateSite(id, safeBody);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(stripAudioData(updated, 'site'));
  });

  app.delete("/api/admin/sites/:id", requireAdmin, async (req, res) => {
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
  app.delete("/api/admin/sites/:id/audio/:lang", requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    const lang = req.params.lang as SupportedLang;
    const field = audioField(lang);
    const updated = await storage.updateSite(id, { [field]: null } as any);
    if (!updated) return res.status(404).json({ error: "Site not found" });
    res.json({ success: true, site: updated });
  });

  // ── Admin: Image Upload ─────────────────────────────────────────────────────────────
  app.post(
    "/api/admin/sites/:id/image",
    requireAdmin,
    imageUpload.single("image"),
    async (req: any, res) => {
      const id = parseInt(req.params.id);
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const imageUrl = `${RAILWAY_BASE}/api/images/${req.file.filename}`;
      const updated = await storage.updateSite(id, { imageUrl } as any);
      if (!updated) return res.status(404).json({ error: "Site not found" });
      res.json({ url: imageUrl, site: updated });
    }
  );

  // POST /api/admin/upload-image — generic image upload (returns absolute URL)
  app.post(
    "/api/admin/upload-image",
    requireAdmin,
    imageUpload.single("image"),
    async (req: any, res) => {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const imageUrl = `${RAILWAY_BASE}/api/images/${req.file.filename}`;
      res.json({ url: imageUrl });
    }
  );

  // ── Itinerary routes (public GET + admin CUD) ───────────────────────────
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
  app.delete("/api/admin/itineraries/:id", requireAdmin, async (req, res) => {
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

  return httpServer;
}
