import Link from 'next/link';

export default function PrivacyPolicyPage() {
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: July 2026</p>

        <div className="prose prose-gray max-w-none space-y-6 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">1. Introduction</h2>
            <p>Neyya.ai ("we", "us", "our") operates the neyya.ai website and mobile application (the "Service"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service.</p>
            <p>By using the Service, you agree to the collection and use of information in accordance with this policy.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">2. Information We Collect</h2>
            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">2.1 Information You Provide</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Account Information:</strong> Name, email address, password when you register</li>
              <li><strong>Profile Information:</strong> Travel preferences, dietary restrictions, allergies, home location</li>
              <li><strong>Family Member Data:</strong> Names, dates of birth, passport details (encrypted), travel preferences of family members you add</li>
              <li><strong>Trip Data:</strong> Trip names, destinations, dates, bookings, expenses, documents you upload</li>
              <li><strong>Communications:</strong> Messages sent through our messaging feature</li>
              <li><strong>Payment Information:</strong> Processed by Stripe; we do not store full card numbers</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">2.2 Information Collected Automatically</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Usage Data:</strong> Pages visited, features used, clicks, session duration</li>
              <li><strong>Device Information:</strong> Browser type, operating system, screen resolution</li>
              <li><strong>Cookies:</strong> Session cookies for authentication, preference cookies for settings</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">2.3 Information from Third Parties</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>OAuth Providers:</strong> When you sign in with Google, Microsoft, or Facebook, we receive your name, email, and profile picture</li>
              <li><strong>Email Integration:</strong> When you connect Gmail or Outlook, we scan for travel booking confirmations only</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>To provide and maintain the Service</li>
              <li>To extract and organize your travel bookings from email</li>
              <li>To provide AI-powered travel tips and recommendations</li>
              <li>To manage your subscription and process payments</li>
              <li>To send transactional emails (verification, password reset, trip invitations)</li>
              <li>To improve the Service through anonymous usage analytics</li>
              <li>To detect and prevent fraud or abuse</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">4. Data Security</h2>
            <p>We implement appropriate security measures to protect your data:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Sensitive data (passport numbers) encrypted with AES-256-GCM</li>
              <li>Passwords hashed with secure algorithms</li>
              <li>All data transmitted over HTTPS/TLS</li>
              <li>Access controls and authentication on all API endpoints</li>
              <li>Regular security reviews</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">5. Data Sharing</h2>
            <p>We do not sell your personal data. We may share information with:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Service Providers:</strong> AWS (hosting), Stripe (payments), email delivery services</li>
              <li><strong>Trip Collaborators:</strong> Other users you invite to shared trips (only trip-related data)</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">6. Your Rights (GDPR)</h2>
            <p>If you are in the European Economic Area, you have the right to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Rectification:</strong> Correct inaccurate data</li>
              <li><strong>Erasure:</strong> Request deletion of your data ("right to be forgotten")</li>
              <li><strong>Portability:</strong> Export your data in a machine-readable format</li>
              <li><strong>Restriction:</strong> Limit how we process your data</li>
              <li><strong>Objection:</strong> Object to processing based on legitimate interests</li>
            </ul>
            <p className="mt-2">To exercise these rights, contact us at <a href="mailto:privacy@neyya.ai" className="text-primary-600 hover:underline">privacy@neyya.ai</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">7. Data Retention</h2>
            <p>We retain your data for as long as your account is active. Upon account deletion:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Personal profile data: deleted within 30 days</li>
              <li>Trip and booking data: deleted within 30 days</li>
              <li>Encrypted passport data: immediately destroyed</li>
              <li>Usage analytics: anonymized and retained for service improvement</li>
              <li>Payment records: retained as required by tax law (up to 7 years)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">8. Cookies</h2>
            <p>We use essential cookies for authentication and session management. We use analytics cookies to understand how users interact with the Service. You can control cookies through your browser settings.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">9. Children</h2>
            <p>The Service is not intended for children under 16. We do not knowingly collect data from children under 16. Family member profiles for children are created and managed by their parent/guardian.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">10. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of significant changes via email or in-app notification. Continued use of the Service after changes constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">11. Contact Us</h2>
            <p>If you have questions about this Privacy Policy or your data:</p>
            <ul className="list-none pl-0 space-y-1">
              <li><strong>Email:</strong> <a href="mailto:privacy@neyya.ai" className="text-primary-600 hover:underline">privacy@neyya.ai</a></li>
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
            <Link href="/" className="hover:underline">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
