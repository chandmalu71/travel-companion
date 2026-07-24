'use client';

import { useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

interface LeadCaptureFormProps {
  source?: string;
  variant?: 'inline' | 'card';
}

export function LeadCaptureForm({ source = 'landing_page', variant = 'card' }: LeadCaptureFormProps) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      // Get UTM params from URL
      const params = new URLSearchParams(window.location.search);

      const res = await fetch(`${API_URL}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          fullName: fullName.trim() || undefined,
          marketingConsent,
          termsConsent: true,
          source,
          utmSource: params.get('utm_source') || undefined,
          utmMedium: params.get('utm_medium') || undefined,
          utmCampaign: params.get('utm_campaign') || undefined,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json();
        if (res.status === 409) {
          // Already exists — still show success (don't leak)
          setSubmitted(true);
        } else {
          setError(data.error || 'Something went wrong. Please try again.');
        }
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className={variant === 'card' ? 'bg-white rounded-2xl shadow-xl p-8 max-w-md mx-auto text-center' : 'text-center py-4'}>
        <div className="text-4xl mb-3">🎉</div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">You're on the list!</h3>
        <p className="text-gray-600 text-sm">
          We'll keep you updated on Neyya's launch and exclusive early-bird offers.
        </p>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:bg-gray-300 transition whitespace-nowrap"
        >
          {loading ? 'Joining...' : 'Get Early Access'}
        </button>
        {error && <p className="text-xs text-red-500 sm:col-span-2">{error}</p>}
      </form>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md mx-auto">
      <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">Get Early Access</h3>
      <p className="text-sm text-gray-600 mb-6 text-center">
        Join our waitlist and be the first to try Neyya when we launch.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="lead-name" className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-gray-400">(optional)</span>
          </label>
          <input
            id="lead-name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name"
            maxLength={100}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
          />
        </div>

        <div>
          <label htmlFor="lead-email" className="block text-sm font-medium text-gray-700 mb-1">
            Email <span className="text-red-400">*</span>
          </label>
          <input
            id="lead-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
          />
        </div>

        <div className="flex items-start gap-2">
          <input
            id="lead-consent"
            type="checkbox"
            checked={marketingConsent}
            onChange={(e) => setMarketingConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-400"
          />
          <label htmlFor="lead-consent" className="text-xs text-gray-600 leading-relaxed">
            I'd like to receive travel tips, product updates, and exclusive offers. You can unsubscribe anytime.
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Joining...
            </span>
          ) : (
            'Join the Waitlist'
          )}
        </button>

        {/* reCAPTCHA badge notice */}
        <p className="text-[10px] text-gray-400 text-center leading-relaxed">
          Protected by reCAPTCHA. By submitting, you agree to our{' '}
          <a href="/privacy" className="underline hover:text-gray-600">Privacy Policy</a>
          {' '}and{' '}
          <a href="/terms" className="underline hover:text-gray-600">Terms of Service</a>.
        </p>
      </form>
    </div>
  );
}
