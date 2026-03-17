import type { Express } from "express";
import { type Server } from "http";
import path from "path";
import fs from "fs";
import multer from "multer";
import { storage } from "./storage";
import { insertUserProgressSchema, insertTourSiteSchema } from "@shared/schema";

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

// ─── Audio upload config ──────────────────────────────────────────────────────
const AUDIO_DIR = path.join(process.cwd(), "data", "audio");
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

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

const upload = multer({
  storage: audioStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("audio/") || file.mimetype === "application/octet-stream") {
      cb(null, true);
    } else {
      cb(new Error("Only audio files are allowed"));
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

  // ── Admin: Auth ─────────────────────────────────────────────────────────────
  app.post("/api/admin/login", (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
      res.json({ token: ADMIN_TOKEN });
    } else {
      res.status(401).json({ error: "Invalid password" });
    }
  });

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

      const audioUrl = `/api/audio/${req.file.filename}`;
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

  return httpServer;
}
