export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-display)" }}>Terms of Service</h1>
      <p className="text-xs text-muted-foreground mb-8">Last updated: {new Date().getFullYear()}</p>

      <div className="prose prose-sm max-w-none space-y-6 text-sm text-foreground">

        <section>
          <h2 className="font-bold text-base mb-2">Overview</h2>
          <p>This platform is operated by AlbaTour — Albania Self-Guided Audio Tours. Throughout these terms, "we", "us", and "our" refer to AlbaTour. By accessing or using this platform, including all audio tours, interactive maps, destination guides, and gamified travel features, you agree to be bound by these Terms of Service.</p>
          <p className="mt-2">These Terms apply to all users of the platform including visitors, registered users, and contributors of content.</p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">Eligibility and Use</h2>
          <p>By using this platform you confirm that you are at least the legal age of majority in your country of residence, or that you have obtained consent from a legal guardian.</p>
          <p className="mt-2">You agree not to use this platform for any illegal purpose, fraudulent activity, unauthorized commercial reproduction, or in violation of any applicable laws or regulations. Any attempt to damage, interfere with, or disrupt the operation of the platform is strictly prohibited.</p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">Nature of the Service</h2>
          <p>AlbaTour provides free self-guided audio tour content for destinations across Albania and the surrounding region. Audio content, destination descriptions, attraction guides, and tour itineraries are provided for informational and entertainment purposes to enhance your travel experience.</p>
          <p className="mt-2">AlbaTour does not operate as a travel agency, tour operator, or booking platform. No travel arrangements, transport, accommodation, or guide services are sold or guaranteed through this platform.</p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">Accuracy of Information</h2>
          <p>While AlbaTour strives to ensure that all destination descriptions, attraction details, historical information, and tour content are accurate and up to date, errors, changes in site access, and evolving local conditions may affect the accuracy of content.</p>
          <p className="mt-2">All information is provided for general travel guidance only and should not be relied upon as the sole basis for travel decisions. Opening hours, entry fees, accessibility conditions, and site availability should always be verified locally before visiting.</p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">User Safety and Responsibility</h2>
          <p>Users are solely responsible for their personal safety and the safety of companions during self-guided tours. AlbaTour tour itineraries describe walking routes, hiking trails, and outdoor locations that may involve uneven terrain, elevation, or physical exertion.</p>
          <p className="mt-2">Users should assess their own physical condition and capabilities before undertaking any tour. AlbaTour accepts no liability for injuries, accidents, or incidents that occur during self-guided exploration.</p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">Location Services and Privacy</h2>
          <p>AlbaTour may request access to your device's location to provide proximity-based features including nearby tour suggestions and geofenced audio triggers. Location data is processed locally on your device and is not stored, transmitted, or shared with third parties.</p>
          <p className="mt-2">Use of location features is entirely optional. All core platform features are accessible without enabling location services.</p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">Gamification and Points</h2>
          <p>AlbaTour includes a gamified exploration system including points, journey tracking, and a leaderboard. Points and progress data are associated with anonymous session identifiers. No monetary value is attached to points, and they confer no right to discounts, services, or rewards unless explicitly offered in a specific promotion.</p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">Intellectual Property</h2>
          <p>All audio content, tour scripts, destination descriptions, maps, logos, and design elements on this platform are the property of AlbaTour or its licensed contributors and are protected by intellectual property laws. Unauthorized reproduction, distribution, or commercial use of this content is strictly prohibited.</p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">Third-Party Links and Services</h2>
          <p>The platform may include links to third-party websites, booking platforms, or service providers for visitor convenience. AlbaTour is not responsible for the content, accuracy, or practices of such external platforms and assumes no liability for transactions conducted through them.</p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">Disclaimer of Warranties</h2>
          <p>The platform and all content are provided on an "as-is" and "as-available" basis. AlbaTour makes no guarantees that the platform will operate without interruption, or that audio content will function on all devices or in all network conditions.</p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">Limitation of Liability</h2>
          <p>To the maximum extent permitted by law, AlbaTour shall not be liable for any indirect, incidental, or consequential damages arising from use of the platform or its content. AlbaTour's total liability for any claim shall not exceed the amount paid by the user for any premium service directly related to the claim.</p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">Force Majeure</h2>
          <p>AlbaTour shall not be liable for failure or delay in performance caused by circumstances beyond its reasonable control including natural disasters, government restrictions, infrastructure failures, or similar events.</p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">Governing Law</h2>
          <p>These Terms of Service shall be governed by and interpreted in accordance with the laws of the Republic of Albania. Any disputes arising from these Terms shall fall under the jurisdiction of the competent courts of Tirana, Albania.</p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">Changes to Terms</h2>
          <p>AlbaTour reserves the right to modify or update these Terms at any time. Updated versions will be posted on this platform and will become effective immediately upon publication. Continued use of the platform after changes constitutes acceptance of the updated Terms.</p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">Contact</h2>
          <p>Questions regarding these Terms of Service may be directed to <a href="mailto:info@albaniaaudiotours.com" className="text-primary hover:underline">info@albaniaaudiotours.com</a></p>
        </section>

      </div>

      <div className="border-t border-border mt-10 pt-6 text-center text-xs text-muted-foreground">
        <p>AlbaTour — Albania Self-Guided Audio Tours · © {new Date().getFullYear()} All Rights Reserved</p>
      </div>
    </div>
  );
}
