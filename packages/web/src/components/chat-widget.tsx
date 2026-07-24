'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  intent?: string;
  created_at?: string;
}

interface ChatSession {
  id: string;
  session_token: string;
  source: string;
}

// ─── Chat Widget Component ───────────────────────────────────────────────────

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [hasNotification, setHasNotification] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check if user is authenticated
  const getToken = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('accessToken');
  };

  const isAuthenticated = () => !!getToken();

  // ─── Session Management ──────────────────────────────────────────────────

  const createOrResumeSession = useCallback(async () => {
    const storedToken = localStorage.getItem('neyya_chat_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const authToken = getToken();
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    try {
      const res = await fetch(`${API_URL}/api/chat/sessions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          session_token: storedToken || undefined,
          source: isAuthenticated() ? 'in_app' : 'landing_page',
          page_url: window.location.href,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const sess = data.session;
        setSession(sess);
        localStorage.setItem('neyya_chat_token', sess.session_token);

        // Load existing messages if resuming
        if (sess.message_count > 0) {
          await loadMessages(sess.id, headers);
        }
      }
    } catch {
      // Session creation failed, widget still works (will retry on message send)
    }
  }, []);

  const loadMessages = async (sessionId: string, headers: Record<string, string>) => {
    try {
      const res = await fetch(`${API_URL}/api/chat/sessions/${sessionId}/messages`, { headers });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
      }
    } catch { /* ignore */ }
  };

  // ─── Message Sending ─────────────────────────────────────────────────────

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading || rateLimited) return;

    const userMsg: ChatMessage = { role: 'user', content: content.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Ensure we have a session
      let currentSession = session;
      if (!currentSession) {
        await createOrResumeSession();
        currentSession = session;
      }

      if (!currentSession) {
        // Create inline if needed
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const authToken = getToken();
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

        const sessRes = await fetch(`${API_URL}/api/chat/sessions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            source: isAuthenticated() ? 'in_app' : 'landing_page',
            page_url: window.location.href,
          }),
        });
        if (sessRes.ok) {
          const sessData = await sessRes.json();
          currentSession = sessData.session;
          setSession(currentSession);
          localStorage.setItem('neyya_chat_token', currentSession!.session_token);
        }
      }

      if (!currentSession) {
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: "I'm having trouble connecting. Please try again in a moment.",
        }]);
        return;
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const authToken = getToken();
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const res = await fetch(`${API_URL}/api/chat/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          session_id: currentSession.id,
          content: content.trim(),
          page_url: window.location.href,
          browser_info: navigator.userAgent,
        }),
      });

      if (res.status === 429) {
        setRateLimited(true);
        const data = await res.json();
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: `You've reached your daily message limit (${data.limit} messages). ${data.upgrade ? 'Upgrade your plan for more!' : ''}`,
        }]);
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: data.message.content,
          intent: data.message.intent,
        }]);

        // Show feedback captured notification
        if (data.feedbackCaptured) {
          const feedbackType = data.feedbackCaptured.type === 'bug' ? 'bug report'
            : data.feedbackCaptured.type === 'feature_request' ? 'feature request'
            : 'feedback';
          setMessages((prev) => [...prev, {
            role: 'system',
            content: `Your ${feedbackType} has been captured and will be reviewed by our team.`,
          }]);
        }
      } else {
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: "I'm sorry, I encountered an issue. Please try again.",
        }]);
      }
    } catch {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: "Connection error. Please check your internet and try again.",
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Quick Actions ───────────────────────────────────────────────────────

  const quickActions = [
    { label: 'Get Help', message: 'How do I get started with Neyya?' },
    { label: 'Report Bug', message: 'I want to report a bug' },
    { label: 'Request Feature', message: 'I have a feature request' },
  ];

  // ─── Escalation ──────────────────────────────────────────────────────────

  const escalateToHuman = async () => {
    if (!session) return;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const authToken = getToken();
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    try {
      const res = await fetch(`${API_URL}/api/chat/sessions/${session.id}/escalate`, {
        method: 'POST',
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, {
          role: 'system',
          content: data.message,
        }]);
      }
    } catch { /* ignore */ }
  };

  // ─── Rating ──────────────────────────────────────────────────────────────

  const rateSession = async (rating: number) => {
    if (!session) return;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const authToken = getToken();
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    try {
      await fetch(`${API_URL}/api/chat/sessions/${session.id}/rate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ rating }),
      });
      setShowRating(false);
      setMessages((prev) => [...prev, {
        role: 'system',
        content: 'Thanks for your feedback!',
      }]);
    } catch { /* ignore */ }
  };

  // ─── Effects ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isOpen && !session) {
      createOrResumeSession();
    }
  }, [isOpen, session, createOrResumeSession]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Show notification dot after 30s on landing page
  useEffect(() => {
    if (!isAuthenticated() && !isOpen) {
      const timer = setTimeout(() => setHasNotification(true), 30000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Show rating prompt after 5+ messages
  useEffect(() => {
    const userMsgCount = messages.filter((m) => m.role === 'user').length;
    if (userMsgCount >= 5 && !showRating) {
      setShowRating(true);
    }
  }, [messages, showRating]);

  // ─── Greeting ────────────────────────────────────────────────────────────

  const getGreeting = (): string => {
    if (isAuthenticated()) {
      return "Hi! I'm Neyya's AI assistant. Need help with anything?";
    }
    return "Hi! I'm Neyya's AI assistant. Ask me anything about travel planning with Neyya.";
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      {/* Floating Bubble */}
      {!isOpen && (
        <button
          onClick={() => { setIsOpen(true); setHasNotification(false); }}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg transition-all hover:bg-emerald-600 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2"
          aria-label="Open chat assistant"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {/* Notification dot */}
          {hasNotification && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500" />
            </span>
          )}
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col w-[380px] h-[520px] rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden max-sm:inset-0 max-sm:w-full max-sm:h-full max-sm:rounded-none max-sm:bottom-0 max-sm:right-0">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-emerald-500 text-white shrink-0">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-emerald-400 flex items-center justify-center text-sm font-bold">
                N
              </div>
              <div>
                <p className="text-sm font-semibold">Neyya AI</p>
                <p className="text-[10px] text-emerald-100 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-300 inline-block" />
                  Online
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded hover:bg-emerald-600 transition"
              aria-label="Minimize chat"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {/* Greeting */}
            {messages.length === 0 && (
              <div className="flex gap-2">
                <div className="h-7 w-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-emerald-600 text-xs font-bold">N</span>
                </div>
                <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-3 py-2 max-w-[85%]">
                  <p className="text-sm text-gray-800">{getGreeting()}</p>
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="h-7 w-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-emerald-600 text-xs font-bold">N</span>
                  </div>
                )}
                {msg.role === 'system' ? (
                  <div className="w-full text-center">
                    <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-1.5 inline-block">
                      {msg.content}
                    </p>
                  </div>
                ) : (
                  <div
                    className={`rounded-2xl px-3 py-2 max-w-[85%] ${
                      msg.role === 'user'
                        ? 'bg-emerald-500 text-white rounded-tr-sm'
                        : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex gap-2">
                <div className="h-7 w-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <span className="text-emerald-600 text-xs font-bold">N</span>
                </div>
                <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            {/* Rating prompt */}
            {showRating && (
              <div className="text-center py-2">
                <p className="text-xs text-gray-500 mb-1">How helpful was this?</p>
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => rateSession(star)}
                      className="text-lg hover:scale-125 transition"
                      aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                    >
                      {'⭐'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions (show when no messages) */}
          {messages.length === 0 && (
            <div className="px-4 pb-2 flex gap-2 flex-wrap shrink-0">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => sendMessage(action.message)}
                  className="text-xs px-3 py-1.5 rounded-full border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}

          {/* Input Area */}
          <div className="border-t border-gray-200 px-3 py-2 shrink-0">
            <form
              onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={rateLimited ? 'Daily limit reached' : 'Type a message...'}
                disabled={rateLimited}
                maxLength={2000}
                className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 disabled:bg-gray-100 disabled:text-gray-400"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading || rateLimited}
                className="h-9 w-9 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition shrink-0"
                aria-label="Send message"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </form>

            {/* Footer */}
            <div className="flex items-center justify-between mt-1.5 px-1">
              <span className="text-[10px] text-gray-400">Powered by AI</span>
              <button
                onClick={escalateToHuman}
                className="text-[10px] text-gray-400 hover:text-emerald-600 transition"
              >
                Talk to human
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
