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
  descEn: text("desc_en").notNull(),
  descAl: text("desc_al").notNull(),
  descGr: text("desc_gr").notNull(),
  descIt: text("desc_it").default(""),
  descEs: text("desc_es").default(""),
  descDe: text("desc_de").default(""),
  descFr: text("desc_fr").default(""),
  descAr: text("desc_ar").default(""),
  descSl: text("desc_sl").default(""),
  audioUrlEn: text("audio_url_en"),
  audioUrlAl: text("audio_url_al"),
  audioUrlGr: text("audio_url_gr"),
  audioUrlIt: text("audio_url_it"),
  audioUrlEs: text("audio_url_es"),
  audioUrlDe: text("audio_url_de"),
  audioUrlFr: text("audio_url_fr"),
  audioUrlAr: text("audio_url_ar"),
  audioUrlSl: text("audio_url_sl"),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  region: text("region").notNull(),
  category: text("category").notNull(),
  difficulty: text("difficulty").notNull(),
  points: integer("points").notNull().default(100),
  imageUrl: text("image_url"),
  visitDuration: integer("visit_duration").notNull().default(60),
  funFactEn: text("fun_fact_en"),
  funFactAl: text("fun_fact_al"),
  funFactGr: text("fun_fact_gr"),
  funFactIt: text("fun_fact_it"),
  funFactEs: text("fun_fact_es"),
  funFactDe: text("fun_fact_de"),
  funFactFr: text("fun_fact_fr"),
  funFactAr: text("fun_fact_ar"),
  funFactSl: text("fun_fact_sl"),
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
  descEn: text("desc_en").notNull().default(""),
  descAl: text("desc_al").notNull().default(""),
  descGr: text("desc_gr").notNull().default(""),
  descIt: text("desc_it").default(""),
  descEs: text("desc_es").default(""),
  descDe: text("desc_de").default(""),
  descFr: text("desc_fr").default(""),
  descAr: text("desc_ar").default(""),
  descSl: text("desc_sl").default(""),
  funFactEn: text("fun_fact_en").notNull().default(""),
  funFactAl: text("fun_fact_al").notNull().default(""),
  funFactGr: text("fun_fact_gr").notNull().default(""),
  funFactIt: text("fun_fact_it").default(""),
  funFactEs: text("fun_fact_es").default(""),
  funFactDe: text("fun_fact_de").default(""),
  funFactFr: text("fun_fact_fr").default(""),
  funFactAr: text("fun_fact_ar").default(""),
  funFactSl: text("fun_fact_sl").default(""),
  audioUrlEn: text("audio_url_en"),
  audioUrlAl: text("audio_url_al"),
  audioUrlGr: text("audio_url_gr"),
  audioUrlIt: text("audio_url_it"),
  audioUrlEs: text("audio_url_es"),
  audioUrlDe: text("audio_url_de"),
  audioUrlFr: text("audio_url_fr"),
  audioUrlAr: text("audio_url_ar"),
  audioUrlSl: text("audio_url_sl"),
  category: text("category").notNull().default("landmark"),
  points: integer("points").notNull().default(50),
  lat: real("lat").notNull().default(0),
  lng: real("lng").notNull().default(0),
  imageUrl: text("image_url"),
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

export const userProgress = pgTable("user_progress", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  sessionId: text("session_id").notNull(),
  siteId: integer("site_id").notNull(),
  visitedAt: text("visited_at").notNull(),
  pointsEarned: integer("points_earned").notNull(),
  audioCompleted: boolean("audio_completed").notNull().default(false),
});

export const insertTourSiteSchema = createInsertSchema(tourSites).omit({ id: true });
export const insertAttractionSchema = createInsertSchema(attractions).omit({ id: true });
export const insertUserProgressSchema = createInsertSchema(userProgress).omit({ id: true });

export type TourSite = typeof tourSites.$inferSelect;
export type Attraction = typeof attractions.$inferSelect;
export type InsertTourSite = z.infer<typeof insertTourSiteSchema>;
export type InsertAttraction = z.infer<typeof insertAttractionSchema>;
export type UserProgress = typeof userProgress.$inferSelect;
export type InsertUserProgress = z.infer<typeof insertUserProgressSchema>;
