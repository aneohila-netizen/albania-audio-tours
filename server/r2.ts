/**
 * Cloudflare R2 helper
 * ─────────────────────────────────────────────────────────────────────────────
 * Wraps @aws-sdk/client-s3 for R2's S3-compatible API.
 * All public image URLs are served directly from R2's CDN edge —
 * Railway is never involved in image delivery after upload.
 *
 * Required env vars (set on Railway):
 *   R2_ACCOUNT_ID      – Cloudflare account ID
 *   R2_ACCESS_KEY_ID   – R2 API token access key
 *   R2_SECRET_KEY      – R2 API token secret key
 *   R2_BUCKET          – bucket name (e.g. albania-audio-tours)
 *   R2_PUBLIC_URL      – public dev URL (e.g. https://pub-xxx.r2.dev)
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

// ── R2 is configured lazily so the server still boots without env vars
// ── (useful for local dev without R2 credentials)
let _client: S3Client | null = null;

function getClient(): S3Client {
  if (_client) return _client;
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 not configured — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_KEY"
    );
  }
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return _client;
}

function getBucket(): string {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new Error("R2_BUCKET env var not set");
  return bucket;
}

function getPublicUrl(): string {
  const url = process.env.R2_PUBLIC_URL;
  if (!url) throw new Error("R2_PUBLIC_URL env var not set");
  return url.replace(/\/$/, ""); // strip trailing slash
}

/**
 * Upload a buffer to R2.
 * Returns the public CDN URL for the stored object.
 *
 * @param buffer   Raw image bytes
 * @param mimeType e.g. "image/webp"
 * @param folder   e.g. "sites", "attractions" — organises objects in the bucket
 */
export async function uploadToR2(
  buffer: Buffer,
  mimeType: string,
  folder: string = "images"
): Promise<string> {
  const ext = mimeType === "image/webp" ? "webp"
            : mimeType === "image/png"  ? "png"
            : mimeType === "image/gif"  ? "gif"
            : "jpg";
  const key = `${folder}/${uuidv4()}.${ext}`;

  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      // Served publicly via R2 dev URL — no signed URL needed
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return `${getPublicUrl()}/${key}`;
}

/**
 * Delete an object from R2 by its full public URL.
 * Safe to call even if the URL is not an R2 URL — will no-op.
 */
export async function deleteFromR2(publicUrl: string): Promise<void> {
  const base = getPublicUrl();
  if (!publicUrl.startsWith(base)) return; // not an R2 URL, skip
  const key = publicUrl.slice(base.length + 1); // strip leading slash
  try {
    await getClient().send(
      new DeleteObjectCommand({ Bucket: getBucket(), Key: key })
    );
  } catch (err) {
    console.warn("[R2] deleteFromR2 failed for key:", key, err);
  }
}

/**
 * Returns true if R2 env vars are present — used to decide whether to
 * fall back to base64 storage when running locally without credentials.
 */
export function isR2Configured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_KEY &&
    process.env.R2_BUCKET &&
    process.env.R2_PUBLIC_URL
  );
}
