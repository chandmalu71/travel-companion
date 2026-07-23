'use client';

import Link from 'next/link';

export default function GdprPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">GDPR Compliance</h1>
        <p className="text-sm text-gray-500 mb-8">Your data rights under the General Data Protection Regulation</p>

        <div className="prose prose-gray max-w-none">
          <h2>Your Rights Under GDPR</h2>
          <p>As a user of Neyya.ai, you have the following rights regarding your personal data under the EU General Data Protection Regulation (GDPR):</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 not-prose my-6">
            <div className="rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-1">Right of Access (Art. 15)</h3>
              <p className="text-sm text-gray-600">You can request a copy of all personal data we hold about you.</p>
              <p className="text-xs text-primary-600 mt-2">Settings → Download My Data</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-1">Right to Rectification (Art. 16)</h3>
              <p className="text-sm text-gray-600">You can correct any inaccurate or incomplete personal data.</p>
              <p className="text-xs text-primary-600 mt-2">Settings → Edit Profile</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-1">Right to Erasure (Art. 17)</h3>
              <p className="text-sm text-gray-600">You can request deletion of all your personal data ("right to be forgotten").</p>
              <p className="text-xs text-primary-600 mt-2">Settings → Delete Account</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-1">Right to Portability (Art. 20)</h3>
              <p className="text-sm text-gray-600">You can export your data in a machine-readable format (JSON).</p>
              <p className="text-xs text-primary-600 mt-2">Settings → Export Data</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-1">Right to Object (Art. 21)</h3>
              <p className="text-sm text-gray-600">You can object to processing for marketing or profiling purposes.</p>
              <p className="text-xs text-primary-600 mt-2">Settings → Marketing Preferences</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-1">Right to Restrict (Art. 18)</h3>
              <p className="text-sm text-gray-600">You can request we limit how we process your data.</p>
              <p className="text-xs text-primary-600 mt-2">Contact: privacy@neyya.ai</p>
            </div>
          </div>

          <h2>How We Protect Your Data</h2>
          <ul>
            <li><strong>Encryption:</strong> All data encrypted in transit (TLS 1.3) and at rest (AES-256)</li>
            <li><strong>EU Hosting:</strong> Data stored in AWS eu-west-1 (Ireland) — never leaves the EEA</li>
            <li><strong>Minimal Collection:</strong> We only collect data necessary to provide the service</li>
            <li><strong>No Selling:</strong> We never sell your personal data to third parties</li>
            <li><strong>Access Controls:</strong> Strict internal access policies and audit logging</li>
            <li><strong>Regular Audits:</strong> Security practices reviewed quarterly</li>
          </ul>

          <h2>Data Processing</h2>
          <table>
            <thead>
              <tr><th>Data Type</th><th>Purpose</th><th>Legal Basis</th><th>Retention</th></tr>
            </thead>
            <tbody>
              <tr><td>Account info</td><td>Service delivery</td><td>Contract</td><td>Until deletion</td></tr>
              <tr><td>Trip data</td><td>Core service</td><td>Contract</td><td>Until deletion</td></tr>
              <tr><td>Email scans</td><td>Booking import</td><td>Consent</td><td>Until disconnected</td></tr>
              <tr><td>Analytics</td><td>Service improvement</td><td>Legitimate interest</td><td>26 months</td></tr>
              <tr><td>Marketing</td><td>Product updates</td><td>Consent</td><td>Until withdrawn</td></tr>
            </tbody>
          </table>

          <h2>Data Controller</h2>
          <p>
            <strong>Neyya.ai</strong><br />
            Email: privacy@neyya.ai<br />
            For GDPR requests, we respond within 30 days.
          </p>

          <h2>Supervisory Authority</h2>
          <p>You have the right to lodge a complaint with your local Data Protection Authority. For Finland: <a href="https://tietosuoja.fi/en" target="_blank" rel="noopener">Office of the Data Protection Ombudsman</a>.</p>

          <h2>Related Policies</h2>
          <ul>
            <li><Link href="/privacy" className="text-primary-600 hover:underline">Privacy Policy</Link> — full details on data collection and use</li>
            <li><Link href="/terms" className="text-primary-600 hover:underline">Terms of Service</Link> — usage rules and account terms</li>
            <li><Link href="/cookies" className="text-primary-600 hover:underline">Cookie Policy</Link> — cookies we use and how to manage them</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
