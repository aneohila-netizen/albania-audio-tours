import fs from "fs";
import path from "path";
import type { TourSite, UserProgress, InsertUserProgress, InsertTourSite } from "@shared/schema";

// ─── Interface ────────────────────────────────────────────────────────────────
export interface IStorage {
  getAllSites(): Promise<TourSite[]>;
  getSiteBySlug(slug: string): Promise<TourSite | undefined>;
  getSiteById(id: number): Promise<TourSite | undefined>;
  createSite(data: InsertTourSite): Promise<TourSite>;
  updateSite(id: number, data: Partial<InsertTourSite>): Promise<TourSite | undefined>;
  deleteSite(id: number): Promise<boolean>;
  getProgress(sessionId: string): Promise<UserProgress[]>;
  addProgress(data: InsertUserProgress): Promise<UserProgress>;
  getLeaderboard(): Promise<{ sessionId: string; totalPoints: number; visitCount: number }[]>;
}

// ─── PostgreSQL storage (used when DATABASE_URL is set) ───────────────────────
class PgStorage implements IStorage {
  private pool: any;
  private ready: Promise<void>;

  constructor(databaseUrl: string) {
    this.ready = this._init(databaseUrl);
  }

  private async _init(databaseUrl: string) {
    const { Pool } = await import("pg");
    this.pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

    // Create tables if they don't exist
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS tour_sites (
        id SERIAL PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        name_en TEXT NOT NULL,
        name_al TEXT NOT NULL DEFAULT '',
        name_gr TEXT NOT NULL DEFAULT '',
        desc_en TEXT NOT NULL DEFAULT '',
        desc_al TEXT NOT NULL DEFAULT '',
        desc_gr TEXT NOT NULL DEFAULT '',
        fun_fact_en TEXT,
        fun_fact_al TEXT,
        fun_fact_gr TEXT,
        audio_url_en TEXT,
        audio_url_al TEXT,
        audio_url_gr TEXT,
        lat DOUBLE PRECISION NOT NULL DEFAULT 0,
        lng DOUBLE PRECISION NOT NULL DEFAULT 0,
        region TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT '',
        difficulty TEXT NOT NULL DEFAULT 'easy',
        points INTEGER NOT NULL DEFAULT 100,
        image_url TEXT,
        visit_duration INTEGER NOT NULL DEFAULT 60
      );

      CREATE TABLE IF NOT EXISTS user_progress (
        id SERIAL PRIMARY KEY,
        session_id TEXT NOT NULL,
        site_id INTEGER NOT NULL,
        visited_at TIMESTAMP DEFAULT NOW(),
        points_earned INTEGER NOT NULL DEFAULT 0
      );
    `);

    // Seed with static data if table is empty
    const { rows } = await this.pool.query("SELECT COUNT(*) as c FROM tour_sites");
    if (parseInt(rows[0].c) === 0) {
      const { STATIC_SITES } = await import("../client/src/lib/staticData.js").catch(() => ({ STATIC_SITES: [] as any[] }));
      for (const s of STATIC_SITES) {
        await this.pool.query(
          `INSERT INTO tour_sites (slug,name_en,name_al,name_gr,desc_en,desc_al,desc_gr,
            fun_fact_en,fun_fact_al,fun_fact_gr,audio_url_en,audio_url_al,audio_url_gr,
            lat,lng,region,category,difficulty,points,image_url,visit_duration)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
           ON CONFLICT (slug) DO NOTHING`,
          [s.slug, s.nameEn, s.nameAl||'', s.nameGr||'', s.descEn||'', s.descAl||'', s.descGr||'',
           s.funFactEn, s.funFactAl, s.funFactGr, s.audioUrlEn, s.audioUrlAl, s.audioUrlGr,
           s.lat, s.lng, s.region, s.category, s.difficulty||'easy', s.points||100, s.imageUrl, s.visitDuration||60]
        );
      }
    }
  }

  private rowToSite(r: any): TourSite {
    return {
      id: r.id, slug: r.slug,
      nameEn: r.name_en, nameAl: r.name_al, nameGr: r.name_gr,
      descEn: r.desc_en, descAl: r.desc_al, descGr: r.desc_gr,
      funFactEn: r.fun_fact_en, funFactAl: r.fun_fact_al, funFactGr: r.fun_fact_gr,
      audioUrlEn: r.audio_url_en, audioUrlAl: r.audio_url_al, audioUrlGr: r.audio_url_gr,
      lat: parseFloat(r.lat), lng: parseFloat(r.lng),
      region: r.region, category: r.category, difficulty: r.difficulty,
      points: r.points, imageUrl: r.image_url, visitDuration: r.visit_duration,
    };
  }

  async getAllSites(): Promise<TourSite[]> {
    await this.ready;
    const { rows } = await this.pool.query("SELECT * FROM tour_sites ORDER BY id");
    return rows.map(this.rowToSite);
  }

  async getSiteBySlug(slug: string): Promise<TourSite | undefined> {
    await this.ready;
    const { rows } = await this.pool.query("SELECT * FROM tour_sites WHERE slug=$1", [slug]);
    return rows[0] ? this.rowToSite(rows[0]) : undefined;
  }

  async getSiteById(id: number): Promise<TourSite | undefined> {
    await this.ready;
    const { rows } = await this.pool.query("SELECT * FROM tour_sites WHERE id=$1", [id]);
    return rows[0] ? this.rowToSite(rows[0]) : undefined;
  }

  async createSite(data: InsertTourSite): Promise<TourSite> {
    await this.ready;
    const { rows } = await this.pool.query(
      `INSERT INTO tour_sites (slug,name_en,name_al,name_gr,desc_en,desc_al,desc_gr,
        fun_fact_en,fun_fact_al,fun_fact_gr,audio_url_en,audio_url_al,audio_url_gr,
        lat,lng,region,category,difficulty,points,image_url,visit_duration)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       RETURNING *`,
      [data.slug, data.nameEn, data.nameAl||'', data.nameGr||'', data.descEn||'', data.descAl||'', data.descGr||'',
       data.funFactEn, data.funFactAl, data.funFactGr, data.audioUrlEn, data.audioUrlAl, data.audioUrlGr,
       data.lat, data.lng, data.region, data.category, data.difficulty||'easy', data.points||100, data.imageUrl, data.visitDuration||60]
    );
    return this.rowToSite(rows[0]);
  }

  async updateSite(id: number, data: Partial<InsertTourSite>): Promise<TourSite | undefined> {
    await this.ready;
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;
    const map: Record<string, string> = {
      slug: "slug", nameEn: "name_en", nameAl: "name_al", nameGr: "name_gr",
      descEn: "desc_en", descAl: "desc_al", descGr: "desc_gr",
      funFactEn: "fun_fact_en", funFactAl: "fun_fact_al", funFactGr: "fun_fact_gr",
      audioUrlEn: "audio_url_en", audioUrlAl: "audio_url_al", audioUrlGr: "audio_url_gr",
      lat: "lat", lng: "lng", region: "region", category: "category",
      difficulty: "difficulty", points: "points", imageUrl: "image_url", visitDuration: "visit_duration",
    };
    for (const [key, col] of Object.entries(map)) {
      if (key in data) { fields.push(`${col}=$${i++}`); values.push((data as any)[key]); }
    }
    if (!fields.length) return this.getSiteById(id);
    values.push(id);
    const { rows } = await this.pool.query(
      `UPDATE tour_sites SET ${fields.join(",")} WHERE id=$${i} RETURNING *`, values
    );
    return rows[0] ? this.rowToSite(rows[0]) : undefined;
  }

  async deleteSite(id: number): Promise<boolean> {
    await this.ready;
    const { rowCount } = await this.pool.query("DELETE FROM tour_sites WHERE id=$1", [id]);
    return (rowCount ?? 0) > 0;
  }

  async getProgress(sessionId: string): Promise<UserProgress[]> {
    await this.ready;
    const { rows } = await this.pool.query(
      "SELECT * FROM user_progress WHERE session_id=$1", [sessionId]
    );
    return rows.map((r: any) => ({ id: r.id, sessionId: r.session_id, siteId: r.site_id, visitedAt: r.visited_at, pointsEarned: r.points_earned }));
  }

  async addProgress(data: InsertUserProgress): Promise<UserProgress> {
    await this.ready;
    const { rows } = await this.pool.query(
      "INSERT INTO user_progress (session_id,site_id,points_earned) VALUES ($1,$2,$3) RETURNING *",
      [data.sessionId, data.siteId, data.pointsEarned]
    );
    const r = rows[0];
    return { id: r.id, sessionId: r.session_id, siteId: r.site_id, visitedAt: r.visited_at, pointsEarned: r.points_earned };
  }

  async getLeaderboard(): Promise<{ sessionId: string; totalPoints: number; visitCount: number }[]> {
    await this.ready;
    const { rows } = await this.pool.query(`
      SELECT session_id, SUM(points_earned) as total_points, COUNT(*) as visit_count
      FROM user_progress GROUP BY session_id ORDER BY total_points DESC LIMIT 10
    `);
    return rows.map((r: any) => ({ sessionId: r.session_id, totalPoints: parseInt(r.total_points), visitCount: parseInt(r.visit_count) }));
  }
}

// ─── File-based storage (local dev fallback) ──────────────────────────────────
const DATA_DIR = path.join(process.cwd(), "data");
const SITES_FILE = path.join(DATA_DIR, "sites.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadSitesFromFile(): TourSite[] {
  ensureDataDir();
  if (fs.existsSync(SITES_FILE)) {
    try { return JSON.parse(fs.readFileSync(SITES_FILE, "utf8")); } catch { /* fall through */ }
  }
  return [];
}

function saveSitesToFile(sites: TourSite[]) {
  ensureDataDir();
  fs.writeFileSync(SITES_FILE, JSON.stringify(sites, null, 2));
}

const progressMap = new Map<string, UserProgress[]>();

export class MemStorage implements IStorage {
  private sites: TourSite[];
  private nextId: number;

  constructor() {
    this.sites = loadSitesFromFile();
    // Seed with static data if empty
    if (this.sites.length === 0) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { STATIC_SITES } = require("../client/src/lib/staticData");
        this.sites = STATIC_SITES as TourSite[];
        saveSitesToFile(this.sites);
      } catch { this.sites = []; }
    }
    this.nextId = this.sites.length > 0 ? Math.max(...this.sites.map(s => s.id)) + 1 : 1;
  }

  async getAllSites() { return [...this.sites]; }
  async getSiteBySlug(slug: string) { return this.sites.find(s => s.slug === slug); }
  async getSiteById(id: number) { return this.sites.find(s => s.id === id); }

  async createSite(data: InsertTourSite): Promise<TourSite> {
    const site = { id: this.nextId++, ...data } as TourSite;
    this.sites.push(site);
    saveSitesToFile(this.sites);
    return site;
  }

  async updateSite(id: number, data: Partial<InsertTourSite>) {
    const idx = this.sites.findIndex(s => s.id === id);
    if (idx === -1) return undefined;
    this.sites[idx] = { ...this.sites[idx], ...data };
    saveSitesToFile(this.sites);
    return this.sites[idx];
  }

  async deleteSite(id: number) {
    const before = this.sites.length;
    this.sites = this.sites.filter(s => s.id !== id);
    if (this.sites.length < before) { saveSitesToFile(this.sites); return true; }
    return false;
  }

  async getProgress(sessionId: string) { return progressMap.get(sessionId) || []; }

  async addProgress(data: InsertUserProgress): Promise<UserProgress> {
    const record: UserProgress = { id: Date.now(), ...data };
    const existing = progressMap.get(data.sessionId) || [];
    progressMap.set(data.sessionId, [...existing, record]);
    return record;
  }

  async getLeaderboard() {
    const results: { sessionId: string; totalPoints: number; visitCount: number }[] = [];
    for (const [sessionId, records] of progressMap.entries()) {
      results.push({ sessionId, totalPoints: records.reduce((s, r) => s + r.pointsEarned, 0), visitCount: records.length });
    }
    return results.sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 10);
  }
}

// ─── Export the right storage based on environment ────────────────────────────
export const storage: IStorage = process.env.DATABASE_URL
  ? new PgStorage(process.env.DATABASE_URL)
  : new MemStorage();
