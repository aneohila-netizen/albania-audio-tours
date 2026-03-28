/**
 * ContactPage — loads content from CMS (slug "contact").
 * Falls back to hardcoded layout if the CMS page is not found.
 */
import { useQuery } from "@tanstack/react-query";
import { Mail, Phone, MapPin, MessageCircle } from "lucide-react";

const RAILWAY_URL = "https://albania-audio-tours-production.up.railway.app";

function HardcodedContact() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10 pb-28 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Contact Us</h1>
        <p className="text-muted-foreground text-sm">We're here to help. Reach out any time.</p>
      </div>
      <div className="grid gap-4">
        <div className="flex items-start gap-4 p-4 rounded-xl border border-border bg-card">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <MapPin size={18} className="text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm mb-0.5">Office Address</p>
            <p className="text-sm text-muted-foreground">
              Bulevardi Gjergj Fishta Nd 26 H3<br />
              Njesia Admin 7, Tirana 1001<br />
              Albania
            </p>
          </div>
        </div>
        <a href="tel:+355686064077" className="flex items-start gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted transition-colors">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Phone size={18} className="text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm mb-0.5">Local Support</p>
            <p className="text-sm text-primary">+355 68 606 4077</p>
            <p className="text-xs text-muted-foreground">Albania</p>
          </div>
        </a>
        <a href="tel:+19047588448" className="flex items-start gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted transition-colors">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Phone size={18} className="text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm mb-0.5">International Support</p>
            <p className="text-sm text-primary">+1 904 758 8448</p>
            <p className="text-xs text-muted-foreground">United States</p>
          </div>
        </a>
        <a href="mailto:info@albaniaaudiotours.com" className="flex items-start gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted transition-colors">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Mail size={18} className="text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm mb-0.5">Email</p>
            <p className="text-sm text-primary">info@albaniaaudiotours.com</p>
          </div>
        </a>
        <a href="https://wa.me/355686064077" target="_blank" rel="noopener noreferrer"
          className="flex items-start gap-4 p-4 rounded-xl border border-[#25D366]/40 bg-[#25D366]/5 hover:bg-[#25D366]/10 transition-colors">
          <div className="w-10 h-10 rounded-full bg-[#25D366]/20 flex items-center justify-center shrink-0">
            <MessageCircle size={18} style={{ color: "#25D366" }} />
          </div>
          <div>
            <p className="font-semibold text-sm mb-0.5">WhatsApp</p>
            <p className="text-sm" style={{ color: "#25D366" }}>+355 68 606 4077</p>
            <p className="text-xs text-muted-foreground">Chat with us directly</p>
          </div>
        </a>
      </div>
      <div className="border-t border-border pt-6 text-center text-xs text-muted-foreground space-y-1">
        <p>AlbaTour — Albania Self-Guided Audio Tours</p>
        <p>© {new Date().getFullYear()} All Rights Reserved</p>
      </div>
    </div>
  );
}

export default function ContactPage() {
  const { data: page, isLoading, isError } = useQuery({
    queryKey: ["/api/cms/pages", "contact"],
    queryFn: async () => {
      const res = await fetch(`${RAILWAY_URL}/api/cms/pages/contact`);
      if (!res.ok) throw new Error("not found");
      return res.json();
    },
    retry: false,
  });

  if (isLoading) return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-3">
      {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
    </div>
  );

  // If CMS page exists and has body, render it; otherwise show hardcoded layout
  if (!isError && page?.body) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 pb-28 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{page.title}</h1>
          {page.excerpt && <p className="text-muted-foreground text-sm">{page.excerpt}</p>}
        </div>
        <div
          className="prose prose-sm max-w-none text-sm text-foreground leading-relaxed
            prose-h2:font-bold prose-h2:text-base prose-h2:mt-6 prose-h2:mb-2
            prose-a:text-primary hover:prose-a:underline prose-p:text-sm"
          dangerouslySetInnerHTML={{ __html: page.body }}
        />
        <div className="border-t border-border pt-6 text-center text-xs text-muted-foreground">
          <p>AlbaTour — Albania Self-Guided Audio Tours · © {new Date().getFullYear()} All Rights Reserved</p>
        </div>
      </div>
    );
  }

  return <HardcodedContact />;
}
