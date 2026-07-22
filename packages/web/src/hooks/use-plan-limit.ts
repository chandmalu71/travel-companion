'use client';

import { useState } from 'react';

interface PlanLimitError {
  resource: string;
  limit: number;
  current: number;
  planName: string;
  upgradeUrl: string;
  message: string;
}

/**
 * Hook to handle plan limit errors from API calls.
 * Shows an upgrade prompt when a 403 PLAN_LIMIT_REACHED response is received.
 *
 * Usage:
 *   const { checkResponse, limitError, dismissError, LimitBanner } = usePlanLimit();
 *   const res = await fetch(...);
 *   if (!checkResponse(res, await res.json())) return; // limit hit, banner shown
 */
export function usePlanLimit() {
  const [limitError, setLimitError] = useState<PlanLimitError | null>(null);

  /**
   * Check if a response is a plan limit error. Returns false if limit hit.
   */
  function checkResponse(_res: Response, data: any): boolean {
    if (data?.error === 'PLAN_LIMIT_REACHED') {
      setLimitError({
        resource: data.resource,
        limit: data.limit,
        current: data.current,
        planName: data.planName,
        upgradeUrl: data.upgradeUrl ?? '/settings#subscription',
        message: data.message,
      });
      return false;
    }
    return true;
  }

  function dismissError() {
    setLimitError(null);
  }

  return { checkResponse, limitError, dismissError };
}

/**
 * Resource-friendly display names
 */
export function getResourceDisplayName(resource: string): string {
  const names: Record<string, string> = {
    trips: 'active trips',
    expenses: 'expenses this month',
    network_connections: 'network connections',
    family_members: 'family members',
    email_aliases: 'email aliases',
    messages: 'messages today',
    ai_tips: 'AI tips per trip',
    ai_chat: 'AI chats today',
  };
  return names[resource] ?? resource;
}
