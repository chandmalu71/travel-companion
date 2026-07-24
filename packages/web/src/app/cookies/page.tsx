'use client';

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Cookie Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: July 2026 | Version 1.0</p>

        <div className="prose prose-gray max-w-none">
          <h2>1. What Are Cookies</h2>
          <p>Cookies are small text files stored on your device when you visit a website. They help us provide you with a better experience by remembering your preferences and understanding how you use our service.</p>

          <h2>2. Cookies We Use</h2>

          <h3>Essential Cookies (Always Active)</h3>
          <p>Required for the website to function. Cannot be disabled.</p>
          <div className="not-prose my-4 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-900">Cookie</th>
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-900">Purpose</th>
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-900">Duration</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-200 px-4 py-3 text-gray-800 font-mono text-xs">neyya_session</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">Maintains your authenticated session so you stay logged in as you navigate between pages</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">24 hours</td>
                </tr>
                <tr className="bg-gray-50/50">
                  <td className="border border-gray-200 px-4 py-3 text-gray-800 font-mono text-xs">neyya_consent</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">Remembers your cookie preference choices so we don't ask again on every visit</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">1 year</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 px-4 py-3 text-gray-800 font-mono text-xs">neyya_csrf</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">Security token preventing cross-site request forgery attacks on form submissions</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">Session</td>
                </tr>
                <tr className="bg-gray-50/50">
                  <td className="border border-gray-200 px-4 py-3 text-gray-800 font-mono text-xs">neyya_chat_token</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">Identifies your AI chat session so conversation history persists across page loads</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">30 minutes</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3>Analytics Cookies (Optional)</h3>
          <p>Help us understand how visitors use the site. Only set if you consent.</p>
          <div className="not-prose my-4 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-900">Cookie</th>
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-900">Purpose</th>
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-900">Duration</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-200 px-4 py-3 text-gray-800 font-mono text-xs">_ga</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">Google Analytics — distinguishes unique users and tracks page views over time</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">2 years</td>
                </tr>
                <tr className="bg-gray-50/50">
                  <td className="border border-gray-200 px-4 py-3 text-gray-800 font-mono text-xs">_gid</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">Google Analytics — identifies user sessions and tracks which features are used</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">24 hours</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3>Marketing Cookies (Optional)</h3>
          <p>Used to deliver relevant advertising and measure campaign performance. Only set if you consent.</p>
          <div className="not-prose my-4 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-900">Cookie</th>
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-900">Purpose</th>
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-900">Duration</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-200 px-4 py-3 text-gray-800 font-mono text-xs">_fbp</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">Facebook Pixel — measures effectiveness of advertising campaigns and tracks conversions</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">90 days</td>
                </tr>
                <tr className="bg-gray-50/50">
                  <td className="border border-gray-200 px-4 py-3 text-gray-800 font-mono text-xs">_gcl_au</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">Google Ads — attributes sign-ups to specific advertising campaigns for ROI measurement</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">90 days</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3>Third-Party Cookies</h3>
          <p>Set by external services we integrate with. Governed by their own privacy policies.</p>
          <div className="not-prose my-4 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-900">Service</th>
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-900">Purpose</th>
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-900">Privacy Policy</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-200 px-4 py-3 text-gray-800 font-medium">Stripe</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">Secure payment processing for subscription billing (PCI DSS Level 1 compliant)</td>
                  <td className="border border-gray-200 px-4 py-3"><a href="https://stripe.com/privacy" className="text-primary-600 hover:underline text-xs">stripe.com/privacy</a></td>
                </tr>
                <tr className="bg-gray-50/50">
                  <td className="border border-gray-200 px-4 py-3 text-gray-800 font-medium">Google reCAPTCHA</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">Bot protection on sign-up and lead capture forms to prevent automated abuse</td>
                  <td className="border border-gray-200 px-4 py-3"><a href="https://policies.google.com/privacy" className="text-primary-600 hover:underline text-xs">google.com/privacy</a></td>
                </tr>
                <tr>
                  <td className="border border-gray-200 px-4 py-3 text-gray-800 font-medium">Google Maps</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">Interactive map display for trip destinations, POI markers, and route planning</td>
                  <td className="border border-gray-200 px-4 py-3"><a href="https://policies.google.com/privacy" className="text-primary-600 hover:underline text-xs">google.com/privacy</a></td>
                </tr>
                <tr className="bg-gray-50/50">
                  <td className="border border-gray-200 px-4 py-3 text-gray-800 font-medium">AWS Bedrock</td>
                  <td className="border border-gray-200 px-4 py-3 text-gray-600">AI-powered features (search, trip tips, chat concierge) — no data retained by AWS</td>
                  <td className="border border-gray-200 px-4 py-3"><a href="https://aws.amazon.com/privacy/" className="text-primary-600 hover:underline text-xs">aws.amazon.com/privacy</a></td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2>3. Managing Cookies</h2>
          <h3>Through Our Site</h3>
          <p>Click "Cookie Settings" in the footer to change your preferences at any time. You can accept or reject analytics and marketing cookies independently.</p>

          <h3>Through Your Browser</h3>
          <p>Most browsers allow you to block or delete cookies. Note that blocking essential cookies will prevent the site from functioning properly.</p>
          <ul>
            <li><a href="https://support.google.com/chrome/answer/95647">Chrome</a></li>
            <li><a href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer">Firefox</a></li>
            <li><a href="https://support.apple.com/guide/safari/manage-cookies-sfri11471">Safari</a></li>
          </ul>

          <h2>4. Updates</h2>
          <p>We may update this Cookie Policy as we add new services. Changes will be reflected on this page with an updated date.</p>

          <h2>5. Contact</h2>
          <p>Questions about cookies: privacy@neyya.ai</p>
        </div>
      </div>
    </div>
  );
}
