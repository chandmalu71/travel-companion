/**
 * Currency Conversion Service
 *
 * Integrates with Open Exchange Rates API to provide real-time currency conversion.
 * Caches rates in Redis with 24h TTL, refreshes every 6 hours via cron job.
 * Supports 50+ ISO 4217 currencies.
 *
 * Implements Requirements: 14.1, 14.2, 14.3, 14.5, 14.6, 14.7
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CurrencyRates {
  base: string;
  timestamp: number;
  rates: Record<string, number>;
  stale: boolean;
}

export interface ConversionResult {
  from: string;
  to: string;
  amount: number;
  convertedAmount: number;
  rate: number;
  rateStale: boolean;
  timestamp: number;
}

export interface CurrencyServiceConfig {
  apiKey: string;
  baseCurrency: string;
  cacheTtlSeconds: number;
  refreshIntervalMs: number;
}

export const DEFAULT_CURRENCY_CONFIG: CurrencyServiceConfig = {
  apiKey: process.env['OPEN_EXCHANGE_RATES_API_KEY'] ?? '',
  baseCurrency: 'USD',
  cacheTtlSeconds: 86400, // 24 hours
  refreshIntervalMs: 6 * 60 * 60 * 1000, // 6 hours
};

// ─── Redis Interface ─────────────────────────────────────────────────────────

interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, ttl?: number): Promise<unknown>;
  setex(key: string, ttl: number, value: string): Promise<unknown>;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class CurrencyService {
  private config: CurrencyServiceConfig;
  private redis: RedisLike;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private cachedRates: CurrencyRates | null = null;

  private static readonly CACHE_KEY = 'currency:rates';
  private static readonly LAST_FETCH_KEY = 'currency:last_fetch';

  constructor(redis: RedisLike, config?: Partial<CurrencyServiceConfig>) {
    this.config = { ...DEFAULT_CURRENCY_CONFIG, ...config };
    this.redis = redis;
  }

  /**
   * Start the background refresh cron.
   */
  start(): void {
    // Fetch immediately on start
    this.fetchAndCacheRates().catch((err) => {
      console.error('[CurrencyService] Initial fetch failed:', err);
    });

    // Schedule periodic refresh every 6 hours
    this.refreshTimer = setInterval(() => {
      this.fetchAndCacheRates().catch((err) => {
        console.error('[CurrencyService] Scheduled fetch failed:', err);
      });
    }, this.config.refreshIntervalMs);
  }

  /**
   * Stop the background refresh cron.
   */
  stop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Convert an amount from one currency to another.
   * Returns the result rounded to 2 decimal places.
   */
  async convert(amount: number, from: string, to: string): Promise<ConversionResult> {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    const rates = await this.getRates();

    if (!rates) {
      throw new Error('Currency rates unavailable');
    }

    const fromUpper = from.toUpperCase();
    const toUpper = to.toUpperCase();

    const fromRate = fromUpper === rates.base ? 1 : rates.rates[fromUpper];
    const toRate = toUpper === rates.base ? 1 : rates.rates[toUpper];

    if (fromRate === undefined) {
      throw new Error(`Unsupported currency: ${fromUpper}`);
    }
    if (toRate === undefined) {
      throw new Error(`Unsupported currency: ${toUpper}`);
    }

    // Convert via base currency: amount / fromRate * toRate
    const rate = toRate / fromRate;
    const convertedAmount = Math.round(amount * rate * 100) / 100;

    return {
      from: fromUpper,
      to: toUpper,
      amount,
      convertedAmount,
      rate: Math.round(rate * 1000000) / 1000000,
      rateStale: rates.stale,
      timestamp: rates.timestamp,
    };
  }

  /**
   * Get current exchange rates (from cache or fetch).
   */
  async getRates(): Promise<CurrencyRates | null> {
    // Try in-memory cache first
    if (this.cachedRates) {
      return this.cachedRates;
    }

    // Try Redis cache
    const cached = await this.redis.get(CurrencyService.CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as CurrencyRates;
        this.cachedRates = parsed;
        return parsed;
      } catch {
        // Invalid cache, fetch fresh
      }
    }

    // No cache available — try fetching
    return this.fetchAndCacheRates();
  }

  /**
   * Get supported currencies list.
   */
  async getSupportedCurrencies(): Promise<string[]> {
    const rates = await this.getRates();
    if (!rates) return [];
    return [rates.base, ...Object.keys(rates.rates)].sort();
  }

  /**
   * Fetch rates from Open Exchange Rates API and cache in Redis.
   * On failure, serves stale cached rates with a flag.
   */
  async fetchAndCacheRates(): Promise<CurrencyRates | null> {
    try {
      const url = `https://openexchangerates.org/api/latest.json?app_id=${this.config.apiKey}&base=${this.config.baseCurrency}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Open Exchange Rates API returned ${response.status}`);
      }

      const data = (await response.json()) as {
        base: string;
        timestamp: number;
        rates: Record<string, number>;
      };

      const rates: CurrencyRates = {
        base: data.base,
        timestamp: data.timestamp,
        rates: data.rates,
        stale: false,
      };

      // Cache in Redis with 24h TTL
      await this.redis.setex(
        CurrencyService.CACHE_KEY,
        this.config.cacheTtlSeconds,
        JSON.stringify(rates),
      );

      // Update last fetch timestamp
      await this.redis.set(CurrencyService.LAST_FETCH_KEY, String(Date.now()));

      // Update in-memory cache
      this.cachedRates = rates;

      console.log(
        `[CurrencyService] Fetched ${Object.keys(data.rates).length} rates (base: ${data.base})`,
      );

      return rates;
    } catch (error) {
      console.error('[CurrencyService] Fetch failed:', error);

      // Serve stale rates if available
      if (this.cachedRates) {
        this.cachedRates = { ...this.cachedRates, stale: true };
        return this.cachedRates;
      }

      // Try Redis as last resort
      const cached = await this.redis.get(CurrencyService.CACHE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as CurrencyRates;
          const staleRates = { ...parsed, stale: true };
          this.cachedRates = staleRates;
          return staleRates;
        } catch {
          return null;
        }
      }

      return null;
    }
  }
}

/**
 * Pure conversion function for use in property tests.
 * Converts amount × rate, rounded to 2 decimal places.
 */
export function convertAmount(amount: number, rate: number): number {
  return Math.round(amount * rate * 100) / 100;
}
