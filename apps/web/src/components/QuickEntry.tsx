import { useState, useEffect } from 'react';
import { 
  X, 
  Loader2,
  AlertCircle,
  Mic,
  Lock,
  Unlock,
  Square,
  Pause,
  Play
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';

interface QuickEntryProps {
  onClose: () => void;
  onSave: () => void;
  patientName?: string;
}

export function QuickEntry({ onClose, onSave, patientName = 'the patient' }: QuickEntryProps) {
  const [content, setContent] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'transcribing'>('idle');

  const {
    isRecording,
    isPaused,
    duration,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    error: recordingError,
  } = useAudioRecorder({
    maxDuration: 180, // 3 minutes
    silenceTimeout: 10, // 10 seconds
    onSilenceDetected: () => {
      handleStopRecording();
    },
    onMaxDurationReached: () => {
      handleStopRecording();
    },
  });

  const handleSubmit = async () => {
    if (!content.trim()) return;
    
    setIsSubmitting(true);
    setError('');
    
    try {
      await api.post('/api/v1/journal', {
        content,
        isPrivate,
        attachmentUrls: []
      });
      
      onSave();
      setContent('');
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to save entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (recordingError) {
      setError(recordingError);
    }
  }, [recordingError]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartRecording = async () => {
    setError('');
    setRecordingStatus('recording');
    await startRecording();
  };

  const handleStopRecording = async () => {
    if (!isRecording) return;
    
    setRecordingStatus('transcribing');
    const audioBlob = await stopRecording();
    
    if (!audioBlob) {
      setError('No audio recorded');
      setRecordingStatus('idle');
      return;
    }

    // Transcribe the audio
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch('/api/v1/journal/transcribe', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`, // You'll need to implement this
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      // Handle SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        throw new Error('No response stream');
      }

      let transcribedText = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              break;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                transcribedText += parsed.text;
                // Append to existing content with a space
                setContent(prev => prev ? `${prev} ${transcribedText}` : transcribedText);
              }
              if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to transcribe audio');
    } finally {
      setRecordingStatus('idle');
    }
  };

  const handleVoiceToggle = () => {
    if (recordingStatus === 'idle') {
      handleStartRecording();
    } else if (recordingStatus === 'recording') {
      handleStopRecording();
    }
  };

  // Helper function to get auth token from Clerk
  const getAuthToken = async (): Promise<string> => {
    try {
      const token = await window.Clerk?.session?.getToken();
      return token || '';
    } catch (error) {
      console.error('Failed to get auth token:', error);
      return '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center p-4 z-50">
      <div className={cn(
        "bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl transition-all",
        recordingStatus === 'recording' && "ring-4 ring-red-500 ring-opacity-50"
      )}>
        <div className="p-6 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Quick Entry</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Jot down a quick note about {patientName}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full px-4 py-3 border-2 border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 dark:placeholder-gray-400 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
            rows={6}
            placeholder="What's happening right now? Any observations, concerns, or updates?"
            autoFocus
          />

          {error && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-3">
              <button
                onClick={handleVoiceToggle}
                disabled={recordingStatus === 'transcribing'}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors relative",
                  recordingStatus === 'recording'
                    ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-400 dark:hover:bg-red-900/60"
                    : recordingStatus === 'transcribing'
                    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-700 dark:text-gray-300 dark:hover:bg-slate-600"
                )}
              >
                {recordingStatus === 'recording' ? (
                  <>
                    <div className="absolute -top-1 -left-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    <Square className="h-4 w-4" />
                    <span>Stop ({formatDuration(duration)})</span>
                  </>
                ) : recordingStatus === 'transcribing' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Transcribing...</span>
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4" />
                    <span>Voice</span>
                  </>
                )}
              </button>

              {isRecording && isPaused && (
                <button
                  onClick={resumeRecording}
                  className="p-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg transition-colors"
                  title="Resume recording"
                >
                  <Play className="h-4 w-4 dark:text-gray-300" />
                </button>
              )}

              {isRecording && !isPaused && (
                <button
                  onClick={pauseRecording}
                  className="p-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg transition-colors"
                  title="Pause recording"
                >
                  <Pause className="h-4 w-4 dark:text-gray-300" />
                </button>
              )}

              <button
                onClick={() => setIsPrivate(!isPrivate)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  isPrivate
                    ? "bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-400"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-700 dark:text-gray-300 dark:hover:bg-slate-600"
                )}
              >
                {isPrivate ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                {isPrivate ? 'Private' : 'Shared'}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !content.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Entry
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            Tip: Press {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to save quickly
          </p>
        </div>
      </div>
    </div>
  );
}