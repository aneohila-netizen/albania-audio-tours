import { pgTable, text, integer, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const tourSites = pgTable("tour_sites", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  slug: text("slug").notNull().unique(),
  nameEn: text("name_en").notNull(),
  nameAl: text("name_al").notNull(),
  nameGr: text("name_gr").notNull(),
  descEn: text("desc_en").notNull(),
  descAl: text("desc_al").notNull(),
  descGr: text("desc_gr").notNull(),
  audioUrlEn: text("audio_url_en"),
  audioUrlAl: text("audio_url_al"),
  audioUrlGr: text("audio_url_gr"),
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
});

export const userProgress = pgTable("user_progress", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  sessionId: text("session_id").notNull(),
  siteId: integer("site_id").notNull(),
  visitedAt: text("visited_at").notNull(),
  pointsEarned: integer("points_earned").notNull(),
  audioCompleted: boolean("audio_completed").notNull().default(false),
});

export const insertTourSiteSchema = createInsertSchema(tourSites).omit({ id: true });
export const insertUserProgressSchema = createInsertSchema(userProgress).omit({ id: true });

export type TourSite = typeof tourSites.$inferSelect;
export type InsertTourSite = z.infer<typeof insertTourSiteSchema>;
export type UserProgress = typeof userProgress.$inferSelect;
export type InsertUserProgress = z.infer<typeof insertUserProgressSchema>;
