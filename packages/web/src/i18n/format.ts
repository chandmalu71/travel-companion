/**
 * Locale-aware formatting utilities.
 * Used throughout the app to format dates, numbers, currencies, and units
 * according to the user's locale preferences.
 */

export interface FormatConfig {
  dateFormat: string;    // 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'DD.MM.YYYY'
  timeFormat: string;    // '24h' or '12h'
  numberFormat: string;  // '1,000.00', '1.000,00', '1 000,00'
  currency: string;      // 'EUR', 'USD', etc.
  units: string;         // 'metric' or 'imperial'
  language: string;      // 'en', 'de', 'fr', etc.
}

const DEFAULT_CONFIG: FormatConfig = {
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24h',
  numberFormat: '1,000.00',
  currency: 'EUR',
  units: 'metric',
  language: 'en',
};

export function formatDate(date: Date | string | null, config: Partial<FormatConfig> = {}): string {
  if (!date) return '—';
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  switch (cfg.dateFormat) {
    case 'MM/DD/YYYY': return `${month}/${day}/${year}`;
    case 'YYYY-MM-DD': return `${year}-${month}-${day}`;
    case 'DD.MM.YYYY': return `${day}.${month}.${year}`;
    case 'YYYY/MM/DD': return `${year}/${month}/${day}`;
    case 'DD-MM-YYYY': return `${day}-${month}-${year}`;
    default: return `${day}/${month}/${year}`;
  }
}

export function formatTime(date: Date | string | null, config: Partial<FormatConfig> = {}): string {
  if (!date) return '—';
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';

  if (cfg.timeFormat === '12h') {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatNumber(num: number | null, config: Partial<FormatConfig> = {}): string {
  if (num === null || num === undefined) return '—';
  const cfg = { ...DEFAULT_CONFIG, ...config };

  switch (cfg.numberFormat) {
    case '1.000,00': return num.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case '1 000,00': return num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case "1'000.00": return num.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case '1,00,000.00': return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    default: return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}

export function formatCurrency(amount: number | null, currency?: string, config: Partial<FormatConfig> = {}): string {
  if (amount === null || amount === undefined) return '—';
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const curr = currency ?? cfg.currency;

  try {
    const locale = getLocaleForLanguage(cfg.language);
    return new Intl.NumberFormat(locale, { style: 'currency', currency: curr }).format(amount);
  } catch {
    return `${curr} ${formatNumber(amount, config)}`;
  }
}

export function formatDistance(km: number, config: Partial<FormatConfig> = {}): string {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  if (cfg.units === 'imperial') {
    const miles = km * 0.621371;
    return `${miles.toFixed(1)} mi`;
  }
  return `${km.toFixed(1)} km`;
}

export function formatTemperature(celsius: number, config: Partial<FormatConfig> = {}): string {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  if (cfg.units === 'imperial') {
    const f = celsius * 9 / 5 + 32;
    return `${Math.round(f)}°F`;
  }
  return `${Math.round(celsius)}°C`;
}

export function formatWeight(kg: number, config: Partial<FormatConfig> = {}): string {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  if (cfg.units === 'imperial') {
    const lbs = kg * 2.20462;
    return `${lbs.toFixed(1)} lb`;
  }
  return `${kg.toFixed(1)} kg`;
}

function getLocaleForLanguage(lang: string): string {
  const map: Record<string, string> = {
    en: 'en-GB', de: 'de-DE', fr: 'fr-FR', it: 'it-IT', es: 'es-ES',
    pt: 'pt-PT', sv: 'sv-SE', no: 'nb-NO', da: 'da-DK', el: 'el-GR',
    nl: 'nl-NL', fi: 'fi-FI', pl: 'pl-PL', tr: 'tr-TR', ja: 'ja-JP',
    ko: 'ko-KR', zh: 'zh-CN', ar: 'ar-SA', hi: 'hi-IN', th: 'th-TH',
  };
  return map[lang] ?? 'en-GB';
}
