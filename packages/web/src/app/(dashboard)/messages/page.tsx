'use client';

import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';

interface Conversation {
  id: string;
  type: string;
  name: string;
  tripId: string | null;
  participantCount: number;
  participants: Array<{ id: string; name: string }>;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  hasUnread: boolean;
}

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  contentType: string;
  metadata: any;
  isEdited: boolean;
  aiModel: string | null;
  threadCount: number;
  reactions: Array<{ emoji: string; count: number }>;
  createdAt: string;
}

const TYPE_ICONS: Record<string, string> = { dm: '💬', group: '👥', family: '👨‍👩‍👧‍👦', trip: '✈️', broadcast: '📢' };
const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '👎', '🤔'];

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showNewConv, setShowNewConv] = useState(false);
  const [threadOpen, setThreadOpen] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<any[]>([]);
  const [threadReply, setThreadReply] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<{ data: Conversation[] }>('/api/conversations')
      .then(res => setConversations(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadMessages = async (conv: Conversation) => {
    setActiveConv(conv);
    setThreadOpen(null);
    const res = await api.get<{ data: Message[] }>(`/api/conversations/${conv.id}/messages`);
    setMessages(res.data ?? []);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !activeConv) return;
    setSending(true);
    try {
      await api.post(`/api/conversations/${activeConv.id}/messages`, { content: newMessage });
      setNewMessage('');
      // Reload messages
      const res = await api.get<{ data: Message[] }>(`/api/conversations/${activeConv.id}/messages`);
      setMessages(res.data ?? []);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch { /* error */ }
    finally { setSending(false); }
  };

  const handleReact = async (messageId: string, emoji: string) => {
    await api.post(`/api/messages/${messageId}/reactions`, { emoji });
    if (activeConv) {
      const res = await api.get<{ data: Message[] }>(`/api/conversations/${activeConv.id}/messages`);
      setMessages(res.data ?? []);
    }
  };

  const openThread = async (messageId: string) => {
    setThreadOpen(messageId);
    const res = await api.get<{ data: any[] }>(`/api/messages/${messageId}/thread`);
    setThreadMessages(res.data ?? []);
  };

  const sendThreadReply = async () => {
    if (!threadReply.trim() || !activeConv || !threadOpen) return;
    await api.post(`/api/conversations/${activeConv.id}/messages`, { content: threadReply, parentMessageId: threadOpen });
    setThreadReply('');
    const res = await api.get<{ data: any[] }>(`/api/messages/${threadOpen}/thread`);
    setThreadMessages(res.data ?? []);
    // Also refresh main messages for thread count
    const mainRes = await api.get<{ data: Message[] }>(`/api/conversations/${activeConv.id}/messages`);
    setMessages(mainRes.data ?? []);
  };

  const handleCreateConversation = async (type: string, participantIds: string[], name?: string) => {
    const res = await api.post<{ data: { id: string } }>('/api/conversations', { type, participantIds, name });
    // Refresh conversation list
    const listRes = await api.get<{ data: Conversation[] }>('/api/conversations');
    setConversations(listRes.data ?? []);
    const newConv = (listRes.data ?? []).find(c => c.id === res.data.id);
    if (newConv) loadMessages(newConv);
    setShowNewConv(false);
  };

  if (loading) return <div className="animate-pulse h-96 bg-gray-200 rounded-lg" />;

  return (
    <div className="flex h-[calc(100vh-8rem)] rounded-lg border border-gray-200 bg-white overflow-hidden">
      {/* Conversation list (left sidebar) */}
      <div className="w-80 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Messages</h2>
          <button onClick={() => setShowNewConv(true)} className="rounded-md bg-primary-600 px-2.5 py-1 text-xs text-white hover:bg-primary-500">+ New</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">
              <p>No conversations yet.</p>
              <p className="mt-1">Start a chat with someone from your network.</p>
            </div>
          ) : (
            conversations.map(conv => (
              <button key={conv.id} onClick={() => loadMessages(conv)}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${activeConv?.id === conv.id ? 'bg-primary-50 border-l-2 border-l-primary-500' : ''}`}>
                <div className="flex items-center gap-2">
                  <span className="text-sm">{TYPE_ICONS[conv.type] ?? '💬'}</span>
                  <span className={`text-sm font-medium truncate flex-1 ${conv.hasUnread ? 'text-gray-900' : 'text-gray-700'}`}>{conv.name}</span>
                  {conv.hasUnread && <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />}
                </div>
                {conv.lastMessagePreview && (
                  <p className="text-[11px] text-gray-400 truncate mt-0.5 ml-6">{conv.lastMessagePreview}</p>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area (right) */}
      <div className="flex-1 flex flex-col">
        {!activeConv ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            <div className="text-center">
              <p className="text-4xl mb-2">💬</p>
              <p>Select a conversation to start chatting</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
              <span>{TYPE_ICONS[activeConv.type] ?? '💬'}</span>
              <h3 className="font-medium text-gray-900 text-sm">{activeConv.name}</h3>
              <span className="text-[10px] text-gray-400">({activeConv.participantCount} members)</span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.map(msg => (
                <div key={msg.id} className="group">
                  <div className={`flex gap-2 ${msg.contentType === 'ai_response' ? 'ml-6' : ''}`}>
                    {/* Avatar */}
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
                      msg.contentType === 'ai_response' ? 'bg-purple-100 text-purple-600' : 'bg-primary-100 text-primary-600'
                    }`}>
                      {msg.contentType === 'ai_response' ? '🤖' : msg.senderName?.charAt(0) ?? '?'}
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-900">{msg.contentType === 'ai_response' ? 'AI Assistant' : msg.senderName}</span>
                        <span className="text-[10px] text-gray-400">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {msg.isEdited && <span className="text-[9px] text-gray-400">(edited)</span>}
                      </div>
                      <p className={`text-sm mt-0.5 whitespace-pre-line ${msg.contentType === 'ai_response' ? 'text-purple-800 bg-purple-50 rounded-md px-2 py-1' : 'text-gray-700'}`}>
                        {msg.content}
                      </p>

                      {/* Reactions */}
                      <div className="flex items-center gap-1 mt-1">
                        {msg.reactions?.map(r => (
                          <span key={r.emoji} className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px]">
                            {r.emoji} {r.count}
                          </span>
                        ))}
                        {/* Reaction picker (on hover) */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 ml-1">
                          {REACTION_EMOJIS.map(e => (
                            <button key={e} onClick={() => handleReact(msg.id, e)} className="hover:scale-125 transition-transform text-xs">{e}</button>
                          ))}
                          {msg.threadCount > 0 ? (
                            <button onClick={() => openThread(msg.id)} className="ml-2 text-[10px] text-primary-600 hover:underline">
                              💬 {msg.threadCount} replies
                            </button>
                          ) : (
                            <button onClick={() => openThread(msg.id)} className="ml-2 text-[10px] text-gray-400 hover:text-primary-600">
                              Reply
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Thread panel */}
            {threadOpen && (
              <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 max-h-48 overflow-y-auto">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-600">Thread</p>
                  <button onClick={() => setThreadOpen(null)} className="text-xs text-gray-400 hover:text-gray-600">✕ Close</button>
                </div>
                {threadMessages.map(tm => (
                  <div key={tm.id} className="flex gap-2 mb-2">
                    <span className="text-[10px] font-medium text-gray-700">{tm.senderName}:</span>
                    <span className="text-xs text-gray-600">{tm.content}</span>
                  </div>
                ))}
                <div className="flex gap-2 mt-2">
                  <input type="text" value={threadReply} onChange={e => setThreadReply(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendThreadReply()}
                    placeholder="Reply in thread..." className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs" />
                  <button onClick={sendThreadReply} className="text-xs bg-primary-600 text-white px-2 py-1 rounded">Reply</button>
                </div>
              </div>
            )}

            {/* Message input */}
            <div className="px-4 py-3 border-t border-gray-200">
              <div className="flex gap-2">
                <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                  placeholder="Type a message... (use @AI for AI help)"
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
                <button onClick={handleSend} disabled={sending || !newMessage.trim()}
                  className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500 disabled:opacity-50">
                  {sending ? '...' : 'Send'}
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Tip: Use @AI to ask the AI assistant. Hover messages for reactions and threads.</p>
            </div>
          </>
        )}
      </div>

      {/* New Conversation Modal */}
      {showNewConv && <NewConversationModal onClose={() => setShowNewConv(false)} onCreate={handleCreateConversation} />}
    </div>
  );
}

// ─── New Conversation Modal ──────────────────────────────────────────────────

function NewConversationModal({ onClose, onCreate }: { onClose: () => void; onCreate: (type: string, ids: string[], name?: string) => void }) {
  const [type, setType] = useState<'dm' | 'group'>('dm');
  const [name, setName] = useState('');
  const [contacts, setContacts] = useState<Array<{ id: string; name: string; email: string | null }>>([]);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    api.get<{ data: Array<{ id: string; connectedUserId: string; name: string; email: string | null }> }>('/api/connections/suggest')
      .then(res => setContacts((res.data ?? []).map(c => ({ id: c.connectedUserId ?? c.id, name: c.name, email: c.email }))))
      .catch(() => {});
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">New Conversation</h3>

        {/* Type selector */}
        <div className="flex gap-2 mb-4">
          <button onClick={() => setType('dm')} className={`flex-1 py-2 text-xs rounded-md border ${type === 'dm' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200'}`}>
            💬 Direct Message
          </button>
          <button onClick={() => setType('group')} className={`flex-1 py-2 text-xs rounded-md border ${type === 'group' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200'}`}>
            👥 Group Chat
          </button>
        </div>

        {type === 'group' && (
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">Group Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Barcelona Planning"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
        )}

        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-700 mb-1">Select participants</label>
          <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
            {contacts.map(c => (
              <label key={c.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={selected.includes(c.id)}
                  onChange={e => setSelected(e.target.checked ? [...selected, c.id] : selected.filter(id => id !== c.id))}
                  className="rounded border-gray-300 text-primary-600" />
                <span className="text-sm text-gray-700">{c.name}</span>
                {c.email && <span className="text-[10px] text-gray-400">{c.email}</span>}
              </label>
            ))}
            {contacts.length === 0 && <p className="px-3 py-4 text-xs text-gray-400 text-center">No contacts found. Add people to your network first.</p>}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm">Cancel</button>
          <button onClick={() => onCreate(type, selected, name || undefined)} disabled={selected.length === 0}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500 disabled:opacity-50">
            {type === 'dm' ? 'Start Chat' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
}
