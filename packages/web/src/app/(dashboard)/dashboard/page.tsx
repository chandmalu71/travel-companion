'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

// ─── Widget Definitions ──────────────────────────────────────────────────────

const ALL_WIDGETS = [
  { id: 'quick_actions', label: 'Quick Actions', icon: '⚡', description: 'Create trips, add expenses, start chats' },
  { id: 'upcoming_trips', label: 'Upcoming Trips', icon: '✈️', description: 'Your next trips with dates' },
  { id: 'recent_expenses', label: 'Recent Expenses', icon: '💰', description: 'Latest expenses and monthly total' },
  { id: 'messages', label: 'Messages', icon: '💬', description: 'Unread messages and recent chats' },
  { id: 'network', label: 'My Network', icon: '👥', description: 'Connections and family members' },
  { id: 'weather', label: 'Weather', icon: '🌤️', description: 'Forecast for your next trip' },
  { id: 'ai_tips', label: 'AI Tips', icon: '💡', description: 'Travel tips for upcoming trips' },
  { id: 'trip_decisions', label: 'Trip Decisions', icon: '✅', description: 'Pending votes and decisions' },
  { id: 'bookings', label: 'Upcoming Bookings', icon: '📋', description: 'Your next flights and hotels' },
  { id: 'favorites', label: 'Recent Favorites', icon: '⭐', description: 'Recently saved places' },
];

const DEFAULT_WIDGETS = ['quick_actions', 'upcoming_trips', 'recent_expenses', 'messages', 'network', 'weather', 'ai_tips'];

export default function DashboardPage() {
  const [activeWidgets, setActiveWidgets] = useState<string[]>(DEFAULT_WIDGETS);
  const [showCustomize, setShowCustomize] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ data: { widgets: string[] } }>('/api/users/me/dashboard-config')
      .then(res => { if (res.data?.widgets?.length > 0) setActiveWidgets(res.data.widgets); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const saveConfig = async (widgets: string[]) => {
    setActiveWidgets(widgets);
    await api.put('/api/users/me/dashboard-config', { widgets }).catch(() => {});
  };

  if (loading) return <div className="animate-pulse space-y-4">{[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-gray-200 rounded-lg" />)}</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <button onClick={() => setShowCustomize(true)} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
          ⚙️ Customize
        </button>
      </div>

      {/* Widget Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeWidgets.map(widgetId => {
          const Widget = WIDGET_COMPONENTS[widgetId];
          if (!Widget) return null;
          return <Widget key={widgetId} />;
        })}
      </div>

      {/* Customize Modal */}
      {showCustomize && (
        <CustomizeModal
          active={activeWidgets}
          onSave={(w) => { saveConfig(w); setShowCustomize(false); }}
          onClose={() => setShowCustomize(false)}
        />
      )}
    </div>
  );
}

// ─── Widget Components ───────────────────────────────────────────────────────

function QuickActionsWidget() {
  return (
    <div className="rounded-lg bg-white p-4 border border-gray-200 shadow-sm md:col-span-2 lg:col-span-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">⚡ Quick Actions</h3>
      <div className="flex flex-wrap gap-2">
        <Link href="/trips/new" className="rounded-md bg-primary-600 px-4 py-2 text-xs font-medium text-white hover:bg-primary-500">+ New Trip</Link>
        <Link href="/expenses" className="rounded-md border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">+ Add Expense</Link>
        <Link href="/messages" className="rounded-md border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">💬 Start Chat</Link>
        <Link href="/search" className="rounded-md border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">🔍 Search Places</Link>
        <Link href="/connections" className="rounded-md border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">👥 My Network</Link>
        <Link href="/settings" className="rounded-md border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">⚙️ Settings</Link>
      </div>
    </div>
  );
}

function UpcomingTripsWidget() {
  const [trips, setTrips] = useState<any[]>([]);
  useEffect(() => {
    api.get<{ data?: any[]; trips?: any[] }>('/api/trips')
      .then(res => {
        const all = res.data ?? res.trips ?? [];
        const upcoming = all.filter((t: any) => t.start_date && new Date(t.start_date) > new Date()).slice(0, 3);
        setTrips(upcoming);
      }).catch(() => {});
  }, []);

  return (
    <div className="rounded-lg bg-white p-4 border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase">✈️ Upcoming Trips</h3>
        <Link href="/trips" className="text-[10px] text-primary-600 hover:underline">View all →</Link>
      </div>
      {trips.length === 0 ? (
        <p className="text-sm text-gray-400">No upcoming trips</p>
      ) : (
        <div className="space-y-2">
          {trips.map((trip: any) => (
            <Link key={trip.id} href={`/trips/${trip.id}`} className="flex items-center gap-2 rounded-md p-2 hover:bg-gray-50 transition-colors">
              <span className="text-lg">🗺️</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{trip.name}</p>
                <p className="text-[10px] text-gray-400">{trip.start_date ? new Date(trip.start_date).toLocaleDateString() : 'No date'}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function RecentExpensesWidget() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  useEffect(() => {
    api.get<{ data?: any[] }>('/api/expenses')
      .then(res => {
        const all = res.data ?? [];
        setExpenses(all.slice(0, 3));
        setTotal(all.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0));
      }).catch(() => {});
  }, []);

  return (
    <div className="rounded-lg bg-white p-4 border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase">💰 Expenses</h3>
        <Link href="/expenses" className="text-[10px] text-primary-600 hover:underline">View all →</Link>
      </div>
      <p className="text-2xl font-bold text-gray-900 mb-2">{total > 0 ? `€${total.toFixed(0)}` : '€0'}</p>
      <div className="space-y-1">
        {expenses.map((e: any) => (
          <div key={e.id} className="flex justify-between text-xs">
            <span className="text-gray-600 truncate">{e.merchant_name ?? e.category}</span>
            <span className="text-gray-900 font-medium">{e.currency} {Number(e.amount).toFixed(0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MessagesWidget() {
  const [conversations, setConversations] = useState<any[]>([]);
  useEffect(() => {
    api.get<{ data?: any[] }>('/api/conversations')
      .then(res => setConversations((res.data ?? []).slice(0, 3)))
      .catch(() => {});
  }, []);

  const unread = conversations.filter((c: any) => c.hasUnread).length;

  return (
    <div className="rounded-lg bg-white p-4 border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase">💬 Messages</h3>
        <Link href="/messages" className="text-[10px] text-primary-600 hover:underline">Open →</Link>
      </div>
      {unread > 0 && <p className="text-sm font-medium text-primary-600 mb-2">{unread} unread</p>}
      {conversations.length === 0 ? (
        <p className="text-sm text-gray-400">No conversations yet</p>
      ) : (
        <div className="space-y-1.5">
          {conversations.map((c: any) => (
            <div key={c.id} className="flex items-center gap-2">
              {c.hasUnread && <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />}
              <p className="text-xs text-gray-700 truncate flex-1">{c.name}</p>
              <p className="text-[9px] text-gray-400">{c.lastMessagePreview?.slice(0, 20)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NetworkWidget() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    api.get<{ data?: any[] }>('/api/connections').then(res => setCount((res.data ?? []).length)).catch(() => {});
  }, []);

  return (
    <div className="rounded-lg bg-white p-4 border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase">👥 My Network</h3>
        <Link href="/connections" className="text-[10px] text-primary-600 hover:underline">View all →</Link>
      </div>
      <p className="text-2xl font-bold text-gray-900">{count}</p>
      <p className="text-xs text-gray-400">Connected travel companions</p>
    </div>
  );
}

function WeatherWidget() {
  return (
    <div className="rounded-lg bg-white p-4 border border-gray-200 shadow-sm">
      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">🌤️ Weather</h3>
      <p className="text-sm text-gray-400">Open a trip to see its weather forecast</p>
      <div className="flex gap-2 mt-2">
        <span className="text-2xl">☀️</span>
        <span className="text-2xl">⛅</span>
        <span className="text-2xl">🌧️</span>
      </div>
    </div>
  );
}

function AiTipsWidget() {
  return (
    <div className="rounded-lg bg-white p-4 border border-gray-200 shadow-sm">
      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">💡 AI Tips</h3>
      <p className="text-sm text-gray-400">Generate personalized tips from any trip's AI Tips tab</p>
      <div className="flex gap-1 mt-2">
        {['🎯', '🧳', '⚠️', '🍽️'].map(icon => <span key={icon} className="text-lg">{icon}</span>)}
      </div>
    </div>
  );
}

function TripDecisionsWidget() {
  return (
    <div className="rounded-lg bg-white p-4 border border-gray-200 shadow-sm">
      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">✅ Trip Decisions</h3>
      <p className="text-sm text-gray-400">Pending votes from trip chats</p>
    </div>
  );
}

function BookingsWidget() {
  const [bookings, setBookings] = useState<any[]>([]);
  useEffect(() => {
    api.get<{ data?: any[] }>('/api/bookings').then(res => setBookings((res.data ?? []).slice(0, 3))).catch(() => {});
  }, []);

  return (
    <div className="rounded-lg bg-white p-4 border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase">📋 Bookings</h3>
        <Link href="/bookings" className="text-[10px] text-primary-600 hover:underline">View all →</Link>
      </div>
      {bookings.length === 0 ? (
        <p className="text-sm text-gray-400">No upcoming bookings</p>
      ) : (
        <div className="space-y-1">
          {bookings.map((b: any) => (
            <div key={b.id} className="flex items-center gap-2 text-xs">
              <span>{b.type === 'flight' ? '✈️' : b.type === 'hotel' ? '🏨' : '🚗'}</span>
              <span className="text-gray-700">{b.type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FavoritesWidget() {
  return (
    <div className="rounded-lg bg-white p-4 border border-gray-200 shadow-sm">
      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">⭐ Favorites</h3>
      <p className="text-sm text-gray-400">Your saved places and recommendations</p>
    </div>
  );
}

// Widget component mapping
const WIDGET_COMPONENTS: Record<string, React.FC> = {
  quick_actions: QuickActionsWidget,
  upcoming_trips: UpcomingTripsWidget,
  recent_expenses: RecentExpensesWidget,
  messages: MessagesWidget,
  network: NetworkWidget,
  weather: WeatherWidget,
  ai_tips: AiTipsWidget,
  trip_decisions: TripDecisionsWidget,
  bookings: BookingsWidget,
  favorites: FavoritesWidget,
};

// ─── Customize Modal ─────────────────────────────────────────────────────────

function CustomizeModal({ active, onSave, onClose }: { active: string[]; onSave: (w: string[]) => void; onClose: () => void }) {
  const [selected, setSelected] = useState<string[]>(active);

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Customize Dashboard</h3>
        <p className="text-sm text-gray-500 mb-4">Select which widgets appear on your dashboard.</p>

        <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
          {ALL_WIDGETS.map(widget => (
            <label key={widget.id}
              className={`flex items-start gap-3 rounded-lg p-3 border cursor-pointer transition-colors ${
                selected.includes(widget.id) ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'
              }`}>
              <input type="checkbox" checked={selected.includes(widget.id)} onChange={() => toggle(widget.id)}
                className="mt-0.5 rounded border-gray-300 text-primary-600" />
              <div>
                <p className="text-sm font-medium text-gray-900">{widget.icon} {widget.label}</p>
                <p className="text-[10px] text-gray-400">{widget.description}</p>
              </div>
            </label>
          ))}
        </div>

        <div className="flex justify-between mt-4">
          <button onClick={() => setSelected(DEFAULT_WIDGETS)} className="text-xs text-gray-500 hover:text-gray-700">Reset to defaults</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm">Cancel</button>
            <button onClick={() => onSave(selected)} className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500">
              Save Layout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
