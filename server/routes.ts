import type { Express } from "express";
import { type Server } from "http";
import path from "path";
import fs from "fs";
import multer from "multer";
import { storage } from "./storage";
import { insertUserProgressSchema, insertTourSiteSchema, insertAttractionSchema } from "@shared/schema";

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

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // ── Public API ──────────────────────────────────────────────────────────────
  app.get("/api/sites", async (_req, res) => {
    const sites = await storage.getAllSites();
    res.json(sites);
  });

  app.get("/api/sites/:slug", async (req, res) => {
    const site = await storage.getSiteBySlug(req.params.slug);
    if (!site) return res.status(404).json({ error: "Not found" });
    res.json(site);
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

  // Serve uploaded audio files
  app.use("/api/audio", (req, res, next) => {
    const filePath = path.join(AUDIO_DIR, req.path.replace(/^\//, ""));
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      next();
    }
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
    res.json(attrs);
  });

  app.get("/api/attractions/:destinationSlug", async (req, res) => {
    const attrs = await storage.getAttractionsByDestination(req.params.destinationSlug);
    res.json(attrs);
  });

  app.get("/api/attractions/:destinationSlug/:slug", async (req, res) => {
    const attr = await storage.getAttractionBySlug(req.params.destinationSlug, req.params.slug);
    if (!attr) return res.status(404).json({ error: "Not found" });
    res.json(attr);
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
    res.json(attrs);
  });

  app.get("/api/admin/attractions/:destinationSlug", requireAdmin, async (req, res) => {
    const attrs = await storage.getAttractionsByDestination(req.params.destinationSlug);
    res.json(attrs);
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
    res.json(attr);
  });

  app.put("/api/admin/attractions/:id", requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const updated = await storage.updateAttraction(id, req.body);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });

  app.delete("/api/admin/attractions/:id", requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const ok = await storage.deleteAttraction(id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  });

  // ── Admin: Attraction Audio Upload ──────────────────────────────────────────
  app.post(
    "/api/admin/attractions/:id/audio/:lang",
    requireAdmin,
    upload.single("audio"),
    async (req: any, res) => {
      const id = parseInt(req.params.id);
      const lang = req.params.lang as "en" | "al" | "gr";
      if (!["en", "al", "gr"].includes(lang)) return res.status(400).json({ error: "lang must be en|al|gr" });
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const audioUrl = `${RAILWAY_BASE}/api/audio/${req.file.filename}`;
      const field = lang === "en" ? "audioUrlEn" : lang === "al" ? "audioUrlAl" : "audioUrlGr";
      const updated = await storage.updateAttraction(id, { [field]: audioUrl } as any);
      if (!updated) return res.status(404).json({ error: "Attraction not found" });
      res.json({ url: audioUrl, attraction: updated });
    }
  );

  app.delete("/api/admin/attractions/:id/audio/:lang", requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    const lang = req.params.lang as "en" | "al" | "gr";
    const field = lang === "en" ? "audioUrlEn" : lang === "al" ? "audioUrlAl" : "audioUrlGr";
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
    res.json(sites);
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
    const updated = await storage.updateSite(id, req.body);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });

  app.delete("/api/admin/sites/:id", requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const ok = await storage.deleteSite(id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  });

  // ── Admin: Audio Upload ─────────────────────────────────────────────────────
  // POST /api/admin/sites/:id/audio/:lang  (lang = en | al | gr)
  app.post(
    "/api/admin/sites/:id/audio/:lang",
    requireAdmin,
    upload.single("audio"),
    async (req: any, res) => {
      const id = parseInt(req.params.id);
      const lang = req.params.lang as "en" | "al" | "gr";
      if (!["en", "al", "gr"].includes(lang)) return res.status(400).json({ error: "lang must be en|al|gr" });
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const audioUrl = `${RAILWAY_BASE}/api/audio/${req.file.filename}`;
      const field = lang === "en" ? "audioUrlEn" : lang === "al" ? "audioUrlAl" : "audioUrlGr";
      const updated = await storage.updateSite(id, { [field]: audioUrl } as any);
      if (!updated) return res.status(404).json({ error: "Site not found" });
      res.json({ url: audioUrl, site: updated });
    }
  );

  // DELETE audio for a site/lang
  app.delete("/api/admin/sites/:id/audio/:lang", requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    const lang = req.params.lang as "en" | "al" | "gr";
    const field = lang === "en" ? "audioUrlEn" : lang === "al" ? "audioUrlAl" : "audioUrlGr";
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

  return httpServer;
}
