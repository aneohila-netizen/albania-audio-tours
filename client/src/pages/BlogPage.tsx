/**
 * BlogPage — public-facing blog index.
 * Lists all published blog posts from the CMS, sorted by publishedAt date.
 */

import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { BookOpen, Calendar, User, ArrowRight } from "lucide-react";

const RAILWAY_URL = "https://albaniaaudiotours.com";

interface CmsPage {
  id: number;
  slug: string;
  pageType: string;
  title: string;
  excerpt: string;
  body: string;
  coverImage: string;
  author: string;
  publishedAt: string;
  isPublished: boolean;
}

export default function BlogPage() {
  const { data: posts = [], isLoading } = useQuery<CmsPage[]>({
    queryKey: ["/api/cms/pages", "blog"],
    queryFn: async () => {
      const res = await fetch(`${RAILWAY_URL}/api/cms/pages?type=blog`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 pb-28 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <BookOpen size={18} className="text-primary" />
        </div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
          Travel Journal
        </h1>
        <p className="text-muted-foreground text-sm">
          Stories, tips, and guides from Albania's most remarkable places.
        </p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-border p-4 space-y-2">
              <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
              <div className="h-3 bg-muted rounded animate-pulse w-full" />
              <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && posts.length === 0 && (
        <div className="text-center py-16 space-y-2">
          <BookOpen size={32} className="mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">No posts yet — check back soon.</p>
        </div>
      )}

      {/* Posts grid */}
      {!isLoading && posts.length > 0 && (
        <div className="space-y-4">
          {posts.map(post => {
            const date = post.publishedAt
              ? new Date(post.publishedAt).toLocaleDateString("en-GB", {
                  year: "numeric", month: "long", day: "numeric",
                })
              : "";
            return (
              <Link key={post.id} href={`/p/${post.slug}`}>
                <a className="block rounded-2xl border border-border bg-card hover:bg-muted/40 transition-colors overflow-hidden group">
                  {post.coverImage && (
                    <div className="overflow-hidden" style={{ aspectRatio: "16/9" }}>
                      <img
                        src={post.coverImage}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  )}
                  <div className="p-4 space-y-2">
                    <h2 className="font-bold text-base leading-snug group-hover:text-primary transition-colors">
                      {post.title}
                    </h2>
                    {post.excerpt && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{post.excerpt}</p>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {post.author && (
                          <span className="flex items-center gap-1">
                            <User size={10} /> {post.author}
                          </span>
                        )}
                        {date && (
                          <span className="flex items-center gap-1">
                            <Calendar size={10} /> {date}
                          </span>
                        )}
                      </div>
                      <span className="flex items-center gap-1 text-xs text-primary font-medium">
                        Read <ArrowRight size={11} />
                      </span>
                    </div>
                  </div>
                </a>
              </Link>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-border pt-6 text-center text-xs text-muted-foreground space-y-1">
        <p>AlbaTour — Albania Self-Guided Audio Tours</p>
        <p>© {new Date().getFullYear()} All Rights Reserved</p>
      </div>
    </div>
  );
}
