'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Language {
  code: string;
  name: string;
  native_name: string;
}

export function LanguageSwitcher() {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [current, setCurrent] = useState('en');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api.get<{ data: Language[] }>('/api/i18n/languages')
      .then(r => setLanguages(r.data ?? []))
      .catch(() => {});

    // Get user's current language preference
    api.get<{ data: { language: string } }>('/api/users/me/locale')
      .then(r => { if (r.data?.language) setCurrent(r.data.language); })
      .catch(() => {});
  }, []);

  const handleChange = async (code: string) => {
    setCurrent(code);
    setOpen(false);
    await api.put('/api/users/me/locale', { language: code }).catch(() => {});
    // In a full implementation, this would trigger a context update and re-render
    // For now, reload to apply
    window.location.reload();
  };

  const currentLang = languages.find(l => l.code === current);

  if (languages.length <= 1) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 transition-colors"
        title="Change language"
      >
        <span>🌐</span>
        <span>{currentLang?.native_name ?? 'English'}</span>
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-50 w-48 rounded-md border border-gray-200 bg-white shadow-lg py-1 max-h-64 overflow-y-auto">
            {languages.map(lang => (
              <button
                key={lang.code}
                onClick={() => handleChange(lang.code)}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${current === lang.code ? 'bg-primary-50 text-primary-700' : 'text-gray-700'}`}
              >
                <span>{lang.native_name}</span>
                <span className="text-xs text-gray-400">{lang.code}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
