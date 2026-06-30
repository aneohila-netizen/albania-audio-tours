/**
 * CmsPageRenderer – renders any CMS page by slug.
 * Used for /#/p/:slug routes (landing pages, info pages, custom blog posts).
 * Falls back to 404 if the slug doesn't exist or the page is unpublished.
 *
 * Link rewriting: all albanianeagletours.com links in CMS page bodies are
 * normalised to the correct collection/page URLs. Any AET link that doesn't
 * match a known pattern falls back to https://albanianeagletours.com/
 */

import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Calendar, User } from "lucide-react";
import { Link } from "wouter";

// Use relative URL so it works on both albaniaudiotours.com and railway preview
const API_BASE = typeof window !== "undefined" && window.location.hostname !== "localhost"
  ? ""
  : "https://albania-audio-tours-production.up.railway.app";

interface CmsPage {
  id: number;
  slug: string;
  pageType: string;
  title: string;
  excerpt: string;
  body: string;
  coverImage: string;
  seoTitle: string;
  seoDescription: string;
  author: string;
  publishedAt: string;
  isPublished: boolean;
}

// ---------------------------------------------------------------------------
// AET link rewriting
// Exact broken URL -> correct URL mappings confirmed from live CMS data.
// Order matters: more specific patterns must come before broader ones.
// ---------------------------------------------------------------------------

/**
 * Rewrites broken albanianeagletours.com button links in an HTML string.
 *
 * Confirmed broken URLs found in CMS pages (via API inspection):
 *   /collections/city-breaks            -> /collections/albania-city-breaks
 *   /collections/car-driver             -> /collections/albania-tours-with-car-driver-included-popular
 *   /contact                            -> /pages/contact-us
 *   /collections/all                    -> /collections/guided-tours  (Book a Guided Tour)
 *
 * Fallback: any remaining albanianeagletours.com link not matching a known
 * good path is redirected to https://albanianeagletours.com/
 */
function rewriteAetLinks(html: string): string {
  let result = html;

  // 1. City Breaks: /collections/city-breaks -> correct collection
  result = result.replace(
    /https?:\/\/(?:www\.)?albanianeagletours\.com\/collections\/(?:albania-)?city-breaks(?:["'\s>])/gi,
    (match) => "https://albanianeagletours.com/collections/albania-city-breaks" + match.slice(-1)
  );

  // 2. Car & Driver: /collections/car-driver -> correct collection
  result = result.replace(
    /https?:\/\/(?:www\.)?albanianeagletours\.com\/collections\/(?:albania-tours-with-)?car-(?:and-)?driver[^"'\s>]*/gi,
    "https://albanianeagletours.com/collections/albania-tours-with-car-driver-included-popular"
  );

  // 3. Ask an Expert / Contact: /contact or /pages/contact -> /pages/contact-us
  result = result.replace(
    /https?:\/\/(?:www\.)?albanianeagletours\.com\/(?:pages\/)?contact(?!\/us)(?:["'\s>/?#]|$)/gi,
    (match) => "https://albanianeagletours.com/pages/contact-us" + (match.slice(-1).match(/["'\s>]/) ? match.slice(-1) : "")
  );

  // 4. Book a Guided Tour: /collections/all -> /collections/guided-tours
  result = result.replace(
    /https?:\/\/(?:www\.)?albanianeagletours\.com\/collections\/all(?:["'\s>/?#]|$)/gi,
    (match) => "https://albanianeagletours.com/collections/guided-tours" + (match.slice(-1).match(/["'\s>]/) ? match.slice(-1) : "")
  );

  // 5. Fallback: any remaining AET href that is NOT one of the 4 known-good URLs
  //    or a /products/ link (which may be valid specific tours) gets the homepage.
  result = result.replace(
    /href="(https?:\/\/(?:www\.)?albanianeagletours\.com\/(?!collections\/albania-city-breaks|collections\/albania-tours-with-car-driver-included-popular|pages\/contact-us|collections\/guided-tours|products\/)[^"]*)"/gi,
    'href="https://albanianeagletours.com/"'
  );

  return result;
}

export default function CmsPageRenderer() {
  const { slug } = useParams<{ slug: string }>();

  const { data: page, isLoading, isError } = useQuery<CmsPage>({
    queryKey: ["/api/cms/pages", slug],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/cms/pages/${slug}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className={`h-4 bg-muted rounded animate-pulse ${i === 0 ? "w-3/4" : "w-full"}`} />
        ))}
      </div>
    );
  }

  if (isError || !page) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-xl font-bold">Page not found</h1>
        <p className="text-muted-foreground text-sm">This page doesn't exist or isn't published yet.</p>
        <Link href="/" className="text-primary text-sm hover:underline">← Back to AlbaTour</Link>
      </div>
    );
  }

  const publishDate = page.publishedAt
    ? new Date(page.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;

  // Rewrite AET links in the body HTML before rendering
  const sanitisedBody = rewriteAetLinks(page.body || "");

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 pb-28 space-y-6">
      {/* Back */}
      <Link href="/" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit">
        <ArrowLeft size={13} /> Back
      </Link>

      {/* Cover image */}
      {page.coverImage && (
        <div className="rounded-2xl overflow-hidden" style={{ aspectRatio: "16/9" }}>
          <img
            src={page.coverImage}
            alt={page.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Title block */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold leading-snug" style={{ fontFamily: "var(--font-display)" }}>
          {page.title}
        </h1>
        {page.excerpt && (
          <p className="text-muted-foreground text-sm leading-relaxed">{page.excerpt}</p>
        )}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {page.author && (
            <span className="flex items-center gap-1">
              <User size={11} /> {page.author}
            </span>
          )}
          {publishDate && (
            <span className="flex items-center gap-1">
              <Calendar size={11} /> {publishDate}
            </span>
          )}
        </div>
      </div>

      {/* Body (HTML) – AET links have been rewritten to correct URLs */}
      <div
        className="prose prose-sm max-w-none text-sm text-foreground leading-relaxed
          prose-headings:font-bold prose-headings:text-foreground
          prose-h1:text-xl prose-h2:text-base prose-h3:text-sm
          prose-a:text-primary prose-a:no-underline hover:prose-a:underline
          prose-ul:list-disc prose-ol:list-decimal
          prose-li:text-sm prose-p:text-sm"
        dangerouslySetInnerHTML={{ __html: sanitisedBody }}
      />

      {/* Footer */}
      <div className="border-t border-border pt-6 text-center text-xs text-muted-foreground space-y-1">
        <p>AlbaTour – Albania Self-Guided Audio Tours</p>
        <p>© {new Date().getFullYear()} All Rights Reserved</p>
      </div>
    </div>
  );
}
