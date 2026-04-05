/**
 * One-time migration script: PostgreSQL base64 images → Cloudflare R2
 * ─────────────────────────────────────────────────────────────────────────────
 * Reads all sites and attractions from Railway, finds any base64 / positional
 * serve-URL images, uploads them to R2, then PATCHes the DB record with the
 * new R2 URL via the admin API.
 *
 * Run once after deploying the R2-enabled server:
 *   npx tsx scripts/migrate-images-to-r2.ts
 *
 * Env vars needed (same as Railway):
 *   RAILWAY_BASE, ADMIN_TOKEN, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
 *   R2_SECRET_KEY, R2_BUCKET, R2_PUBLIC_URL
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import * as https from "https";
import * as http from "http";

// ── Config ────────────────────────────────────────────────────────────────────
const RAILWAY_BASE  = process.env.RAILWAY_BASE  || "https://albania-audio-tours-production.up.railway.app";
const ADMIN_TOKEN   = process.env.ADMIN_TOKEN   || "albatour-admin-secret-token";
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "537459e65b55c4e1aaa1996ef06bb3fc";
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID || "7018d59eae4f73e6557ac79097c36949";
const R2_SECRET_KEY = process.env.R2_SECRET_KEY || "bfd9406f1dca82d5843e033a47bf6c5234bbc5a26513dda2a94cc4b2f918f662";
const R2_BUCKET     = process.env.R2_BUCKET     || "albania-audio-tours";
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || "https://pub-d0a61558630844848afa90674031b6a8.r2.dev").replace(/\/$/, "");

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY },
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client.get(url, { headers: { "x-admin-token": ADMIN_TOKEN } }, (res) => {
      let data = "";
      res.on("data", (c: string) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse failed: ${data.slice(0, 200)}`)); }
      });
    }).on("error", reject);
  });
}

function patchJson(url: string, body: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        "x-admin-token": ADMIN_TOKEN,
      },
    };
    const client = url.startsWith("https") ? https : http;
    const req = client.request(options, (res) => {
      let data = "";
      res.on("data", (c: string) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse failed: ${data.slice(0, 200)}`)); }
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function fetchImageBuffer(url: string): Promise<{ buf: Buffer; mime: string }> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client.get(url, { headers: { "x-admin-token": ADMIN_TOKEN } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        const buf = Buffer.concat(chunks);
        const mime = (res.headers["content-type"] as string) || "image/jpeg";
        resolve({ buf, mime });
      });
    }).on("error", reject);
  });
}

async function uploadToR2(buf: Buffer, mime: string, folder: string): Promise<string> {
  const ext = mime.includes("webp") ? "webp" : mime.includes("png") ? "png" : "jpg";
  const key = `${folder}/${uuidv4()}.${ext}`;
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: buf,
    ContentType: mime,
    CacheControl: "public, max-age=31536000, immutable",
  }));
  return `${R2_PUBLIC_URL}/${key}`;
}

function isBase64(s: string) { return s?.startsWith("data:"); }
function isServeUrl(s: string) { return s?.includes("/api/images/db/"); }
function needsMigration(s: string) { return s && (isBase64(s) || isServeUrl(s)); }

async function resolveToBuffer(imageValue: string): Promise<{ buf: Buffer; mime: string } | null> {
  if (!imageValue) return null;
  if (isBase64(imageValue)) {
    const match = imageValue.match(/^data:([^;]+);base64,(.+)$/s);
    if (!match) return null;
    return { buf: Buffer.from(match[2], "base64"), mime: match[1] };
  }
  if (isServeUrl(imageValue)) {
    const fullUrl = imageValue.startsWith("http") ? imageValue : `${RAILWAY_BASE}${imageValue}`;
    try { return await fetchImageBuffer(fullUrl); }
    catch (e) { console.warn("  ⚠ Could not fetch serve URL:", fullUrl); return null; }
  }
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function migrate() {
  console.log("🚀 Starting image migration to Cloudflare R2...\n");
  let totalMigrated = 0;
  let totalSkipped = 0;

  // ── Sites ──────────────────────────────────────────────────────────────────
  console.log("📍 Fetching all sites...");
  const sites = await fetchJson(`${RAILWAY_BASE}/api/sites`);
  console.log(`   Found ${sites.length} sites\n`);

  for (const site of sites) {
    const id = site.id;
    const slug = site.slug;
    let changed = false;
    const patch: any = {};

    // Hero image
    if (needsMigration(site.imageUrl)) {
      console.log(`  [Site ${id} ${slug}] Migrating hero image...`);
      const resolved = await resolveToBuffer(site.imageUrl);
      if (resolved) {
        const r2Url = await uploadToR2(resolved.buf, resolved.mime, "sites");
        patch.imageUrl = r2Url;
        console.log(`    ✅ Hero → ${r2Url}`);
        changed = true;
        totalMigrated++;
      } else {
        console.log(`    ⚠ Could not resolve hero image, skipping`);
        totalSkipped++;
      }
    }

    // Gallery images
    const gallery: string[] = site.images || [];
    if (gallery.some(needsMigration)) {
      const newGallery: string[] = [];
      for (let i = 0; i < gallery.length; i++) {
        const img = gallery[i];
        if (needsMigration(img)) {
          console.log(`  [Site ${id} ${slug}] Migrating gallery[${i}]...`);
          const resolved = await resolveToBuffer(img);
          if (resolved) {
            const r2Url = await uploadToR2(resolved.buf, resolved.mime, "sites");
            newGallery.push(r2Url);
            console.log(`    ✅ gallery[${i}] → ${r2Url}`);
            totalMigrated++;
          } else {
            console.log(`    ⚠ Could not resolve gallery[${i}], keeping original`);
            newGallery.push(img);
            totalSkipped++;
          }
        } else {
          newGallery.push(img); // already R2 or external URL
        }
      }
      patch.images = newGallery;
      // Sync hero to first gallery image
      if (!patch.imageUrl && newGallery[0]) patch.imageUrl = newGallery[0];
      changed = true;
    }

    if (changed) {
      await patchJson(`${RAILWAY_BASE}/api/admin/sites/${id}`, patch);
      console.log(`  💾 Site ${id} (${slug}) updated in DB\n`);
    }
  }

  // ── Attractions ────────────────────────────────────────────────────────────
  console.log("\n📍 Fetching all attractions...");
  const attractions = await fetchJson(`${RAILWAY_BASE}/api/admin/attractions`);
  console.log(`   Found ${attractions.length} attractions\n`);

  for (const attr of attractions) {
    const id = attr.id;
    const name = attr.name || attr.slug || id;
    let changed = false;
    const patch: any = {};

    if (needsMigration(attr.imageUrl)) {
      console.log(`  [Attraction ${id} ${name}] Migrating hero image...`);
      const resolved = await resolveToBuffer(attr.imageUrl);
      if (resolved) {
        const r2Url = await uploadToR2(resolved.buf, resolved.mime, "attractions");
        patch.imageUrl = r2Url;
        console.log(`    ✅ Hero → ${r2Url}`);
        changed = true;
        totalMigrated++;
      } else {
        console.log(`    ⚠ Could not resolve hero image, skipping`);
        totalSkipped++;
      }
    }

    const gallery: string[] = attr.images || [];
    if (gallery.some(needsMigration)) {
      const newGallery: string[] = [];
      for (let i = 0; i < gallery.length; i++) {
        const img = gallery[i];
        if (needsMigration(img)) {
          console.log(`  [Attraction ${id} ${name}] Migrating gallery[${i}]...`);
          const resolved = await resolveToBuffer(img);
          if (resolved) {
            const r2Url = await uploadToR2(resolved.buf, resolved.mime, "attractions");
            newGallery.push(r2Url);
            console.log(`    ✅ gallery[${i}] → ${r2Url}`);
            totalMigrated++;
          } else {
            newGallery.push(img);
            totalSkipped++;
          }
        } else {
          newGallery.push(img);
        }
      }
      patch.images = newGallery;
      if (!patch.imageUrl && newGallery[0]) patch.imageUrl = newGallery[0];
      changed = true;
    }

    if (changed) {
      await patchJson(`${RAILWAY_BASE}/api/admin/attractions/${id}`, patch);
      console.log(`  💾 Attraction ${id} (${name}) updated in DB\n`);
    }
  }

  console.log("\n─────────────────────────────────────────────────────────────");
  console.log(`✅ Migration complete: ${totalMigrated} images migrated, ${totalSkipped} skipped`);
  console.log("─────────────────────────────────────────────────────────────\n");
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
