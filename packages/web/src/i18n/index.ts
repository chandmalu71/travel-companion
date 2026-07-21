'use client';

import { createContext, useContext } from 'react';
import enTranslations from './en.json';

// Type for translation keys
export type TranslationKey = keyof typeof enTranslations;

// Translation context
interface I18nContextValue {
  language: string;
  translations: Record<string, string>;
  t: (key: string, params?: Record<string, string | number>) => string;
  formatDate: (date: Date | string, format?: string) => string;
  formatNumber: (num: number) => string;
  formatCurrency: (amount: number, currency?: string) => string;
}

const defaultTranslations: Record<string, string> = enTranslations;

export const I18nContext = createContext<I18nContextValue>({
  language: 'en',
  translations: defaultTranslations,
  t: (key: string) => defaultTranslations[key] ?? key,
  formatDate: (date) => String(date),
  formatNumber: (num) => String(num),
  formatCurrency: (amount, currency) => {
    const curr = currency ?? 'USD';
    try {
      return amount.toLocaleString('en', { style: 'currency', currency: curr });
    } catch {
      return `${curr} ${amount.toFixed(2)}`;
    }
  },
});

export function useTranslation() {
  const ctx = useContext(I18nContext);
  return ctx;
}

// Simple translation function (no context needed for static usage)
export function t(key: string, params?: Record<string, string | number>): string {
  let text = defaultTranslations[key] ?? key;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, String(v));
    });
  }
  return text;
}
