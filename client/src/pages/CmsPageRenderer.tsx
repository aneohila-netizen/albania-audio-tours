/**
 * CmsPageRenderer — renders any CMS page by slug.
 * Used for /#/p/:slug routes (landing pages, info pages, custom blog posts).
 * Falls back to 404 if the slug doesn't exist or the page is unpublished.
 */

import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Calendar, User } from "lucide-react";
import { Link } from "wouter";

const RAILWAY_URL = "https://albania-audio-tours-production.up.railway.app";

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

export default function CmsPageRenderer() {
  const { slug } = useParams<{ slug: string }>();

  const { data: page, isLoading, isError } = useQuery<CmsPage>({
    queryKey: ["/api/cms/pages", slug],
    queryFn: async () => {
      const res = await fetch(`${RAILWAY_URL}/api/cms/pages/${slug}`);
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
        <Link href="/" className="text-primary text-sm hover:underline">← Back to Home</Link>
      </div>
    );
  }

  const publishDate = page.publishedAt
    ? new Date(page.publishedAt).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })
    : "";

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 pb-28 space-y-6">
      {/* Back */}
      <Link href="/" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit">
        <ArrowLeft size={13} /> Back
      </Link>

      {/* Cover image */}
      {page.coverImage && (
        <div className="rounded-2xl overflow-hidden aspect-[16/7]">
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

      {/* Body (HTML) */}
      <div
        className="prose prose-sm max-w-none text-sm text-foreground leading-relaxed
          prose-headings:font-bold prose-headings:text-foreground
          prose-h1:text-xl prose-h2:text-base prose-h3:text-sm
          prose-a:text-primary prose-a:no-underline hover:prose-a:underline
          prose-ul:list-disc prose-ol:list-decimal
          prose-li:text-sm prose-p:text-sm"
        dangerouslySetInnerHTML={{ __html: page.body }}
      />

      {/* Footer */}
      <div className="border-t border-border pt-6 text-center text-xs text-muted-foreground space-y-1">
        <p>AlbaTour — Albania Self-Guided Audio Tours</p>
        <p>© {new Date().getFullYear()} All Rights Reserved</p>
      </div>
    </div>
  );
}
