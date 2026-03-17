import { useState, useEffect } from "react";
import { useApp } from "@/App";
import type { TourSite } from "@shared/schema";

interface VisitModalProps {
  site: TourSite;
  onClose: () => void;
}

const CONFETTI_COLORS = ["#C0392B", "#C9A227", "#0A6E8C", "#2D7A22", "#4A4A6A"];

export default function VisitModal({ site, onClose }: VisitModalProps) {
  const { t, lang } = useApp();
  const [show, setShow] = useState(false);
  const [confetti, setConfetti] = useState<Array<{ x: number; y: number; color: string; delay: number }>>([]);

  const name = lang === "al" ? site.nameAl : lang === "gr" ? site.nameGr : site.nameEn;

  useEffect(() => {
    setShow(true);
    setConfetti(
      Array.from({ length: 12 }, (_, i) => ({
        x: Math.random() * 100,
        y: Math.random() * 40,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        delay: Math.random() * 0.4,
      }))
    );
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl p-6 text-center overflow-hidden transition-all duration-500 ${show ? "scale-100 opacity-100" : "scale-90 opacity-0"}`}
        onClick={e => e.stopPropagation()}
        data-testid="visit-modal"
      >
        {/* Confetti */}
        {confetti.map((c, i) => (
          <div
            key={i}
            className="confetti-piece"
            style={{
              left: `${c.x}%`,
              top: `${c.y}px`,
              background: c.color,
              animationDelay: `${c.delay}s`,
            }}
          />
        ))}

        {/* Passport stamp */}
        <div className="relative mx-auto w-24 h-24 mb-4 flex items-center justify-center">
          <div
            className="passport-stamp absolute inset-0 rounded-full border-4 flex items-center justify-center"
            style={{ borderColor: "hsl(var(--primary))", borderStyle: "dashed" }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
              style={{ background: "hsl(var(--primary) / 0.1)" }}
            >
              {site.category === "beach" ? "🏖️" :
               site.category === "castle" ? "🏰" :
               site.category === "archaeology" ? "🏛️" :
               site.category === "nature" ? "🏔️" : "🏘️"}
            </div>
          </div>
        </div>

        <h2 className="text-xl font-bold mb-1" style={{ fontFamily: "var(--font-display)" }}>
          {t.congratulations}
        </h2>
        <p className="text-muted-foreground text-sm mb-4">{name}</p>

        {/* Points earned */}
        <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 font-bold text-lg mb-4"
          style={{ background: "linear-gradient(135deg, #C9A227, #E8B84B)", color: "#2A1A00" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1L10 6H15L11 9.5L12.5 14L8 11L3.5 14L5 9.5L1 6H6L8 1Z" />
          </svg>
          +{site.points} pts
        </div>

        {/* Fun fact */}
        {(lang === "al" ? site.funFactAl : lang === "gr" ? site.funFactGr : site.funFactEn) && (
          <div className="rounded-lg bg-muted p-3 text-sm text-left mb-4">
            <p className="font-semibold mb-1 text-xs uppercase tracking-wide" style={{ color: "hsl(var(--accent))" }}>
              {t.funFact}
            </p>
            <p className="text-muted-foreground">
              {lang === "al" ? site.funFactAl : lang === "gr" ? site.funFactGr : site.funFactEn}
            </p>
          </div>
        )}

        <button
          data-testid="visit-modal-close"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl font-semibold text-sm transition-colors"
          style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
        >
          {t.close}
        </button>
      </div>
    </div>
  );
}
