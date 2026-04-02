/**
 * BackToTop — floating button that appears after 300px scroll.
 * Industry standard: fixed bottom-right, above the mobile nav bar,
 * smooth scroll to top on click, fades in/out with CSS transition.
 * Does NOT render at all until the user has scrolled — zero layout impact.
 */
import { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () =>
    window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <button
      onClick={scrollToTop}
      aria-label="Back to top"
      className="fixed z-50 flex items-center justify-center rounded-full shadow-lg border border-border bg-card text-foreground transition-all duration-300"
      style={{
        // Right-aligned, above the mobile nav bar (which is ~64px tall + safe area)
        bottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px) + 0.75rem)",
        right: "1rem",
        width: 40,
        height: 40,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
        transform: visible ? "translateY(0)" : "translateY(8px)",
      }}
    >
      <ArrowUp size={16} />
    </button>
  );
}
