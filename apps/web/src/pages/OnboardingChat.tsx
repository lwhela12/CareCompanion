import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import {
  Send,
  Loader2,
  ArrowRight,
  Check,
  X,
  Pill,
  Calendar,
  Users,
  User,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CeeCeeAvatar } from '@/components/CeeCeeAvatar';
import { CeeCeeName } from '@/components/CeeCeeName';

const API_URL = import.meta.env.VITE_API_URL || '';

// CeeCee's initial greeting - asks for their name first
const INITIAL_AI_MESSAGE = `Hi I am CeeCee. I am here to help you get started with CareCompanion. If you'd rather do it yourself you can click skip and explore in the top right any time you want. Otherwise, let's start with your name. What should I call you?`;

// Types matching backend
interface CollectedPatientInfo {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  relationship: string;
}

interface CollectedMedication {
  name: string;
  dosage: string;
  frequency: string;
  scheduleTimes: string[];
  instructions?: string;
}

interface CollectedCareTask {
  title: string;
  description?: string;
  recurrenceType?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'once';
  priority?: 'high' | 'medium' | 'low';
}

interface CollectedFamilyMember {
  email: string;
  name?: string;
  role: 'caregiver' | 'family_member' | 'read_only';
  relationship: string;
}

interface OnboardingCollectedData {
  userName?: string;
  patient?: CollectedPatientInfo;
  medications: CollectedMedication[];
  careTasks: CollectedCareTask[];
  familyMembers: CollectedFamilyMember[];
  familyName?: string;
  conversationSummary?: string;
  dashboardWelcome?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

export function OnboardingChat() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  // Start with the AI greeting already shown
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'initial',
      role: 'assistant',
      content: INITIAL_AI_MESSAGE,
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [collectedData, setCollectedData] = useState<OnboardingCollectedData>({
    medications: [],
    careTasks: [],
    familyMembers: [],
  });
  const [showSummary, setShowSummary] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [shouldAutoConfirm, setShouldAutoConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-confirm handler (doesn't require button click)
  const handleConfirmAuto = useCallback(async () => {
    if (!collectedData.patient || isConfirming || isTransitioning) return;

    setIsConfirming(true);
    setError(null);

    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/v1/onboarding/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ collectedData }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to complete setup');
      }

      // Store full conversation history for the chat widget
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));
      localStorage.setItem('ceecee_onboarding_messages', JSON.stringify(conversationHistory));

      if (collectedData.userName) {
        localStorage.setItem('ceecee_user_name', collectedData.userName);
      }

      // Navigate immediately - dashboard will handle the transition
      setIsConfirming(false);
      navigate('/dashboard?welcome=true');
    } catch (err: any) {
      setError(err.message || 'Failed to complete setup');
      setIsConfirming(false);
      setShouldAutoConfirm(false);
    }
  }, [collectedData, isConfirming, getToken, navigate, messages]);

  // Auto-confirm and transition when ready_for_dashboard is called
  useEffect(() => {
    if (shouldAutoConfirm && !isLoading && collectedData.patient) {
      // Small delay to let the final message render
      const timer = setTimeout(() => {
        handleConfirmAuto();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [shouldAutoConfirm, isLoading, collectedData.patient, handleConfirmAuto]);

  const sendMessage = useCallback(async (messageContent?: string) => {
    const content = messageContent || input.trim();
    if (!content || isLoading) return;

    setInput('');
    setError(null);

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
    };
    setMessages(prev => [...prev, userMessage]);

    // Add placeholder for assistant response
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      isStreaming: true,
    };
    setMessages(prev => [...prev, assistantMessage]);
    setIsLoading(true);

    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/v1/onboarding/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: content,
          conversationHistory: messages.map(m => ({ role: m.role, content: m.content })),
          collectedData,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let fullResponse = '';
      let latestCollectedData = collectedData;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              switch (data.type) {
                case 'delta':
                  fullResponse += data.text;
                  setMessages(prev =>
                    prev.map(m =>
                      m.id === assistantMessage.id
                        ? { ...m, content: fullResponse }
                        : m
                    )
                  );
                  break;

                case 'tool_use':
                  // Handle ready_for_dashboard - CeeCee is ready to transition
                  if (data.toolName === 'ready_for_dashboard') {
                    // Store the dashboard welcome message
                    if (data.input?.dashboardWelcome) {
                      setCollectedData(prev => ({
                        ...prev,
                        dashboardWelcome: data.input.dashboardWelcome,
                        conversationSummary: data.input.conversationSummary,
                      }));
                    }
                    // Mark that we should auto-confirm after final message displays
                    setShouldAutoConfirm(true);
                  }
                  break;

                case 'tool_result':
                  if (data.collectedData) {
                    latestCollectedData = data.collectedData;
                    setCollectedData(data.collectedData);
                  }
                  break;

                case 'done':
                  if (data.collectedData) {
                    setCollectedData(data.collectedData);
                  }
                  setMessages(prev =>
                    prev.map(m =>
                      m.id === assistantMessage.id
                        ? { ...m, content: fullResponse, isStreaming: false }
                        : m
                    )
                  );
                  break;

                case 'error':
                  setError(data.message);
                  break;
              }
            } catch (e) {
              // Ignore JSON parse errors for incomplete chunks
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setMessages(prev => prev.filter(m => m.id !== assistantMessage.id));
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [input, isLoading, messages, collectedData, getToken]);

  const handleConfirm = async () => {
    if (!collectedData.patient) {
      setError('Please provide patient information before confirming');
      return;
    }

    setIsConfirming(true);
    setError(null);

    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/v1/onboarding/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ collectedData }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to complete setup');
      }

      // Store full conversation history for the chat widget
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));
      localStorage.setItem('ceecee_onboarding_messages', JSON.stringify(conversationHistory));

      if (collectedData.userName) {
        localStorage.setItem('ceecee_user_name', collectedData.userName);
      }

      // Trigger transition animation
      setIsConfirming(false);
      setIsTransitioning(true);

      // Wait for animation to complete, then navigate
      setTimeout(() => {
        navigate('/dashboard?welcome=true');
      }, 800);
    } catch (err: any) {
      setError(err.message || 'Failed to complete setup');
      setIsConfirming(false);
    }
  };

  const handleSkip = () => {
    navigate('/dashboard');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Count collected items
  const itemCount = {
    patient: collectedData.patient ? 1 : 0,
    medications: collectedData.medications.length,
    tasks: collectedData.careTasks.length,
    family: collectedData.familyMembers.length,
  };

  return (
    <>
      {/* Transition overlay */}
      {isTransitioning && (
        <div className="fixed inset-0 bg-gradient-to-br from-primary-50 to-white z-40 animate-fade-in" />
      )}

      <div
        ref={containerRef}
        className={cn(
          "min-h-screen bg-gradient-to-br from-primary-50 to-white flex flex-col transition-all duration-700 ease-in-out",
          isTransitioning && "fixed z-50 animate-shrink-to-corner"
        )}
        style={isTransitioning ? {
          transformOrigin: 'bottom right',
        } : undefined}
      >
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CeeCeeAvatar size="lg" />
          <div>
            <h1><CeeCeeName size="lg" /></h1>
            <p className="text-sm text-gray-500">Your care companion</p>
          </div>
        </div>
        <button
          onClick={handleSkip}
          className="text-gray-500 hover:text-gray-700 text-sm font-medium flex items-center gap-1"
        >
          Skip & Explore
          <ChevronRight className="h-4 w-4" />
        </button>
      </header>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex gap-3',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {/* CeeCee avatar for assistant messages */}
                {message.role === 'assistant' && (
                  <CeeCeeAvatar size="sm" className="flex-shrink-0 mt-1" />
                )}
                <div
                  className={cn(
                    'max-w-[75%] rounded-2xl px-4 py-3',
                    message.role === 'user'
                      ? 'bg-primary-600 text-white'
                      : 'bg-white shadow-sm border border-gray-100'
                  )}
                >
                  {message.content ? (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  ) : message.isStreaming ? (
                    <div className="flex gap-1 py-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-gray-200 bg-white p-4">
            {error && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                <X className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}
            <div className="flex gap-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                disabled={isLoading}
                rows={1}
                className="flex-1 resize-none rounded-xl border-2 border-gray-200 px-4 py-3 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 disabled:opacity-50 disabled:bg-gray-50"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading}
                className={cn(
                  'px-4 py-3 rounded-xl font-medium transition-all flex items-center gap-2',
                  input.trim() && !isLoading
                    ? 'bg-primary-600 text-white hover:bg-primary-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                )}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar - Collected data summary */}
        <div className="w-80 bg-white border-l border-gray-200 p-4 overflow-y-auto hidden lg:block">
          <h2 className="font-semibold text-gray-900 mb-4">Collected Information</h2>

          {/* Patient */}
          <div className="mb-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <User className="h-4 w-4" />
              Patient
              {collectedData.patient && <Check className="h-4 w-4 text-green-500 ml-auto" />}
            </div>
            {collectedData.patient ? (
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <p className="font-medium">{collectedData.patient.firstName} {collectedData.patient.lastName}</p>
                {collectedData.patient.dateOfBirth && (
                  <p className="text-gray-500">
                    {collectedData.patient.dateOfBirth.endsWith('-01-01')
                      ? `Age: ${new Date().getFullYear() - parseInt(collectedData.patient.dateOfBirth.slice(0, 4))}`
                      : `DOB: ${collectedData.patient.dateOfBirth}`
                    }
                  </p>
                )}
                <p className="text-gray-500 capitalize">{collectedData.patient.relationship}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Not yet provided</p>
            )}
          </div>

          {/* Medications */}
          <div className="mb-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Pill className="h-4 w-4" />
              Medications ({itemCount.medications})
            </div>
            {collectedData.medications.length > 0 ? (
              <div className="space-y-2">
                {collectedData.medications.map((med, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-3 text-sm">
                    <p className="font-medium">{med.name}</p>
                    <p className="text-gray-500">{med.dosage} - {med.frequency}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">None added yet</p>
            )}
          </div>

          {/* Care Tasks */}
          <div className="mb-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Calendar className="h-4 w-4" />
              Care Tasks ({itemCount.tasks})
            </div>
            {collectedData.careTasks.length > 0 ? (
              <div className="space-y-2">
                {collectedData.careTasks.map((task, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-3 text-sm">
                    <p className="font-medium">{task.title}</p>
                    {task.recurrenceType && (
                      <p className="text-gray-500 capitalize">{task.recurrenceType}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">None added yet</p>
            )}
          </div>

          {/* Family Members */}
          <div className="mb-6">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Users className="h-4 w-4" />
              Family Members ({itemCount.family})
            </div>
            {collectedData.familyMembers.length > 0 ? (
              <div className="space-y-2">
                {collectedData.familyMembers.map((member, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-3 text-sm">
                    <p className="font-medium">{member.name || member.email}</p>
                    <p className="text-gray-500 capitalize">{member.role.replace('_', ' ')}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">None invited yet</p>
            )}
          </div>

          {/* Confirm button */}
          {collectedData.patient && (
            <button
              onClick={handleConfirm}
              disabled={isConfirming}
              className="w-full bg-primary-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-primary-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isConfirming ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  Complete Setup
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Mobile summary modal */}
      {showSummary && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 lg:hidden">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Review Your Information</h2>
              <button onClick={() => setShowSummary(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Patient */}
            {collectedData.patient && (
              <div className="mb-4">
                <h3 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <User className="h-4 w-4" /> Patient
                </h3>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="font-medium">{collectedData.patient.firstName} {collectedData.patient.lastName}</p>
                  {collectedData.patient.dateOfBirth && (
                    <p className="text-sm text-gray-500">
                      {collectedData.patient.dateOfBirth.endsWith('-01-01')
                        ? `Age: ${new Date().getFullYear() - parseInt(collectedData.patient.dateOfBirth.slice(0, 4))}`
                        : `DOB: ${collectedData.patient.dateOfBirth}`
                      }
                    </p>
                  )}
                  <p className="text-sm text-gray-500 capitalize">{collectedData.patient.relationship}</p>
                </div>
              </div>
            )}

            {/* Medications */}
            {collectedData.medications.length > 0 && (
              <div className="mb-4">
                <h3 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Pill className="h-4 w-4" /> Medications
                </h3>
                <div className="space-y-2">
                  {collectedData.medications.map((med, i) => (
                    <div key={i} className="bg-gray-50 rounded-lg p-3">
                      <p className="font-medium">{med.name}</p>
                      <p className="text-sm text-gray-500">{med.dosage} - {med.frequency}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSummary(false)}
                className="flex-1 py-3 px-4 border-2 border-gray-200 rounded-xl font-medium hover:bg-gray-50"
              >
                Continue Chatting
              </button>
              <button
                onClick={handleConfirm}
                disabled={!collectedData.patient || isConfirming}
                className="flex-1 bg-primary-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isConfirming ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    Confirm
                    <Check className="h-5 w-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}

export default OnboardingChat;
