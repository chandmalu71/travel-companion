'use client';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: July 2026 | Version 1.0</p>

        <div className="prose prose-gray max-w-none">
          <h2>1. Who We Are</h2>
          <p>Neyya.ai ("we", "us", "our") is an AI-powered travel companion platform. We are the data controller responsible for your personal data.</p>
          <p><strong>Contact:</strong> privacy@neyya.ai</p>

          <h2>2. Data We Collect</h2>
          <h3>Account Information</h3>
          <ul>
            <li>Name, email address, password (hashed)</li>
            <li>Profile preferences (language, currency, dietary needs, allergies)</li>
            <li>Subscription and billing information (processed by Stripe)</li>
          </ul>

          <h3>Trip Data</h3>
          <ul>
            <li>Trip details (destinations, dates, budgets)</li>
            <li>Bookings (flights, hotels, car rentals)</li>
            <li>Expenses and financial records</li>
            <li>Messages between trip members</li>
            <li>Photos and documents you upload</li>
          </ul>

          <h3>Technical Data</h3>
          <ul>
            <li>IP address, browser type, device information</li>
            <li>Usage analytics (pages visited, features used)</li>
            <li>Cookie data (see our Cookie Policy)</li>
          </ul>

          <h3>Email Data (if connected)</h3>
          <ul>
            <li>Booking confirmation emails (scanned for trip data extraction)</li>
            <li>We only read booking-related emails, never personal correspondence</li>
          </ul>

          <h2>3. How We Use Your Data</h2>
          <ul>
            <li><strong>Service delivery:</strong> Managing your trips, bookings, and expenses</li>
            <li><strong>AI personalisation:</strong> Generating travel tips, recommendations, and suggestions tailored to your preferences</li>
            <li><strong>Communication:</strong> Sending trip-related notifications, account updates, and (with consent) marketing emails</li>
            <li><strong>Security:</strong> Detecting fraud, preventing abuse, and protecting your account</li>
            <li><strong>Improvement:</strong> Analysing usage patterns to improve our service</li>
          </ul>

          <h2>4. Legal Basis (GDPR Article 6)</h2>
          <ul>
            <li><strong>Contract:</strong> Processing necessary to deliver the service you signed up for</li>
            <li><strong>Consent:</strong> Marketing communications, cookie analytics</li>
            <li><strong>Legitimate Interest:</strong> Security, fraud prevention, service improvement</li>
          </ul>

          <h2>5. Data Sharing</h2>
          <p>We do not sell your personal data. We share data only with:</p>
          <ul>
            <li><strong>Stripe:</strong> Payment processing (PCI-DSS compliant)</li>
            <li><strong>AWS:</strong> Cloud infrastructure hosting (EU region, encrypted)</li>
            <li><strong>Trip members:</strong> Only data you explicitly choose to share within trips</li>
          </ul>

          <h2>6. Data Security</h2>
          <ul>
            <li>All data encrypted in transit (TLS 1.3) and at rest (AES-256)</li>
            <li>Passwords hashed (never stored in plain text)</li>
            <li>Passport/ID data encrypted with separate keys</li>
            <li>Regular security audits and access controls</li>
          </ul>

          <h2>7. Data Retention</h2>
          <ul>
            <li><strong>Active accounts:</strong> Data retained while account is active</li>
            <li><strong>Deleted accounts:</strong> All personal data removed within 30 days</li>
            <li><strong>Backups:</strong> Purged within 90 days of account deletion</li>
            <li><strong>Legal obligations:</strong> Financial records retained for 7 years (tax compliance)</li>
          </ul>

          <h2>8. Your Rights (GDPR)</h2>
          <ul>
            <li><strong>Access:</strong> Request a copy of your data (Settings → Download My Data)</li>
            <li><strong>Rectification:</strong> Correct inaccurate data via your profile</li>
            <li><strong>Erasure:</strong> Delete your account and all data (Settings → Delete Account)</li>
            <li><strong>Portability:</strong> Export data in machine-readable format (JSON)</li>
            <li><strong>Object:</strong> Opt out of marketing, disable analytics</li>
            <li><strong>Restrict:</strong> Request we limit processing of your data</li>
          </ul>
          <p>To exercise these rights, email privacy@neyya.ai or use the in-app settings.</p>

          <h2>9. International Transfers</h2>
          <p>Your data is processed in the EU (AWS eu-west-1, Ireland). We do not transfer personal data outside the EEA without appropriate safeguards.</p>

          <h2>10. Children</h2>
          <p>Our service is not directed at children under 16. We do not knowingly collect data from children. Family member profiles managed by parents are stored under the parent's account.</p>

          <h2>11. Changes to This Policy</h2>
          <p>We will notify you of material changes via email and in-app notification. Continued use after notification constitutes acceptance.</p>

          <h2>12. Contact & Complaints</h2>
          <p>Data Controller: Neyya.ai<br/>Email: privacy@neyya.ai</p>
          <p>You have the right to lodge a complaint with your local Data Protection Authority.</p>
        </div>
      </div>
    </div>
  );
}
