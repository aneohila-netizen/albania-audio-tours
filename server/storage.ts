import fs from "fs";
import path from "path";
import type {
  TourSite, UserProgress, InsertUserProgress, InsertTourSite,
  Attraction, InsertAttraction,
  Itinerary, InsertItinerary,
  Rating, InsertRating,
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
  // Ratings
  saveRating(siteId: number, siteSlug: string, stars: number): Promise<Rating>;
  getRatingStats(siteSlug: string): Promise<{ average: number; count: number }>;
  // Itineraries
  getItinerariesBySite(siteSlug: string): Promise<Itinerary[]>;
  getItineraryById(id: number): Promise<Itinerary | undefined>;
  createItinerary(data: InsertItinerary): Promise<Itinerary>;
  updateItinerary(id: number, data: Partial<InsertItinerary>): Promise<Itinerary | undefined>;
  deleteItinerary(id: number): Promise<boolean>;
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
        name_it TEXT DEFAULT '',
        name_es TEXT DEFAULT '',
        name_de TEXT DEFAULT '',
        name_fr TEXT DEFAULT '',
        name_ar TEXT DEFAULT '',
        name_sl TEXT DEFAULT '',
        desc_en TEXT NOT NULL DEFAULT '',
        desc_al TEXT NOT NULL DEFAULT '',
        desc_gr TEXT NOT NULL DEFAULT '',
        desc_it TEXT DEFAULT '',
        desc_es TEXT DEFAULT '',
        desc_de TEXT DEFAULT '',
        desc_fr TEXT DEFAULT '',
        desc_ar TEXT DEFAULT '',
        desc_sl TEXT DEFAULT '',
        fun_fact_en TEXT,
        fun_fact_al TEXT,
        fun_fact_gr TEXT,
        fun_fact_it TEXT,
        fun_fact_es TEXT,
        fun_fact_de TEXT,
        fun_fact_fr TEXT,
        fun_fact_ar TEXT,
        fun_fact_sl TEXT,
        audio_url_en TEXT,
        audio_url_al TEXT,
        audio_url_gr TEXT,
        audio_url_it TEXT,
        audio_url_es TEXT,
        audio_url_de TEXT,
        audio_url_fr TEXT,
        audio_url_ar TEXT,
        audio_url_sl TEXT,
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
        name_it TEXT DEFAULT '',
        name_es TEXT DEFAULT '',
        name_de TEXT DEFAULT '',
        name_fr TEXT DEFAULT '',
        name_ar TEXT DEFAULT '',
        name_sl TEXT DEFAULT '',
        desc_en TEXT NOT NULL DEFAULT '',
        desc_al TEXT NOT NULL DEFAULT '',
        desc_gr TEXT NOT NULL DEFAULT '',
        desc_it TEXT DEFAULT '',
        desc_es TEXT DEFAULT '',
        desc_de TEXT DEFAULT '',
        desc_fr TEXT DEFAULT '',
        desc_ar TEXT DEFAULT '',
        desc_sl TEXT DEFAULT '',
        fun_fact_en TEXT NOT NULL DEFAULT '',
        fun_fact_al TEXT NOT NULL DEFAULT '',
        fun_fact_gr TEXT NOT NULL DEFAULT '',
        fun_fact_it TEXT DEFAULT '',
        fun_fact_es TEXT DEFAULT '',
        fun_fact_de TEXT DEFAULT '',
        fun_fact_fr TEXT DEFAULT '',
        fun_fact_ar TEXT DEFAULT '',
        fun_fact_sl TEXT DEFAULT '',
        audio_url_en TEXT,
        audio_url_al TEXT,
        audio_url_gr TEXT,
        audio_url_it TEXT,
        audio_url_es TEXT,
        audio_url_de TEXT,
        audio_url_fr TEXT,
        audio_url_ar TEXT,
        audio_url_sl TEXT,
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

      CREATE TABLE IF NOT EXISTS ratings (
        id SERIAL PRIMARY KEY,
        site_id INTEGER NOT NULL,
        site_slug TEXT NOT NULL,
        stars INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS itineraries (
        id SERIAL PRIMARY KEY,
        site_slug TEXT NOT NULL,
        entity_type TEXT NOT NULL DEFAULT 'site',
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        instructions TEXT NOT NULL DEFAULT '',
        duration_minutes INTEGER NOT NULL DEFAULT 60,
        distance_km REAL DEFAULT 0,
        difficulty TEXT NOT NULL DEFAULT 'easy',
        waypoints TEXT NOT NULL DEFAULT '[]',
        is_published BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TEXT NOT NULL DEFAULT 'now'
      );
    `);

    // ─── Migrate: add new language columns if they don't exist yet ────────────
    const newLangCols = [
      // tour_sites
      "ALTER TABLE tour_sites ADD COLUMN IF NOT EXISTS name_it TEXT DEFAULT ''",
      "ALTER TABLE tour_sites ADD COLUMN IF NOT EXISTS name_es TEXT DEFAULT ''",
      "ALTER TABLE tour_sites ADD COLUMN IF NOT EXISTS name_de TEXT DEFAULT ''",
      "ALTER TABLE tour_sites ADD COLUMN IF NOT EXISTS name_fr TEXT DEFAULT ''",
      "ALTER TABLE tour_sites ADD COLUMN IF NOT EXISTS name_ar TEXT DEFAULT ''",
      "ALTER TABLE tour_sites ADD COLUMN IF NOT EXISTS name_sl TEXT DEFAULT ''",
      "ALTER TABLE tour_sites ADD COLUMN IF NOT EXISTS desc_it TEXT DEFAULT ''",
      "ALTER TABLE tour_sites ADD COLUMN IF NOT EXISTS desc_es TEXT DEFAULT ''",
      "ALTER TABLE tour_sites ADD COLUMN IF NOT EXISTS desc_de TEXT DEFAULT ''",
      "ALTER TABLE tour_sites ADD COLUMN IF NOT EXISTS desc_fr TEXT DEFAULT ''",
      "ALTER TABLE tour_sites ADD COLUMN IF NOT EXISTS desc_ar TEXT DEFAULT ''",
      "ALTER TABLE tour_sites ADD COLUMN IF NOT EXISTS desc_sl TEXT DEFAULT ''",
      "ALTER TABLE tour_sites ADD COLUMN IF NOT EXISTS fun_fact_it TEXT",
      "ALTER TABLE tour_sites ADD COLUMN IF NOT EXISTS fun_fact_es TEXT",
      "ALTER TABLE tour_sites ADD COLUMN IF NOT EXISTS fun_fact_de TEXT",
      "ALTER TABLE tour_sites ADD COLUMN IF NOT EXISTS fun_fact_fr TEXT",
      "ALTER TABLE tour_sites ADD COLUMN IF NOT EXISTS fun_fact_ar TEXT",
      "ALTER TABLE tour_sites ADD COLUMN IF NOT EXISTS fun_fact_sl TEXT",
      "ALTER TABLE tour_sites ADD COLUMN IF NOT EXISTS audio_url_it TEXT",
      "ALTER TABLE tour_sites ADD COLUMN IF NOT EXISTS audio_url_es TEXT",
      "ALTER TABLE tour_sites ADD COLUMN IF NOT EXISTS audio_url_de TEXT",
      "ALTER TABLE tour_sites ADD COLUMN IF NOT EXISTS audio_url_fr TEXT",
      "ALTER TABLE tour_sites ADD COLUMN IF NOT EXISTS audio_url_ar TEXT",
      "ALTER TABLE tour_sites ADD COLUMN IF NOT EXISTS audio_url_sl TEXT",
      // attractions
      "ALTER TABLE attractions ADD COLUMN IF NOT EXISTS name_it TEXT DEFAULT ''",
      "ALTER TABLE attractions ADD COLUMN IF NOT EXISTS name_es TEXT DEFAULT ''",
      "ALTER TABLE attractions ADD COLUMN IF NOT EXISTS name_de TEXT DEFAULT ''",
      "ALTER TABLE attractions ADD COLUMN IF NOT EXISTS name_fr TEXT DEFAULT ''",
      "ALTER TABLE attractions ADD COLUMN IF NOT EXISTS name_ar TEXT DEFAULT ''",
      "ALTER TABLE attractions ADD COLUMN IF NOT EXISTS name_sl TEXT DEFAULT ''",
      "ALTER TABLE attractions ADD COLUMN IF NOT EXISTS desc_it TEXT DEFAULT ''",
      "ALTER TABLE attractions ADD COLUMN IF NOT EXISTS desc_es TEXT DEFAULT ''",
      "ALTER TABLE attractions ADD COLUMN IF NOT EXISTS desc_de TEXT DEFAULT ''",
      "ALTER TABLE attractions ADD COLUMN IF NOT EXISTS desc_fr TEXT DEFAULT ''",
      "ALTER TABLE attractions ADD COLUMN IF NOT EXISTS desc_ar TEXT DEFAULT ''",
      "ALTER TABLE attractions ADD COLUMN IF NOT EXISTS desc_sl TEXT DEFAULT ''",
      "ALTER TABLE attractions ADD COLUMN IF NOT EXISTS fun_fact_it TEXT DEFAULT ''",
      "ALTER TABLE attractions ADD COLUMN IF NOT EXISTS fun_fact_es TEXT DEFAULT ''",
      "ALTER TABLE attractions ADD COLUMN IF NOT EXISTS fun_fact_de TEXT DEFAULT ''",
      "ALTER TABLE attractions ADD COLUMN IF NOT EXISTS fun_fact_fr TEXT DEFAULT ''",
      "ALTER TABLE attractions ADD COLUMN IF NOT EXISTS fun_fact_ar TEXT DEFAULT ''",
      "ALTER TABLE attractions ADD COLUMN IF NOT EXISTS fun_fact_sl TEXT DEFAULT ''",
      "ALTER TABLE attractions ADD COLUMN IF NOT EXISTS audio_url_it TEXT",
      "ALTER TABLE attractions ADD COLUMN IF NOT EXISTS audio_url_es TEXT",
      "ALTER TABLE attractions ADD COLUMN IF NOT EXISTS audio_url_de TEXT",
      "ALTER TABLE attractions ADD COLUMN IF NOT EXISTS audio_url_fr TEXT",
      "ALTER TABLE attractions ADD COLUMN IF NOT EXISTS audio_url_ar TEXT",
      "ALTER TABLE attractions ADD COLUMN IF NOT EXISTS audio_url_sl TEXT",
    ];
    for (const sql of newLangCols) {
      await this.pool.query(sql).catch(() => {}); // ignore if already exists
    }

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
      nameIt: r.name_it||'', nameEs: r.name_es||'', nameDe: r.name_de||'',
      nameFr: r.name_fr||'', nameAr: r.name_ar||'', nameSl: r.name_sl||'',
      descEn: r.desc_en, descAl: r.desc_al, descGr: r.desc_gr,
      descIt: r.desc_it||'', descEs: r.desc_es||'', descDe: r.desc_de||'',
      descFr: r.desc_fr||'', descAr: r.desc_ar||'', descSl: r.desc_sl||'',
      funFactEn: r.fun_fact_en, funFactAl: r.fun_fact_al, funFactGr: r.fun_fact_gr,
      funFactIt: r.fun_fact_it||null, funFactEs: r.fun_fact_es||null, funFactDe: r.fun_fact_de||null,
      funFactFr: r.fun_fact_fr||null, funFactAr: r.fun_fact_ar||null, funFactSl: r.fun_fact_sl||null,
      audioUrlEn: r.audio_url_en, audioUrlAl: r.audio_url_al, audioUrlGr: r.audio_url_gr,
      audioUrlIt: r.audio_url_it||null, audioUrlEs: r.audio_url_es||null, audioUrlDe: r.audio_url_de||null,
      audioUrlFr: r.audio_url_fr||null, audioUrlAr: r.audio_url_ar||null, audioUrlSl: r.audio_url_sl||null,
      lat: parseFloat(r.lat), lng: parseFloat(r.lng),
      region: r.region, category: r.category, difficulty: r.difficulty,
      points: r.points, imageUrl: r.image_url, visitDuration: r.visit_duration,
    } as any;
  }

  private rowToAttraction(r: any): Attraction {
    return {
      id: r.id, slug: r.slug, destinationSlug: r.destination_slug,
      nameEn: r.name_en, nameAl: r.name_al, nameGr: r.name_gr,
      nameIt: r.name_it||'', nameEs: r.name_es||'', nameDe: r.name_de||'',
      nameFr: r.name_fr||'', nameAr: r.name_ar||'', nameSl: r.name_sl||'',
      descEn: r.desc_en, descAl: r.desc_al, descGr: r.desc_gr,
      descIt: r.desc_it||'', descEs: r.desc_es||'', descDe: r.desc_de||'',
      descFr: r.desc_fr||'', descAr: r.desc_ar||'', descSl: r.desc_sl||'',
      funFactEn: r.fun_fact_en||'', funFactAl: r.fun_fact_al||'', funFactGr: r.fun_fact_gr||'',
      funFactIt: r.fun_fact_it||null, funFactEs: r.fun_fact_es||null, funFactDe: r.fun_fact_de||null,
      funFactFr: r.fun_fact_fr||null, funFactAr: r.fun_fact_ar||null, funFactSl: r.fun_fact_sl||null,
      audioUrlEn: r.audio_url_en, audioUrlAl: r.audio_url_al, audioUrlGr: r.audio_url_gr,
      audioUrlIt: r.audio_url_it||null, audioUrlEs: r.audio_url_es||null, audioUrlDe: r.audio_url_de||null,
      audioUrlFr: r.audio_url_fr||null, audioUrlAr: r.audio_url_ar||null, audioUrlSl: r.audio_url_sl||null,
      category: r.category, points: r.points,
      lat: parseFloat(r.lat), lng: parseFloat(r.lng),
      imageUrl: r.image_url, visitDuration: r.visit_duration,
    } as any;
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
      nameIt: "name_it", nameEs: "name_es", nameDe: "name_de", nameFr: "name_fr", nameAr: "name_ar", nameSl: "name_sl",
      descEn: "desc_en", descAl: "desc_al", descGr: "desc_gr",
      descIt: "desc_it", descEs: "desc_es", descDe: "desc_de", descFr: "desc_fr", descAr: "desc_ar", descSl: "desc_sl",
      funFactEn: "fun_fact_en", funFactAl: "fun_fact_al", funFactGr: "fun_fact_gr",
      funFactIt: "fun_fact_it", funFactEs: "fun_fact_es", funFactDe: "fun_fact_de",
      funFactFr: "fun_fact_fr", funFactAr: "fun_fact_ar", funFactSl: "fun_fact_sl",
      audioUrlEn: "audio_url_en", audioUrlAl: "audio_url_al", audioUrlGr: "audio_url_gr",
      audioUrlIt: "audio_url_it", audioUrlEs: "audio_url_es", audioUrlDe: "audio_url_de",
      audioUrlFr: "audio_url_fr", audioUrlAr: "audio_url_ar", audioUrlSl: "audio_url_sl",
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
      nameIt: "name_it", nameEs: "name_es", nameDe: "name_de", nameFr: "name_fr", nameAr: "name_ar", nameSl: "name_sl",
      descEn: "desc_en", descAl: "desc_al", descGr: "desc_gr",
      descIt: "desc_it", descEs: "desc_es", descDe: "desc_de", descFr: "desc_fr", descAr: "desc_ar", descSl: "desc_sl",
      funFactEn: "fun_fact_en", funFactAl: "fun_fact_al", funFactGr: "fun_fact_gr",
      funFactIt: "fun_fact_it", funFactEs: "fun_fact_es", funFactDe: "fun_fact_de",
      funFactFr: "fun_fact_fr", funFactAr: "fun_fact_ar", funFactSl: "fun_fact_sl",
      audioUrlEn: "audio_url_en", audioUrlAl: "audio_url_al", audioUrlGr: "audio_url_gr",
      audioUrlIt: "audio_url_it", audioUrlEs: "audio_url_es", audioUrlDe: "audio_url_de",
      audioUrlFr: "audio_url_fr", audioUrlAr: "audio_url_ar", audioUrlSl: "audio_url_sl",
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

  // ── Itineraries ────────────────────────────────────────────────────
  private rowToItinerary(r: any): Itinerary {
    return {
      id: r.id,
      siteSlug: r.site_slug,
      entityType: r.entity_type || 'site',
      name: r.name,
      description: r.description || '',
      instructions: r.instructions || '',
      durationMinutes: r.duration_minutes || 60,
      distanceKm: r.distance_km ? parseFloat(r.distance_km) : 0,
      difficulty: r.difficulty || 'easy',
      waypoints: r.waypoints || '[]',
      isPublished: r.is_published ?? true,
      createdAt: r.created_at || 'now',
    };
  }

  async getItinerariesBySite(siteSlug: string): Promise<Itinerary[]> {
    await this.ready;
    const { rows } = await this.pool.query(
      'SELECT * FROM itineraries WHERE site_slug = $1 ORDER BY id',
      [siteSlug]
    );
    return rows.map(this.rowToItinerary);
  }

  async getItineraryById(id: number): Promise<Itinerary | undefined> {
    await this.ready;
    const { rows } = await this.pool.query('SELECT * FROM itineraries WHERE id = $1', [id]);
    return rows[0] ? this.rowToItinerary(rows[0]) : undefined;
  }

  async createItinerary(data: InsertItinerary): Promise<Itinerary> {
    await this.ready;
    const { rows } = await this.pool.query(
      `INSERT INTO itineraries (site_slug, entity_type, name, description, instructions,
        duration_minutes, distance_km, difficulty, waypoints, is_published, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        data.siteSlug, data.entityType || 'site', data.name,
        data.description || '', data.instructions || '',
        data.durationMinutes || 60, data.distanceKm || 0,
        data.difficulty || 'easy', data.waypoints || '[]',
        data.isPublished ?? true,
        new Date().toISOString(),
      ]
    );
    return this.rowToItinerary(rows[0]);
  }

  async updateItinerary(id: number, data: Partial<InsertItinerary>): Promise<Itinerary | undefined> {
    await this.ready;
    const fields: string[] = [];
    const vals: any[] = [];
    let i = 1;
    if (data.name !== undefined) { fields.push(`name=$${i++}`); vals.push(data.name); }
    if (data.description !== undefined) { fields.push(`description=$${i++}`); vals.push(data.description); }
    if (data.instructions !== undefined) { fields.push(`instructions=$${i++}`); vals.push(data.instructions); }
    if (data.durationMinutes !== undefined) { fields.push(`duration_minutes=$${i++}`); vals.push(data.durationMinutes); }
    if (data.distanceKm !== undefined) { fields.push(`distance_km=$${i++}`); vals.push(data.distanceKm); }
    if (data.difficulty !== undefined) { fields.push(`difficulty=$${i++}`); vals.push(data.difficulty); }
    if (data.waypoints !== undefined) { fields.push(`waypoints=$${i++}`); vals.push(data.waypoints); }
    if (data.isPublished !== undefined) { fields.push(`is_published=$${i++}`); vals.push(data.isPublished); }
    if (!fields.length) return this.getItineraryById(id);
    vals.push(id);
    const { rows } = await this.pool.query(
      `UPDATE itineraries SET ${fields.join(',')} WHERE id=$${i} RETURNING *`, vals
    );
    return rows[0] ? this.rowToItinerary(rows[0]) : undefined;
  }

  async deleteItinerary(id: number): Promise<boolean> {
    await this.ready;
    const { rowCount } = await this.pool.query('DELETE FROM itineraries WHERE id=$1', [id]);
    return (rowCount ?? 0) > 0;
  }

  // ── Ratings ─────────────────────────────────────────
  async saveRating(siteId: number, siteSlug: string, stars: number): Promise<Rating> {
    await this.ready;
    const { rows } = await this.pool.query(
      'INSERT INTO ratings (site_id, site_slug, stars, created_at) VALUES ($1,$2,$3,$4) RETURNING *',
      [siteId, siteSlug, stars, new Date().toISOString()]
    );
    const r = rows[0];
    return { id: r.id, siteId: r.site_id, siteSlug: r.site_slug, stars: r.stars, createdAt: r.created_at };
  }

  async getRatingStats(siteSlug: string): Promise<{ average: number; count: number }> {
    await this.ready;
    const { rows } = await this.pool.query(
      'SELECT COUNT(*)::int as count, ROUND(AVG(stars)::numeric, 1)::float as average FROM ratings WHERE site_slug=$1',
      [siteSlug]
    );
    const { count, average } = rows[0];
    return { count: count || 0, average: average || 0 };
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

  // MemStorage itineraries (in-memory only, resets on restart)
  private itineraries: Itinerary[] = [];
  async getItinerariesBySite(siteSlug: string) { return this.itineraries.filter(i => i.siteSlug === siteSlug); }
  async getItineraryById(id: number) { return this.itineraries.find(i => i.id === id); }
  async createItinerary(data: InsertItinerary): Promise<Itinerary> {
    const item: Itinerary = { id: Date.now(), siteSlug: data.siteSlug, entityType: data.entityType || 'site', name: data.name, description: data.description || '', instructions: data.instructions || '', durationMinutes: data.durationMinutes || 60, distanceKm: data.distanceKm ?? 0, difficulty: data.difficulty || 'easy', waypoints: data.waypoints || '[]', isPublished: data.isPublished ?? true, createdAt: new Date().toISOString() };
    this.itineraries.push(item);
    return item;
  }
  async updateItinerary(id: number, data: Partial<InsertItinerary>): Promise<Itinerary | undefined> {
    const idx = this.itineraries.findIndex(i => i.id === id);
    if (idx === -1) return undefined;
    this.itineraries[idx] = { ...this.itineraries[idx], ...data } as Itinerary;
    return this.itineraries[idx];
  }
  async deleteItinerary(id: number): Promise<boolean> {
    const before = this.itineraries.length;
    this.itineraries = this.itineraries.filter(i => i.id !== id);
    return this.itineraries.length < before;
  }

  // MemStorage ratings (in-memory)
  private ratingsList: Rating[] = [];
  async saveRating(siteId: number, siteSlug: string, stars: number): Promise<Rating> {
    const item: Rating = { id: Date.now(), siteId, siteSlug, stars, createdAt: new Date().toISOString() };
    this.ratingsList.push(item);
    return item;
  }
  async getRatingStats(siteSlug: string): Promise<{ average: number; count: number }> {
    const list = this.ratingsList.filter(r => r.siteSlug === siteSlug);
    if (!list.length) return { average: 0, count: 0 };
    const avg = Math.round((list.reduce((s, r) => s + r.stars, 0) / list.length) * 10) / 10;
    return { average: avg, count: list.length };
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────
export const storage: IStorage = process.env.DATABASE_URL
  ? new PgStorage(process.env.DATABASE_URL)
  : new MemStorage();
