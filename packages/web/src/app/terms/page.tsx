'use client';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: July 2026 | Version 1.0</p>

        <div className="prose prose-gray max-w-none">
          <h2>1. Acceptance of Terms</h2>
          <p>By creating an account or using Neyya.ai ("the Service"), you agree to these Terms of Service. If you do not agree, do not use the Service.</p>

          <h2>2. Eligibility</h2>
          <p>You must be at least 16 years old to use the Service. By using Neyya.ai, you represent that you meet this requirement.</p>

          <h2>3. Account Registration</h2>
          <ul>
            <li>You must provide accurate and complete information</li>
            <li>You are responsible for maintaining the security of your account</li>
            <li>You must notify us immediately of any unauthorised access</li>
            <li>One account per person (no shared accounts)</li>
          </ul>

          <h2>4. Subscription & Billing</h2>
          <ul>
            <li>Free tier: limited features, no payment required</li>
            <li>Pro/Premium: billed monthly or annually via Stripe</li>
            <li>Prices displayed include VAT where applicable</li>
            <li>You can cancel anytime; access continues until the end of your billing period</li>
            <li>Refunds: pro-rated refund available within 14 days of upgrade (EU cooling-off period)</li>
          </ul>

          <h2>5. Acceptable Use</h2>
          <p>You agree NOT to:</p>
          <ul>
            <li>Use the Service for illegal purposes</li>
            <li>Upload malicious content, spam, or harmful material</li>
            <li>Attempt to access other users' accounts or data</li>
            <li>Reverse engineer, scrape, or misuse the Service</li>
            <li>Use automated tools to create accounts or submit data</li>
            <li>Share content that is defamatory, obscene, or violates others' rights</li>
          </ul>

          <h2>6. Your Content</h2>
          <ul>
            <li>You retain ownership of all content you upload (trips, photos, documents)</li>
            <li>You grant us a limited licence to process your content to deliver the Service</li>
            <li>We will never sell or share your content with third parties for their benefit</li>
            <li>You are responsible for ensuring you have rights to content you upload</li>
          </ul>

          <h2>7. AI-Generated Content</h2>
          <ul>
            <li>Trip tips, suggestions, and AI-generated text are for informational purposes only</li>
            <li>We do not guarantee the accuracy of AI-generated content</li>
            <li>Always verify critical information (flight times, visa requirements) with official sources</li>
          </ul>

          <h2>8. Limitation of Liability</h2>
          <p>To the maximum extent permitted by law:</p>
          <ul>
            <li>The Service is provided "as is" without warranties</li>
            <li>We are not liable for missed flights, incorrect bookings, or travel disruptions</li>
            <li>Our total liability is limited to the amount you paid in the last 12 months</li>
            <li>We are not liable for indirect, incidental, or consequential damages</li>
          </ul>

          <h2>9. Termination</h2>
          <ul>
            <li><strong>By you:</strong> Delete your account anytime from Settings</li>
            <li><strong>By us:</strong> We may suspend or terminate accounts that violate these Terms</li>
            <li>Upon termination, your data will be deleted per our Privacy Policy</li>
          </ul>

          <h2>10. Changes to Terms</h2>
          <p>We may update these Terms. Material changes will be notified 30 days in advance via email. Continued use constitutes acceptance.</p>

          <h2>11. Governing Law</h2>
          <p>These Terms are governed by the laws of Finland and the European Union. Disputes shall be resolved in the courts of Helsinki, Finland, unless EU consumer protection law provides otherwise.</p>

          <h2>12. Contact</h2>
          <p>Questions about these Terms: legal@neyya.ai</p>
        </div>
      </div>
    </div>
  );
}
