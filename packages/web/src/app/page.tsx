'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// ─── Hero Carousel Images (Unsplash, free to use) ────────────────────────────

const CAROUSEL_IMAGES = [
  {
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80',
    alt: 'Tropical beach with turquoise water',
    headline: 'Plan Your Perfect Trip',
    subline: 'AI-powered travel planning that adapts to your style',
  },
  {
    url: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1920&q=80',
    alt: 'Road trip through mountains',
    headline: 'Every Journey, Organized',
    subline: 'From bookings to expenses, all in one place',
  },
  {
    url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1920&q=80',
    alt: 'Lake surrounded by mountains',
    headline: 'Travel Together',
    subline: 'Collaborate with friends and family in real time',
  },
  {
    url: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1920&q=80',
    alt: 'Traveler with map overlooking city',
    headline: 'Discover Hidden Gems',
    subline: 'Personalized recommendations based on your interests',
  },
];

const FEATURES = [
  {
    icon: '✈️',
    title: 'Smart Booking Import',
    description: 'Connect your email and we automatically extract flight, hotel, and car rental bookings.',
  },
  {
    icon: '🗺️',
    title: 'Interactive Maps',
    description: 'See all your trip locations on a map with custom markers, routes, and nearby POIs.',
  },
  {
    icon: '🤖',
    title: 'AI-Powered Search',
    description: 'Find restaurants, activities, and attractions using natural language — personalized to your tastes.',
  },
  {
    icon: '💰',
    title: 'Expense Tracking',
    description: 'Scan receipts, track spending by category, split costs with travel companions.',
  },
  {
    icon: '📅',
    title: 'Timeline View',
    description: 'See your entire trip day-by-day with bookings, events, and weather forecasts.',
  },
  {
    icon: '👥',
    title: 'Collaborative Planning',
    description: 'Share trips, vote on activities, and plan together with real-time updates.',
  },
];

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#about', label: 'About Us' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#help', label: 'Help' },
];

// ─── Landing Page Component ──────────────────────────────────────────────────

export default function LandingPage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Auto-advance carousel
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % CAROUSEL_IMAGES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <img src="/logo-header.svg" alt="Neyya" className="h-10 hidden sm:block" />
              <img src="/logo-icon.svg" alt="Neyya" className="h-9 sm:hidden" />
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-8">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </nav>

            {/* Login Button */}
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="hidden sm:inline-flex rounded-md bg-primary-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-600 transition-colors"
              >
                Log In
              </Link>
              <Link
                href="/register"
                className="hidden sm:inline-flex rounded-md border border-primary-500 px-5 py-2 text-sm font-semibold text-primary-600 hover:bg-primary-50 transition-colors"
              >
                Sign Up
              </Link>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100"
                aria-label="Toggle menu"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Nav */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-gray-200 py-4 space-y-2">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 rounded-md"
                >
                  {link.label}
                </a>
              ))}
              <div className="flex gap-2 pt-2 px-3">
                <Link href="/login" className="flex-1 text-center rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white">
                  Log In
                </Link>
                <Link href="/register" className="flex-1 text-center rounded-md border border-primary-600 px-4 py-2 text-sm font-semibold text-primary-600">
                  Sign Up
                </Link>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ─── Hero Carousel ──────────────────────────────────────────── */}
      <section className="relative h-[85vh] min-h-[500px] mt-16 overflow-hidden">
        {CAROUSEL_IMAGES.map((slide, idx) => (
          <div
            key={idx}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              idx === currentSlide ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <img
              src={slide.url}
              alt={slide.alt}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60" />
          </div>
        ))}

        {/* Hero Content */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-4">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-4 drop-shadow-lg">
            {CAROUSEL_IMAGES[currentSlide]?.headline}
          </h1>
      <p className="text-lg sm:text-xl text-white/90 mb-8 max-w-2xl drop-shadow">
            {CAROUSEL_IMAGES[currentSlide]?.subline}
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/register"
              className="rounded-lg bg-primary-500 px-8 py-3 text-lg font-semibold text-white shadow-lg hover:bg-primary-600 transition-all hover:scale-105"
            >
              Get Started Free
            </Link>
            <a
              href="#features"
              className="rounded-lg bg-white/20 backdrop-blur px-8 py-3 text-lg font-semibold text-white border border-white/40 hover:bg-white/30 transition-all"
            >
              Learn More
            </a>
          </div>

          {/* Carousel dots */}
          <div className="absolute bottom-8 flex gap-2">
            {CAROUSEL_IMAGES.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`w-3 h-3 rounded-full transition-all ${
                  idx === currentSlide ? 'bg-white scale-125' : 'bg-white/50'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ───────────────────────────────────────────────── */}
      <section id="features" className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Everything You Need for Seamless Travel
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              From planning to sharing memories, Neyya handles every aspect of your journey.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURES.map((feature, idx) => (
              <div
                key={idx}
                className="group rounded-xl border border-gray-200 p-6 hover:border-primary-300 hover:shadow-lg transition-all"
              >
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">{feature.icon}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ───────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-lg text-gray-600">Get started in minutes, not hours.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '1', title: 'Connect', description: 'Link your email and we automatically import your booking confirmations.', icon: '📧' },
              { step: '2', title: 'Plan', description: 'Organize trips, explore destinations, and collaborate with your travel group.', icon: '📋' },
              { step: '3', title: 'Travel', description: 'Access everything offline, get smart reminders, and track expenses on the go.', icon: '🌍' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-100 flex items-center justify-center text-3xl">
                  {item.icon}
                </div>
                <div className="inline-block bg-primary-500 text-white text-xs font-bold px-2 py-1 rounded-full mb-3">
                  Step {item.step}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── About Us ───────────────────────────────────────────────── */}
      <section id="about" className="py-20 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">About Us</h2>
              <p className="text-gray-600 mb-4 leading-relaxed">
                Neyya was born from a simple frustration: planning trips shouldn't require
                a dozen apps and spreadsheets. We built an all-in-one platform that uses AI to make
                travel planning effortless.
              </p>
              <p className="text-gray-600 mb-4 leading-relaxed">
                The name "Neyya" comes from Sanskrit, meaning "to guide." Our mission is to give 
                every traveler a personal AI guide that understands their preferences, handles the 
                logistics, and lets them focus on what matters most — enjoying the experience.
              </p>
              <p className="text-gray-600 leading-relaxed">
                Whether you're a solo backpacker or planning a family vacation, we adapt to your
                style and make every trip smoother.
              </p>
            </div>
            <div className="rounded-xl overflow-hidden shadow-lg">
              <img
                src="https://images.unsplash.com/photo-1522199710521-72d69614c702?w=600&q=80"
                alt="Team planning a trip together"
                className="w-full h-64 md:h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Testimonials / Social Proof ────────────────────────────── */}
      <section className="py-20 px-4 bg-gradient-to-br from-primary-500 to-forest-500">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-12">Loved by Travelers Worldwide</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { quote: 'Finally, one app that handles everything. No more switching between 5 different tools.', author: 'Sarah K.', role: 'Frequent Traveler' },
              { quote: 'The AI search found a perfect restaurant that matched my dietary needs in Tokyo. Amazing!', author: 'Marcus L.', role: 'Food Enthusiast' },
              { quote: 'Splitting expenses with our travel group used to be a nightmare. Not anymore!', author: 'Priya R.', role: 'Group Trip Planner' },
            ].map((testimonial, idx) => (
              <div key={idx} className="bg-white/10 backdrop-blur rounded-xl p-6 text-left">
                <p className="text-white/90 text-sm italic mb-4">"{testimonial.quote}"</p>
                <div>
                  <p className="text-white font-semibold text-sm">{testimonial.author}</p>
                  <p className="text-white/70 text-xs">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Help / FAQ ─────────────────────────────────────────────── */}
      <section id="help" className="py-20 px-4 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h2>
            <p className="text-gray-600">Can't find what you're looking for? Contact us at support@travelcompanion.app</p>
          </div>

          <div className="space-y-4">
            {[
              { q: 'Is Neyya free?', a: 'Yes! We offer a generous free tier with all core features. Premium plans add advanced AI features and priority support.' },
              { q: 'How do you import my bookings?', a: 'Connect your Gmail or Outlook and we scan for booking confirmation emails. We extract flight, hotel, and car rental details automatically.' },
              { q: 'Is my data secure?', a: 'Absolutely. We use end-to-end encryption for sensitive data, comply with GDPR, and never sell your information to third parties.' },
              { q: 'Can I use it offline?', a: 'Yes! Select up to 10 trips for offline access. Your data syncs automatically when you reconnect.' },
              { q: 'Do you support group trips?', a: 'Yes — invite up to 20 collaborators to any trip. Everyone can add items, vote on activities, and split expenses.' },
            ].map((faq, idx) => (
              <details key={idx} className="group rounded-lg bg-white border border-gray-200 overflow-hidden">
                <summary className="flex items-center justify-between cursor-pointer px-6 py-4 text-left font-medium text-gray-900 hover:bg-gray-50">
                  {faq.q}
                  <span className="ml-4 text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="px-6 pb-4 text-sm text-gray-600 leading-relaxed">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing Section ──────────────────────────────────────── */}
      <PricingSection />

      {/* ─── CTA Section ────────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Ready to Transform Your Travel Experience?
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Join thousands of travelers who plan smarter, not harder.
          </p>
          <Link
            href="/register"
            className="inline-block rounded-lg bg-primary-500 px-10 py-4 text-lg font-semibold text-white shadow-lg hover:bg-primary-600 transition-all hover:scale-105"
          >
            Create Your Free Account
          </Link>
        </div>
      </section>

      {/* ─── Footer ─────────────────────────────────────────────────── */}
      <footer className="bg-gray-900 text-gray-300 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div>
              <div className="mb-4">
                <img src="/logo-white.svg" alt="Neyya" className="h-10" />
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">
                AI-powered travel planning that adapts to your style. Plan, book, and explore with confidence.
              </p>
            </div>

            {/* Product */}
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">Product</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a></li>
                <li><Link href="/login" className="hover:text-white transition-colors">Log In</Link></li>
                <li><Link href="/register" className="hover:text-white transition-colors">Sign Up</Link></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">Company</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#about" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#help" className="hover:text-white transition-colors">Support</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">Legal</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="/terms" className="hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="/gdpr" className="hover:text-white transition-colors">GDPR Compliance</a></li>
                <li><a href="/cookies" className="hover:text-white transition-colors">Cookie Policy</a></li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-gray-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              &copy; {new Date().getFullYear()} Neyya. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
                GDPR Compliant
              </span>
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
                SOC 2
              </span>
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
                256-bit SSL
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}


// ─── Dynamic Pricing Section (shows promotions with strikethrough) ────────────
function PricingSection() {
  const [plans, setPlans] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);

  useEffect(() => {
    fetch('http://localhost:3000/api/plans')
      .then(r => r.json())
      .then(d => { setPlans(d.data ?? []); setPromotions(d.promotions ?? []); })
      .catch(() => {
        // Fallback to hardcoded if API is down
        setPlans([
          { name: 'Free', slug: 'free', price_monthly_eur: 0, features: ['basic_trips', 'basic_expenses', 'basic_weather', 'equal_split'], max_storage_mb: 100 },
          { name: 'Pro', slug: 'pro', price_monthly_eur: 14.99, features: ['unlimited_trips', 'unlimited_expenses', 'all_split_modes', 'polls', 'multi_currency', '14day_weather'], max_storage_mb: 5120, max_family_members: 10 },
          { name: 'Premium', slug: 'premium', price_monthly_eur: 29.99, features: ['unlimited_trips', 'unlimited_expenses', 'priority_ai', 'shared_family_visibility', 'broadcast', 'priority_support'], max_storage_mb: 25600, max_family_members: 20 },
        ]);
      });
  }, []);

  const getPromo = (slug: string) => promotions.find(p => p.is_active && p.applies_to?.includes(slug) && p.billing_cycles?.includes('monthly'));

  const FEATURES: Record<string, string[]> = {
    free: ['3 active trips', '20 expenses/month', 'Basic weather', 'Equal split', '100MB storage'],
    pro: ['Unlimited trips & expenses', 'All split modes', '14-day weather + alerts', 'Multi-currency', 'Polls & Trip Decisions', '5GB storage', 'Family plan available'],
    premium: ['Everything in Pro', 'Priority AI model', 'Shared family visibility', 'Broadcast messages', '25GB storage', 'Priority support', 'Family plan available'],
  };

  return (
    <section id="pricing" className="py-20 px-4 bg-gray-50">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Simple, Transparent Pricing</h2>
          <p className="text-lg text-gray-600">Start free for 30 days. No credit card required.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const promo = getPromo(plan.slug);
            const price = Number(plan.price_monthly_eur);
            const promoPrice = promo ? price * (1 - promo.discount_percent / 100) : null;
            const isPopular = plan.slug === 'pro';
            const features = FEATURES[plan.slug] ?? [];

            return (
              <div key={plan.slug} className={`rounded-xl border-2 p-6 bg-white relative ${isPopular ? 'border-primary-500 shadow-lg' : 'border-gray-200'}`}>
                {isPopular && !promo && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-500 text-white text-xs font-bold px-3 py-1 rounded-full">Most Popular</div>}
                {promo && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">{promo.badge_text}</div>}

                <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>

                <div className="mt-2">
                  {promo && promoPrice !== null ? (
                    <>
                      <span className="text-lg font-bold text-red-500 line-through decoration-red-500 decoration-2">€{price.toFixed(2)}</span>
                      <span className="text-3xl font-bold text-gray-900 ml-2">€{promoPrice.toFixed(2)}</span>
                      <span className="text-gray-500 text-sm">/month</span>
                    </>
                  ) : (
                    <>
                      <span className="text-3xl font-bold text-gray-900">€{price === 0 ? '0' : price.toFixed(2)}</span>
                      <span className="text-gray-500 text-sm">{price === 0 ? ' forever' : '/month'}</span>
                    </>
                  )}
                </div>

                <Link href="/register" className={`mt-4 block w-full text-center rounded-lg py-2.5 text-sm font-semibold ${isPopular ? 'bg-primary-600 text-white hover:bg-primary-500' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}>
                  {plan.slug === 'free' ? 'Start Free' : 'Start Trial'}
                </Link>
                <ul className="mt-4 space-y-2">
                  {features.map(f => <li key={f} className="flex items-start gap-2 text-sm text-gray-600"><span className="text-green-500">✓</span>{f}</li>)}
                </ul>
              </div>
            );
          })}
        </div>
        <p className="text-center text-sm text-gray-500 mt-6">Annual billing saves 2 months. <Link href="/pricing" className="text-primary-600 hover:underline">View full comparison →</Link></p>
      </div>
    </section>
  );
}
