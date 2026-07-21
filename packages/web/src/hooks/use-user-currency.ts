'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

/**
 * Hook to fetch the user's preferred display currency from their preferences.
 * Returns the primary display currency (first in the list) and all display currencies.
 */
export function useUserCurrency() {
  const [primaryCurrency, setPrimaryCurrency] = useState<string>('USD');
  const [displayCurrencies, setDisplayCurrencies] = useState<string[]>(['USD']);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.get<{ data: { displayCurrencies?: string[] } }>('/api/users/me/preferences')
      .then((res) => {
        const currencies = res.data?.displayCurrencies;
        if (currencies && currencies.length > 0) {
          setPrimaryCurrency(currencies[0]);
          setDisplayCurrencies(currencies);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  return { primaryCurrency, displayCurrencies, loaded };
}
