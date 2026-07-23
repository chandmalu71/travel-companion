'use client';

import { useState, useEffect, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface Lead {
  id: string;
  email: string;
  full_name: string;
  country: string | null;
  city: string | null;
  travel_style: string | null;
  trips_per_year: string | null;
  status: string;
  tags: string[];
  notes: string | null;
  marketing_consent: boolean;
  converted_to_user: boolean;
  source_page: string | null;
  utm_source: string | null;
  device_type: string | null;
  created_at: string;
}

export default function LeadsListPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;

  const fetchLeads = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (countryFilter) params.set('country', countryFilter);
      params.set('limit', String(pageSize));
      params.set('offset', String(offset));

      const res = await fetch(`${API_BASE}/api/admin/crm/leads?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.data) setLeads(data.data);
      if (data.pagination) setTotal(data.pagination.total);
    } catch {} finally { setLoading(false); }
  }, [token, search, statusFilter, countryFilter, pageSize, offset]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);
  useEffect(() => { setOffset(0); }, [search, statusFilter, countryFilter, pageSize]);

  const updateLead = async (id: string, updates: any) => {
    if (!token) return;
    await fetch(`${API_BASE}/api/admin/crm/leads/${id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    fetchLeads();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">All Leads</h1>
          <p className="text-sm text-gray-400 mt-1">{total} total leads captured</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] rounded-lg bg-gray-800 border border-gray-600 px-4 py-2 text-sm text-white placeholder-gray-400 focus:border-emerald-500 focus:outline-none"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg bg-gray-800 border border-gray-600 px-3 py-2 text-sm text-white">
          <option value="">All Status</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="converted">Converted</option>
          <option value="unsubscribed">Unsubscribed</option>
        </select>
        <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}
          className="rounded-lg bg-gray-800 border border-gray-600 px-3 py-2 text-sm text-white">
          <option value="">All Countries</option>
          <option value="Finland">Finland</option>
          <option value="United Kingdom">United Kingdom</option>
          <option value="India">India</option>
          <option value="United States">United States</option>
          <option value="Germany">Germany</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading leads...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-left">
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Travel Style</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{lead.full_name}</p>
                    <p className="text-gray-400 text-xs">{lead.email}</p>
                    {lead.marketing_consent && <span className="text-[10px] text-emerald-400">✓ Marketing consent</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-xs">
                    {[lead.city, lead.country].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3">
                    {lead.travel_style ? (
                      <span className="inline-flex items-center rounded-full bg-purple-500/20 text-purple-400 px-2 py-0.5 text-xs capitalize">
                        {lead.travel_style}
                      </span>
                    ) : <span className="text-gray-500 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={lead.status}
                      onChange={(e) => updateLead(lead.id, { status: e.target.value })}
                      className="rounded bg-gray-700 border border-gray-600 px-2 py-1 text-xs text-white"
                    >
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="converted">Converted</option>
                      <option value="unsubscribed">Unsubscribed</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {lead.device_type && <span className="capitalize">{lead.device_type}</span>}
                    {lead.utm_source && <span className="ml-1 text-gray-500">({lead.utm_source})</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(lead.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelectedLead(lead)}
                      className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded hover:bg-gray-600"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No leads found. They will appear here once the lead capture form is live.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">Rows:</span>
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}
            className="rounded-lg bg-gray-800 border border-gray-600 px-2 py-1 text-sm text-white">
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="text-sm text-gray-500">{offset + 1}-{Math.min(offset + pageSize, total)} of {total}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setOffset(Math.max(0, offset - pageSize))} disabled={offset === 0}
            className="rounded-md bg-gray-700 px-3 py-1.5 text-sm text-white disabled:opacity-30">Previous</button>
          <button onClick={() => setOffset(offset + pageSize)} disabled={offset + pageSize >= total}
            className="rounded-md bg-gray-700 px-3 py-1.5 text-sm text-white disabled:opacity-30">Next</button>
        </div>
      </div>

      {/* Lead Detail Modal */}
      {selectedLead && (
        <LeadDetailModal lead={selectedLead} onClose={() => setSelectedLead(null)} onUpdate={(updates) => { updateLead(selectedLead.id, updates); setSelectedLead(null); }} />
      )}
    </div>
  );
}

function LeadDetailModal({ lead, onClose, onUpdate }: { lead: Lead; onClose: () => void; onUpdate: (updates: any) => void }) {
  const [notes, setNotes] = useState(lead.notes ?? '');
  const [tags, setTags] = useState(lead.tags?.join(', ') ?? '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-lg rounded-lg bg-gray-800 border border-gray-700 p-6 shadow-xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Lead Details</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">&times;</button>
        </div>

        <div className="space-y-4">
          {/* Profile */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-400">Name:</span> <span className="text-white ml-2">{lead.full_name}</span></div>
            <div><span className="text-gray-400">Email:</span> <span className="text-white ml-2">{lead.email}</span></div>
            <div><span className="text-gray-400">Country:</span> <span className="text-white ml-2">{lead.country ?? '—'}</span></div>
            <div><span className="text-gray-400">City:</span> <span className="text-white ml-2">{lead.city ?? '—'}</span></div>
            <div><span className="text-gray-400">Travel Style:</span> <span className="text-white ml-2 capitalize">{lead.travel_style ?? '—'}</span></div>
            <div><span className="text-gray-400">Trips/Year:</span> <span className="text-white ml-2">{lead.trips_per_year ?? '—'}</span></div>
            <div><span className="text-gray-400">Device:</span> <span className="text-white ml-2 capitalize">{lead.device_type ?? '—'}</span></div>
            <div><span className="text-gray-400">UTM Source:</span> <span className="text-white ml-2">{lead.utm_source ?? '—'}</span></div>
            <div><span className="text-gray-400">Marketing:</span> <span className={`ml-2 ${lead.marketing_consent ? 'text-emerald-400' : 'text-red-400'}`}>{lead.marketing_consent ? 'Consented' : 'No consent'}</span></div>
            <div><span className="text-gray-400">Converted:</span> <span className={`ml-2 ${lead.converted_to_user ? 'text-emerald-400' : 'text-gray-500'}`}>{lead.converted_to_user ? 'Yes' : 'No'}</span></div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Tags (comma-separated)</label>
            <input type="text" value={tags} onChange={(e) => setTags(e.target.value)}
              className="w-full rounded-md border border-gray-600 bg-gray-700 text-white px-3 py-2 text-sm"
              placeholder="e.g., high-intent, travel-blogger, enterprise" />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Internal Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-md border border-gray-600 bg-gray-700 text-white px-3 py-2 text-sm h-24 resize-none"
              placeholder="Add notes about this lead..." />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="rounded-md border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700">Cancel</button>
            <button
              onClick={() => onUpdate({ notes, tags: tags.split(',').map(t => t.trim()).filter(Boolean) })}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
