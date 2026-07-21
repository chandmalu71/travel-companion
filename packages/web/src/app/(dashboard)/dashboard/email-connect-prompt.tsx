'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

/**
 * Post-login email connection prompt.
 *
 * Shows ONCE after first login, asking user to connect their inbox
 * for automatic booking import. GDPR-compliant: explicit consent required.
 *
 * Requirement 29
 */

interface EmailConnectPromptProps {
  /** How the user logged in — determines which provider to suggest */
  loginProvider?: 'google' | 'microsoft' | 'email' | null;
}

const PROMPT_DISMISSED_KEY = 'neyya_email_prompt_dismissed';

export function EmailConnectPrompt({ loginProvider }: EmailConnectPromptProps) {
  const [visible, setVisible] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    // Check if prompt was already dismissed or email already connected
    const dismissed = localStorage.getItem(PROMPT_DISMISSED_KEY);
    if (dismissed === 'true') return;

    // Check if user already has email connections
    api.get<{ data: { connections: any[] } }>('/api/email/connections')
      .then((res) => {
        if (!res.data?.connections?.length) {
          // No connections — show prompt
          setVisible(true);
        } else {
          // Already connected — don't show again
          localStorage.setItem(PROMPT_DISMISSED_KEY, 'true');
        }
      })
      .catch(() => {
        // If API fails, still show the prompt
        setVisible(true);
      });
  }, []);

  function handleDismiss() {
    setVisible(false);
    localStorage.setItem(PROMPT_DISMISSED_KEY, 'true');
    // Also save to server so it persists across devices
    api.put('/api/users/me/preferences', { emailConnectPromptDismissed: true }).catch(() => {});
  }

  async function handleConnect() {
    setConnecting(true);

    if (loginProvider === 'google') {
      // In production: redirect to Google OAuth with gmail.readonly scope
      // For now: navigate to email connections page
      window.location.href = '/settings/email-connections';
    } else if (loginProvider === 'microsoft') {
      window.location.href = '/settings/email-connections';
    } else {
      window.location.href = '/settings/email-connections';
    }
  }

  if (!visible) return null;

  // Determine provider-specific messaging
  const providerInfo = getProviderInfo(loginProvider);

  return (
    <div className="rounded-xl border border-primary-200 bg-gradient-to-r from-primary-50 to-white p-5 shadow-sm mb-6 animate-in fade-in slide-in-from-top-2 duration-500">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-2xl">
          {providerInfo.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900">
            Import your bookings automatically?
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            {providerInfo.description}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            We only read travel-related emails (booking confirmations).
            You can disconnect anytime in Settings.
          </p>

          {/* Actions */}
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="inline-flex items-center gap-2 rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-600 transition-colors disabled:opacity-50"
            >
              {connecting ? (
                'Connecting...'
              ) : (
                <>
                  {providerInfo.buttonIcon} {providerInfo.buttonText}
                </>
              )}
            </button>
            <button
              onClick={handleDismiss}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Not now
            </button>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Dismiss"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function getProviderInfo(loginProvider?: string | null) {
  switch (loginProvider) {
    case 'google':
      return {
        icon: '📧',
        description: 'You signed in with Google. We can scan your Gmail for flight, hotel, and car rental confirmations and add them to your trips.',
        buttonText: 'Connect Gmail',
        buttonIcon: '📧',
      };
    case 'microsoft':
      return {
        icon: '📬',
        description: 'You signed in with Microsoft. We can scan your Outlook for booking confirmations and add them to your trips.',
        buttonText: 'Connect Outlook',
        buttonIcon: '📬',
      };
    default:
      return {
        icon: '✉️',
        description: 'Connect your email and we\'ll automatically find booking confirmations (flights, hotels, car rentals) and add them to your trips.',
        buttonText: 'Connect Email',
        buttonIcon: '✉️',
      };
  }
}
