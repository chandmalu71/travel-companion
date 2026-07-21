'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

/**
 * Hook to fetch the user's preferred display currency and exchange rates.
 * Provides conversion utilities for displaying amounts in the user's currency.
 */
export function useUserCurrency() {
  const [primaryCurrency, setPrimaryCurrency] = useState<string>('USD');
  const [displayCurrencies, setDisplayCurrencies] = useState<string[]>(['USD']);
  const [rates, setRates] = useState<Record<string, number>>({ USD: 1 });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Fetch user preferences
    api.get<{ data: { displayCurrencies?: string[] } }>('/api/users/me/preferences')
      .then((res) => {
        const currencies = res.data?.displayCurrencies;
        if (currencies && currencies.length > 0) {
          setPrimaryCurrency(currencies[0]);
          setDisplayCurrencies(currencies);
        }
      })
      .catch(() => {});

    // Fetch exchange rates
    api.get<{ data: { rates: Record<string, number> } }>('/api/i18n/exchange-rates')
      .then((res) => {
        if (res.data?.rates) {
          setRates(res.data.rates);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  /**
   * Convert an amount from one currency to another using exchange rates.
   * Rates are relative to USD, so we convert: fromCurrency → USD → toCurrency
   */
  function convert(amount: number, fromCurrency: string, toCurrency?: string): number {
    const target = toCurrency ?? primaryCurrency;
    if (fromCurrency === target) return amount;

    const fromRate = rates[fromCurrency] ?? 1;
    const toRate = rates[target] ?? 1;

    // Convert to USD first, then to target
    const amountInUsd = amount / fromRate;
    return amountInUsd * toRate;
  }

  return { primaryCurrency, displayCurrencies, rates, loaded, convert };
}
