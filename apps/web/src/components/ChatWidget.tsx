import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Loader2, Send, ExternalLink } from 'lucide-react';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<null | { type: 'fact'|'journal'|'document'; id: string }>(null);
  const [citationLoading, setCitationLoading] = useState(false);
  const [citationError, setCitationError] = useState('');
  const [citationData, setCitationData] = useState<any>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  const getAuthToken = async (): Promise<string> => {
    try {
      // @ts-ignore
      const token = await window.Clerk?.session?.getToken();
      return token || '';
    } catch (e) {
      return '';
    }
  };

  const onClickCitation = async (type: 'fact'|'journal'|'document', id: string) => {
    setSelectedCitation({ type, id });
    setCitationError('');
    setCitationData(null);
    setCitationLoading(true);
    try {
      const token = await getAuthToken();
      let url = '';
      if (type === 'fact') url = `/api/v1/facts/${id}`;
      if (type === 'journal') url = `/api/v1/journal/${id}`;
      if (type === 'document') url = `/api/v1/documents/${id}`;
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) throw new Error('Failed to fetch source');
      const data = await resp.json();
      setCitationData(data);
    } catch (e: any) {
      setCitationError(e?.message || 'Failed to load source');
    } finally {
      setCitationLoading(false);
    }
  };

  const renderWithCitations = (text: string) => {
    const parts: Array<{ t: 'text'|'cite'; value: string; ctype?: 'fact'|'journal'|'document'; cid?: string }> = [];
    const regex = /\[(fact|journal|doc|document):([a-zA-Z0-9_-]+)\]/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const [full, kind, id] = match;
      if (match.index > lastIndex) {
        parts.push({ t: 'text', value: text.slice(lastIndex, match.index) });
      }
      const ctype = kind === 'doc' ? 'document' : (kind as any);
      parts.push({ t: 'cite', value: full, ctype, cid: id });
      lastIndex = match.index + full.length;
    }
    if (lastIndex < text.length) parts.push({ t: 'text', value: text.slice(lastIndex) });

    return (
      <span className="whitespace-pre-wrap break-words">
        {parts.map((p, idx) => {
          if (p.t === 'text') return <span key={idx}>{p.value}</span>;
          return (
            <button
              key={idx}
              onClick={() => onClickCitation(p.ctype as any, p.cid as string)}
              className="text-primary-700 underline underline-offset-2 hover:text-primary-800"
              title={`Open ${p.ctype} ${p.cid}`}
            >
              {p.value}
            </button>
          );
        })}
      </span>
    );
  };

  const send = async () => {
    const query = input.trim();
    if (!query || isStreaming) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: query }, { role: 'assistant', content: '' }]);
    setIsStreaming(true);

    try {
      const resp = await fetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`,
        },
        body: JSON.stringify({ query }),
      });

      if (!resp.ok || !resp.body) {
        throw new Error('Chat request failed');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (!data) continue;
          try {
            const evt = JSON.parse(data);
            if (evt.type === 'delta' && typeof evt.text === 'string') {
              setMessages((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last && last.role === 'assistant') {
                  last.content += evt.text;
                }
                return copy;
              });
            } else if (evt.type === 'error') {
              setMessages((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last && last.role === 'assistant') {
                  last.content = last.content || 'An error occurred.';
                }
                return copy;
              });
            }
          } catch {}
        }
      }
    } catch (e: any) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, I ran into an issue.' }]);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 rounded-full bg-primary-600 text-white shadow-lg w-14 h-14 flex items-center justify-center hover:bg-primary-700"
        aria-label="Open chat"
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-40 w-[90vw] max-w-md bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
            <div className="font-semibold text-gray-800">Care Chat</div>
            <button onClick={() => setOpen(false)} className="p-2 text-gray-500 hover:text-gray-700" aria-label="Close chat">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-3 h-80 overflow-y-auto space-y-3">
            {messages.length === 0 && (
              <div className="text-sm text-gray-500">Ask about recent recommendations, journal notes, or medications. I’ll cite sources like [fact:ID] and [journal:ID].</div>
            )}
            {messages.map((m, idx) => (
              <div key={idx} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                <div className={m.role === 'user' ? 'inline-block bg-primary-600 text-white px-3 py-2 rounded-xl' : 'inline-block bg-gray-100 text-gray-800 px-3 py-2 rounded-xl'}>
                  <div className="text-sm">{m.role === 'assistant' ? renderWithCitations(m.content) : <span className="whitespace-pre-wrap break-words">{m.content}</span>}</div>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Citation viewer */}
          {selectedCitation && (
            <div className="border-t bg-gray-50 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-gray-800">Source: {selectedCitation.type}:{selectedCitation.id}</div>
                <button onClick={() => { setSelectedCitation(null); setCitationData(null); setCitationError(''); }} className="text-gray-500 hover:text-gray-700" aria-label="Close source"> <X className="h-4 w-4" /> </button>
              </div>
              {citationLoading && <div className="flex items-center gap-2 text-sm text-gray-600"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
              {citationError && <div className="text-sm text-red-600">{citationError}</div>}
              {!citationLoading && !citationError && citationData && (
                <div className="bg-white border border-gray-200 rounded-lg p-2 max-h-40 overflow-auto text-sm">
                  {selectedCitation.type === 'fact' && (
                    <div>
                      <div className="text-gray-800 font-medium">{citationData.fact?.entity?.displayName || citationData.fact?.entityId}</div>
                      <div className="text-xs text-gray-500">{citationData.fact?.entityType} • {citationData.fact?.key}</div>
                      <pre className="mt-1 whitespace-pre-wrap break-words">{JSON.stringify(citationData.fact?.value, null, 2)}</pre>
                      {Array.isArray(citationData.fact?.sources) && citationData.fact.sources.length > 0 && (
                        <div className="mt-2">
                          <div className="text-xs font-semibold text-gray-700">Sources</div>
                          <ul className="text-xs text-gray-600 list-disc pl-4">
                            {citationData.fact.sources.map((s: any, i: number) => (
                              <li key={i}>{s.type || s.sourceType}:{s.sourceId}{s.section ? ` • ${s.section}` : ''}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  {selectedCitation.type === 'journal' && (
                    <div>
                      <div className="text-xs text-gray-500">{citationData.entry?.createdAt}</div>
                      <div className="mt-1 whitespace-pre-wrap break-words">{citationData.entry?.content}</div>
                    </div>
                  )}
                  {selectedCitation.type === 'document' && (
                    <div>
                      <div className="text-gray-800 font-medium">{citationData.document?.title}</div>
                      <div className="text-xs text-gray-500">{citationData.document?.type}</div>
                      <div className="mt-1 text-xs text-gray-600 break-words">{citationData.document?.url}</div>
                      <div className="mt-2">
                        <a
                          className="inline-flex items-center gap-1 text-primary-700 hover:text-primary-800 underline underline-offset-2"
                          href="#"
                          onClick={async (e) => {
                            e.preventDefault();
                            try {
                              const token = await getAuthToken();
                              const r = await fetch(`/api/v1/documents/${selectedCitation.id}/download`, { headers: { Authorization: `Bearer ${token}` } });
                              const j = await r.json();
                              if (j.downloadUrl) window.open(j.downloadUrl, '_blank');
                            } catch {}
                          }}
                        >
                          <ExternalLink className="h-4 w-4" /> Download
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="p-3 border-t bg-white">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Ask a question..."
                rows={2}
                className="flex-1 resize-none border-2 border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
              />
              <button
                onClick={send}
                disabled={isStreaming || !input.trim()}
                className="h-10 w-10 rounded-xl bg-primary-600 text-white flex items-center justify-center disabled:opacity-50"
                aria-label="Send"
              >
                {isStreaming ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ChatWidget;
