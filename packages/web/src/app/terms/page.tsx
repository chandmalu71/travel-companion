import Link from 'next/link';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 py-4 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo-header.svg" alt="Neyya" className="h-9" />
          </Link>
          <Link href="/" className="text-sm text-primary-600 hover:underline">Back to Home</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: July 2026</p>

        <div className="prose prose-gray max-w-none space-y-6 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">1. Acceptance of Terms</h2>
            <p>By creating an account or using Neyya.ai (the "Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not access or use the Service.</p>
            <p>We may modify these Terms at any time. Material changes will be communicated 30 days in advance. Continued use after notification constitutes acceptance of the updated Terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">2. Eligibility</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>You must be at least 16 years old to create an account</li>
              <li>You must provide accurate, complete, and current registration information</li>
              <li>One account per person; shared accounts are not permitted</li>
              <li>You are responsible for maintaining the confidentiality of your password</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">3. Service Description</h2>
            <p>Neyya.ai provides an AI-powered travel companion platform including:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Trip planning and itinerary management</li>
              <li>Automated booking import from email</li>
              <li>Expense tracking and splitting</li>
              <li>AI-generated travel recommendations and tips</li>
              <li>Collaborative group trip features</li>
              <li>Weather and destination information</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">4. Subscription & Billing</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Free Tier:</strong> Core features with usage limits, no payment required</li>
              <li><strong>Pro & Premium:</strong> Billed monthly or annually via Stripe</li>
              <li><strong>Trial:</strong> 30-day full-access trial of Premium features</li>
              <li><strong>Prices:</strong> Displayed inclusive of applicable VAT/tax</li>
              <li><strong>Cancellation:</strong> Cancel anytime; access continues until billing period ends</li>
              <li><strong>Refunds:</strong> Pro-rated refund available within 14 days of upgrade (EU consumer cooling-off period)</li>
              <li><strong>Price Changes:</strong> 30 days advance notice for existing subscribers</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">5. Acceptable Use</h2>
            <p>You agree NOT to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Use the Service for any illegal or unauthorised purpose</li>
              <li>Upload malicious content, spam, viruses, or harmful material</li>
              <li>Attempt to access other users' accounts or data</li>
              <li>Reverse engineer, decompile, or scrape the Service</li>
              <li>Use automated tools (bots) to create accounts or submit data</li>
              <li>Share content that is defamatory, obscene, or violates others' rights</li>
              <li>Circumvent usage limits or plan restrictions</li>
              <li>Resell or redistribute the Service without authorisation</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">6. Your Content</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>You retain full ownership of all content you upload (trips, photos, documents)</li>
              <li>You grant us a limited, non-exclusive licence to process your content solely to deliver the Service</li>
              <li>We will never sell, share, or use your content for advertising purposes</li>
              <li>You are responsible for ensuring you have rights to any content you upload</li>
              <li>We may remove content that violates these Terms or applicable law</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">7. AI-Generated Content</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Trip tips, suggestions, and AI-generated text are for <strong>informational purposes only</strong></li>
              <li>We do not guarantee the accuracy, completeness, or timeliness of AI content</li>
              <li>Always verify critical information (flight times, visa requirements, safety advisories) with official sources</li>
              <li>We are not responsible for decisions made based on AI-generated recommendations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">8. Limitation of Liability</h2>
            <p>To the maximum extent permitted by applicable law:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>The Service is provided "as is" and "as available" without warranties of any kind</li>
              <li>We are not liable for missed flights, incorrect bookings, or travel disruptions</li>
              <li>We are not liable for any indirect, incidental, special, or consequential damages</li>
              <li>Our total aggregate liability is limited to the amount you paid us in the preceding 12 months</li>
              <li>These limitations do not affect your statutory rights as a consumer under EU law</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">9. Account Termination</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>By You:</strong> Delete your account at any time from Settings. Data is removed per our Privacy Policy</li>
              <li><strong>By Us:</strong> We may suspend or terminate accounts that violate these Terms, with notice where reasonably possible</li>
              <li><strong>Effect:</strong> Upon termination, your access ends and data is deleted within 30 days (except where legally required to retain)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">10. Intellectual Property</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>The Neyya.ai name, logo, design, and software are our intellectual property</li>
              <li>You may not copy, modify, or distribute our branding or code without permission</li>
              <li>User-generated content remains your property (see Section 6)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">11. Governing Law & Disputes</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>These Terms are governed by the laws of <strong>Finland</strong> and the European Union</li>
              <li>Disputes shall be resolved in the courts of Helsinki, Finland</li>
              <li>This does not affect your rights under EU consumer protection regulations to bring proceedings in your country of residence</li>
              <li>Before court proceedings, we encourage you to contact us to resolve disputes amicably</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">12. Contact</h2>
            <p>Questions about these Terms:</p>
            <ul className="list-none pl-0 space-y-1">
              <li><strong>Email:</strong> <a href="mailto:legal@neyya.ai" className="text-primary-600 hover:underline">legal@neyya.ai</a></li>
              <li><strong>Website:</strong> <a href="https://neyya.ai" className="text-primary-600 hover:underline">neyya.ai</a></li>
            </ul>
          </section>
        </div>
      </main>

      <footer className="border-t border-gray-200 py-6 px-6 mt-12">
        <div className="max-w-4xl mx-auto text-center text-sm text-gray-500">
          <p>Neyya.ai — Your Complete AI Travel Companion</p>
          <div className="mt-2 space-x-4">
            <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
            <Link href="/terms" className="hover:underline">Terms of Service</Link>
            <Link href="/cookies" className="hover:underline">Cookie Policy</Link>
            <Link href="/gdpr" className="hover:underline">GDPR</Link>
            <Link href="/" className="hover:underline">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
