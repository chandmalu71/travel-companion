'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Plan {
  name: string;
  slug: string;
  tier: number;
  price_monthly_eur: number;
  price_annual_eur: number;
  price_monthly_family_eur: number | null;
  price_annual_family_eur: number | null;
  features: string[];
  max_active_trips: number | null;
  max_family_members: number | null;
  max_storage_mb: number | null;
}

interface Promotion {
  id: string;
  name: string;
  discount_percent: number;
  applies_to: string[];
  billing_cycles: string[];
  starts_at: string;
  ends_at: string;
  badge_text: string;
  is_active: boolean;
  event_type: string;
  theme_color: string;
  banner_text: string | null;
  banner_emoji: string | null;
}

const FEATURE_LABELS: Record<string, string> = {
  basic_trips: 'Up to 3 active trips',
  basic_expenses: 'Up to 20 expenses/month',
  basic_weather: '3-day weather forecast',
  equal_split: 'Equal expense splitting',
  unlimited_trips: 'Unlimited trips',
  unlimited_expenses: 'Unlimited expenses',
  all_split_modes: 'All split modes (equal/percentage/per-item)',
  polls: 'Polls & voting in chat',
  trip_decisions: 'Trip Decisions from chat',
  multi_currency: 'Multi-currency conversion',
  data_export: 'Export data (PDF/CSV)',
  '14day_weather': '14-day weather forecast',
  weather_alerts: 'Weather alerts & notifications',
  weather_historical: 'Historical weather averages',
  shared_family_visibility: 'Shared family visibility',
  broadcast: 'Broadcast announcements',
  priority_ai: 'Priority AI (faster model)',
  priority_support: 'Priority customer support',
};

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [annual, setAnnual] = useState(false);
  const [campaign, setCampaign] = useState('');
  const [discount, setDiscount] = useState<{ code: string; percent: number } | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/api/plans`)
      .then(r => r.json())
      .then(d => {
        setPlans(d.data ?? []);
        setPromotions(d.promotions ?? []);
      })
      .catch(() => {});
    // Check if user is logged in
    if (typeof window !== 'undefined' && localStorage.getItem('accessToken')) {
      setIsLoggedIn(true);
    }
  }, []);

  const applyCampaign = async () => {
    if (!campaign) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/api/subscription/apply-campaign`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: campaign }),
      });
      const data = await res.json();
      if (data.data) setDiscount({ code: data.data.code, percent: data.data.discountPercent });
      else setDiscount(null);
    } catch { setDiscount(null); }
  };

  const getPrice = (plan: Plan) => {
    const base = annual ? Number(plan.price_annual_eur) : Number(plan.price_monthly_eur);
    // Campaign code discount
    if (discount && plan.slug !== 'free') return base * (1 - discount.percent / 100);
    return base;
  };

  // Get active promotion for a specific plan and billing cycle
  const getPromotion = (plan: Plan): Promotion | null => {
    if (plan.slug === 'free') return null;
    const cycle = annual ? 'annual' : 'monthly';
    return promotions.find(p =>
      p.is_active &&
      p.applies_to.includes(plan.slug) &&
      p.billing_cycles.includes(cycle)
    ) ?? null;
  };

  // Calculate promotional price
  const getPromoPrice = (plan: Plan): number | null => {
    const promo = getPromotion(plan);
    if (!promo) return null;
    const base = annual ? Number(plan.price_annual_eur) : Number(plan.price_monthly_eur);
    return base * (1 - promo.discount_percent / 100);
  };

  // Time remaining for promotion
  const getPromoTimeRemaining = (promo: Promotion): string => {
    const end = new Date(promo.ends_at);
    const now = new Date();
    const days = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 1) return 'Ends today!';
    if (days <= 7) return `${days} days left`;
    if (days <= 30) return `${Math.ceil(days / 7)} weeks left`;
    return `${Math.ceil(days / 30)} months left`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 py-4 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo-header.svg" alt="Neyya" className="h-9" />
          </Link>
          <Link href={isLoggedIn ? '/dashboard' : '/login'} className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500">
            {isLoggedIn ? 'Dashboard' : 'Log In'}
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-16">
        {/* Promotional Banner */}
        {promotions.length > 0 && (() => {
          // Show the first active promotion's banner
          const activePromo = promotions[0];
          if (!activePromo?.banner_text) return null;
          return (
            <div className="mb-8 rounded-xl p-4 text-center border-2 animate-pulse-slow" style={{ backgroundColor: `${activePromo.theme_color}15`, borderColor: `${activePromo.theme_color}40` }}>
              <p className="text-lg font-bold" style={{ color: activePromo.theme_color }}>
                {activePromo.banner_emoji && <span className="mr-2 text-2xl">{activePromo.banner_emoji}</span>}
                {activePromo.banner_text}
                {activePromo.banner_emoji && <span className="ml-2 text-2xl">{activePromo.banner_emoji}</span>}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Offer valid until {new Date(activePromo.ends_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          );
        })()}

        {/* Title */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Simple, transparent pricing</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Start with a 30-day free trial of all features. No credit card required. Upgrade when you're ready.
          </p>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-3 mt-8">
            <span className={`text-sm ${!annual ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>Monthly</span>
            <button onClick={() => setAnnual(!annual)}
              className={`relative w-12 h-6 rounded-full transition-colors ${annual ? 'bg-primary-600' : 'bg-gray-300'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${annual ? 'translate-x-6' : ''}`} />
            </button>
            <span className={`text-sm ${annual ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
              Annual <span className="text-green-600 text-xs font-medium ml-1">Save 2 months</span>
            </span>
          </div>
        </div>

        {/* Campaign code */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <input type="text" value={campaign} onChange={e => setCampaign(e.target.value.toUpperCase())}
            placeholder="Have a promo code?" className="rounded-md border border-gray-300 px-3 py-1.5 text-sm w-48" />
          <button onClick={applyCampaign} className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200">Apply</button>
          {discount && <span className="text-sm text-green-600 font-medium">✓ {discount.percent}% off!</span>}
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map(plan => {
            const price = getPrice(plan);
            const isPopular = plan.slug === 'pro';
            const promo = getPromotion(plan);
            const promoPrice = getPromoPrice(plan);

            return (
              <div key={plan.slug} className={`rounded-xl border-2 p-6 bg-white relative ${
                isPopular ? 'border-primary-500 shadow-lg' : 'border-gray-200'
              }`}>
                {isPopular && !promo && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    Most Popular
                  </div>
                )}
                {promo && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                    {promo.badge_text}
                  </div>
                )}

                <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>

                {/* Price display with promotion strikethrough */}
                <div className="mt-4">
                  {promo && promoPrice !== null ? (
                    <>
                      {/* Original price crossed out in red */}
                      <span className="text-xl font-bold text-red-500 line-through decoration-red-500 decoration-2">
                        €{price.toFixed(2)}
                      </span>
                      {/* Discounted price */}
                      <span className="text-4xl font-bold text-gray-900 ml-2">
                        €{promoPrice.toFixed(2)}
                      </span>
                      <span className="text-gray-500 text-sm">/{annual ? 'year' : 'month'}</span>
                      {/* Time remaining */}
                      <p className="text-xs text-red-500 font-medium mt-1">
                        ⏰ {getPromoTimeRemaining(promo)}
                      </p>
                    </>
                  ) : (
                    <>
                      <span className="text-4xl font-bold text-gray-900">
                        €{price.toFixed(price === 0 ? 0 : 2)}
                      </span>
                      {plan.slug !== 'free' && (
                        <span className="text-gray-500 text-sm">/{annual ? 'year' : 'month'}</span>
                      )}
                      {discount && plan.slug !== 'free' && (
                        <span className="ml-2 text-sm line-through text-red-400 font-semibold">
                          €{(annual ? Number(plan.price_annual_eur) : Number(plan.price_monthly_eur)).toFixed(2)}
                        </span>
                      )}
                    </>
                  )}
                </div>

                {plan.price_monthly_family_eur && (
                  <p className="text-xs text-gray-500 mt-1">
                    Family (up to 5): €{annual ? plan.price_annual_family_eur : plan.price_monthly_family_eur}/{annual ? 'yr' : 'mo'}
                  </p>
                )}

                <Link href={isLoggedIn ? '/settings#subscription' : '/register'}
                  className={`mt-6 block w-full text-center rounded-lg py-2.5 text-sm font-semibold ${
                    isPopular ? 'bg-primary-600 text-white hover:bg-primary-500' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}>
                  {isLoggedIn ? (plan.slug === 'free' ? 'Current Plan' : `Upgrade to ${plan.name}`) : (plan.slug === 'free' ? 'Start Free Trial' : `Get ${plan.name}`)}
                </Link>

                <div className="mt-6 space-y-2">
                  {(plan.features ?? []).map((f: string) => (
                    <div key={f} className="flex items-start gap-2">
                      <span className="text-green-500 text-sm mt-0.5">✓</span>
                      <span className="text-sm text-gray-600">{FEATURE_LABELS[f] ?? f}</span>
                    </div>
                  ))}
                  {plan.max_storage_mb && (
                    <div className="flex items-start gap-2">
                      <span className="text-green-500 text-sm mt-0.5">✓</span>
                      <span className="text-sm text-gray-600">{plan.max_storage_mb >= 1024 ? `${(plan.max_storage_mb / 1024).toFixed(0)}GB` : `${plan.max_storage_mb}MB`} storage</span>
                    </div>
                  )}
                  {plan.max_family_members && (
                    <div className="flex items-start gap-2">
                      <span className="text-green-500 text-sm mt-0.5">✓</span>
                      <span className="text-sm text-gray-600">Up to {plan.max_family_members} family members</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* FAQ */}
        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Questions?</h2>
          <p className="text-gray-600">All plans include a 30-day free trial with full Premium access. Cancel anytime.</p>
          <Link href="/#help" className="text-primary-600 hover:underline text-sm mt-2 inline-block">View FAQ →</Link>
        </div>
      </div>
    </div>
  );
}
