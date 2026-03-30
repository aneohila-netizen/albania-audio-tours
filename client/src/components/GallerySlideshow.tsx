/**
 * GallerySlideshow — auto-advancing image slideshow for destination/attraction hero.
 *
 * Combines the hero image + gallery images into a single slideshow.
 * Auto-advances every 5 seconds. Supports manual arrow/dot navigation.
 * Falls back gracefully if no images are provided.
 *
 * DATA SAFETY NOTE: This component is read-only — it never deletes images.
 * All gallery image deletion requires x-confirm-delete: yes header on the server
 * (enforced in server/routes.ts — never modify that requirement).
 */

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

interface GallerySlideshowProps {
  imageUrl?: string | null;
  images?: string[];
  alt?: string;
  className?: string;
  /** Height class — if not set, uses 16:9 aspect ratio (industry standard) */
  heightClass?: string;
  /** Auto-advance interval in ms, default 5000 */
  interval?: number;
  /** Whether to show navigation controls */
  showControls?: boolean;
  /** Optional overlay content (placed above the image) */
  children?: React.ReactNode;
}

export default function GallerySlideshow({
  imageUrl,
  images = [],
  alt = "",
  className = "",
  heightClass = "h-64",
  interval = 5000,
  showControls = true,
  children,
}: GallerySlideshowProps) {
  // gallery[0] is always the hero. imageUrl is a fallback if gallery is empty.
  // Priority: gallery images first, then imageUrl as last resort.
  const galleryImages = images.filter(Boolean) as string[];
  const allImages = galleryImages.length > 0
    ? galleryImages
    : [imageUrl].filter(Boolean) as string[];
  const [activeIdx, setActiveIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  // Clamp index when images array shrinks
  useEffect(() => {
    if (activeIdx >= allImages.length && allImages.length > 0) {
      setActiveIdx(allImages.length - 1);
    }
  }, [allImages.length, activeIdx]);

  // Auto-advance
  useEffect(() => {
    if (allImages.length <= 1 || paused) return;
    const timer = setInterval(() => {
      setActiveIdx(i => (i + 1) % allImages.length);
    }, interval);
    return () => clearInterval(timer);
  }, [allImages.length, paused, interval]);

  const prev = useCallback(() => {
    setPaused(true);
    setActiveIdx(i => (i - 1 + allImages.length) % allImages.length);
    // Resume after 8 seconds of no interaction
    setTimeout(() => setPaused(false), 8000);
  }, [allImages.length]);

  const next = useCallback(() => {
    setPaused(true);
    setActiveIdx(i => (i + 1) % allImages.length);
    setTimeout(() => setPaused(false), 8000);
  }, [allImages.length]);

  const goTo = useCallback((idx: number) => {
    setPaused(true);
    setActiveIdx(idx);
    setTimeout(() => setPaused(false), 8000);
  }, []);

  // Use 16:9 aspect ratio (industry standard) unless caller forces a height class
  const containerStyle = heightClass
    ? undefined
    : { aspectRatio: "16 / 9" };
  // Only include default rounded-2xl when no className override is given
  // (callers may pass responsive rounding like "rounded-none sm:rounded-2xl")
  const hasCustomClass = className.trim().length > 0;
  const containerClass = `relative overflow-hidden bg-muted ${!hasCustomClass ? "rounded-2xl" : ""} ${heightClass || ""} ${className}`;

  if (allImages.length === 0) {
    // No images — render placeholder
    return (
      <div className={containerClass} style={containerStyle}>
        {children}
      </div>
    );
  }

  return (
    <div
      className={containerClass}
      style={containerStyle}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Images — stacked, only active one visible */}
      {allImages.map((src, i) => (
        <img
          key={i}
          src={src}
          alt={i === 0 ? alt : `${alt} — gallery ${i}`}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
            i === activeIdx ? "opacity-100" : "opacity-0"
          }`}
          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
          loading={i === 0 ? "eager" : "lazy"}
        />
      ))}

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />

      {/* Navigation arrows — only show with 2+ images */}
      {showControls && allImages.length > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/75 text-white flex items-center justify-center transition-colors z-10"
            aria-label="Previous image"
          >
            <ArrowLeft size={15} />
          </button>
          <button
            type="button"
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/75 text-white flex items-center justify-center transition-colors z-10"
            aria-label="Next image"
          >
            <ArrowRight size={15} />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {showControls && allImages.length > 1 && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {allImages.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              className={`rounded-full transition-all duration-300 ${
                i === activeIdx
                  ? "w-4 h-1.5 bg-white"
                  : "w-1.5 h-1.5 bg-white/50 hover:bg-white/75"
              }`}
              aria-label={`Go to image ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Slot for overlay content (title, badges, etc.) */}
      {children && (
        <div className="absolute inset-0 z-10 pointer-events-none">
          {children}
        </div>
      )}
    </div>
  );
}
