export default function RefundPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-display)" }}>Refund Policy</h1>
      <p className="text-xs text-muted-foreground mb-8">Last updated: {new Date().getFullYear()}</p>

      <div className="space-y-6 text-sm text-foreground">

        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
          <p className="font-semibold text-primary mb-1">Free Platform</p>
          <p className="text-muted-foreground">AlbaTour's core self-guided audio tours, destination guides, maps, and gamified features are provided free of charge. No payment is required to access standard tour content, and no refund is applicable for free services.</p>
        </div>

        <section>
          <h2 className="font-bold text-base mb-2">1. Scope of This Policy</h2>
          <p>This Refund Policy applies to any paid features, premium content, or subscription services that AlbaTour may offer. It does not apply to third-party services, external tour operators, transport providers, accommodation, or any services booked through external platforms linked from AlbaTour.</p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">2. Digital Content — General Principle</h2>
          <p>AlbaTour provides digital audio content and self-guided tour experiences. In accordance with standard digital content regulations, once audio content has been downloaded or streamed and access to the digital service has begun, refunds may not be available unless the content is materially defective or the service fails to perform as described.</p>
          <p className="mt-2">If you purchase any premium tour content and the audio does not play, the content is incomplete, or the service fails to deliver what was described, you are entitled to a full refund within 14 days of purchase.</p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">3. Cancellation by User</h2>
          <p>All cancellation requests for any paid services must be submitted in writing by email to <a href="mailto:info@albaniaaudiotours.com" className="text-primary hover:underline">info@albaniaaudiotours.com</a>.</p>
          <p className="mt-2">The standard refund schedule for paid services is as follows:</p>
          <div className="mt-3 space-y-2 border border-border rounded-xl overflow-hidden">
            {[
              ["More than 14 days before access date", "Full refund minus administrative fee"],
              ["7 to 14 days before access date", "50% refund of amount paid"],
              ["Less than 7 days before access date", "Non-refundable"],
              ["After content accessed or downloaded", "Non-refundable (unless defective)"],
            ].map(([timing, policy]) => (
              <div key={timing} className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-0">
                <div className="flex-1 text-xs font-medium">{timing}</div>
                <div className="text-xs text-muted-foreground">{policy}</div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">4. Non-Refundable Items</h2>
          <p>The following are non-refundable under all circumstances:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1 text-muted-foreground">
            <li>Administrative processing fees</li>
            <li>Payment transaction costs and currency conversion fees</li>
            <li>Digital content fully accessed or downloaded</li>
            <li>Services consumed in full</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">5. Extraordinary Circumstances</h2>
          <p>If AlbaTour is unable to provide a paid service due to extraordinary and unavoidable circumstances beyond its control — including but not limited to technical failures, platform outages, natural disasters, or government restrictions — AlbaTour will offer either a credit, an equivalent alternative service, or a full refund where operationally possible.</p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">6. Cancellation by AlbaTour</h2>
          <p>If AlbaTour discontinues a paid service or feature you have purchased, you will receive a full refund of any unused portion of your payment. AlbaTour will provide reasonable advance notice of any such discontinuation.</p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">7. Administrative Fees</h2>
          <p>All eligible refunds are subject to a non-refundable administrative processing fee of €5 to €25, depending on the transaction value, to cover payment processing, operational administration, and booking management costs.</p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">8. Refund Processing Time</h2>
          <p>Approved refunds will be processed within 7 to 14 business days of confirmation. Refunds are issued to the original payment method. Bank transfer fees or card processing charges may be deducted from the refund amount.</p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">9. Unused Content</h2>
          <p>No refund will be granted for paid content that was not accessed due to personal choice, device incompatibility not disclosed at time of purchase, or failure to use the service within the validity period without prior notification to AlbaTour.</p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">10. Limitation of Liability</h2>
          <p>AlbaTour's maximum liability in connection with any refund claim is limited to the total amount paid by the user for the specific service in question. AlbaTour is not liable for consequential damages, loss of enjoyment, travel costs, or any indirect losses arising from service issues.</p>
          <p className="mt-2">Any complaint must be communicated to AlbaTour within 10 days of the issue occurring. Failure to report promptly may limit the possibility of resolution or refund.</p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">Contact for Refund Requests</h2>
          <p>To submit a refund request or complaint, contact us at:</p>
          <div className="mt-3 p-4 rounded-xl bg-muted space-y-1">
            <p className="font-semibold">AlbaTour — Albania Self-Guided Audio Tours</p>
            <p className="text-muted-foreground">Email: <a href="mailto:info@albaniaaudiotours.com" className="text-primary hover:underline">info@albaniaaudiotours.com</a></p>
            <p className="text-muted-foreground">Phone: +355 68 606 4077</p>
            <p className="text-muted-foreground">Address: Bulevardi Gjergj Fishta Nd 26 H3, Tirana 1001, Albania</p>
          </div>
        </section>

      </div>

      <div className="border-t border-border mt-10 pt-6 text-center text-xs text-muted-foreground">
        <p>AlbaTour — Albania Self-Guided Audio Tours · © {new Date().getFullYear()} All Rights Reserved</p>
      </div>
    </div>
  );
}
