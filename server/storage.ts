import fs from "fs";
import path from "path";
import type {
  TourSite, UserProgress, InsertUserProgress, InsertTourSite,
  Attraction, InsertAttraction,
} from "@shared/schema";

// ─── Interface ────────────────────────────────────────────────────────────────
export interface IStorage {
  // Sites (destinations / regions)
  getAllSites(): Promise<TourSite[]>;
  getSiteBySlug(slug: string): Promise<TourSite | undefined>;
  getSiteById(id: number): Promise<TourSite | undefined>;
  createSite(data: InsertTourSite): Promise<TourSite>;
  updateSite(id: number, data: Partial<InsertTourSite>): Promise<TourSite | undefined>;
  deleteSite(id: number): Promise<boolean>;
  // Attractions
  getAllAttractions(): Promise<Attraction[]>;
  getAttractionsByDestination(destinationSlug: string): Promise<Attraction[]>;
  getAttractionBySlug(destinationSlug: string, slug: string): Promise<Attraction | undefined>;
  getAttractionById(id: number): Promise<Attraction | undefined>;
  createAttraction(data: InsertAttraction): Promise<Attraction>;
  updateAttraction(id: number, data: Partial<InsertAttraction>): Promise<Attraction | undefined>;
  deleteAttraction(id: number): Promise<boolean>;
  // Progress
  getProgress(sessionId: string): Promise<UserProgress[]>;
  addProgress(data: InsertUserProgress): Promise<UserProgress>;
  getLeaderboard(): Promise<{ sessionId: string; totalPoints: number; visitCount: number }[]>;
}

// ─── PostgreSQL storage ───────────────────────────────────────────────────────
class PgStorage implements IStorage {
  private pool: any;
  private ready: Promise<void>;

  constructor(databaseUrl: string) {
    this.ready = this._init(databaseUrl);
  }

  private async _init(databaseUrl: string) {
    const { Pool } = await import("pg");
    this.pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

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

      CREATE TABLE IF NOT EXISTS attractions (
        id SERIAL PRIMARY KEY,
        slug TEXT NOT NULL,
        destination_slug TEXT NOT NULL,
        name_en TEXT NOT NULL,
        name_al TEXT NOT NULL DEFAULT '',
        name_gr TEXT NOT NULL DEFAULT '',
        desc_en TEXT NOT NULL DEFAULT '',
        desc_al TEXT NOT NULL DEFAULT '',
        desc_gr TEXT NOT NULL DEFAULT '',
        fun_fact_en TEXT NOT NULL DEFAULT '',
        fun_fact_al TEXT NOT NULL DEFAULT '',
        fun_fact_gr TEXT NOT NULL DEFAULT '',
        audio_url_en TEXT,
        audio_url_al TEXT,
        audio_url_gr TEXT,
        category TEXT NOT NULL DEFAULT 'landmark',
        points INTEGER NOT NULL DEFAULT 50,
        lat DOUBLE PRECISION NOT NULL DEFAULT 0,
        lng DOUBLE PRECISION NOT NULL DEFAULT 0,
        image_url TEXT,
        visit_duration INTEGER NOT NULL DEFAULT 30,
        UNIQUE(destination_slug, slug)
      );

      CREATE TABLE IF NOT EXISTS user_progress (
        id SERIAL PRIMARY KEY,
        session_id TEXT NOT NULL,
        site_id INTEGER NOT NULL,
        visited_at TIMESTAMP DEFAULT NOW(),
        points_earned INTEGER NOT NULL DEFAULT 0
      );
    `);

    // Seed tour_sites if empty
    const { rows: siteRows } = await this.pool.query("SELECT COUNT(*) as c FROM tour_sites");
    if (parseInt(siteRows[0].c) === 0) {
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

    // Seed attractions if empty
    const { rows: attrRows } = await this.pool.query("SELECT COUNT(*) as c FROM attractions");
    if (parseInt(attrRows[0].c) === 0) {
      const { ATTRACTIONS } = await import("../client/src/lib/staticData.js").catch(() => ({ ATTRACTIONS: [] as any[] }));
      for (const a of ATTRACTIONS) {
        await this.pool.query(
          `INSERT INTO attractions (slug,destination_slug,name_en,name_al,name_gr,
            desc_en,desc_al,desc_gr,fun_fact_en,fun_fact_al,fun_fact_gr,
            audio_url_en,audio_url_al,audio_url_gr,
            category,points,lat,lng,image_url,visit_duration)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
           ON CONFLICT (destination_slug, slug) DO NOTHING`,
          [a.slug, a.destinationSlug, a.nameEn, a.nameAl||'', a.nameGr||'',
           a.descEn||'', a.descAl||'', a.descGr||'',
           a.funFactEn||'', a.funFactAl||'', a.funFactGr||'',
           a.audioUrlEn||null, a.audioUrlAl||null, a.audioUrlGr||null,
           a.category||'landmark', a.points||50, a.lat||0, a.lng||0, a.imageUrl||null, a.visitDuration||30]
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

  private rowToAttraction(r: any): Attraction {
    return {
      id: r.id, slug: r.slug, destinationSlug: r.destination_slug,
      nameEn: r.name_en, nameAl: r.name_al, nameGr: r.name_gr,
      descEn: r.desc_en, descAl: r.desc_al, descGr: r.desc_gr,
      funFactEn: r.fun_fact_en||'', funFactAl: r.fun_fact_al||'', funFactGr: r.fun_fact_gr||'',
      audioUrlEn: r.audio_url_en, audioUrlAl: r.audio_url_al, audioUrlGr: r.audio_url_gr,
      category: r.category, points: r.points,
      lat: parseFloat(r.lat), lng: parseFloat(r.lng),
      imageUrl: r.image_url, visitDuration: r.visit_duration,
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

  // ── Attractions ──────────────────────────────────────────────────────────────

  async getAllAttractions(): Promise<Attraction[]> {
    await this.ready;
    const { rows } = await this.pool.query("SELECT * FROM attractions ORDER BY id");
    return rows.map(this.rowToAttraction.bind(this));
  }

  async getAttractionsByDestination(destinationSlug: string): Promise<Attraction[]> {
    await this.ready;
    const { rows } = await this.pool.query("SELECT * FROM attractions WHERE destination_slug=$1 ORDER BY id", [destinationSlug]);
    return rows.map(this.rowToAttraction.bind(this));
  }

  async getAttractionBySlug(destinationSlug: string, slug: string): Promise<Attraction | undefined> {
    await this.ready;
    const { rows } = await this.pool.query("SELECT * FROM attractions WHERE destination_slug=$1 AND slug=$2", [destinationSlug, slug]);
    return rows[0] ? this.rowToAttraction(rows[0]) : undefined;
  }

  async getAttractionById(id: number): Promise<Attraction | undefined> {
    await this.ready;
    const { rows } = await this.pool.query("SELECT * FROM attractions WHERE id=$1", [id]);
    return rows[0] ? this.rowToAttraction(rows[0]) : undefined;
  }

  async createAttraction(data: InsertAttraction): Promise<Attraction> {
    await this.ready;
    const { rows } = await this.pool.query(
      `INSERT INTO attractions (slug,destination_slug,name_en,name_al,name_gr,
        desc_en,desc_al,desc_gr,fun_fact_en,fun_fact_al,fun_fact_gr,
        audio_url_en,audio_url_al,audio_url_gr,
        category,points,lat,lng,image_url,visit_duration)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       RETURNING *`,
      [data.slug, data.destinationSlug, data.nameEn, data.nameAl||'', data.nameGr||'',
       data.descEn||'', data.descAl||'', data.descGr||'',
       data.funFactEn||'', data.funFactAl||'', data.funFactGr||'',
       data.audioUrlEn||null, data.audioUrlAl||null, data.audioUrlGr||null,
       data.category||'landmark', data.points||50, data.lat||0, data.lng||0,
       data.imageUrl||null, data.visitDuration||30]
    );
    return this.rowToAttraction(rows[0]);
  }

  async updateAttraction(id: number, data: Partial<InsertAttraction>): Promise<Attraction | undefined> {
    await this.ready;
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;
    const map: Record<string, string> = {
      slug: "slug", destinationSlug: "destination_slug",
      nameEn: "name_en", nameAl: "name_al", nameGr: "name_gr",
      descEn: "desc_en", descAl: "desc_al", descGr: "desc_gr",
      funFactEn: "fun_fact_en", funFactAl: "fun_fact_al", funFactGr: "fun_fact_gr",
      audioUrlEn: "audio_url_en", audioUrlAl: "audio_url_al", audioUrlGr: "audio_url_gr",
      category: "category", points: "points",
      lat: "lat", lng: "lng", imageUrl: "image_url", visitDuration: "visit_duration",
    };
    for (const [key, col] of Object.entries(map)) {
      if (key in data) { fields.push(`${col}=$${i++}`); values.push((data as any)[key]); }
    }
    if (!fields.length) return this.getAttractionById(id);
    values.push(id);
    const { rows } = await this.pool.query(
      `UPDATE attractions SET ${fields.join(",")} WHERE id=$${i} RETURNING *`, values
    );
    return rows[0] ? this.rowToAttraction(rows[0]) : undefined;
  }

  async deleteAttraction(id: number): Promise<boolean> {
    await this.ready;
    const { rowCount } = await this.pool.query("DELETE FROM attractions WHERE id=$1", [id]);
    return (rowCount ?? 0) > 0;
  }

  // ── Progress ─────────────────────────────────────────────────────────────────

  async getProgress(sessionId: string): Promise<UserProgress[]> {
    await this.ready;
    const { rows } = await this.pool.query("SELECT * FROM user_progress WHERE session_id=$1", [sessionId]);
    return rows.map((r: any) => ({ id: r.id, sessionId: r.session_id, siteId: r.site_id, visitedAt: r.visited_at, pointsEarned: r.points_earned, audioCompleted: r.audio_completed ?? false }));
  }

  async addProgress(data: InsertUserProgress): Promise<UserProgress> {
    await this.ready;
    const { rows } = await this.pool.query(
      "INSERT INTO user_progress (session_id,site_id,points_earned) VALUES ($1,$2,$3) RETURNING *",
      [data.sessionId, data.siteId, data.pointsEarned]
    );
    const r = rows[0];
    return { id: r.id, sessionId: r.session_id, siteId: r.site_id, visitedAt: r.visited_at, pointsEarned: r.points_earned, audioCompleted: r.audio_completed ?? false };
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

// ─── File-based / memory storage (local dev fallback) ─────────────────────────
const DATA_DIR = path.join(process.cwd(), "data");
const SITES_FILE = path.join(DATA_DIR, "sites.json");
const ATTRS_FILE = path.join(DATA_DIR, "attractions.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

const progressMap = new Map<string, UserProgress[]>();

export class MemStorage implements IStorage {
  private sites: TourSite[];
  private attrs: Attraction[];
  private nextSiteId: number;
  private nextAttrId: number;

  constructor() {
    ensureDataDir();
    // Sites
    this.sites = fs.existsSync(SITES_FILE) ? JSON.parse(fs.readFileSync(SITES_FILE, "utf8")) : [];
    if (this.sites.length === 0) {
      try {
        const { STATIC_SITES } = require("../client/src/lib/staticData");
        this.sites = STATIC_SITES as TourSite[];
        fs.writeFileSync(SITES_FILE, JSON.stringify(this.sites, null, 2));
      } catch { this.sites = []; }
    }
    this.nextSiteId = this.sites.length > 0 ? Math.max(...this.sites.map(s => s.id)) + 1 : 1;

    // Attractions
    this.attrs = fs.existsSync(ATTRS_FILE) ? JSON.parse(fs.readFileSync(ATTRS_FILE, "utf8")) : [];
    if (this.attrs.length === 0) {
      try {
        const { ATTRACTIONS } = require("../client/src/lib/staticData");
        this.attrs = ATTRACTIONS as Attraction[];
        fs.writeFileSync(ATTRS_FILE, JSON.stringify(this.attrs, null, 2));
      } catch { this.attrs = []; }
    }
    this.nextAttrId = this.attrs.length > 0 ? Math.max(...this.attrs.map(a => a.id)) + 1 : 1;
  }

  private saveSites() { ensureDataDir(); fs.writeFileSync(SITES_FILE, JSON.stringify(this.sites, null, 2)); }
  private saveAttrs() { ensureDataDir(); fs.writeFileSync(ATTRS_FILE, JSON.stringify(this.attrs, null, 2)); }

  async getAllSites() { return [...this.sites]; }
  async getSiteBySlug(slug: string) { return this.sites.find(s => s.slug === slug); }
  async getSiteById(id: number) { return this.sites.find(s => s.id === id); }

  async createSite(data: InsertTourSite): Promise<TourSite> {
    const site = { id: this.nextSiteId++, ...data } as TourSite;
    this.sites.push(site); this.saveSites(); return site;
  }

  async updateSite(id: number, data: Partial<InsertTourSite>) {
    const idx = this.sites.findIndex(s => s.id === id);
    if (idx === -1) return undefined;
    this.sites[idx] = { ...this.sites[idx], ...data };
    this.saveSites(); return this.sites[idx];
  }

  async deleteSite(id: number) {
    const before = this.sites.length;
    this.sites = this.sites.filter(s => s.id !== id);
    if (this.sites.length < before) { this.saveSites(); return true; }
    return false;
  }

  async getAllAttractions() { return [...this.attrs]; }
  async getAttractionsByDestination(destinationSlug: string) { return this.attrs.filter(a => a.destinationSlug === destinationSlug); }
  async getAttractionBySlug(destinationSlug: string, slug: string) { return this.attrs.find(a => a.destinationSlug === destinationSlug && a.slug === slug); }
  async getAttractionById(id: number) { return this.attrs.find(a => a.id === id); }

  async createAttraction(data: InsertAttraction): Promise<Attraction> {
    const attr = { id: this.nextAttrId++, ...data } as Attraction;
    this.attrs.push(attr); this.saveAttrs(); return attr;
  }

  async updateAttraction(id: number, data: Partial<InsertAttraction>) {
    const idx = this.attrs.findIndex(a => a.id === id);
    if (idx === -1) return undefined;
    this.attrs[idx] = { ...this.attrs[idx], ...data };
    this.saveAttrs(); return this.attrs[idx];
  }

  async deleteAttraction(id: number) {
    const before = this.attrs.length;
    this.attrs = this.attrs.filter(a => a.id !== id);
    if (this.attrs.length < before) { this.saveAttrs(); return true; }
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

// ─── Export ───────────────────────────────────────────────────────────────────
export const storage: IStorage = process.env.DATABASE_URL
  ? new PgStorage(process.env.DATABASE_URL)
  : new MemStorage();
