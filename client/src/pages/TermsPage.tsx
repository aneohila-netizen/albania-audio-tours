/**
 * TermsPage — loads from CMS (slug "terms"), falls back to hardcoded content.
 */
import { useQuery } from "@tanstack/react-query";

const RAILWAY_URL = "https://albania-audio-tours-production.up.railway.app";

export default function TermsPage() {
  const { data: page, isLoading, isError } = useQuery({
    queryKey: ["/api/cms/pages", "terms"],
    queryFn: async () => {
      const res = await fetch(`${RAILWAY_URL}/api/cms/pages/terms`);
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
            prose-ul:list-disc prose-li:text-sm"
          dangerouslySetInnerHTML={{ __html: page.body }}
        />
        <div className="border-t border-border mt-10 pt-6 text-center text-xs text-muted-foreground">
          <p>AlbaTour — Albania Self-Guided Audio Tours · © {new Date().getFullYear()} All Rights Reserved</p>
        </div>
      </div>
    );
  }

  // Hardcoded fallback (full original content)
  return (
    <div className="max-w-2xl mx-auto px-4 py-10 pb-28">
      <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-display)" }}>Terms of Service</h1>
      <p className="text-xs text-muted-foreground mb-8">Last updated: {new Date().getFullYear()}</p>
      <div className="prose prose-sm max-w-none space-y-6 text-sm text-foreground">
        <section><h2 className="font-bold text-base mb-2">Overview</h2><p>This platform is operated by AlbaTour — Albania Self-Guided Audio Tours. By accessing or using this platform, you agree to be bound by these Terms of Service.</p></section>
        <section><h2 className="font-bold text-base mb-2">Eligibility and Use</h2><p>By using this platform you confirm that you are at least the legal age of majority in your country of residence.</p></section>
        <section><h2 className="font-bold text-base mb-2">Nature of the Service</h2><p>AlbaTour provides free self-guided audio tour content for destinations across Albania. AlbaTour does not operate as a travel agency, tour operator, or booking platform.</p></section>
        <section><h2 className="font-bold text-base mb-2">Governing Law</h2><p>These Terms shall be governed by the laws of the Republic of Albania. Disputes fall under the jurisdiction of the courts of Tirana, Albania.</p></section>
        <section><h2 className="font-bold text-base mb-2">Contact</h2><p>Questions may be directed to <a href="mailto:info@albaniaaudiotours.com" className="text-primary hover:underline">info@albaniaaudiotours.com</a></p></section>
      </div>
      <div className="border-t border-border mt-10 pt-6 text-center text-xs text-muted-foreground">
        <p>AlbaTour — Albania Self-Guided Audio Tours · © {new Date().getFullYear()} All Rights Reserved</p>
      </div>
    </div>
  );
}
