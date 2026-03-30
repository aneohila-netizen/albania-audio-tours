import { pgTable, text, integer, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const tourSites = pgTable("tour_sites", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  slug: text("slug").notNull().unique(),
  nameEn: text("name_en").notNull(),
  nameAl: text("name_al").notNull(),
  nameGr: text("name_gr").notNull(),
  nameIt: text("name_it").default(""),
  nameEs: text("name_es").default(""),
  nameDe: text("name_de").default(""),
  nameFr: text("name_fr").default(""),
  nameAr: text("name_ar").default(""),
  nameSl: text("name_sl").default(""),
  namePt: text("name_pt").default(""),
  nameCn: text("name_cn").default(""),
  descEn: text("desc_en").notNull(),
  descAl: text("desc_al").notNull(),
  descGr: text("desc_gr").notNull(),
  descIt: text("desc_it").default(""),
  descEs: text("desc_es").default(""),
  descDe: text("desc_de").default(""),
  descFr: text("desc_fr").default(""),
  descAr: text("desc_ar").default(""),
  descSl: text("desc_sl").default(""),
  descPt: text("desc_pt").default(""),
  descCn: text("desc_cn").default(""),
  audioUrlEn: text("audio_url_en"),
  audioUrlAl: text("audio_url_al"),
  audioUrlGr: text("audio_url_gr"),
  audioUrlIt: text("audio_url_it"),
  audioUrlEs: text("audio_url_es"),
  audioUrlDe: text("audio_url_de"),
  audioUrlFr: text("audio_url_fr"),
  audioUrlAr: text("audio_url_ar"),
  audioUrlSl: text("audio_url_sl"),
  audioUrlPt: text("audio_url_pt"),
  audioUrlCn: text("audio_url_cn"),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  region: text("region").notNull(),
  category: text("category").notNull(),
  difficulty: text("difficulty").notNull(),
  points: integer("points").notNull().default(100),
  imageUrl: text("image_url"),
  images: text("images"), // JSON array of image URLs for gallery/slideshow
  visitDuration: integer("visit_duration").notNull().default(60),
  isLocked: boolean("is_locked").notNull().default(false),
  shopifyUrl: text("shopify_url"),
  funFactEn: text("fun_fact_en"),
  funFactAl: text("fun_fact_al"),
  funFactGr: text("fun_fact_gr"),
  funFactIt: text("fun_fact_it"),
  funFactEs: text("fun_fact_es"),
  funFactDe: text("fun_fact_de"),
  funFactFr: text("fun_fact_fr"),
  funFactAr: text("fun_fact_ar"),
  funFactSl: text("fun_fact_sl"),
  funFactPt: text("fun_fact_pt"),
  funFactCn: text("fun_fact_cn"),
});

// Attractions: sub-sites within a destination
export const attractions = pgTable("attractions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  slug: text("slug").notNull(),
  destinationSlug: text("destination_slug").notNull(),
  nameEn: text("name_en").notNull(),
  nameAl: text("name_al").notNull().default(""),
  nameGr: text("name_gr").notNull().default(""),
  nameIt: text("name_it").default(""),
  nameEs: text("name_es").default(""),
  nameDe: text("name_de").default(""),
  nameFr: text("name_fr").default(""),
  nameAr: text("name_ar").default(""),
  nameSl: text("name_sl").default(""),
  namePt: text("name_pt").default(""),
  nameCn: text("name_cn").default(""),
  descEn: text("desc_en").notNull().default(""),
  descAl: text("desc_al").notNull().default(""),
  descGr: text("desc_gr").notNull().default(""),
  descIt: text("desc_it").default(""),
  descEs: text("desc_es").default(""),
  descDe: text("desc_de").default(""),
  descFr: text("desc_fr").default(""),
  descAr: text("desc_ar").default(""),
  descSl: text("desc_sl").default(""),
  descPt: text("desc_pt").default(""),
  descCn: text("desc_cn").default(""),
  funFactEn: text("fun_fact_en").notNull().default(""),
  funFactAl: text("fun_fact_al").notNull().default(""),
  funFactGr: text("fun_fact_gr").notNull().default(""),
  funFactIt: text("fun_fact_it").default(""),
  funFactEs: text("fun_fact_es").default(""),
  funFactDe: text("fun_fact_de").default(""),
  funFactFr: text("fun_fact_fr").default(""),
  funFactAr: text("fun_fact_ar").default(""),
  funFactSl: text("fun_fact_sl").default(""),
  funFactPt: text("fun_fact_pt").default(""),
  funFactCn: text("fun_fact_cn").default(""),
  audioUrlEn: text("audio_url_en"),
  audioUrlAl: text("audio_url_al"),
  audioUrlGr: text("audio_url_gr"),
  audioUrlIt: text("audio_url_it"),
  audioUrlEs: text("audio_url_es"),
  audioUrlDe: text("audio_url_de"),
  audioUrlFr: text("audio_url_fr"),
  audioUrlAr: text("audio_url_ar"),
  audioUrlSl: text("audio_url_sl"),
  audioUrlPt: text("audio_url_pt"),
  audioUrlCn: text("audio_url_cn"),
  category: text("category").notNull().default("landmark"),
  points: integer("points").notNull().default(50),
  lat: real("lat").notNull().default(0),
  lng: real("lng").notNull().default(0),
  imageUrl: text("image_url"),
  images: text("images"), // JSON array of image URLs for gallery/slideshow
  visitDuration: integer("visit_duration").notNull().default(30),
});

// ── Tour Itineraries ──────────────────────────────────────────────────────────
// Each itinerary belongs to a site (destination, tour site, or attraction page)
// via siteSlug. Multiple itineraries per page are supported.
// Waypoints are stored as JSON array: [{lat, lng, title, description, order}]
export const itineraries = pgTable("itineraries", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  siteSlug: text("site_slug").notNull(),     // matches tourSites.slug or attractions.slug
  entityType: text("entity_type").notNull().default("site"), // "site" | "attraction"
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  instructions: text("instructions").notNull().default(""),  // visitor instructions
  durationMinutes: integer("duration_minutes").notNull().default(60),
  distanceKm: real("distance_km").default(0),
  difficulty: text("difficulty").notNull().default("easy"),  // easy | moderate | hard
  waypoints: text("waypoints").notNull().default("[]"), // JSON: [{lat,lng,title,description,order}]
  isPublished: boolean("is_published").notNull().default(true),
  createdAt: text("created_at").notNull().default("now"),
});

export const insertItinerarySchema = createInsertSchema(itineraries).omit({ id: true });
export type Itinerary = typeof itineraries.$inferSelect;
export type InsertItinerary = z.infer<typeof insertItinerarySchema>;

// ── Ratings ───────────────────────────────────────────────────────────────
export const ratings = pgTable("ratings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  siteId: integer("site_id").notNull(),
  siteSlug: text("site_slug").notNull(),
  stars: integer("stars").notNull(),        // 1–5
  createdAt: text("created_at").notNull(),
});

export const insertRatingSchema = createInsertSchema(ratings).omit({ id: true });
export type Rating = typeof ratings.$inferSelect;
export type InsertRating = z.infer<typeof insertRatingSchema>;

export const userProgress = pgTable("user_progress", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  sessionId: text("session_id").notNull(),
  siteId: integer("site_id").notNull(),
  visitedAt: text("visited_at").notNull(),
  pointsEarned: integer("points_earned").notNull(),
  audioCompleted: boolean("audio_completed").notNull().default(false),
});

// ── CMS Pages ────────────────────────────────────────────────────────────────
// Covers: editable footer pages (contact/terms/refund), blog posts, SEO landing pages
export const cmsPages = pgTable("cms_pages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  slug: text("slug").notNull().unique(),           // URL: /#/p/slug (or /contact, /terms, /refund-policy)
  pageType: text("page_type").notNull().default("info"), // "info" | "blog" | "landing" | "system"
  title: text("title").notNull(),
  excerpt: text("excerpt").default(""),             // blog card subtitle / meta description fallback
  body: text("body").notNull().default(""),         // HTML content (rich text)
  coverImage: text("cover_image").default(""),      // base64 or URL
  seoTitle: text("seo_title").default(""),
  seoDescription: text("seo_description").default(""),
  seoKeywords: text("seo_keywords").default(""),
  author: text("author").default("AlbaTour"),
  publishedAt: text("published_at").default(""),    // ISO date string
  isPublished: boolean("is_published").notNull().default(false),
  showInFooter: boolean("show_in_footer").notNull().default(false),
  showInBlog: boolean("show_in_blog").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default("now"),
  updatedAt: text("updated_at").notNull().default("now"),
});

export const insertCmsPageSchema = createInsertSchema(cmsPages).omit({ id: true });
export type CmsPage = typeof cmsPages.$inferSelect;
export type InsertCmsPage = z.infer<typeof insertCmsPageSchema>;

// ── Subscription Plans ───────────────────────────────────────────────────
// Admin-editable plans shown on the public /subscriptions page
export const subscriptionPlans = pgTable("subscription_plans", {
  id:            integer("id").primaryKey().generatedAlwaysAsIdentity(),
  slug:          text("slug").notNull().unique(),          // e.g. "trip-pass", "explorer", "operator"
  tier:          text("tier").notNull().default("individual"), // "individual" | "commercial"
  name:          text("name").notNull(),
  tagline:       text("tagline").notNull().default(""),    // e.g. "Perfect for a week in Albania"
  priceEur:      real("price_eur").notNull(),              // e.g. 7.99
  billingPeriod: text("billing_period").notNull().default("year"), // "7-day" | "month" | "year"
  features:      text("features").notNull().default("[]"), // JSON array of feature strings
  isPopular:     boolean("is_popular").notNull().default(false),
  isActive:      boolean("is_active").notNull().default(true),
  sortOrder:     integer("sort_order").notNull().default(0),
  deviceLimit:   integer("device_limit").notNull().default(2), // max devices per subscription
  shopifyVariantId: text("shopify_variant_id").default(""), // Shopify product variant ID for Buy Button
  shopifyCheckoutUrl: text("shopify_checkout_url").default(""), // Direct checkout URL
  ctaLabel:      text("cta_label").notNull().default("Get Started"),
  notes:         text("notes").default(""),                // Admin-only notes
});
export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({ id: true });
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;

// ── Subscription Leads ───────────────────────────────────────────────────
// Captures email interest before Shopify checkout is fully wired
export const subscriptionLeads = pgTable("subscription_leads", {
  id:        integer("id").primaryKey().generatedAlwaysAsIdentity(),
  email:     text("email").notNull(),
  planSlug:  text("plan_slug").notNull(),
  planName:  text("plan_name").notNull(),
  source:    text("source").default("pricing-page"),
  createdAt: text("created_at").notNull(),
  notes:     text("notes").default(""),
});
export const insertLeadSchema = createInsertSchema(subscriptionLeads).omit({ id: true });
export type SubscriptionLead = typeof subscriptionLeads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;

// ── User Subscriptions ───────────────────────────────────────────────────
// One row per purchase. Created by the Shopify orders/paid webhook.
export const userSubscriptions = pgTable("user_subscriptions", {
  id:           integer("id").primaryKey().generatedAlwaysAsIdentity(),
  email:        text("email").notNull(),
  planSlug:     text("plan_slug").notNull(),
  planName:     text("plan_name").notNull(),
  shopifyOrderId: text("shopify_order_id").notNull().unique(),
  priceEur:     real("price_eur").notNull().default(0),
  startsAt:     text("starts_at").notNull(),
  expiresAt:    text("expires_at").notNull(),  // ISO date — checked on every audio request
  isActive:     boolean("is_active").notNull().default(true),  // admin can revoke
  deviceCount:  integer("device_count").notNull().default(0),
  deviceLimit:  integer("device_limit").notNull().default(2),  // copied from plan at purchase time
  devices:      text("devices").notNull().default("[]"), // JSON array of device fingerprints
  sessionToken: text("session_token").default(""),  // opaque token issued to first activating device
  accessCode:   text("access_code").default(""),    // short human-readable code e.g. ALB-7X2K
  notes:        text("notes").default(""),
  createdAt:    text("created_at").notNull(),
});
export const insertUserSubscriptionSchema = createInsertSchema(userSubscriptions).omit({ id: true });
export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type InsertUserSubscription = z.infer<typeof insertUserSubscriptionSchema>;

// ── App Settings (global key/value flags) ──────────────────────────────────────
// Used for toggles like launch_banner_enabled, maintenance_mode, etc.
export const appSettings = pgTable("app_settings", {
  key:       text("key").primaryKey(),
  value:     text("value").notNull().default("true"),
  updatedAt: text("updated_at").notNull().default("now"),
});
export type AppSetting = typeof appSettings.$inferSelect;

export const insertTourSiteSchema = createInsertSchema(tourSites).omit({ id: true });
export const insertAttractionSchema = createInsertSchema(attractions).omit({ id: true });
export const insertUserProgressSchema = createInsertSchema(userProgress).omit({ id: true });

export type TourSite = typeof tourSites.$inferSelect;
export type Attraction = typeof attractions.$inferSelect;
export type InsertTourSite = z.infer<typeof insertTourSiteSchema>;
export type InsertAttraction = z.infer<typeof insertAttractionSchema>;
export type UserProgress = typeof userProgress.$inferSelect;
export type InsertUserProgress = z.infer<typeof insertUserProgressSchema>;
