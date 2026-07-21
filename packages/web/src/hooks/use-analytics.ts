'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

let sessionId: string | null = null;
function getSessionId(): string {
  if (!sessionId) {
    sessionId = typeof window !== 'undefined'
      ? sessionStorage.getItem('analytics_session') ?? `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`
      : 'ssr';
    if (typeof window !== 'undefined') sessionStorage.setItem('analytics_session', sessionId);
  }
  return sessionId;
}

function trackEvent(eventType: string, page?: string, element?: string, metadata?: any) {
  if (typeof window === 'undefined') return;
  const token = localStorage.getItem('accessToken');
  fetch(`${API_URL}/api/analytics/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ eventType, page, element, metadata, sessionId: getSessionId() }),
  }).catch(() => {}); // fire and forget
}

/**
 * Hook to auto-track page views. Add to the dashboard layout.
 */
export function usePageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    trackEvent('page_view', pathname);
  }, [pathname]);
}

/**
 * Track a feature usage event.
 */
export function trackFeatureUse(feature: string, metadata?: any) {
  trackEvent('feature_use', undefined, feature, metadata);
}

/**
 * Track a button click.
 */
export function trackClick(element: string, page?: string) {
  trackEvent('click', page, element);
}
