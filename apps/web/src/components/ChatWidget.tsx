import { useEffect, useRef, useState, useCallback, useMemo, memo, useTransition, type ReactNode, type RefObject } from 'react';
import { X, Loader2, Send, ExternalLink, Plus, History, ChevronLeft, Paperclip, Image as ImageIcon, FileText, Check, BookOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { CeeCeeAvatar } from './CeeCeeAvatar';
import { CeeCeeName } from './CeeCeeName';

interface ChatAttachment {
  type: 'image' | 'document';
  url: string;
  mimeType: string;
  name: string;
  previewUrl?: string; // Local preview before upload
}

const API_URL = import.meta.env.VITE_API_URL || '';

// Dashboard welcome message shown after onboarding transition
const DASHBOARD_WELCOME_MESSAGE = "This is your dashboard! You can see the medications and tasks I've added. If you have any questions, I am right here! You can bring me up and ask questions any time.";

// Storage keys
const CHAT_MESSAGES_KEY = 'ceecee_chat_messages';
const CHAT_CONVERSATION_ID_KEY = 'ceecee_conversation_id';
const MARKDOWN_PLUGINS = [remarkGfm, remarkBreaks] as const;

// Get onboarding conversation history if available (persists until cleared)
function getOnboardingMessages(): { role: 'user' | 'assistant'; content: string }[] | null {
  const stored = localStorage.getItem('ceecee_onboarding_messages');
  if (stored) {
    try {
      const messages = JSON.parse(stored);
      // Don't remove - persist for the session so closing/reopening widget keeps history
      return messages;
    } catch {
      return null;
    }
  }
  return null;
}

// Clear onboarding messages (call when starting a fresh conversation)
function clearOnboardingMessages(): void {
  localStorage.removeItem('ceecee_onboarding_messages');
}

// Get persisted chat messages
function getPersistedMessages(): { role: 'user' | 'assistant'; content: string }[] | null {
  const stored = localStorage.getItem(CHAT_MESSAGES_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
}

// Persist chat messages
function persistMessages(messages: { role: 'user' | 'assistant'; content: string }[]): void {
  localStorage.setItem(CHAT_MESSAGES_KEY, JSON.stringify(messages));
}

// Clear persisted messages
function clearPersistedMessages(): void {
  localStorage.removeItem(CHAT_MESSAGES_KEY);
  localStorage.removeItem(CHAT_CONVERSATION_ID_KEY);
}

// Get persisted conversation ID
function getPersistedConversationId(): string | null {
  return localStorage.getItem(CHAT_CONVERSATION_ID_KEY);
}

// Persist conversation ID
function persistConversationId(id: string | null): void {
  if (id) {
    localStorage.setItem(CHAT_CONVERSATION_ID_KEY, id);
  } else {
    localStorage.removeItem(CHAT_CONVERSATION_ID_KEY);
  }
}

// Emit event when data is modified via chat (for other components to refresh)
function emitDataChanged(): void {
  window.dispatchEvent(new CustomEvent('ceecee-data-changed'));
}

// Get personalized greeting for returning users
function getInitialGreeting(): string | null {
  // Returning user greeting
  const userName = localStorage.getItem('ceecee_user_name');
  if (userName) {
    return `Hey ${userName}, how can I help today?`;
  }

  return null;
}

type ChatMessage = { role: 'user' | 'assistant'; content: string };

interface Conversation {
  id: string;
  title: string | null;
  updatedAt: string;
  messages?: { content: string; role: string }[];
  _count?: { messages: number };
}

interface SavedDocumentNotification {
  documentId: string;
  title: string;
  documentType: string;
  parsingStatus: 'COMPLETED' | 'FAILED' | 'PENDING';
  processingResult?: {
    providerId: string | null;
    journalEntryId: string | null;
    recommendationCount: number;
  };
}

const MessagesList = memo(
  function MessagesList({
    messages,
    isStreaming,
    markdownComponents,
    toMarkdownWithCitations,
    bottomRef,
  }: {
    messages: ChatMessage[];
    isStreaming: boolean;
    markdownComponents: any;
    toMarkdownWithCitations: (text: string) => string;
    bottomRef: RefObject<HTMLDivElement>;
  }) {
    return (
      <>
        {messages.length === 0 && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Ask about medications, care tasks, journal notes, or recommendations. I'll cite sources like [fact:ID] and [journal:ID].
          </div>
        )}
        {messages.map((m, idx) => {
          const isLastMessage = idx === messages.length - 1;
          const isTyping = m.role === 'assistant' && isLastMessage && isStreaming && !m.content;

          return (
            <div key={idx} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start gap-2'}>
              {m.role === 'assistant' && <CeeCeeAvatar size="sm" className="flex-shrink-0 mt-1" />}
              <div className={m.role === 'user' ? 'inline-block bg-primary-600 text-white px-3 py-2 rounded-xl max-w-[85%]' : 'inline-block bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-100 px-3 py-2 rounded-xl max-w-[80%]'}>
                {isTyping ? (
                  <div className="flex gap-1 py-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                ) : (
                  <div className="text-sm leading-relaxed">
                    <ReactMarkdown
                      remarkPlugins={MARKDOWN_PLUGINS}
                      components={markdownComponents}
                    >
                      {m.role === 'assistant' ? toMarkdownWithCitations(m.content) : m.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </>
    );
  },
  (prev, next) =>
    prev.isStreaming === next.isStreaming &&
    prev.messages === next.messages &&
    prev.markdownComponents === next.markdownComponents &&
    prev.toMarkdownWithCitations === next.toMarkdownWithCitations
);

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  // Initialize messages from localStorage if available
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const persisted = getPersistedMessages();
    return persisted || [];
  });
  const [, startTransition] = useTransition();
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  // Initialize conversationId from localStorage if available
  const [conversationId, setConversationId] = useState<string | null>(() => {
    return getPersistedConversationId();
  });
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<null | { type: 'fact'|'journal'|'document'; id: string }>(null);
  const [citationLoading, setCitationLoading] = useState(false);
  const [citationError, setCitationError] = useState('');
  const [citationData, setCitationData] = useState<any>(null);
  const [savedDocuments, setSavedDocuments] = useState<SavedDocumentNotification[]>([]);
  const [isSavingToJournal, setIsSavingToJournal] = useState(false);

  // Auto-open chat when coming from onboarding (?welcome=true)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('welcome') === 'true') {
      // Remove the param from URL without reload
      const url = new URL(window.location.href);
      url.searchParams.delete('welcome');
      window.history.replaceState({}, '', url.toString());

      // Load onboarding conversation history if available
      const onboardingMessages = getOnboardingMessages();
      if (onboardingMessages && onboardingMessages.length > 0) {
        // Add the dashboard welcome message at the end
        const messagesWithWelcome: ChatMessage[] = [
          ...onboardingMessages,
          { role: 'assistant', content: DASHBOARD_WELCOME_MESSAGE }
        ];
        setMessages(messagesWithWelcome);
      }

      // Open the chat
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  // Persist messages whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      persistMessages(messages);
    }
  }, [messages]);

  // Persist conversationId whenever it changes
  useEffect(() => {
    persistConversationId(conversationId);
  }, [conversationId]);

  const getAuthToken = useCallback(async (): Promise<string> => {
    try {
      // @ts-ignore
      const token = await window.Clerk?.session?.getToken();
      return token || '';
    } catch (e) {
      return '';
    }
  }, []);

  // Load conversation history
  const loadConversations = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const token = await getAuthToken();
      const resp = await fetch(`${API_URL}/api/v1/conversations?limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setConversations(data.conversations || []);
      }
    } catch (e) {
      console.error('Failed to load conversations', e);
    } finally {
      setLoadingHistory(false);
    }
  }, [getAuthToken]);

  // Load a specific conversation
  const loadConversation = async (id: string) => {
    try {
      const token = await getAuthToken();
      const resp = await fetch(`${API_URL}/api/v1/conversations/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        const loadedMessages: ChatMessage[] = (data.conversation?.messages || []).map((m: any) => ({
          role: m.role === 'USER' ? 'user' : 'assistant',
          content: m.content,
        }));
        setMessages(loadedMessages);
        setConversationId(id);
        setShowHistory(false);
      }
    } catch (e) {
      console.error('Failed to load conversation', e);
    }
  };

  // Start a new conversation
  const startNewConversation = () => {
    setConversationId(null);
    // Clear onboarding messages when explicitly starting fresh
    clearOnboardingMessages();
    // Clear persisted messages
    clearPersistedMessages();
    // Check for personalized greeting
    const greeting = getInitialGreeting();
    if (greeting) {
      setMessages([{ role: 'assistant', content: greeting }]);
    } else {
      setMessages([]);
    }
    setShowHistory(false);
  };

  // Save current conversation to journal
  const handleSaveToJournal = async () => {
    if (!conversationId || isSavingToJournal) return;
    setIsSavingToJournal(true);
    try {
      const token = await getAuthToken();
      const resp = await fetch(`${API_URL}/api/v1/conversations/${conversationId}/log-to-journal`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        // Show success message in chat
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Conversation saved to journal!'
        }]);
      } else {
        const error = await resp.json();
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Could not save: ${error.error?.message || 'Already saved or no messages'}`
        }]);
      }
    } catch (e) {
      console.error('Failed to save to journal', e);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Failed to save conversation. Please try again.'
      }]);
    } finally {
      setIsSavingToJournal(false);
    }
  };

  // Show greeting or load onboarding messages when widget opens with no messages
  useEffect(() => {
    if (open && messages.length === 0 && !conversationId && !showHistory) {
      // First check for onboarding messages (persists until user starts new conversation)
      const onboardingMessages = getOnboardingMessages();
      if (onboardingMessages && onboardingMessages.length > 0) {
        // Include the dashboard welcome if not already there
        const hasWelcome = onboardingMessages.some(m => m.content === DASHBOARD_WELCOME_MESSAGE);
        if (!hasWelcome) {
          setMessages([...onboardingMessages, { role: 'assistant', content: DASHBOARD_WELCOME_MESSAGE }]);
        } else {
          setMessages(onboardingMessages);
        }
        return;
      }
      // Fall back to personalized greeting
      const greeting = getInitialGreeting();
      if (greeting) {
        setMessages([{ role: 'assistant', content: greeting }]);
      }
    }
  }, [open]);

  // Load history when panel opens
  useEffect(() => {
    if (open && showHistory) {
      loadConversations();
    }
  }, [open, showHistory, loadConversations]);

  const onClickCitation = useCallback(async (type: 'fact'|'journal'|'document', id: string) => {
    setSelectedCitation({ type, id });
    setCitationError('');
    setCitationData(null);
    setCitationLoading(true);
    try {
      const token = await getAuthToken();
      let url = '';
      if (type === 'fact') url = `${API_URL}/api/v1/facts/${id}`;
      if (type === 'journal') url = `${API_URL}/api/v1/journal/${id}`;
      if (type === 'document') url = `${API_URL}/api/v1/documents/${id}`;
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) throw new Error('Failed to fetch source');
      const data = await resp.json();
      setCitationData(data);
    } catch (e: any) {
      setCitationError(e?.message || 'Failed to load source');
    } finally {
      setCitationLoading(false);
    }
  }, [getAuthToken]);

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let file: File = files[0];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (file.size > maxSize) {
      alert('File size must be less than 10MB');
      return;
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'application/pdf', 'text/plain', 'text/markdown'];
    const isTextFile = file.name.toLowerCase().endsWith('.txt') || file.name.toLowerCase().endsWith('.md');
    if (!allowedTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.heic') && !isTextFile) {
      alert('Allowed file types: Images (JPEG, PNG, GIF, WebP, HEIC), Documents (PDF, TXT, MD)');
      return;
    }

    setIsUploading(true);

    try {
      // Convert HEIC to JPEG (Claude doesn't support HEIC)
      if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
        try {
          const heic2any = (await import('heic2any')).default;
          const convertedBlob = await heic2any({
            blob: file,
            toType: 'image/jpeg',
            quality: 0.9,
          });
          const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
          file = new File(
            [blob],
            file.name.replace(/\.heic$/i, '.jpg'),
            { type: 'image/jpeg' }
          );
        } catch (conversionError) {
          console.error('HEIC conversion failed:', conversionError);
          alert('Failed to convert HEIC format. Please use JPG or PNG.');
          setIsUploading(false);
          return;
        }
      }

      const token = await getAuthToken();

      // Get presigned upload URL
      const uploadUrlResponse = await fetch(`${API_URL}/api/v1/ai/chat/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        }),
      });

      if (!uploadUrlResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadUrl, publicUrl } = await uploadUrlResponse.json();

      // Upload the file
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file');
      }

      // Create local preview for images
      let previewUrl: string | undefined;
      if (file.type.startsWith('image/')) {
        previewUrl = URL.createObjectURL(file);
      }

      // Add to attachments
      const attachment: ChatAttachment = {
        type: file.type.startsWith('image/') ? 'image' : 'document',
        url: publicUrl,
        mimeType: file.type,
        name: file.name,
        previewUrl,
      };

      setAttachments((prev) => [...prev, attachment]);
    } catch (error) {
      console.error('File upload error:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Remove attachment
  const removeAttachment = (index: number) => {
    setAttachments((prev) => {
      const attachment = prev[index];
      if (attachment.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const CITATION_REGEX = /\[(fact|journal|doc|document):([a-zA-Z0-9_-]+)\]/g;

  const toMarkdownWithCitations = useCallback(
    (text: string) =>
      text.replace(CITATION_REGEX, (_match, type, id) => {
        const normalizedType = type === 'doc' ? 'document' : type;
        return `[${normalizedType}:${id}](citation://${normalizedType}/${id})`;
      }),
    []
  );

  const markdownComponents = useMemo(() => ({
    a: ({ href, children }: { href?: string; children: ReactNode }) => {
      if (!href) return <span>{children}</span>;

      if (href.startsWith('citation://')) {
        const [, type, id] = href.split('/');
        return (
          <button
            onClick={() => onClickCitation(type as any, id)}
            className="text-primary-700 underline underline-offset-2 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300"
            title={`Open ${type} ${id}`}
          >
            {children}
          </button>
        );
      }

      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-primary-700 underline underline-offset-2 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300"
        >
          {children}
        </a>
      );
    },
    p: ({ children }: { children: ReactNode }) => (
      <p className="mb-2 last:mb-0 text-sm leading-relaxed text-inherit">{children}</p>
    ),
    ul: ({ children }: { children: ReactNode }) => (
      <ul className="list-disc pl-5 space-y-1 text-sm leading-relaxed text-inherit">{children}</ul>
    ),
    ol: ({ children }: { children: ReactNode }) => (
      <ol className="list-decimal pl-5 space-y-1 text-sm leading-relaxed text-inherit">{children}</ol>
    ),
    li: ({ children }: { children: ReactNode }) => <li className="pl-1">{children}</li>,
    code: ({ inline, children }: { inline?: boolean; children: ReactNode }) =>
      inline ? (
        <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-700 text-[13px]">{children}</code>
      ) : (
        <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 overflow-x-auto text-sm">
          <code>{children}</code>
        </pre>
      ),
    blockquote: ({ children }: { children: React.ReactNode }) => (
      <blockquote className="border-l-4 border-primary-200 dark:border-primary-700 pl-3 text-gray-700 dark:text-gray-300 italic text-sm leading-relaxed">
        {children}
      </blockquote>
    ),
  }), [onClickCitation]);

  const send = async () => {
    const query = input.trim();
    if (!query || isStreaming) {
      if (import.meta.env.DEV) {
        console.log('[ChatWidget] send() early return - query empty or already streaming');
      }
      return;
    }
    setInput('');

    // Capture attachments before clearing
    const currentAttachments = attachments.map((att) => ({
      type: att.type,
      url: att.url,
      mimeType: att.mimeType,
      name: att.name,
    }));

    // Clean up preview URLs
    attachments.forEach((att) => {
      if (att.previewUrl) {
        URL.revokeObjectURL(att.previewUrl);
      }
    });
    setAttachments([]);
    // Clear previous saved documents
    setSavedDocuments([]);

    setMessages((prev) => [...prev, { role: 'user', content: query }, { role: 'assistant', content: '' }]);
    setIsStreaming(true);
    if (import.meta.env.DEV) {
      console.log('[ChatWidget] send() starting fetch');
    }

    try {
      const resp = await fetch(`${API_URL}/api/v1/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`,
        },
        body: JSON.stringify({
          query,
          conversationId,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
        }),
      });

      if (!resp.ok || !resp.body) {
        throw new Error('Chat request failed');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let deltaReceiveCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        if (import.meta.env.DEV) {
          console.log('[ChatWidget] Chunk received, lines:', lines.length, 'raw:', chunk.substring(0, 100));
        }
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (!data) continue;
          try {
            const evt = JSON.parse(data);
            if (evt.type === 'conversation' && evt.conversationId) {
              // New conversation created
              setConversationId(evt.conversationId);
            } else if (evt.type === 'delta' && typeof evt.text === 'string') {
              deltaReceiveCount++;
              if (import.meta.env.DEV) {
                console.log('[ChatWidget] Delta #' + deltaReceiveCount + ':', evt.text.substring(0, 50));
              }
              startTransition(() => {
                setMessages((prev) => {
                  const copy = [...prev];
                  const lastIdx = copy.length - 1;
                  const last = copy[lastIdx];
                  if (last && last.role === 'assistant') {
                    copy[lastIdx] = { ...last, content: last.content + evt.text };
                  }
                  return copy;
                });
              });
            } else if (evt.type === 'tool_result' && evt.result?.success) {
              // Tool was executed - emit event so other components can refresh
              emitDataChanged();
            } else if (evt.type === 'document_saved') {
              // Document was saved from attachment
              setSavedDocuments((prev) => [...prev, {
                documentId: evt.documentId,
                title: evt.title,
                documentType: evt.documentType,
                parsingStatus: evt.parsingStatus,
                processingResult: evt.processingResult,
              }]);
              // Also emit data changed so Documents page can refresh
              emitDataChanged();
            } else if (evt.type === 'done' && evt.conversationId) {
              // Ensure we have the conversation ID
              setConversationId(evt.conversationId);
            } else if (evt.type === 'error') {
              setMessages((prev) => {
                const copy = [...prev];
                const lastIdx = copy.length - 1;
                const last = copy[lastIdx];
                if (last && last.role === 'assistant') {
                  copy[lastIdx] = { ...last, content: evt.message || 'An error occurred.' };
                }
                return copy;
              });
            }
          } catch {}
        }
      }
      // Final sanitize to remove any stutters while preserving anchors
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const copy = [...prev];
        const lastIdx = copy.length - 1;
        const last = copy[lastIdx];
        if (last && last.role === 'assistant' && last.content) {
          copy[lastIdx] = { ...last, content: sanitizeAnswer(last.content) };
        }
        return copy;
      });
    } catch (e: any) {
      setMessages((prev) => {
        const copy = [...prev];
        const lastIdx = copy.length - 1;
        const last = copy[lastIdx];
        if (last && last.role === 'assistant') {
          copy[lastIdx] = { ...last, content: 'Sorry, I ran into an issue. Please try again.' };
        }
        return copy;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  // Sanitize answer: light cleanup while preserving anchors
  // Note: Heavy deduplication removed since root cause was fixed in backend
  function sanitizeAnswer(text: string): string {
    // Normalize multiple spaces/newlines
    let cleaned = text.replace(/[ \t]{2,}/g, ' ');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    // Fix any duplicated label before anchors like 'journal [journal:ID]'
    return cleaned.replace(/(journal|fact|document)\s+\[(journal|fact|document):/gi, '[$2:');
  }

  return (
    <>
      {/* Floating button - CeeCee */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 rounded-full shadow-lg w-14 h-14 flex items-center justify-center hover:scale-105 transition-transform"
        aria-label="Chat with CeeCee"
      >
        <CeeCeeAvatar size="lg" />
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-40 w-[90vw] max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b dark:border-slate-700 bg-gray-50 dark:bg-slate-900">
            {showHistory ? (
              <>
                <button
                  onClick={() => setShowHistory(false)}
                  className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  aria-label="Back to chat"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="font-semibold text-gray-800 dark:text-gray-100">Chat History</div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <CeeCeeAvatar size="sm" />
                  <CeeCeeName />
                  <button
                    onClick={() => setShowHistory(true)}
                    className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-slate-700 rounded"
                    aria-label="View history"
                    title="Chat history"
                  >
                    <History className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleSaveToJournal}
                    disabled={!conversationId || isSavingToJournal}
                    className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-slate-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Save to journal"
                    title="Save conversation to journal"
                  >
                    {isSavingToJournal ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={startNewConversation}
                    className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-slate-700 rounded"
                    aria-label="New chat"
                    title="New conversation"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <button onClick={() => setOpen(false)} className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" aria-label="Close chat">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </>
            )}
          </div>

          {showHistory ? (
            // History view
            <div className="p-3 h-80 overflow-y-auto">
              {loadingHistory ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400 dark:text-gray-500" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">No previous conversations</div>
              ) : (
                <div className="space-y-2">
                  {conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => loadConversation(conv.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        conv.id === conversationId
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-700'
                      }`}
                    >
                      <div className="font-medium text-gray-800 dark:text-gray-100 text-sm truncate">
                        {conv.title || 'Untitled conversation'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {new Date(conv.updatedAt).toLocaleDateString()} • {conv._count?.messages || 0} messages
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // Chat view
            <>
              <div className="p-3 h-80 overflow-y-auto space-y-3">
                <MessagesList
                  messages={messages}
                  isStreaming={isStreaming}
                  markdownComponents={markdownComponents}
                  toMarkdownWithCitations={toMarkdownWithCitations}
                  bottomRef={bottomRef}
                />
              </div>

              {/* Citation viewer */}
              {selectedCitation && (
                <div className="border-t dark:border-slate-700 bg-gray-50 dark:bg-slate-900 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">Source: {selectedCitation.type}:{selectedCitation.id.substring(0, 8)}...</div>
                    <button onClick={() => { setSelectedCitation(null); setCitationData(null); setCitationError(''); }} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" aria-label="Close source"> <X className="h-4 w-4" /> </button>
                  </div>
                  {citationLoading && <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
                  {citationError && <div className="text-sm text-red-600 dark:text-red-400">{citationError}</div>}
                  {!citationLoading && !citationError && citationData && (
                    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-2 max-h-40 overflow-auto text-sm">
                      {selectedCitation.type === 'fact' && (
                        <div>
                          <div className="text-gray-800 dark:text-gray-100 font-medium">{citationData.fact?.entity?.displayName || citationData.fact?.entityId}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{citationData.fact?.entityType} • {citationData.fact?.key}</div>
                          <pre className="mt-1 whitespace-pre-wrap break-words text-xs dark:text-gray-300">{JSON.stringify(citationData.fact?.value, null, 2)}</pre>
                        </div>
                      )}
                      {selectedCitation.type === 'journal' && (
                        <div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{citationData.entry?.createdAt}</div>
                          <div className="mt-1 whitespace-pre-wrap break-words dark:text-gray-300">{citationData.entry?.content}</div>
                        </div>
                      )}
                      {selectedCitation.type === 'document' && (
                        <div>
                          <div className="text-gray-800 dark:text-gray-100 font-medium">{citationData.document?.title}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{citationData.document?.type}</div>
                          <div className="mt-2">
                            <a
                              className="inline-flex items-center gap-1 text-primary-700 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 underline underline-offset-2"
                              href="#"
                              onClick={async (e) => {
                                e.preventDefault();
                                try {
                                  const token = await getAuthToken();
                                  const r = await fetch(`${API_URL}/api/v1/documents/${selectedCitation.id}/download`, { headers: { Authorization: `Bearer ${token}` } });
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

              {/* Saved documents notification */}
              {savedDocuments.length > 0 && (
                <div className="px-3 py-2 border-t dark:border-slate-700 bg-green-50 dark:bg-green-900/20">
                  {savedDocuments.map((doc) => (
                    <div key={doc.documentId} className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                      <Check className="h-4 w-4 flex-shrink-0" />
                      <FileText className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">
                        <strong>{doc.title}</strong> saved to Documents
                        {doc.parsingStatus === 'COMPLETED' && doc.processingResult && (
                          <span className="text-green-600 dark:text-green-400 ml-1">
                            {doc.processingResult.recommendationCount > 0 && (
                              <> &bull; {doc.processingResult.recommendationCount} recommendation{doc.processingResult.recommendationCount !== 1 ? 's' : ''} found</>
                            )}
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="p-3 border-t dark:border-slate-700 bg-white dark:bg-slate-800">
                {/* Attachment preview */}
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {attachments.map((att, idx) => (
                      <div key={idx} className="relative group">
                        {att.type === 'image' && att.previewUrl ? (
                          <img
                            src={att.previewUrl}
                            alt={att.name}
                            className="h-16 w-16 object-cover rounded-lg border border-gray-200 dark:border-slate-600"
                          />
                        ) : (
                          <div className="h-16 w-16 bg-gray-100 dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600 flex flex-col items-center justify-center">
                            <Paperclip className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-14 px-1">{att.name.split('.').pop()}</span>
                          </div>
                        )}
                        <button
                          onClick={() => removeAttachment(idx)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Remove attachment"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp,image/heic,application/pdf,text/plain,text/markdown,.txt,.md"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <div className="flex items-end gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || isStreaming}
                    className="h-10 w-10 rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors"
                    aria-label="Attach file"
                    title="Attach image or document"
                  >
                    {isUploading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <ImageIcon className="h-5 w-5" />
                    )}
                  </button>
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    placeholder={attachments.length > 0 ? "Add a message about this..." : "Ask a question..."}
                    rows={2}
                    className="flex-1 resize-none border-2 border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 dark:placeholder-gray-400 rounded-xl px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  />
                  <button
                    onClick={send}
                    disabled={isStreaming || !input.trim()}
                    className="h-10 w-10 rounded-xl bg-primary-600 text-white flex items-center justify-center disabled:opacity-50 hover:bg-primary-700"
                    aria-label="Send"
                  >
                    {isStreaming ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

export default ChatWidget;
