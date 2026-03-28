import { Mail, Phone, MapPin, MessageCircle } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10 pb-28 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Contact Us</h1>
        <p className="text-muted-foreground text-sm">We're here to help. Reach out any time.</p>
      </div>

      <div className="grid gap-4">
        {/* Address */}
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

        {/* Local Phone */}
        <a
          href="tel:+355686064077"
          className="flex items-start gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Phone size={18} className="text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm mb-0.5">Local Support</p>
            <p className="text-sm text-primary">+355 68 606 4077</p>
            <p className="text-xs text-muted-foreground">Albania</p>
          </div>
        </a>

        {/* International Phone */}
        <a
          href="tel:+19047588448"
          className="flex items-start gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Phone size={18} className="text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm mb-0.5">International Support</p>
            <p className="text-sm text-primary">+1 904 758 8448</p>
            <p className="text-xs text-muted-foreground">United States</p>
          </div>
        </a>

        {/* Email */}
        <a
          href="mailto:info@albaniaaudiotours.com"
          className="flex items-start gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Mail size={18} className="text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm mb-0.5">Email</p>
            <p className="text-sm text-primary">info@albaniaaudiotours.com</p>
          </div>
        </a>

        {/* WhatsApp */}
        <a
          href="https://wa.me/355686064077"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-4 p-4 rounded-xl border border-[#25D366]/40 bg-[#25D366]/5 hover:bg-[#25D366]/10 transition-colors"
        >
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
