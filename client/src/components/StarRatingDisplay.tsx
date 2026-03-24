/**
 * StarRatingDisplay — Shows the average visitor rating for a site.
 * Fetches from GET /api/ratings/:siteSlug.
 * Renders filled/half/empty stars + "4.3 ★ (12 ratings)" — Google Maps style.
 * Only renders when count >= 1.
 */
import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import { RAILWAY_URL } from "@/lib/queryClient";

interface Props {
  siteSlug: string;
}

interface RatingStats {
  average: number;
  count: number;
}

export default function StarRatingDisplay({ siteSlug }: Props) {
  const [stats, setStats] = useState<RatingStats | null>(null);

  useEffect(() => {
    if (!siteSlug) return;
    fetch(`${RAILWAY_URL}/api/ratings/${encodeURIComponent(siteSlug)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data && data.count >= 1) setStats(data); })
      .catch(() => {});
  }, [siteSlug]);

  // Don't render until there's at least one real rating
  if (!stats || stats.count < 1) return null;

  const avg = stats.average;
  const count = stats.count;

  // Build 5 star icons: filled, half, or empty
  const stars = [1, 2, 3, 4, 5].map(pos => {
    const fill = avg >= pos ? "full" : avg >= pos - 0.5 ? "half" : "empty";
    return fill;
  });

  return (
    <div
      className="flex items-center gap-1.5"
      aria-label={`Average rating: ${avg} out of 5 stars from ${count} rating${count !== 1 ? "s" : ""}`}
      data-testid="star-rating-display"
    >
      {/* Stars */}
      <div className="flex items-center gap-0.5">
        {stars.map((fill, i) => (
          <span key={i} className="relative inline-flex" style={{ width: 16, height: 16 }}>
            {/* Empty base */}
            <Star
              size={16}
              fill="none"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1.5}
              className="absolute inset-0"
            />
            {/* Filled overlay — full or clipped half */}
            {fill !== "empty" && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: fill === "half" ? "50%" : "100%" }}
              >
                <Star size={16} fill="#F59E0B" stroke="#F59E0B" strokeWidth={1.5} />
              </span>
            )}
          </span>
        ))}
      </div>

      {/* Numeric average */}
      <span className="text-sm font-semibold" style={{ color: "#F59E0B" }}>
        {avg.toFixed(1)}
      </span>

      {/* Count */}
      <span className="text-xs text-muted-foreground">
        ({count} {count === 1 ? "rating" : "ratings"})
      </span>
    </div>
  );
}
