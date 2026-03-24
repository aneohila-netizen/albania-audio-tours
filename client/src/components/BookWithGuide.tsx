/**
 * BookWithGuide — Non-intrusive CTA linking to Shopify booking page.
 * Only renders when shopifyUrl is set. Placed at bottom of detail pages,
 * and shown after audio completion. Never interrupts the audio experience.
 */
import { ExternalLink, Users } from "lucide-react";

interface BookWithGuideProps {
  shopifyUrl: string;
  siteName?: string;
  compact?: boolean; // compact = inline chip, default = full card
}

export default function BookWithGuide({ shopifyUrl, siteName, compact = false }: BookWithGuideProps) {
  if (!shopifyUrl) return null;

  if (compact) {
    return (
      <a
        href={shopifyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        aria-label={`Book ${siteName || "this tour"} with a local guide`}
      >
        <Users size={12} />
        Book with a guide
        <ExternalLink size={10} />
      </a>
    );
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Users size={18} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm mb-0.5">Want a richer experience?</p>
          <p className="text-xs text-muted-foreground mb-3">
            Explore {siteName || "this destination"} with a knowledgeable local expert.
            Private and small-group tours available.
          </p>
          <a
            href={shopifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
            aria-label={`Book ${siteName || "this tour"} with a local guide on AlbanianEagleTours.com`}
          >
            <ExternalLink size={14} />
            Book with a Guide
          </a>
        </div>
      </div>
    </div>
  );
}
