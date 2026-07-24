'use client';

import { useState } from 'react';

const PLATFORMS = [
  { id: 'facebook', name: 'Facebook', icon: '📘', color: 'bg-blue-600', connected: false },
  { id: 'instagram', name: 'Instagram', icon: '📷', color: 'bg-gradient-to-br from-purple-500 to-pink-500', connected: false },
  { id: 'twitter', name: 'Twitter / X', icon: '🐦', color: 'bg-gray-900', connected: false },
  { id: 'linkedin', name: 'LinkedIn', icon: '💼', color: 'bg-blue-700', connected: false },
  { id: 'tiktok', name: 'TikTok', icon: '🎵', color: 'bg-gray-900', connected: false },
];

const TONES = ['casual', 'professional', 'funny', 'inspirational'];

export default function SocialMediaPage() {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');
  const [tone, setTone] = useState('casual');
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'create' | 'scheduled' | 'published' | 'analytics'>('create');

  const handleGenerate = () => {
    setGenerating(true);
    // Simulate AI generation
    setTimeout(() => {
      setGeneratedContent({
        facebook: `🌍 Exciting news for travellers! ${prompt}\n\nPlan smarter, travel better with Neyya.ai\n\n#travel #ai #adventure #neyya`,
        instagram: `✈️ ${prompt}\n\n🗺️ Your AI travel companion is here.\n\n#traveltips #wanderlust #travelapp #neyya #explore`,
        twitter: `${prompt.slice(0, 200)} 🌍✈️\n\nTry Neyya.ai — your AI travel companion\n\n#travel #AI`,
        linkedin: `I'm excited to share how AI is transforming travel planning.\n\n${prompt}\n\nAt Neyya.ai, we're building the future of intelligent travel management.\n\n#TravelTech #AI #Innovation`,
        tiktok: `Hook: "${prompt.slice(0, 50)}..."\n\nScript:\n1. Open with the problem\n2. Show Neyya solving it\n3. CTA: "Link in bio"\n\n#traveltok #ai #lifehack`,
      });
      setGenerating(false);
    }, 2000);
  };

  const handleSchedule = () => {
    if (!generatedContent) return;
    const newPost = {
      id: Date.now().toString(),
      platforms: selectedPlatforms,
      content: generatedContent,
      status: 'scheduled',
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    };
    setPosts([newPost, ...posts]);
    setGeneratedContent(null);
    setPrompt('');
    setActiveTab('scheduled');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Social Media</h1>
          <p className="text-sm text-gray-400 mt-1">Create, schedule, and monitor social media campaigns with AI</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-800 rounded-lg p-1 w-fit">
        {(['create', 'scheduled', 'published', 'analytics'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize ${activeTab === tab ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Connected Accounts */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Connected Accounts</h3>
        <div className="flex gap-3 flex-wrap">
          {PLATFORMS.map(p => (
            <button key={p.id}
              onClick={() => setSelectedPlatforms(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                selectedPlatforms.includes(p.id) ? 'border-emerald-500 bg-emerald-900/20 text-white' : 'border-gray-600 text-gray-400 hover:border-gray-500'
              }`}>
              <span>{p.icon}</span> {p.name}
              {!p.connected && <span className="text-[10px] text-amber-400">(connect)</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Create Tab */}
      {activeTab === 'create' && (
        <div className="space-y-4">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">AI Content Generator</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">What do you want to post about?</label>
                <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
                  placeholder="e.g., Announce our new trip photos feature, share a travel tip about packing light..."
                  className="w-full rounded-md border border-gray-600 bg-gray-700 text-white px-3 py-2 text-sm h-20 resize-none" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Tone</label>
                  <select value={tone} onChange={e => setTone(e.target.value)}
                    className="w-full rounded-md border border-gray-600 bg-gray-700 text-white px-3 py-2 text-sm">
                    {TONES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <button onClick={handleGenerate} disabled={generating || !prompt || selectedPlatforms.length === 0}
                    className="rounded-md bg-purple-600 px-6 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50">
                    {generating ? 'Generating...' : 'Generate'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Generated Preview */}
          {generatedContent && (
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-300">Generated Content</h3>
                <div className="flex gap-2">
                  <button onClick={() => setGeneratedContent(null)} className="text-xs text-gray-400 hover:text-white">Regenerate</button>
                  <button onClick={handleSchedule} className="rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-500">
                    Schedule Post
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedPlatforms.map(pid => {
                  const platform = PLATFORMS.find(p => p.id === pid);
                  return (
                    <div key={pid} className="rounded-lg border border-gray-600 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span>{platform?.icon}</span>
                        <span className="text-xs font-medium text-gray-300">{platform?.name}</span>
                      </div>
                      <textarea
                        defaultValue={generatedContent[pid] ?? ''}
                        className="w-full rounded-md border border-gray-600 bg-gray-700 text-white px-2 py-1.5 text-xs h-28 resize-none"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scheduled Tab */}
      {activeTab === 'scheduled' && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
          {posts.filter(p => p.status === 'scheduled').length > 0 ? (
            <div className="space-y-3">
              {posts.filter(p => p.status === 'scheduled').map(post => (
                <div key={post.id} className="rounded-lg border border-gray-600 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white">{post.platforms.join(', ')}</p>
                    <p className="text-xs text-gray-400">Scheduled: {new Date(post.scheduledAt).toLocaleString()}</p>
                  </div>
                  <button className="text-xs text-red-400 hover:text-red-300">Cancel</button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">No scheduled posts. Create one from the Create tab.</p>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 text-center">
              <p className="text-2xl font-bold text-white">0</p>
              <p className="text-xs text-gray-400">Total Posts</p>
            </div>
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 text-center">
              <p className="text-2xl font-bold text-blue-400">0</p>
              <p className="text-xs text-gray-400">Impressions</p>
            </div>
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 text-center">
              <p className="text-2xl font-bold text-emerald-400">0%</p>
              <p className="text-xs text-gray-400">Engagement Rate</p>
            </div>
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 text-center">
              <p className="text-2xl font-bold text-amber-400">0</p>
              <p className="text-xs text-gray-400">Followers Gained</p>
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 text-center text-gray-500">
            <p className="text-3xl mb-2">📊</p>
            <p className="text-sm">Connect your social accounts to see analytics</p>
            <p className="text-xs text-gray-600 mt-1">Performance data will appear here once accounts are connected and posts are published</p>
          </div>
        </div>
      )}

      {/* Published Tab */}
      {activeTab === 'published' && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 text-center text-gray-500">
          <p>No published posts yet.</p>
        </div>
      )}
    </div>
  );
}
