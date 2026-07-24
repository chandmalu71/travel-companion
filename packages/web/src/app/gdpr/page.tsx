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
          <div className="not-prose my-6 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-900">Data Type</th>
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-900">Purpose</th>
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-900">Legal Basis</th>
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-900">Retention</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-200 px-4 py-3 text-gray-800 font-medium">Account information</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">Name, email, profile — required to deliver the service and manage your account</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">Performance of contract (Art. 6(1)(b))</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">Until account deletion</td>
                </tr>
                <tr className="bg-gray-50/50">
                  <td className="border border-gray-200 px-4 py-3 text-gray-800 font-medium">Trip & booking data</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">Flights, hotels, car rentals, itineraries — core travel planning functionality</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">Performance of contract (Art. 6(1)(b))</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">Until account deletion</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 px-4 py-3 text-gray-800 font-medium">Email inbox scanning</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">Automatic extraction of booking confirmations from connected email accounts</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">Explicit consent (Art. 6(1)(a))</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">Until disconnected; raw emails deleted within 24 hours of processing</td>
                </tr>
                <tr className="bg-gray-50/50">
                  <td className="border border-gray-200 px-4 py-3 text-gray-800 font-medium">Expense & financial data</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">Amounts, merchants, currencies — budget tracking and expense splitting</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">Performance of contract (Art. 6(1)(b))</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">Until account deletion</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 px-4 py-3 text-gray-800 font-medium">Family member data</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">Names, ages, dietary needs, passport info (encrypted) — travel group management</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">Explicit consent (Art. 6(1)(a))</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">Until removed by user; passport data encrypted with AES-256-GCM</td>
                </tr>
                <tr className="bg-gray-50/50">
                  <td className="border border-gray-200 px-4 py-3 text-gray-800 font-medium">Usage analytics</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">Page views, feature usage, performance metrics — service improvement</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">Legitimate interest (Art. 6(1)(f))</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">26 months (anonymised after 14 months)</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 px-4 py-3 text-gray-800 font-medium">Marketing communications</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">Product updates, travel tips, promotional offers</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">Explicit consent (Art. 6(1)(a))</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">Until consent withdrawn (one-click unsubscribe)</td>
                </tr>
                <tr className="bg-gray-50/50">
                  <td className="border border-gray-200 px-4 py-3 text-gray-800 font-medium">Payment data</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">Subscription billing — processed by Stripe (PCI DSS compliant)</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">Performance of contract (Art. 6(1)(b))</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">Card details stored only by Stripe; billing records retained 7 years (legal obligation)</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 px-4 py-3 text-gray-800 font-medium">AI chat conversations</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">Support queries, feedback, bug reports via chat widget</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">Legitimate interest (Art. 6(1)(f))</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">12 months; anonymised after 6 months</td>
                </tr>
              </tbody>
            </table>
          </div>

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
