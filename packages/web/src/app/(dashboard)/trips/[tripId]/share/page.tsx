'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';

/**
 * AI-Powered Social Sharing
 * 
 * Generates shareable content from trip data using AI.
 * V1: Generate text → Copy → Open platform
 * V2: Direct posting via connected accounts
 * 
 * Status: UI STUB — Premium feature, implementation deferred.
 */

const TONES = [
  { id: 'casual', label: 'Casual', emoji: '😊', example: 'Had the best time exploring...' },
  { id: 'professional', label: 'Professional', emoji: '💼', example: 'Productive trip with cultural highlights...' },
  { id: 'funny', label: 'Funny', emoji: '😂', example: 'My GPS said turn left into a gelato shop...' },
  { id: 'inspirational', label: 'Inspirational', emoji: '✨', example: 'There\'s something about watching the sunset...' },
];

const PLATFORMS = [
  { id: 'facebook', label: 'Facebook', icon: '📘', color: 'bg-blue-600' },
  { id: 'twitter', label: 'Twitter / X', icon: '🐦', color: 'bg-black' },
  { id: 'instagram', label: 'Instagram', icon: '📷', color: 'bg-gradient-to-br from-purple-500 to-pink-500' },
  { id: 'whatsapp', label: 'WhatsApp', icon: '💬', color: 'bg-green-600' },
  { id: 'linkedin', label: 'LinkedIn', icon: '💼', color: 'bg-blue-700' },
  { id: 'copy', label: 'Copy Link', icon: '📋', color: 'bg-gray-600' },
];

export default function ShareTripPage() {
  const { tripId } = useParams();
  const [selectedTone, setSelectedTone] = useState('casual');
  const [customPrompt, setCustomPrompt] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [step, setStep] = useState<'configure' | 'preview' | 'shared'>('configure');

  const handleGenerate = () => {
    setIsGenerating(true);
    // Stub: simulate AI generation
    setTimeout(() => {
      setGeneratedText(
        `Just got back from an incredible trip! 🌍✈️\n\nThe highlights were absolutely unforgettable — from stunning architecture to amazing local cuisine. Every moment felt like a postcard.\n\n#travel #wanderlust #adventure #neyya`
      );
      setStep('preview');
      setIsGenerating(false);
    }, 2000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Share Your Trip</h1>
        <p className="text-sm text-gray-500 mt-1">Let AI craft the perfect post from your trip highlights</p>
      </div>

      {/* Premium Gate */}
      <div className="rounded-xl border-2 border-dashed border-purple-300 bg-purple-50 p-6">
        <div className="flex items-start gap-4">
          <span className="text-3xl">🤖</span>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">AI Social Sharing</h3>
            <p className="text-sm text-gray-600 mt-1">
              Our AI analyzes your trip — destinations visited, photos taken, and experiences — then crafts
              platform-perfect posts you can share with one click.
            </p>
            <span className="mt-2 inline-flex items-center rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-800">
              Premium Feature
            </span>
          </div>
        </div>
      </div>

      {/* Step 1: Configure */}
      {step === 'configure' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Tone</label>
            <div className="grid grid-cols-2 gap-3">
              {TONES.map((tone) => (
                <button
                  key={tone.id}
                  onClick={() => setSelectedTone(tone.id)}
                  className={`rounded-lg border-2 p-3 text-left transition-colors ${
                    selectedTone === tone.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-lg">{tone.emoji}</span>
                  <p className="font-medium text-sm text-gray-900 mt-1">{tone.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5 italic">"{tone.example}"</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Custom prompt (optional)
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g., Focus on the food experiences and sunset views..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none h-20"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full rounded-lg bg-primary-500 py-3 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
          >
            {isGenerating ? '🤖 Generating...' : '✨ Generate Share Content'}
          </button>
        </div>
      )}

      {/* Step 2: Preview & Share */}
      {step === 'preview' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <label className="block text-xs font-medium text-gray-500 mb-2">Generated Content (editable)</label>
            <textarea
              value={generatedText}
              onChange={(e) => setGeneratedText(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none h-32"
            />
          </div>

          {/* Photo selection placeholder */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-medium text-gray-500 mb-2">Selected Photos (AI picks best 1-4)</p>
            <div className="flex gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-20 h-20 rounded-lg bg-gray-200 flex items-center justify-center text-gray-400 text-xs">
                  Photo {i}
                </div>
              ))}
            </div>
          </div>

          {/* Platform buttons */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Share to:</p>
            <div className="grid grid-cols-3 gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  className={`${p.color} rounded-lg px-3 py-2.5 text-white text-sm font-medium hover:opacity-90 flex items-center justify-center gap-2`}
                >
                  <span>{p.icon}</span> {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep('configure')}
              className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              ← Regenerate
            </button>
            <button
              onClick={() => { navigator.clipboard.writeText(generatedText); setStep('shared'); }}
              className="flex-1 rounded-lg bg-primary-500 py-2.5 text-sm font-semibold text-white hover:bg-primary-600"
            >
              📋 Copy Text
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Success */}
      {step === 'shared' && (
        <div className="text-center py-8">
          <p className="text-4xl mb-3">🎉</p>
          <h3 className="text-lg font-semibold text-gray-900">Content Copied!</h3>
          <p className="text-sm text-gray-600 mt-1">Paste it into your favourite social platform.</p>
          <button
            onClick={() => setStep('configure')}
            className="mt-4 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Create Another Share
          </button>
        </div>
      )}
    </div>
  );
}
