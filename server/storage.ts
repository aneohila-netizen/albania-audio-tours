import fs from "fs";
import path from "path";
import type {
  TourSite, UserProgress, InsertUserProgress, InsertTourSite,
  Attraction, InsertAttraction,
  Itinerary, InsertItinerary,
  Rating, InsertRating,
  CmsPage, InsertCmsPage,
  AppSetting,
  SubscriptionPlan, InsertSubscriptionPlan,
  SubscriptionLead, InsertLead,
  UserSubscription, InsertUserSubscription,
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
  getAllPublishedItineraries(): Promise<Itinerary[]>;
  getItinerariesBySite(siteSlug: string): Promise<Itinerary[]>;
  getItineraryById(id: number): Promise<Itinerary | undefined>;
  createItinerary(data: InsertItinerary): Promise<Itinerary>;
  updateItinerary(id: number, data: Partial<InsertItinerary>): Promise<Itinerary | undefined>;
  deleteItinerary(id: number): Promise<boolean>;
  // Progress
  getProgress(sessionId: string): Promise<UserProgress[]>;
  addProgress(data: InsertUserProgress): Promise<UserProgress>;
  getLeaderboard(): Promise<{ sessionId: string; totalPoints: number; visitCount: number }[]>;
  // Subscription Plans
  getAllPlans(): Promise<SubscriptionPlan[]>;
  getActivePlans(): Promise<SubscriptionPlan[]>;
  getPlanBySlug(slug: string): Promise<SubscriptionPlan | undefined>;
  createPlan(data: InsertSubscriptionPlan): Promise<SubscriptionPlan>;
  updatePlan(id: number, data: Partial<InsertSubscriptionPlan>): Promise<SubscriptionPlan | undefined>;
  deletePlan(id: number): Promise<boolean>;
  // Leads
  getAllLeads(): Promise<SubscriptionLead[]>;
  createLead(data: InsertLead): Promise<SubscriptionLead>;
  // User Subscriptions
  createSubscription(data: InsertUserSubscription): Promise<UserSubscription>;
  getSubscriptionByOrderId(orderId: string): Promise<UserSubscription | undefined>;
  getSubscriptionByToken(token: string): Promise<UserSubscription | undefined>;
  getSubscriptionByCode(code: string): Promise<UserSubscription | undefined>;
  getActiveSubscriptionByEmail(email: string): Promise<UserSubscription | undefined>;
  getAllSubscriptions(): Promise<UserSubscription[]>;
  updateSubscription(id: number, data: Partial<InsertUserSubscription>): Promise<UserSubscription | undefined>;
  revokeSubscription(id: number): Promise<boolean>;
  // App Settings
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<AppSetting>;
  getAllSettings(): Promise<AppSetting[]>;
  // CMS Pages
  getAllCmsPages(): Promise<CmsPage[]>;
  getCmsPageBySlug(slug: string): Promise<CmsPage | undefined>;
  getCmsPageById(id: number): Promise<CmsPage | undefined>;
  getPublishedCmsPages(type?: string): Promise<CmsPage[]>;
  createCmsPage(data: InsertCmsPage): Promise<CmsPage>;
  updateCmsPage(id: number, data: Partial<InsertCmsPage>): Promise<CmsPage | undefined>;
  deleteCmsPage(id: number): Promise<boolean>;
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
        name_pt TEXT DEFAULT '',
        name_cn TEXT DEFAULT '',
        desc_en TEXT NOT NULL DEFAULT '',
        desc_al TEXT NOT NULL DEFAULT '',
        desc_gr TEXT NOT NULL DEFAULT '',
        desc_it TEXT DEFAULT '',
        desc_es TEXT DEFAULT '',
        desc_de TEXT DEFAULT '',
        desc_fr TEXT DEFAULT '',
        desc_ar TEXT DEFAULT '',
        desc_sl TEXT DEFAULT '',
        desc_pt TEXT DEFAULT '',
        desc_cn TEXT DEFAULT '',
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
        visit_duration INTEGER NOT NULL DEFAULT 60,
        is_locked BOOLEAN NOT NULL DEFAULT FALSE,
        shopify_url TEXT
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
        name_pt TEXT DEFAULT '',
        name_cn TEXT DEFAULT '',
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
        fun_fact_pt TEXT DEFAULT '',
        fun_fact_cn TEXT DEFAULT '',
        audio_url_en TEXT,
        audio_url_al TEXT,
        audio_url_gr TEXT,
        audio_url_it TEXT,
        audio_url_es TEXT,
        audio_url_de TEXT,
        audio_url_fr TEXT,
        audio_url_ar TEXT,
        audio_url_sl TEXT,
        audio_url_pt TEXT,
        audio_url_cn TEXT,
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
      "ALTER TABLE tour_sites ADD COLUMN IF NOT EXISTS name_pt TEXT DEFAULT ''",
      "ALTER TABLE tour_sites ADD COLUMN IF NOT EXISTS name_cn TEXT DEFAULT ''",
      "ALTER TABLE tour_sites ADD COLUMN IF NOT EXISTS desc_pt TEXT DEFAULT ''",
      "ALTER TABLE tour_sites ADD COLUMN IF NOT EXISTS desc_cn TEXT DEFAULT ''",
      "ALTER TABLE tour_sites ADD COLUMN IF NOT EXISTS fun_fact_pt TEXT",
      "ALTER TABLE tour_sites ADD COLUMN IF NOT EXISTS fun_fact_cn TEXT",
      "ALTER TABLE tour_sites ADD COLUMN IF NOT EXISTS audio_url_pt TEXT",
      "ALTER TABLE tour_sites ADD COLUMN IF NOT EXISTS audio_url_cn TEXT",
      "ALTER TABLE tour_sites ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE",
      "ALTER TABLE tour_sites ADD COLUMN IF NOT EXISTS shopify_url TEXT",
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
      "ALTER TABLE attractions ADD COLUMN IF NOT EXISTS name_pt TEXT DEFAULT ''",
      "ALTER TABLE attractions ADD COLUMN IF NOT EXISTS name_cn TEXT DEFAULT ''",
      "ALTER TABLE attractions ADD COLUMN IF NOT EXISTS desc_pt TEXT DEFAULT ''",
      "ALTER TABLE attractions ADD COLUMN IF NOT EXISTS desc_cn TEXT DEFAULT ''",
      "ALTER TABLE attractions ADD COLUMN IF NOT EXISTS fun_fact_pt TEXT DEFAULT ''",
      "ALTER TABLE attractions ADD COLUMN IF NOT EXISTS fun_fact_cn TEXT DEFAULT ''",
      "ALTER TABLE attractions ADD COLUMN IF NOT EXISTS audio_url_pt TEXT",
      "ALTER TABLE attractions ADD COLUMN IF NOT EXISTS audio_url_cn TEXT",
      "ALTER TABLE attractions ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE",
      "ALTER TABLE attractions ADD COLUMN IF NOT EXISTS shopify_url TEXT",
      // Gallery images (JSON array of URLs)
      "ALTER TABLE tour_sites ADD COLUMN IF NOT EXISTS images TEXT",
      "ALTER TABLE attractions ADD COLUMN IF NOT EXISTS images TEXT",
    ];
    for (const sql of newLangCols) {
      await this.pool.query(sql).catch(() => {}); // ignore if already exists
    }

    // DATA REPAIR: Clear any images arrays that contain serve URLs instead of data URIs.
    // This happened when handleSave incorrectly sent serve URLs back via PUT.
    // Safe to run every startup — only clears rows where images contains '/api/images/db/'.
    await this.pool.query(`
      UPDATE tour_sites
      SET images = NULL
      WHERE images IS NOT NULL
        AND images LIKE '%/api/images/db/%'
    `).catch(() => {});
    await this.pool.query(`
      UPDATE attractions
      SET images = NULL
      WHERE images IS NOT NULL
        AND images LIKE '%/api/images/db/%'
    `).catch(() => {});

    // DATA REPAIR: Clear stale imageUrl values that point to any domain-based serve URL.
    // These get regenerated correctly from gallery[0] on next API response.
    // Handles cases where imageUrl was stored with a domain that no longer serves images.
    await this.pool.query(`
      UPDATE tour_sites
      SET image_url = NULL
      WHERE image_url IS NOT NULL
        AND image_url LIKE '%/api/images/db/%'
        AND image_url NOT LIKE '%/gallery/%'
    `).catch(() => {});
    await this.pool.query(`
      UPDATE attractions
      SET image_url = NULL
      WHERE image_url IS NOT NULL
        AND image_url LIKE '%/api/images/db/%'
        AND image_url NOT LIKE '%/gallery/%'
    `).catch(() => {});

    // Subscription plans table
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS subscription_plans (
        id SERIAL PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        tier TEXT NOT NULL DEFAULT 'individual',
        name TEXT NOT NULL,
        tagline TEXT NOT NULL DEFAULT '',
        price_eur REAL NOT NULL,
        billing_period TEXT NOT NULL DEFAULT 'year',
        features TEXT NOT NULL DEFAULT '[]',
        is_popular BOOLEAN NOT NULL DEFAULT FALSE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        shopify_variant_id TEXT DEFAULT '',
        shopify_checkout_url TEXT DEFAULT '',
        cta_label TEXT NOT NULL DEFAULT 'Get Started',
        notes TEXT DEFAULT ''
      );
    `);

    // Subscription leads table
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS subscription_leads (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        plan_slug TEXT NOT NULL,
        plan_name TEXT NOT NULL,
        source TEXT DEFAULT 'pricing-page',
        created_at TEXT NOT NULL,
        notes TEXT DEFAULT ''
      );
    `);

    // Seed default plans if none exist
    const { rows: planRows } = await this.pool.query('SELECT COUNT(*) as c FROM subscription_plans');
    if (parseInt(planRows[0].c) === 0) {
      const defaultPlans = [
        { slug: 'trip-pass', tier: 'individual', name: 'Trip Pass', tagline: 'Perfect for a week in Albania', price: 7.99, period: '7-day',
          features: JSON.stringify(['7 days full access','All 43 destinations','All 305 attractions','10 audio walking tours','Offline audio playback','Works on any device']),
          popular: false, order: 1, cta: 'Buy Trip Pass' },
        { slug: 'explorer', tier: 'individual', name: 'Explorer', tagline: 'Best value for Albania lovers', price: 19.99, period: 'year',
          features: JSON.stringify(['Full year access','All 43 destinations','All 305 attractions','10 audio walking tours','Offline audio playback','New tours as added','All 11 languages']),
          popular: true, order: 2, cta: 'Start Exploring' },
        { slug: 'operator', tier: 'commercial', name: 'Operator Licence', tagline: 'For tour guides, hostels & small agencies', price: 199, period: 'year',
          features: JSON.stringify(['Up to 10 active guides','All individual features','Commercial use permitted','Priority email support','Early access to new tours','Attribution-free use']),
          popular: false, order: 3, cta: 'Get Operator Licence' },
        { slug: 'agency', tier: 'commercial', name: 'Agency Licence', tagline: 'For tour operators & travel agencies', price: 499, period: 'year',
          features: JSON.stringify(['Unlimited guides & staff','All Operator features','API access (on request)','White-label use permitted','Dedicated account support','Co-marketing opportunities','Custom tour additions (on request)']),
          popular: false, order: 4, cta: 'Contact for Agency Licence' },
      ];
      for (const p of defaultPlans) {
        await this.pool.query(
          `INSERT INTO subscription_plans (slug,tier,name,tagline,price_eur,billing_period,features,is_popular,is_active,sort_order,shopify_variant_id,shopify_checkout_url,cta_label)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE,$9,'','', $10) ON CONFLICT (slug) DO NOTHING`,
          [p.slug, p.tier, p.name, p.tagline, p.price, p.period, p.features, p.popular, p.order, p.cta]
        );
      }
    }

    // User subscriptions table
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS user_subscriptions (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        plan_slug TEXT NOT NULL,
        plan_name TEXT NOT NULL,
        shopify_order_id TEXT NOT NULL UNIQUE,
        price_eur REAL NOT NULL DEFAULT 0,
        starts_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        device_count INTEGER NOT NULL DEFAULT 0,
        devices TEXT NOT NULL DEFAULT '[]',
        session_token TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        created_at TEXT NOT NULL
      );
    `);

    // App settings table
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL DEFAULT 'true',
        updated_at TEXT NOT NULL DEFAULT 'now'
      );
    `);
    // Seed default settings
    await this.pool.query(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ('launch_banner_enabled', 'true', $1)
      ON CONFLICT (key) DO NOTHING
    `, [new Date().toISOString()]);

    // CMS pages table
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS cms_pages (
        id SERIAL PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        page_type TEXT NOT NULL DEFAULT 'info',
        title TEXT NOT NULL,
        excerpt TEXT DEFAULT '',
        body TEXT NOT NULL DEFAULT '',
        cover_image TEXT DEFAULT '',
        seo_title TEXT DEFAULT '',
        seo_description TEXT DEFAULT '',
        seo_keywords TEXT DEFAULT '',
        author TEXT DEFAULT 'AlbaTour',
        published_at TEXT DEFAULT '',
        is_published BOOLEAN NOT NULL DEFAULT FALSE,
        show_in_footer BOOLEAN NOT NULL DEFAULT FALSE,
        show_in_blog BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT 'now',
        updated_at TEXT NOT NULL DEFAULT 'now'
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
      nameIt: r.name_it||'', nameEs: r.name_es||'', nameDe: r.name_de||'',
      nameFr: r.name_fr||'', nameAr: r.name_ar||'', nameSl: r.name_sl||'', namePt: r.name_pt||'', nameCn: r.name_cn||'',
      descEn: r.desc_en, descAl: r.desc_al, descGr: r.desc_gr,
      descIt: r.desc_it||'', descEs: r.desc_es||'', descDe: r.desc_de||'',
      descFr: r.desc_fr||'', descAr: r.desc_ar||'', descSl: r.desc_sl||'',
      descPt: r.desc_pt||'', descCn: r.desc_cn||'',
      funFactEn: r.fun_fact_en, funFactAl: r.fun_fact_al, funFactGr: r.fun_fact_gr,
      funFactIt: r.fun_fact_it||null, funFactEs: r.fun_fact_es||null, funFactDe: r.fun_fact_de||null,
      funFactFr: r.fun_fact_fr||null, funFactAr: r.fun_fact_ar||null, funFactSl: r.fun_fact_sl||null,
      funFactPt: r.fun_fact_pt||null, funFactCn: r.fun_fact_cn||null,
      audioUrlEn: r.audio_url_en, audioUrlAl: r.audio_url_al, audioUrlGr: r.audio_url_gr,
      audioUrlIt: r.audio_url_it||null, audioUrlEs: r.audio_url_es||null, audioUrlDe: r.audio_url_de||null,
      audioUrlFr: r.audio_url_fr||null, audioUrlAr: r.audio_url_ar||null, audioUrlSl: r.audio_url_sl||null, audioUrlPt: r.audio_url_pt||null, audioUrlCn: r.audio_url_cn||null,
      lat: parseFloat(r.lat), lng: parseFloat(r.lng),
      region: r.region, category: r.category, difficulty: r.difficulty,
      points: r.points, imageUrl: r.image_url,
      images: r.images ? JSON.parse(r.images) : [],
      visitDuration: r.visit_duration,
      isLocked: r.is_locked||false, shopifyUrl: r.shopify_url||null,
    } as any;
  }

  private rowToAttraction(r: any): Attraction {
    return {
      id: r.id, slug: r.slug, destinationSlug: r.destination_slug,
      nameEn: r.name_en, nameAl: r.name_al, nameGr: r.name_gr,
      nameIt: r.name_it||'', nameEs: r.name_es||'', nameDe: r.name_de||'',
      nameFr: r.name_fr||'', nameAr: r.name_ar||'', nameSl: r.name_sl||'', namePt: r.name_pt||'', nameCn: r.name_cn||'',
      descEn: r.desc_en, descAl: r.desc_al, descGr: r.desc_gr,
      descIt: r.desc_it||'', descEs: r.desc_es||'', descDe: r.desc_de||'',
      descFr: r.desc_fr||'', descAr: r.desc_ar||'', descSl: r.desc_sl||'',
      descPt: r.desc_pt||'', descCn: r.desc_cn||'',
      funFactEn: r.fun_fact_en||'', funFactAl: r.fun_fact_al||'', funFactGr: r.fun_fact_gr||'',
      funFactIt: r.fun_fact_it||null, funFactEs: r.fun_fact_es||null, funFactDe: r.fun_fact_de||null,
      funFactFr: r.fun_fact_fr||null, funFactAr: r.fun_fact_ar||null, funFactSl: r.fun_fact_sl||null,
      funFactPt: r.fun_fact_pt||null, funFactCn: r.fun_fact_cn||null,
      audioUrlEn: r.audio_url_en, audioUrlAl: r.audio_url_al, audioUrlGr: r.audio_url_gr,
      audioUrlIt: r.audio_url_it||null, audioUrlEs: r.audio_url_es||null, audioUrlDe: r.audio_url_de||null,
      audioUrlFr: r.audio_url_fr||null, audioUrlAr: r.audio_url_ar||null, audioUrlSl: r.audio_url_sl||null, audioUrlPt: r.audio_url_pt||null, audioUrlCn: r.audio_url_cn||null,
      category: r.category, points: r.points,
      lat: parseFloat(r.lat), lng: parseFloat(r.lng),
      imageUrl: r.image_url,
      images: r.images ? JSON.parse(r.images) : [],
      visitDuration: r.visit_duration,
      isLocked: r.is_locked ?? false, shopifyUrl: r.shopify_url || null,
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
      nameIt: "name_it", nameEs: "name_es", nameDe: "name_de", nameFr: "name_fr", nameAr: "name_ar", nameSl: "name_sl", namePt: "name_pt", nameCn: "name_cn",
      descEn: "desc_en", descAl: "desc_al", descGr: "desc_gr",
      descIt: "desc_it", descEs: "desc_es", descDe: "desc_de", descFr: "desc_fr", descAr: "desc_ar", descSl: "desc_sl", descPt: "desc_pt", descCn: "desc_cn",
      funFactEn: "fun_fact_en", funFactAl: "fun_fact_al", funFactGr: "fun_fact_gr",
      funFactIt: "fun_fact_it", funFactEs: "fun_fact_es", funFactDe: "fun_fact_de",
      funFactFr: "fun_fact_fr", funFactAr: "fun_fact_ar", funFactSl: "fun_fact_sl", funFactPt: "fun_fact_pt", funFactCn: "fun_fact_cn",
      audioUrlEn: "audio_url_en", audioUrlAl: "audio_url_al", audioUrlGr: "audio_url_gr",
      audioUrlIt: "audio_url_it", audioUrlEs: "audio_url_es", audioUrlDe: "audio_url_de",
      audioUrlFr: "audio_url_fr", audioUrlAr: "audio_url_ar", audioUrlSl: "audio_url_sl", audioUrlPt: "audio_url_pt", audioUrlCn: "audio_url_cn",
      lat: "lat", lng: "lng", region: "region", category: "category",
      difficulty: "difficulty", points: "points", imageUrl: "image_url", visitDuration: "visit_duration",
      isLocked: "is_locked", shopifyUrl: "shopify_url",
    };
    for (const [key, col] of Object.entries(map)) {
      if (key in data) { fields.push(`${col}=$${i++}`); values.push((data as any)[key]); }
    }
    // images gallery: stored as JSON string
    if ('images' in data) {
      fields.push(`images=$${i++}`);
      values.push(JSON.stringify((data as any).images || []));
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
      nameIt: "name_it", nameEs: "name_es", nameDe: "name_de", nameFr: "name_fr", nameAr: "name_ar", nameSl: "name_sl", namePt: "name_pt", nameCn: "name_cn",
      descEn: "desc_en", descAl: "desc_al", descGr: "desc_gr",
      descIt: "desc_it", descEs: "desc_es", descDe: "desc_de", descFr: "desc_fr", descAr: "desc_ar", descSl: "desc_sl", descPt: "desc_pt", descCn: "desc_cn",
      funFactEn: "fun_fact_en", funFactAl: "fun_fact_al", funFactGr: "fun_fact_gr",
      funFactIt: "fun_fact_it", funFactEs: "fun_fact_es", funFactDe: "fun_fact_de",
      funFactFr: "fun_fact_fr", funFactAr: "fun_fact_ar", funFactSl: "fun_fact_sl", funFactPt: "fun_fact_pt", funFactCn: "fun_fact_cn",
      audioUrlEn: "audio_url_en", audioUrlAl: "audio_url_al", audioUrlGr: "audio_url_gr",
      audioUrlIt: "audio_url_it", audioUrlEs: "audio_url_es", audioUrlDe: "audio_url_de",
      audioUrlFr: "audio_url_fr", audioUrlAr: "audio_url_ar", audioUrlSl: "audio_url_sl", audioUrlPt: "audio_url_pt", audioUrlCn: "audio_url_cn",
      category: "category", points: "points",
      lat: "lat", lng: "lng", imageUrl: "image_url", visitDuration: "visit_duration",
      isLocked: "is_locked", shopifyUrl: "shopify_url",
    };
    for (const [key, col] of Object.entries(map)) {
      if (key in data) { fields.push(`${col}=$${i++}`); values.push((data as any)[key]); }
    }
    // images gallery: stored as JSON string
    if ('images' in data) {
      fields.push(`images=$${i++}`);
      values.push(JSON.stringify((data as any).images || []));
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

  async getAllPublishedItineraries(): Promise<Itinerary[]> {
    await this.ready;
    const { rows } = await this.pool.query(
      'SELECT * FROM itineraries WHERE is_published = true ORDER BY id'
    );
    return rows.map(this.rowToItinerary);
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

  // ── Subscription Plans ────────────────────────────────────────────────────
  private rowToPlan(r: any): SubscriptionPlan {
    return {
      id: r.id, slug: r.slug, tier: r.tier, name: r.name, tagline: r.tagline,
      priceEur: parseFloat(r.price_eur), billingPeriod: r.billing_period,
      features: r.features || '[]', isPopular: r.is_popular || false,
      isActive: r.is_active || true, sortOrder: r.sort_order || 0,
      deviceLimit: r.device_limit || 2,
      shopifyVariantId: r.shopify_variant_id || '',
      shopifyCheckoutUrl: r.shopify_checkout_url || '',
      ctaLabel: r.cta_label || 'Get Started', notes: r.notes || '',
    };
  }
  async getAllPlans(): Promise<SubscriptionPlan[]> {
    await this.ready;
    const { rows } = await this.pool.query('SELECT * FROM subscription_plans ORDER BY sort_order ASC, id ASC');
    return rows.map((r: any) => this.rowToPlan(r));
  }
  async getActivePlans(): Promise<SubscriptionPlan[]> {
    await this.ready;
    const { rows } = await this.pool.query('SELECT * FROM subscription_plans WHERE is_active=TRUE ORDER BY sort_order ASC');
    return rows.map((r: any) => this.rowToPlan(r));
  }
  async getPlanBySlug(slug: string): Promise<SubscriptionPlan | undefined> {
    await this.ready;
    const { rows } = await this.pool.query('SELECT * FROM subscription_plans WHERE slug=$1', [slug]);
    return rows[0] ? this.rowToPlan(rows[0]) : undefined;
  }
  async createPlan(data: InsertSubscriptionPlan): Promise<SubscriptionPlan> {
    await this.ready;
    await this.pool.query(`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS device_limit integer NOT NULL DEFAULT 2`).catch(()=>{});
    const { rows } = await this.pool.query(
      `INSERT INTO subscription_plans (slug,tier,name,tagline,price_eur,billing_period,features,is_popular,is_active,sort_order,device_limit,shopify_variant_id,shopify_checkout_url,cta_label,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [data.slug,data.tier||'individual',data.name,data.tagline||'',data.priceEur,
       data.billingPeriod||'year',data.features||'[]',data.isPopular??false,
       data.isActive??true,data.sortOrder??0,(data as any).deviceLimit||2,
       data.shopifyVariantId||'',data.shopifyCheckoutUrl||'',
       data.ctaLabel||'Get Started',data.notes||'']
    );
    return this.rowToPlan(rows[0]);
  }
  async updatePlan(id: number, data: Partial<InsertSubscriptionPlan>): Promise<SubscriptionPlan | undefined> {
    await this.ready;
    const map: Record<string,string> = {
      slug:'slug',tier:'tier',name:'name',tagline:'tagline',priceEur:'price_eur',
      billingPeriod:'billing_period',features:'features',isPopular:'is_popular',
      isActive:'is_active',sortOrder:'sort_order',deviceLimit:'device_limit',
      shopifyVariantId:'shopify_variant_id',
      shopifyCheckoutUrl:'shopify_checkout_url',ctaLabel:'cta_label',notes:'notes',
    };
    const fields: string[] = []; const vals: any[] = []; let i = 1;
    for (const [k, col] of Object.entries(map)) {
      if (k in data) { fields.push(`${col}=$${i++}`); vals.push((data as any)[k]); }
    }
    if (!fields.length) return undefined;
    vals.push(id);
    const { rows } = await this.pool.query(`UPDATE subscription_plans SET ${fields.join(', ')} WHERE id=$${i} RETURNING *`, vals);
    return rows[0] ? this.rowToPlan(rows[0]) : undefined;
  }
  async deletePlan(id: number): Promise<boolean> {
    await this.ready;
    const { rowCount } = await this.pool.query('DELETE FROM subscription_plans WHERE id=$1', [id]);
    return (rowCount ?? 0) > 0;
  }
  async getAllLeads(): Promise<SubscriptionLead[]> {
    await this.ready;
    const { rows } = await this.pool.query('SELECT * FROM subscription_leads ORDER BY id DESC');
    return rows.map((r: any) => ({ id:r.id, email:r.email, planSlug:r.plan_slug, planName:r.plan_name, source:r.source||'', createdAt:r.created_at, notes:r.notes||'' }));
  }
  async createLead(data: InsertLead): Promise<SubscriptionLead> {
    await this.ready;
    const now = new Date().toISOString();
    const { rows } = await this.pool.query(
      `INSERT INTO subscription_leads (email,plan_slug,plan_name,source,created_at,notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [data.email,data.planSlug,data.planName,data.source||'pricing-page',now,data.notes||'']
    );
    return { id:rows[0].id, email:rows[0].email, planSlug:rows[0].plan_slug, planName:rows[0].plan_name, source:rows[0].source, createdAt:rows[0].created_at, notes:rows[0].notes };
  }


  // ── User Subscriptions ────────────────────────────────────────────────────
  private rowToSub(r: any): UserSubscription {
    return {
      id: r.id, email: r.email, planSlug: r.plan_slug, planName: r.plan_name,
      shopifyOrderId: r.shopify_order_id, priceEur: parseFloat(r.price_eur)||0,
      startsAt: r.starts_at, expiresAt: r.expires_at, isActive: r.is_active,
      deviceCount: r.device_count||0, deviceLimit: r.device_limit||2,
      devices: r.devices||'[]', sessionToken: r.session_token||'',
      accessCode: r.access_code||'', notes: r.notes||'', createdAt: r.created_at,
    };
  }
  async createSubscription(data: InsertUserSubscription): Promise<UserSubscription> {
    await this.ready;
    // Run DB migrations for new columns (idempotent)
    await this.pool.query(`ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS device_limit integer NOT NULL DEFAULT 2`).catch(()=>{});
    await this.pool.query(`ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS access_code text DEFAULT ''`).catch(()=>{});
    await this.pool.query(`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS device_limit integer NOT NULL DEFAULT 2`).catch(()=>{});
    const { rows } = await this.pool.query(
      `INSERT INTO user_subscriptions (email,plan_slug,plan_name,shopify_order_id,price_eur,
        starts_at,expires_at,is_active,device_count,device_limit,devices,session_token,access_code,notes,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [data.email, data.planSlug, data.planName, data.shopifyOrderId, data.priceEur||0,
       data.startsAt, data.expiresAt, data.isActive??true, data.deviceCount||0,
       (data as any).deviceLimit||2, data.devices||'[]', data.sessionToken||'',
       (data as any).accessCode||'', data.notes||'', data.createdAt]
    );
    return this.rowToSub(rows[0]);
  }
  async getSubscriptionByCode(code: string): Promise<UserSubscription | undefined> {
    await this.ready;
    if (!code) return undefined;
    const { rows } = await this.pool.query(
      'SELECT * FROM user_subscriptions WHERE UPPER(access_code)=UPPER($1)', [code.trim()]
    );
    return rows[0] ? this.rowToSub(rows[0]) : undefined;
  }
  async getSubscriptionByOrderId(orderId: string): Promise<UserSubscription | undefined> {
    await this.ready;
    const { rows } = await this.pool.query('SELECT * FROM user_subscriptions WHERE shopify_order_id=$1', [orderId]);
    return rows[0] ? this.rowToSub(rows[0]) : undefined;
  }
  async getSubscriptionByToken(token: string): Promise<UserSubscription | undefined> {
    await this.ready;
    if (!token) return undefined;
    const { rows } = await this.pool.query('SELECT * FROM user_subscriptions WHERE session_token=$1', [token]);
    return rows[0] ? this.rowToSub(rows[0]) : undefined;
  }
  async getActiveSubscriptionByEmail(email: string): Promise<UserSubscription | undefined> {
    await this.ready;
    const now = new Date().toISOString();
    const { rows } = await this.pool.query(
      `SELECT * FROM user_subscriptions WHERE email=$1 AND is_active=TRUE AND expires_at > $2
       ORDER BY expires_at DESC LIMIT 1`, [email.toLowerCase(), now]
    );
    return rows[0] ? this.rowToSub(rows[0]) : undefined;
  }
  async getAllSubscriptions(): Promise<UserSubscription[]> {
    await this.ready;
    const { rows } = await this.pool.query('SELECT * FROM user_subscriptions ORDER BY id DESC');
    return rows.map((r: any) => this.rowToSub(r));
  }
  async updateSubscription(id: number, data: Partial<InsertUserSubscription>): Promise<UserSubscription | undefined> {
    await this.ready;
    const map: Record<string,string> = {
      email:'email', planSlug:'plan_slug', planName:'plan_name',
      shopifyOrderId:'shopify_order_id', priceEur:'price_eur',
      startsAt:'starts_at', expiresAt:'expires_at', isActive:'is_active',
      deviceCount:'device_count', deviceLimit:'device_limit',
      devices:'devices', sessionToken:'session_token',
      accessCode:'access_code', notes:'notes',
    };
    const fields: string[] = []; const vals: any[] = []; let i = 1;
    for (const [k, col] of Object.entries(map)) {
      if (k in data) { fields.push(`${col}=$${i++}`); vals.push((data as any)[k]); }
    }
    if (!fields.length) return undefined;
    vals.push(id);
    const { rows } = await this.pool.query(
      `UPDATE user_subscriptions SET ${fields.join(', ')} WHERE id=$${i} RETURNING *`, vals
    );
    return rows[0] ? this.rowToSub(rows[0]) : undefined;
  }
  async revokeSubscription(id: number): Promise<boolean> {
    await this.ready;
    const { rowCount } = await this.pool.query(
      `UPDATE user_subscriptions SET is_active=FALSE, session_token='' WHERE id=$1`, [id]
    );
    return (rowCount ?? 0) > 0;
  }

  // ── App Settings ──────────────────────────────────────────────────────────────
  async getSetting(key: string): Promise<string | null> {
    await this.ready;
    const { rows } = await this.pool.query('SELECT value FROM app_settings WHERE key=$1', [key]);
    return rows[0]?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<AppSetting> {
    await this.ready;
    const now = new Date().toISOString();
    const { rows } = await this.pool.query(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ($1,$2,$3)
       ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=$3 RETURNING *`,
      [key, value, now]
    );
    return { key: rows[0].key, value: rows[0].value, updatedAt: rows[0].updated_at };
  }

  async getAllSettings(): Promise<AppSetting[]> {
    await this.ready;
    const { rows } = await this.pool.query('SELECT * FROM app_settings ORDER BY key ASC');
    return rows.map((r: any) => ({ key: r.key, value: r.value, updatedAt: r.updated_at }));
  }

  // ── CMS Pages ──────────────────────────────────────────────────────────────
  private rowToCmsPage(r: any): CmsPage {
    return {
      id: r.id,
      slug: r.slug,
      pageType: r.page_type,
      title: r.title,
      excerpt: r.excerpt || '',
      body: r.body || '',
      coverImage: r.cover_image || '',
      seoTitle: r.seo_title || '',
      seoDescription: r.seo_description || '',
      seoKeywords: r.seo_keywords || '',
      author: r.author || 'AlbaTour',
      publishedAt: r.published_at || '',
      isPublished: r.is_published || false,
      showInFooter: r.show_in_footer || false,
      showInBlog: r.show_in_blog || false,
      sortOrder: r.sort_order || 0,
      createdAt: r.created_at || 'now',
      updatedAt: r.updated_at || 'now',
    };
  }

  async getAllCmsPages(): Promise<CmsPage[]> {
    await this.ready;
    const { rows } = await this.pool.query('SELECT * FROM cms_pages ORDER BY sort_order ASC, id ASC');
    return rows.map((r: any) => this.rowToCmsPage(r));
  }

  async getCmsPageBySlug(slug: string): Promise<CmsPage | undefined> {
    await this.ready;
    const { rows } = await this.pool.query('SELECT * FROM cms_pages WHERE slug=$1', [slug]);
    return rows[0] ? this.rowToCmsPage(rows[0]) : undefined;
  }

  async getCmsPageById(id: number): Promise<CmsPage | undefined> {
    await this.ready;
    const { rows } = await this.pool.query('SELECT * FROM cms_pages WHERE id=$1', [id]);
    return rows[0] ? this.rowToCmsPage(rows[0]) : undefined;
  }

  async getPublishedCmsPages(type?: string): Promise<CmsPage[]> {
    await this.ready;
    if (type === 'blog') {
      // Blog index: any published page that has show_in_blog=TRUE, regardless of page_type
      const { rows } = await this.pool.query(
        'SELECT * FROM cms_pages WHERE is_published=TRUE AND show_in_blog=TRUE ORDER BY sort_order ASC, published_at DESC'
      );
      return rows.map((r: any) => this.rowToCmsPage(r));
    }
    if (type) {
      const { rows } = await this.pool.query(
        'SELECT * FROM cms_pages WHERE is_published=TRUE AND page_type=$1 ORDER BY sort_order ASC, published_at DESC', [type]
      );
      return rows.map((r: any) => this.rowToCmsPage(r));
    }
    const { rows } = await this.pool.query(
      'SELECT * FROM cms_pages WHERE is_published=TRUE ORDER BY sort_order ASC, published_at DESC'
    );
    return rows.map((r: any) => this.rowToCmsPage(r));
  }

  async createCmsPage(data: InsertCmsPage): Promise<CmsPage> {
    await this.ready;
    const now = new Date().toISOString();
    const { rows } = await this.pool.query(
      `INSERT INTO cms_pages (slug, page_type, title, excerpt, body, cover_image,
        seo_title, seo_description, seo_keywords, author, published_at,
        is_published, show_in_footer, show_in_blog, sort_order, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16)
       RETURNING *`,
      [
        data.slug, data.pageType || 'info', data.title, data.excerpt || '',
        data.body || '', data.coverImage || '',
        data.seoTitle || '', data.seoDescription || '', data.seoKeywords || '',
        data.author || 'AlbaTour', data.publishedAt || '',
        data.isPublished ?? false, data.showInFooter ?? false,
        data.showInBlog ?? false, data.sortOrder ?? 0, now,
      ]
    );
    return this.rowToCmsPage(rows[0]);
  }

  async updateCmsPage(id: number, data: Partial<InsertCmsPage>): Promise<CmsPage | undefined> {
    await this.ready;
    const now = new Date().toISOString();
    const fields: string[] = [];
    const vals: any[] = [];
    let i = 1;
    const map: Record<string, string> = {
      slug: 'slug', pageType: 'page_type', title: 'title', excerpt: 'excerpt',
      body: 'body', coverImage: 'cover_image', seoTitle: 'seo_title',
      seoDescription: 'seo_description', seoKeywords: 'seo_keywords',
      author: 'author', publishedAt: 'published_at', isPublished: 'is_published',
      showInFooter: 'show_in_footer', showInBlog: 'show_in_blog', sortOrder: 'sort_order',
    };
    for (const [k, col] of Object.entries(map)) {
      if (k in data) { fields.push(`${col}=$${i++}`); vals.push((data as any)[k]); }
    }
    if (!fields.length) return this.getCmsPageById(id);
    fields.push(`updated_at=$${i++}`); vals.push(now);
    vals.push(id);
    const { rows } = await this.pool.query(
      `UPDATE cms_pages SET ${fields.join(', ')} WHERE id=$${i} RETURNING *`, vals
    );
    return rows[0] ? this.rowToCmsPage(rows[0]) : undefined;
  }

  async deleteCmsPage(id: number): Promise<boolean> {
    await this.ready;
    const { rowCount } = await this.pool.query('DELETE FROM cms_pages WHERE id=$1', [id]);
    return (rowCount ?? 0) > 0;
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
  async getAllPublishedItineraries() { return this.itineraries.filter(i => i.isPublished); }
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
  // Subscription stubs for MemStorage
  private _plans: SubscriptionPlan[] = [];
  private _leads: SubscriptionLead[] = [];
  private _nextPlanId = 1;
  private _nextLeadId = 1;
  async getAllPlans() { return [...this._plans]; }
  async getActivePlans() { return this._plans.filter(p => p.isActive); }
  async getPlanBySlug(slug: string) { return this._plans.find(p => p.slug === slug); }
  async createPlan(data: InsertSubscriptionPlan): Promise<SubscriptionPlan> {
    const p = { id: this._nextPlanId++, ...data } as SubscriptionPlan;
    this._plans.push(p); return p;
  }
  async updatePlan(id: number, data: Partial<InsertSubscriptionPlan>) {
    const idx = this._plans.findIndex(p => p.id === id);
    if (idx === -1) return undefined;
    this._plans[idx] = { ...this._plans[idx], ...data };
    return this._plans[idx];
  }
  async deletePlan(id: number) {
    const idx = this._plans.findIndex(p => p.id === id);
    if (idx === -1) return false;
    this._plans.splice(idx, 1); return true;
  }
  async getAllLeads() { return [...this._leads]; }
  async createLead(data: InsertLead): Promise<SubscriptionLead> {
    const l = { id: this._nextLeadId++, ...data, createdAt: new Date().toISOString() } as SubscriptionLead;
    this._leads.push(l); return l;
  }

  // User Subscription stubs for MemStorage
  private _subs: UserSubscription[] = [];
  private _nextSubId = 1;
  async createSubscription(data: InsertUserSubscription): Promise<UserSubscription> {
    const s = { id: this._nextSubId++, ...data } as UserSubscription;
    this._subs.push(s); return s;
  }
  async getSubscriptionByOrderId(id: string) { return this._subs.find(s => s.shopifyOrderId === id); }
  async getSubscriptionByToken(token: string) { return this._subs.find(s => s.sessionToken === token); }
  async getSubscriptionByCode(code: string) { return this._subs.find(s => s.accessCode?.toUpperCase() === code?.toUpperCase().trim()); }
  async getActiveSubscriptionByEmail(email: string) {
    const now = new Date().toISOString();
    return this._subs.find(s => s.email === email.toLowerCase() && s.isActive && s.expiresAt > now);
  }
  async getAllSubscriptions() { return [...this._subs]; }
  async updateSubscription(id: number, data: Partial<InsertUserSubscription>) {
    const idx = this._subs.findIndex(s => s.id === id);
    if (idx === -1) return undefined;
    this._subs[idx] = { ...this._subs[idx], ...data }; return this._subs[idx];
  }
  async revokeSubscription(id: number) {
    const idx = this._subs.findIndex(s => s.id === id);
    if (idx === -1) return false;
    this._subs[idx].isActive = false; this._subs[idx].sessionToken = ''; return true;
  }

  // App Settings stubs for MemStorage
  private _settings: Record<string, string> = { launch_banner_enabled: 'true' };
  async getSetting(key: string) { return this._settings[key] ?? null; }
  async setSetting(key: string, value: string): Promise<AppSetting> {
    this._settings[key] = value;
    return { key, value, updatedAt: new Date().toISOString() };
  }
  async getAllSettings(): Promise<AppSetting[]> {
    return Object.entries(this._settings).map(([key, value]) => ({ key, value, updatedAt: '' }));
  }

  // CMS stubs for MemStorage (in-memory only)
  private cmsPages: CmsPage[] = [];
  private nextCmsId = 1;
  async getAllCmsPages() { return [...this.cmsPages]; }
  async getCmsPageBySlug(slug: string) { return this.cmsPages.find(p => p.slug === slug); }
  async getCmsPageById(id: number) { return this.cmsPages.find(p => p.id === id); }
  async getPublishedCmsPages(type?: string) {
    if (type === 'blog') return this.cmsPages.filter(p => p.isPublished && p.showInBlog);
    return this.cmsPages.filter(p => p.isPublished && (!type || p.pageType === type));
  }
  async createCmsPage(data: InsertCmsPage): Promise<CmsPage> {
    const now = new Date().toISOString();
    const page: CmsPage = { id: this.nextCmsId++, ...data, createdAt: now, updatedAt: now } as CmsPage;
    this.cmsPages.push(page); return page;
  }
  async updateCmsPage(id: number, data: Partial<InsertCmsPage>): Promise<CmsPage | undefined> {
    const idx = this.cmsPages.findIndex(p => p.id === id);
    if (idx === -1) return undefined;
    this.cmsPages[idx] = { ...this.cmsPages[idx], ...data, updatedAt: new Date().toISOString() };
    return this.cmsPages[idx];
  }
  async deleteCmsPage(id: number): Promise<boolean> {
    const idx = this.cmsPages.findIndex(p => p.id === id);
    if (idx === -1) return false;
    this.cmsPages.splice(idx, 1); return true;
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────
export const storage: IStorage = process.env.DATABASE_URL
  ? new PgStorage(process.env.DATABASE_URL)
  : new MemStorage();
