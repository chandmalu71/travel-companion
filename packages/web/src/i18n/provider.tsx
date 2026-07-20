'use client';

import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { I18nContext } from './index';
import enTranslations from './en.json';
import { api } from '@/lib/api';

interface I18nProviderProps {
  children: ReactNode;
  initialLanguage?: string;
  initialLocale?: string;
}

interface LocaleConfig {
  dateFormat: string;
  timeFormat: string;
  numberFormat: string;
  defaultCurrency: string;
  units: string;
}

export function I18nProvider({ children, initialLanguage = 'en', initialLocale = 'en-GB' }: I18nProviderProps) {
  const [language, setLanguage] = useState(initialLanguage);
  const [translations, setTranslations] = useState<Record<string, string>>(enTranslations);
  const [localeConfig, setLocaleConfig] = useState<LocaleConfig>({
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    numberFormat: '1,000.00',
    defaultCurrency: 'GBP',
    units: 'metric',
  });

  // Load translations for a language
  useEffect(() => {
    if (language === 'en') {
      setTranslations(enTranslations);
      return;
    }
    // Fetch translations from API
    api.get<{ data: Record<string, string> }>(`/api/i18n/translations/${language}`)
      .then(res => {
        if (res.data && Object.keys(res.data).length > 0) {
          // Merge with English fallback
          setTranslations({ ...enTranslations, ...res.data });
        }
      })
      .catch(() => {
        // Fallback to English
        setTranslations(enTranslations);
      });
  }, [language]);

  // Load locale config
  useEffect(() => {
    api.get<{ data: any[] }>('/api/i18n/locales')
      .then(res => {
        const loc = (res.data ?? []).find((l: any) => l.code === initialLocale);
        if (loc) {
          setLocaleConfig({
            dateFormat: loc.date_format,
            timeFormat: loc.time_format,
            numberFormat: loc.number_format,
            defaultCurrency: loc.default_currency,
            units: loc.units,
          });
        }
      })
      .catch(() => {});
  }, [initialLocale]);

  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    let text = translations[key] ?? enTranslations[key as keyof typeof enTranslations] ?? key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  }, [translations]);

  const formatDate = useCallback((date: Date | string, _format?: string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    switch (localeConfig.dateFormat) {
      case 'MM/DD/YYYY': return `${month}/${day}/${year}`;
      case 'YYYY-MM-DD': return `${year}-${month}-${day}`;
      case 'DD.MM.YYYY': return `${day}.${month}.${year}`;
      case 'YYYY/MM/DD': return `${year}/${month}/${day}`;
      case 'DD-MM-YYYY': return `${day}-${month}-${year}`;
      default: return `${day}/${month}/${year}`;
    }
  }, [localeConfig.dateFormat]);

  const formatNumber = useCallback((num: number) => {
    const fmt = localeConfig.numberFormat;
    if (fmt === '1.000,00') return num.toLocaleString('de-DE', { minimumFractionDigits: 2 });
    if (fmt === '1 000,00') return num.toLocaleString('fr-FR', { minimumFractionDigits: 2 });
    if (fmt === "1'000.00") return num.toLocaleString('de-CH', { minimumFractionDigits: 2 });
    if (fmt === '1,00,000.00') return num.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    return num.toLocaleString('en-US', { minimumFractionDigits: 2 });
  }, [localeConfig.numberFormat]);

  const formatCurrency = useCallback((amount: number, currency?: string) => {
    const curr = currency ?? localeConfig.defaultCurrency;
    try {
      return amount.toLocaleString(language, { style: 'currency', currency: curr });
    } catch {
      return `${curr} ${formatNumber(amount)}`;
    }
  }, [language, localeConfig.defaultCurrency, formatNumber]);

  return (
    <I18nContext.Provider value={{ language, translations, t, formatDate, formatNumber, formatCurrency }}>
      {children}
    </I18nContext.Provider>
  );
}
