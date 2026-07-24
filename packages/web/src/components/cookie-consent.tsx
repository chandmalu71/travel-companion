'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type ConsentLevel = 'all' | 'essential' | 'custom';

interface CookiePreferences {
  essential: true; // Always true, can't be disabled
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
}

const CONSENT_KEY = 'neyya_consent';

function getStoredConsent(): CookiePreferences | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function saveConsent(prefs: CookiePreferences) {
  localStorage.setItem(CONSENT_KEY, JSON.stringify(prefs));
  // Also set a cookie so the server can read it
  document.cookie = `neyya_consent=${encodeURIComponent(JSON.stringify(prefs))};path=/;max-age=${365 * 24 * 60 * 60};SameSite=Lax`;
}

export function getConsent(): CookiePreferences | null {
  return getStoredConsent();
}

export function hasAnalyticsConsent(): boolean {
  return getStoredConsent()?.analytics ?? false;
}

export function hasMarketingConsent(): boolean {
  return getStoredConsent()?.marketing ?? false;
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    // Don't show for logged-in users (they accepted Terms at registration)
    if (typeof window !== 'undefined' && localStorage.getItem('accessToken')) {
      return;
    }

    // Show banner if no consent stored (anonymous visitors only)
    const existing = getStoredConsent();
    if (!existing) {
      // Delay slightly to not flash on page load
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = (level: ConsentLevel) => {
    let prefs: CookiePreferences;

    switch (level) {
      case 'all':
        prefs = { essential: true, analytics: true, marketing: true, timestamp: new Date().toISOString() };
        break;
      case 'essential':
        prefs = { essential: true, analytics: false, marketing: false, timestamp: new Date().toISOString() };
        break;
      case 'custom':
        prefs = { essential: true, analytics, marketing, timestamp: new Date().toISOString() };
        break;
    }

    saveConsent(prefs);
    setVisible(false);

    // Dispatch event so other components can react
    window.dispatchEvent(new CustomEvent('cookie-consent-updated', { detail: prefs }));
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] p-4 sm:p-6" role="dialog" aria-label="Cookie consent">
      <div className="max-w-4xl mx-auto rounded-xl bg-white dark:bg-gray-800 shadow-2xl border border-gray-200 dark:border-gray-700 p-5 sm:p-6">
        {!showDetails ? (
          /* ─── Simple View ─────────────────────────────────────────── */
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                We use cookies to improve your experience, analyse site usage, and support our marketing.
                You can accept all, reject non-essential, or customise your preferences.{' '}
                <Link href="/cookies" className="text-primary-600 dark:text-primary-400 hover:underline">
                  Cookie Policy
                </Link>
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                onClick={() => accept('essential')}
                className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Reject All
              </button>
              <button
                onClick={() => setShowDetails(true)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Manage
              </button>
              <button
                onClick={() => accept('all')}
                className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 transition-colors"
              >
                Accept All
              </button>
            </div>
          </div>
        ) : (
          /* ─── Detail View ─────────────────────────────────────────── */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Cookie Preferences</h3>
              <button onClick={() => setShowDetails(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              {/* Essential — always on */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Essential Cookies</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Required for the website to function (authentication, security, preferences)</p>
                </div>
                <div className="shrink-0">
                  <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded">Always on</span>
                </div>
              </div>

              {/* Analytics */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Analytics Cookies</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Help us understand how visitors use the site (Google Analytics)</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={analytics}
                    onChange={(e) => setAnalytics(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-300 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-500" />
                </label>
              </div>

              {/* Marketing */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Marketing Cookies</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Used to measure advertising effectiveness (Facebook Pixel, Google Ads)</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={marketing}
                    onChange={(e) => setMarketing(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-300 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-500" />
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => accept('essential')}
                className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Reject All
              </button>
              <button
                onClick={() => accept('custom')}
                className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 transition-colors"
              >
                Save Preferences
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
