'use client';

import Link from 'next/link';
import { getResourceDisplayName } from '@/hooks/use-plan-limit';

interface UpgradePromptProps {
  resource: string;
  limit: number;
  current: number;
  planName: string;
  onDismiss: () => void;
}

/**
 * Upgrade prompt shown when a plan limit is reached.
 * Displays a banner with current usage and a link to upgrade.
 */
export function UpgradePrompt({ resource, limit, current, planName, onDismiss }: UpgradePromptProps) {
  const displayName = getResourceDisplayName(resource);

  return (
    <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4 mb-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <span className="text-2xl">⚡</span>
          <div>
            <h4 className="font-semibold text-amber-900">Plan limit reached</h4>
            <p className="text-sm text-amber-700 mt-1">
              You've used <strong>{current}/{limit}</strong> {displayName} on your <strong>{planName}</strong> plan.
            </p>
            <p className="text-sm text-amber-600 mt-1">
              Upgrade to unlock more capacity and premium features.
            </p>
            <Link
              href="/settings#subscription"
              className="inline-block mt-3 rounded-md bg-primary-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-primary-500"
            >
              Upgrade Plan →
            </Link>
          </div>
        </div>
        <button onClick={onDismiss} className="text-amber-400 hover:text-amber-600 text-xl leading-none">×</button>
      </div>
    </div>
  );
}
