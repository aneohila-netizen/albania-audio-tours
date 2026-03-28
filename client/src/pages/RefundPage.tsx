/**
 * RefundPage — loads from CMS (slug "refund-policy"), falls back to hardcoded.
 */
import { useQuery } from "@tanstack/react-query";

const RAILWAY_URL = "https://albania-audio-tours-production.up.railway.app";

export default function RefundPage() {
  const { data: page, isLoading, isError } = useQuery({
    queryKey: ["/api/cms/pages", "refund-policy"],
    queryFn: async () => {
      const res = await fetch(`${RAILWAY_URL}/api/cms/pages/refund-policy`);
      if (!res.ok) throw new Error("not found");
      return res.json();
    },
    retry: false,
  });

  if (isLoading) return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-3">
      {[...Array(6)].map((_, i) => <div key={i} className="h-8 bg-muted rounded animate-pulse" />)}
    </div>
  );

  if (!isError && page?.body) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 pb-28">
        <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-display)" }}>{page.title}</h1>
        <p className="text-xs text-muted-foreground mb-8">Last updated: {new Date().getFullYear()}</p>
        <div
          className="prose prose-sm max-w-none space-y-4 text-sm text-foreground leading-relaxed
            prose-h2:font-bold prose-h2:text-base prose-h2:mt-6 prose-h2:mb-2
            prose-a:text-primary hover:prose-a:underline prose-p:text-sm
            prose-ul:list-disc prose-li:text-sm prose-table:text-sm"
          dangerouslySetInnerHTML={{ __html: page.body }}
        />
        <div className="border-t border-border mt-10 pt-6 text-center text-xs text-muted-foreground">
          <p>AlbaTour — Albania Self-Guided Audio Tours · © {new Date().getFullYear()} All Rights Reserved</p>
        </div>
      </div>
    );
  }

  // Hardcoded fallback
  return (
    <div className="max-w-2xl mx-auto px-4 py-10 pb-28">
      <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-display)" }}>Refund Policy</h1>
      <p className="text-xs text-muted-foreground mb-8">Last updated: {new Date().getFullYear()}</p>
      <div className="space-y-6 text-sm text-foreground">
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
          <p className="font-semibold text-primary mb-1">Free Platform</p>
          <p className="text-muted-foreground">AlbaTour's core features are provided free of charge. No refund is applicable for free services.</p>
        </div>
        <section><h2 className="font-bold text-base mb-2">Scope</h2><p>This policy applies to paid features and subscription services AlbaTour may offer in the future.</p></section>
        <section><h2 className="font-bold text-base mb-2">Contact</h2><p>Email: <a href="mailto:info@albaniaaudiotours.com" className="text-primary hover:underline">info@albaniaaudiotours.com</a></p></section>
      </div>
      <div className="border-t border-border mt-10 pt-6 text-center text-xs text-muted-foreground">
        <p>AlbaTour — Albania Self-Guided Audio Tours · © {new Date().getFullYear()} All Rights Reserved</p>
      </div>
    </div>
  );
}
