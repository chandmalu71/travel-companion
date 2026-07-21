'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Connection {
  id: string;
  connectedUserId: string | null;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  status: string;
  label: string | null;
  privacy: string;
  source: string;
  sourceTripId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  connected: { label: 'Connected', color: 'bg-green-100 text-green-700 border-green-200' },
  invited: { label: 'Invited', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  declined: { label: 'Declined', color: 'bg-red-100 text-red-600 border-red-200' },
  blocked: { label: 'Blocked', color: 'bg-gray-200 text-gray-600 border-gray-300' },
};

const LABEL_OPTIONS = [
  'Partner', 'Family', 'Friend', 'Colleague', 'Travel Buddy', 'Guide', 'Other',
];

export default function ConnectionsPage() {
  const [activeTab, setActiveTab] = useState<'network' | 'family'>('network');

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Network</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your travel contacts and family members</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('network')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'network' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          👥 Network
        </button>
        <button
          onClick={() => setActiveTab('family')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'family' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          👨‍👩‍👧‍👦 Family
        </button>
      </div>

      {activeTab === 'network' ? <NetworkTab /> : <FamilyTab />}
    </div>
  );
}

// ─── Network Tab (existing connections functionality) ─────────────────────────

function NetworkTab() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
  const [filter, setFilter] = useState<'all' | 'connected' | 'invited' | 'declined'>('all');

  const loadConnections = () => {
    api.get<{ data: Connection[] }>('/api/connections')
      .then((res) => setConnections(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadConnections(); }, []);

  const filtered = filter === 'all' ? connections : connections.filter((c) => c.status === filter);

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this connection? They will no longer appear in your suggestions.')) return;
    try {
      await api.delete(`/api/connections/${id}`);
      setConnections((prev) => prev.filter((c) => c.id !== id));
    } catch { /* toast */ }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-200 rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">People you travel with. Connected users appear as suggestions when inviting to trips.</p>
        <button
          onClick={() => setShowAddModal(true)}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500"
        >
          + Add Contact
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {(['all', 'connected', 'invited', 'declined'] as const).map((f) => {
          const count = f === 'all' ? connections.length : connections.filter((c) => c.status === f).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg border p-3 text-center transition-all ${
                filter === f ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <p className="text-lg font-bold text-gray-900">{count}</p>
              <p className="text-[11px] text-gray-500 capitalize">{f}</p>
            </button>
          );
        })}
      </div>

      {/* Connection list */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <p className="text-4xl mb-3">👥</p>
          <p className="text-gray-500">No connections yet.</p>
          <p className="text-sm text-gray-400 mt-1">Add contacts manually or they'll appear automatically when trip invitations are accepted.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((connection) => (
            <div
              key={connection.id}
              className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 border border-gray-200 shadow-sm hover:border-primary-200 transition-all group"
            >
              {/* Avatar */}
              <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                {connection.avatarUrl ? (
                  <img src={connection.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <span className="text-primary-600 font-bold text-sm">
                    {connection.name?.charAt(0)?.toUpperCase() ?? '?'}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setEditingConnection(connection)}>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 text-sm truncate">{connection.name}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_BADGES[connection.status]?.color ?? 'bg-gray-100 text-gray-500'}`}>
                    {STATUS_BADGES[connection.status]?.label ?? connection.status}
                  </span>
                  {connection.label && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-200">
                      {connection.label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {connection.email && <p className="text-[11px] text-gray-400 truncate">{connection.email}</p>}
                  {connection.source === 'trip_accept' && <span className="text-[10px] text-gray-400">via trip invite</span>}
                  {connection.source === 'manual' && <span className="text-[10px] text-gray-400">added manually</span>}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setEditingConnection(connection)}
                  className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  title="Edit"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleDelete(connection.id)}
                  className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50"
                  title="Remove"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <AddConnectionModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => { setShowAddModal(false); loadConnections(); }}
        />
      )}

      {/* Edit Modal */}
      {editingConnection && (
        <EditConnectionModal
          connection={editingConnection}
          onClose={() => setEditingConnection(null)}
          onSaved={() => { setEditingConnection(null); loadConnections(); }}
        />
      )}
    </div>
  );
}

// ─── Family Tab ──────────────────────────────────────────────────────────────

interface FamilyMember {
  id: string;
  mode: string;
  relationship: string;
  firstName: string;
  lastName: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  dietaryPreferences: string[];
  allergies: string[];
  seatPreference: string | null;
  mealPreference: string | null;
  cabinClassPreference: string | null;
  hasPassportStored: boolean;
  passportNationality: string | null;
  passportNumberMasked: string | null;
  sharingScope: string;
  notes: string | null;
}

const RELATIONSHIP_ICONS: Record<string, string> = {
  spouse: '💑', partner: '💑', child: '👶', parent: '👴', sibling: '👫', grandparent: '👵', other: '👤',
};

const RELATIONSHIP_LABELS: Record<string, string> = {
  spouse: 'Spouse', partner: 'Partner', child: 'Child', parent: 'Parent', sibling: 'Sibling', grandparent: 'Grandparent', other: 'Other',
};

function FamilyTab() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);

  const loadMembers = () => {
    api.get<{ data: FamilyMember[] }>('/api/family-members')
      .then((res) => setMembers(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadMembers(); }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from your family members?`)) return;
    try {
      await api.delete(`/api/family-members/${id}`);
      setMembers((prev) => prev.filter((m) => m.id !== id));
    } catch { /* toast */ }
  };

  if (loading) {
    return <div className="animate-pulse space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-200 rounded-lg" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Family members permanently linked to your profile. Their preferences auto-apply when added to trips.</p>
        <button onClick={() => setShowAddModal(true)} className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500">
          + Add Family Member
        </button>
      </div>

      {members.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <p className="text-4xl mb-3">👨‍👩‍👧‍👦</p>
          <p className="text-gray-500">No family members added yet.</p>
          <p className="text-sm text-gray-400 mt-1">Add your family to quickly include them in trips with their preferences and passport details.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((member) => (
            <div key={member.id} className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 border border-gray-200 shadow-sm hover:border-primary-200 transition-all group">
              {/* Avatar / Relationship icon */}
              <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0 text-lg">
                {RELATIONSHIP_ICONS[member.relationship] ?? '👤'}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setEditingMember(member)}>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 text-sm">{member.firstName} {member.lastName ?? ''}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                    {RELATIONSHIP_LABELS[member.relationship] ?? member.relationship}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${member.mode === 'connected' ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-gray-50 text-gray-500 border border-gray-200'}`}>
                    {member.mode === 'connected' ? 'Linked account' : 'Managed'}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-[11px] text-gray-400">
                  {member.dateOfBirth && <span>Born: {new Date(member.dateOfBirth).toLocaleDateString()}</span>}
                  {member.allergies.length > 0 && <span>⚠️ {member.allergies.length} allergies</span>}
                  {member.hasPassportStored && <span>🛂 {member.passportNumberMasked}</span>}
                  {member.seatPreference && <span>💺 {member.seatPreference}</span>}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setEditingMember(member)} className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100" title="Edit">✏️</button>
                <button onClick={() => handleDelete(member.id, member.firstName)} className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50" title="Remove">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <AddFamilyMemberModal onClose={() => setShowAddModal(false)} onAdded={() => { setShowAddModal(false); loadMembers(); }} />
      )}
      {editingMember && (
        <EditFamilyMemberModal member={editingMember} onClose={() => setEditingMember(null)} onSaved={() => { setEditingMember(null); loadMembers(); }} />
      )}
    </div>
  );
}

// ─── Add Family Member Modal ─────────────────────────────────────────────────

function AddFamilyMemberModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [relationship, setRelationship] = useState('child');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>([]);
  const [seatPreference, setSeatPreference] = useState('');
  const [mealPreference, setMealPreference] = useState('');
  const [passportName, setPassportName] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [passportNationality, setPassportNationality] = useState('');
  const [passportExpiry, setPassportExpiry] = useState('');
  const [showPassportSection, setShowPassportSection] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fetch admin-managed options (same as Settings page)
  const [DIETARY_OPTIONS, setDietaryOptions] = useState<Array<{ key: string; name: string; icon: string }>>([]);
  const [ALLERGY_OPTIONS, setAllergyOptions] = useState<Array<{ key: string; name: string; icon: string }>>([]);

  useEffect(() => {
    api.get<{ data: any[] }>('/api/preferences/dietary').then(r => setDietaryOptions(r.data ?? [])).catch(() => {});
    api.get<{ data: any[] }>('/api/preferences/allergies').then(r => setAllergyOptions(r.data ?? [])).catch(() => {});
  }, []);

  const toggleDietary = (key: string) => {
    setDietaryPreferences(prev => prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key]);
  };
  const toggleAllergy = (key: string) => {
    setAllergies(prev => prev.includes(key) ? prev.filter(a => a !== key) : [...prev, key]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !relationship) { setError('Name and relationship are required'); return; }
    setSubmitting(true); setError('');
    try {
      await api.post('/api/family-members', {
        firstName, lastName: lastName || undefined, relationship, dateOfBirth: dateOfBirth || undefined,
        gender: gender || undefined,
        allergies,
        dietaryPreferences,
        seatPreference: seatPreference || undefined, mealPreference: mealPreference || undefined,
        passport: (passportName || passportNumber) ? {
          fullName: passportName || undefined, number: passportNumber || undefined,
          nationality: passportNationality || undefined, expiry: passportExpiry || undefined,
        } : undefined,
      });
      onAdded();
    } catch (err: any) { setError(err?.data?.message ?? 'Failed to add family member'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Family Member</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name + Relationship */}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-gray-700 mb-1">First Name *</label>
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" autoFocus /></div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Last Name</label>
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Relationship *</label>
              <select value={relationship} onChange={e => setRelationship(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="spouse">Spouse</option><option value="partner">Partner</option>
                <option value="child">Child</option><option value="parent">Parent</option>
                <option value="sibling">Sibling</option><option value="grandparent">Grandparent</option>
                <option value="other">Other</option>
              </select></div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Date of Birth</label>
              <input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Gender</label>
              <select value={gender} onChange={e => setGender(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="">—</option><option value="male">Male</option><option value="female">Female</option>
                <option value="non-binary">Non-binary</option><option value="prefer_not_to_say">Prefer not to say</option>
              </select></div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Seat Preference</label>
              <select value={seatPreference} onChange={e => setSeatPreference(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="">No preference</option><option value="window">Window</option>
                <option value="aisle">Aisle</option><option value="middle">Middle</option>
              </select></div>
          </div>

          {/* Dietary Preferences — chip selector (same as Settings) */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Dietary Preferences</label>
            <div className="flex flex-wrap gap-1.5">
              {DIETARY_OPTIONS.map((pref) => (
                <button key={pref.key} type="button" onClick={() => toggleDietary(pref.key)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    dietaryPreferences.includes(pref.key)
                      ? 'bg-green-100 text-green-700 border border-green-300'
                      : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                  }`}>
                  {pref.icon} {pref.name}
                </button>
              ))}
            </div>
          </div>

          {/* Allergies — chip selector (same as Settings) */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Allergies</label>
            <div className="flex flex-wrap gap-1.5">
              {ALLERGY_OPTIONS.map((allergy) => (
                <button key={allergy.key} type="button" onClick={() => toggleAllergy(allergy.key)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    allergies.includes(allergy.key)
                      ? 'bg-red-100 text-red-700 border border-red-300'
                      : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                  }`}>
                  {allergy.icon} {allergy.name}
                </button>
              ))}
            </div>
          </div>

          <div><label className="block text-xs font-medium text-gray-700 mb-1">Meal Preference (flights)</label>
            <select value={mealPreference} onChange={e => setMealPreference(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="">Standard</option><option value="vegetarian">Vegetarian</option><option value="vegan">Vegan</option>
              <option value="halal">Halal</option><option value="kosher">Kosher</option><option value="child_meal">Child Meal</option>
              <option value="gluten_free">Gluten Free</option><option value="diabetic">Diabetic</option>
            </select></div>

          {/* Passport (collapsible) */}
          <div className="border border-gray-200 rounded-lg p-3">
            <button type="button" onClick={() => setShowPassportSection(!showPassportSection)}
              className="text-xs font-medium text-gray-700 flex items-center gap-1 w-full text-left">
              🛂 Passport / ID Details <span className="text-gray-400 ml-1">(optional, encrypted)</span>
              <span className={`ml-auto transition-transform ${showPassportSection ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {showPassportSection && (
              <div className="mt-3 space-y-3">
                <div><label className="block text-xs text-gray-600 mb-1">Full Name (as on passport)</label>
                  <input type="text" value={passportName} onChange={e => setPassportName(e.target.value)} placeholder="JOHN DOE" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs text-gray-600 mb-1">Passport Number</label>
                    <input type="text" value={passportNumber} onChange={e => setPassportNumber(e.target.value)} placeholder="AB1234567" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>
                  <div><label className="block text-xs text-gray-600 mb-1">Nationality (ISO code)</label>
                    <input type="text" value={passportNationality} onChange={e => setPassportNationality(e.target.value.toUpperCase())} placeholder="DE" maxLength={3} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase" /></div>
                </div>
                <div><label className="block text-xs text-gray-600 mb-1">Expiry Date</label>
                  <input type="date" value={passportExpiry} onChange={e => setPassportExpiry(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>
                <p className="text-[10px] text-gray-400">🔒 Passport data is encrypted with AES-256-GCM and stored securely.</p>
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500 disabled:opacity-50">
              {submitting ? 'Adding...' : 'Add Family Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit Family Member Modal ────────────────────────────────────────────────

function EditFamilyMemberModal({ member, onClose, onSaved }: { member: FamilyMember; onClose: () => void; onSaved: () => void }) {
  const [firstName, setFirstName] = useState(member.firstName);
  const [lastName, setLastName] = useState(member.lastName ?? '');
  const [relationship, setRelationship] = useState(member.relationship);
  const [allergies, setAllergies] = useState<string[]>(member.allergies);
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>(member.dietaryPreferences);
  const [seatPreference, setSeatPreference] = useState(member.seatPreference ?? '');
  const [mealPreference, setMealPreference] = useState(member.mealPreference ?? '');
  const [sharingScope, setSharingScope] = useState(member.sharingScope);
  const [saving, setSaving] = useState(false);

  // Fetch admin-managed options
  const [DIETARY_OPTIONS, setDietaryOptions] = useState<Array<{ key: string; name: string; icon: string }>>([]);
  const [ALLERGY_OPTIONS, setAllergyOptions] = useState<Array<{ key: string; name: string; icon: string }>>([]);

  useEffect(() => {
    api.get<{ data: any[] }>('/api/preferences/dietary').then(r => setDietaryOptions(r.data ?? [])).catch(() => {});
    api.get<{ data: any[] }>('/api/preferences/allergies').then(r => setAllergyOptions(r.data ?? [])).catch(() => {});
  }, []);

  const toggleDietary = (key: string) => {
    setDietaryPreferences(prev => prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key]);
  };
  const toggleAllergy = (key: string) => {
    setAllergies(prev => prev.includes(key) ? prev.filter(a => a !== key) : [...prev, key]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/api/family-members/${member.id}`, {
        firstName, lastName: lastName || null, relationship,
        allergies,
        dietaryPreferences,
        seatPreference: seatPreference || null, mealPreference: mealPreference || null,
        sharingScope,
      });
      onSaved();
    } catch { alert('Failed to update'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Edit Family Member</h3>
        <p className="text-sm text-gray-500 mb-4">{RELATIONSHIP_ICONS[member.relationship]} {member.firstName} {member.lastName ?? ''}</p>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-gray-700 mb-1">First Name</label>
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Last Name</label>
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>
          </div>

          <div><label className="block text-xs font-medium text-gray-700 mb-1">Relationship</label>
            <select value={relationship} onChange={e => setRelationship(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="spouse">Spouse</option><option value="partner">Partner</option>
              <option value="child">Child</option><option value="parent">Parent</option>
              <option value="sibling">Sibling</option><option value="grandparent">Grandparent</option>
              <option value="other">Other</option>
            </select></div>

          {/* Dietary Preferences — chip selector */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Dietary Preferences</label>
            <div className="flex flex-wrap gap-1.5">
              {DIETARY_OPTIONS.map((pref) => (
                <button key={pref.key} type="button" onClick={() => toggleDietary(pref.key)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    dietaryPreferences.includes(pref.key)
                      ? 'bg-green-100 text-green-700 border border-green-300'
                      : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                  }`}>
                  {pref.icon} {pref.name}
                </button>
              ))}
            </div>
          </div>

          {/* Allergies — chip selector */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Allergies</label>
            <div className="flex flex-wrap gap-1.5">
              {ALLERGY_OPTIONS.map((allergy) => (
                <button key={allergy.key} type="button" onClick={() => toggleAllergy(allergy.key)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    allergies.includes(allergy.key)
                      ? 'bg-red-100 text-red-700 border border-red-300'
                      : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                  }`}>
                  {allergy.icon} {allergy.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Seat Preference</label>
              <select value={seatPreference} onChange={e => setSeatPreference(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="">No preference</option><option value="window">Window</option>
                <option value="aisle">Aisle</option><option value="middle">Middle</option>
              </select></div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Meal Preference</label>
              <select value={mealPreference} onChange={e => setMealPreference(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="">Standard</option><option value="vegetarian">Vegetarian</option><option value="vegan">Vegan</option>
                <option value="halal">Halal</option><option value="kosher">Kosher</option><option value="child_meal">Child Meal</option>
              </select></div>
          </div>

          {/* Sharing scope */}
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Preference Sharing</label>
            <select value={sharingScope} onChange={e => setSharingScope(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="this_trip">Share for this trip only</option>
              <option value="all_trips">Share for all future trips</option>
              <option value="none">Don't share preferences</option>
            </select>
            <p className="text-[10px] text-gray-400 mt-1">Controls whether trip members can see this person's dietary needs and allergies.</p>
          </div>

          {member.hasPassportStored && (
            <div className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2">
              <p className="text-xs text-gray-600">🛂 Passport stored: {member.passportNumberMasked} ({member.passportNationality})</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Connection Modal ────────────────────────────────────────────────────

function AddConnectionModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email && !name) {
      setError('Please enter an email or name');
      return;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/api/connections', {
        email: email || undefined,
        name: name || undefined,
        label: label || undefined,
        notes: notes || undefined,
      });
      onAdded();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? 'Failed to add connection');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Travel Companion</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="friend@example.com"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              autoFocus
            />
            <p className="text-[10px] text-gray-400 mt-1">If they have an account, their profile will be linked automatically.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sarah"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Label</label>
            <div className="flex flex-wrap gap-1.5">
              {LABEL_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setLabel(label === opt ? '' : opt)}
                  className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                    label === opt
                      ? 'bg-primary-100 text-primary-700 border border-primary-300'
                      : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes <span className="text-gray-400">(optional)</span></label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How you know them..."
              maxLength={200}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500 disabled:opacity-50"
            >
              {submitting ? 'Adding...' : 'Add Companion'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit Connection Modal ───────────────────────────────────────────────────

function EditConnectionModal({ connection, onClose, onSaved }: { connection: Connection; onClose: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState(connection.label ?? '');
  const [privacy, setPrivacy] = useState(connection.privacy);
  const [notes, setNotes] = useState(connection.notes ?? '');
  const [status, setStatus] = useState(connection.status);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/api/connections/${connection.id}`, {
        label: label || null,
        privacy,
        notes: notes || null,
        status,
      });
      onSaved();
    } catch {
      alert('Failed to update connection');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Edit Connection</h3>
        <p className="text-sm text-gray-500 mb-4">{connection.name} {connection.email ? `(${connection.email})` : ''}</p>

        <div className="space-y-4">
          {/* Label */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Label</label>
            <div className="flex flex-wrap gap-1.5">
              {LABEL_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setLabel(label === opt ? '' : opt)}
                  className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                    label === opt
                      ? 'bg-primary-100 text-primary-700 border border-primary-300'
                      : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="connected">Connected</option>
              <option value="invited">Invited</option>
              <option value="declined">Declined</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>

          {/* Privacy */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">What they can see about you</label>
            <div className="space-y-1.5">
              {[
                { value: 'full', label: 'Full Profile', desc: 'Name, email, and avatar' },
                { value: 'limited', label: 'Limited', desc: 'Name and avatar only' },
                { value: 'minimal', label: 'Minimal', desc: 'Display name only' },
              ].map((opt) => (
                <label key={opt.value} className={`flex items-center gap-3 rounded-md border p-2.5 cursor-pointer transition-colors ${privacy === opt.value ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input
                    type="radio"
                    name="privacy"
                    value={opt.value}
                    checked={privacy === opt.value}
                    onChange={() => setPrivacy(opt.value)}
                    className="text-primary-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                    <p className="text-[10px] text-gray-500">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How you know them..."
              maxLength={200}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
