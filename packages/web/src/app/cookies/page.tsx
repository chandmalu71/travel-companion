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
          <table>
            <thead><tr><th>Cookie</th><th>Purpose</th><th>Duration</th></tr></thead>
            <tbody>
              <tr><td>neyya_session</td><td>Authentication session</td><td>24 hours</td></tr>
              <tr><td>neyya_consent</td><td>Stores your cookie preferences</td><td>1 year</td></tr>
              <tr><td>neyya_csrf</td><td>Security (prevents cross-site attacks)</td><td>Session</td></tr>
            </tbody>
          </table>

          <h3>Analytics Cookies (Optional)</h3>
          <p>Help us understand how visitors use the site. Only set if you consent.</p>
          <table>
            <thead><tr><th>Cookie</th><th>Purpose</th><th>Duration</th></tr></thead>
            <tbody>
              <tr><td>_ga, _gid</td><td>Google Analytics (page views, features used)</td><td>2 years / 24 hours</td></tr>
            </tbody>
          </table>

          <h3>Marketing Cookies (Optional)</h3>
          <p>Used to deliver relevant advertising and measure campaign performance. Only set if you consent.</p>
          <table>
            <thead><tr><th>Cookie</th><th>Purpose</th><th>Duration</th></tr></thead>
            <tbody>
              <tr><td>_fbp</td><td>Facebook Pixel (ad measurement)</td><td>90 days</td></tr>
              <tr><td>_gcl_au</td><td>Google Ads conversion tracking</td><td>90 days</td></tr>
            </tbody>
          </table>

          <h3>Third-Party Cookies</h3>
          <table>
            <thead><tr><th>Service</th><th>Purpose</th><th>Policy</th></tr></thead>
            <tbody>
              <tr><td>Stripe</td><td>Payment processing</td><td><a href="https://stripe.com/privacy">stripe.com/privacy</a></td></tr>
              <tr><td>Google reCAPTCHA</td><td>Bot protection</td><td><a href="https://policies.google.com/privacy">google.com/privacy</a></td></tr>
              <tr><td>Google Maps</td><td>Map display</td><td><a href="https://policies.google.com/privacy">google.com/privacy</a></td></tr>
            </tbody>
          </table>

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
