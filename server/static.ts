import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Cache policy:
  //  - /assets/* are content-hashed by Vite (a changed file gets a new name), so browsers can
  //    keep them for a year without ever re-checking — repeat visits and page changes no
  //    longer pay a round trip per script/stylesheet.
  //  - index.html must always be revalidated so a new deploy is picked up immediately (the
  //    ETag makes the check cheap).
  //  - images / icons / mascot art: one day.
  app.use(express.static(distPath, {
    setHeaders(res, filePath) {
      const rel = path.relative(distPath, filePath).split(path.sep).join("/");
      if (rel.startsWith("assets/")) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      } else if (rel.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache");
      } else if (/\.(png|jpe?g|webp|gif|svg|ico|woff2?)$/i.test(rel)) {
        res.setHeader("Cache-Control", "public, max-age=86400");
      }
    },
  }));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
