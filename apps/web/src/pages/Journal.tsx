import { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Plus, 
  Mic, 
  Lock,
  Unlock,
  Calendar,
  TrendingUp,
  AlertCircle,
  Search,
  Filter,
  ChevronRight,
  Edit2,
  Trash2,
  Loader2,
  X,
  Square,
  Pause,
  Play
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { format, formatDistanceToNow } from 'date-fns';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';

interface JournalEntry {
  id: string;
  content: string;
  sentiment?: 'positive' | 'neutral' | 'concerned' | 'urgent';
  isPrivate: boolean;
  attachmentUrls: string[];
  createdAt: string;
  user: {
    firstName: string;
    lastName: string;
  };
}

interface JournalInsights {
  totalEntries: number;
  sentimentDistribution: Record<string, number>;
  recentConcerns: Array<{
    content: string;
    sentiment: string;
    createdAt: string;
  }>;
  averageEntriesPerDay: string;
}

export function Journal() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [insights, setInsights] = useState<JournalInsights | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [newEntryContent, setNewEntryContent] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDays, setFilterDays] = useState(30);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
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
    maxDuration: 300, // 5 minutes for journal page
    silenceTimeout: 10,
    onSilenceDetected: () => {
      handleStopRecording();
    },
    onMaxDurationReached: () => {
      handleStopRecording();
    },
  });

  useEffect(() => {
    fetchData();
  }, [filterDays]);

  const fetchData = async () => {
    try {
      const [entriesRes, insightsRes] = await Promise.all([
        api.get(`/api/v1/journal?days=${filterDays}&includePrivate=true`),
        api.get('/api/v1/journal/insights?days=7')
      ]);
      
      setEntries(entriesRes.data.entries);
      setInsights(insightsRes.data.insights);
    } catch (err) {
      setError('Failed to load journal data');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitEntry = async () => {
    if (!newEntryContent.trim()) return;
    
    setIsSubmitting(true);
    setError('');
    
    try {
      const response = await api.post('/api/v1/journal', {
        content: newEntryContent,
        isPrivate,
        attachmentUrls: []
      });
      
      setEntries([response.data.entry, ...entries]);
      setNewEntryContent('');
      setShowNewEntry(false);
      setIsPrivate(false);
      
      // Refresh insights
      const insightsRes = await api.get('/api/v1/journal/insights?days=7');
      setInsights(insightsRes.data.insights);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to create entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateEntry = async () => {
    if (!editingEntry || !newEntryContent.trim()) return;
    
    setIsSubmitting(true);
    setError('');
    
    try {
      const response = await api.put(`/api/v1/journal/${editingEntry.id}`, {
        content: newEntryContent,
        isPrivate
      });
      
      setEntries(entries.map(e => e.id === editingEntry.id ? response.data.entry : e));
      setEditingEntry(null);
      setNewEntryContent('');
      setIsPrivate(false);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to update entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    
    try {
      await api.delete(`/api/v1/journal/${entryId}`);
      setEntries(entries.filter(e => e.id !== entryId));
    } catch (err) {
      setError('Failed to delete entry');
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

  const getAuthToken = async (): Promise<string> => {
    try {
      const token = await window.Clerk?.session?.getToken();
      return token || '';
    } catch (error) {
      console.error('Failed to get auth token:', error);
      return '';
    }
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

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch('/api/v1/journal/transcribe', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

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
                setNewEntryContent(prev => prev ? `${prev} ${transcribedText}` : transcribedText);
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

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive':
        return 'text-green-600 bg-green-50';
      case 'concerned':
        return 'text-yellow-600 bg-yellow-50';
      case 'urgent':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getSentimentIcon = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive':
        return <TrendingUp className="h-4 w-4" />;
      case 'concerned':
      case 'urgent':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const filteredEntries = entries.filter(entry => 
    entry.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.user.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.user.lastName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Care Journal</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track daily observations and care notes
          </p>
        </div>
        <button
          onClick={() => {
            setShowNewEntry(true);
            setEditingEntry(null);
            setNewEntryContent('');
            setIsPrivate(false);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          New Entry
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* Insights Summary */}
      {insights && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Total Entries</span>
              <BookOpen className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{insights.totalEntries}</p>
            <p className="text-xs text-gray-500">Last 7 days</p>
          </div>
          
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Daily Average</span>
              <Calendar className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{insights.averageEntriesPerDay}</p>
            <p className="text-xs text-gray-500">Entries per day</p>
          </div>
          
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Mood Trend</span>
              <TrendingUp className="h-5 w-5 text-gray-400" />
            </div>
            <div className="flex gap-2">
              {Object.entries(insights.sentimentDistribution).map(([sentiment, count]) => (
                <div key={sentiment} className={cn("px-2 py-1 rounded text-xs font-medium", getSentimentColor(sentiment))}>
                  {sentiment}: {count}
                </div>
              ))}
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Concerns</span>
              <AlertCircle className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{insights.recentConcerns.length}</p>
            <p className="text-xs text-gray-500">Needs attention</p>
          </div>
        </div>
      )}

      {/* New/Edit Entry Form */}
      {(showNewEntry || editingEntry) && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {editingEntry ? 'Edit Entry' : 'New Journal Entry'}
            </h2>
            <button
              onClick={() => {
                setShowNewEntry(false);
                setEditingEntry(null);
                setNewEntryContent('');
                setIsPrivate(false);
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <textarea
                value={newEntryContent}
                onChange={(e) => setNewEntryContent(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                rows={5}
                placeholder="What happened today? How is the patient doing?"
                autoFocus
              />
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleVoiceToggle}
                    disabled={recordingStatus === 'transcribing'}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors relative",
                      recordingStatus === 'recording' 
                        ? "bg-red-100 text-red-700 hover:bg-red-200"
                        : recordingStatus === 'transcribing'
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
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
                        <span>Voice Input</span>
                      </>
                    )}
                  </button>
                  
                  {isRecording && isPaused && (
                    <button
                      onClick={resumeRecording}
                      className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      title="Resume recording"
                    >
                      <Play className="h-4 w-4" />
                    </button>
                  )}
                  
                  {isRecording && !isPaused && (
                    <button
                      onClick={pauseRecording}
                      className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      title="Pause recording"
                    >
                      <Pause className="h-4 w-4" />
                    </button>
                  )}
                  
                  <button
                    onClick={() => setIsPrivate(!isPrivate)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                      isPrivate
                        ? "bg-primary-100 text-primary-700"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    )}
                  >
                    {isPrivate ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                    {isPrivate ? 'Private' : 'Shared'}
                  </button>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setShowNewEntry(false);
                      setEditingEntry(null);
                      setNewEntryContent('');
                      setIsPrivate(false);
                    }}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={editingEntry ? handleUpdateEntry : handleSubmitEntry}
                    disabled={isSubmitting || !newEntryContent.trim()}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {editingEntry ? 'Update' : 'Save Entry'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search entries..."
            className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        
        <select
          value={filterDays}
          onChange={(e) => setFilterDays(Number(e.target.value))}
          className="px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last year</option>
        </select>
      </div>

      {/* Journal Entries */}
      <div className="space-y-4">
        {filteredEntries.length === 0 ? (
          <div className="card text-center py-12">
            <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No journal entries found</p>
            <p className="text-sm text-gray-400 mt-1">
              {searchQuery ? 'Try adjusting your search' : 'Start by creating your first entry'}
            </p>
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <div key={entry.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">
                      {entry.user.firstName} {entry.user.lastName}
                    </span>
                    {entry.isPrivate && (
                      <Lock className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                  {entry.sentiment && (
                    <span className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                      getSentimentColor(entry.sentiment)
                    )}>
                      {getSentimentIcon(entry.sentiment)}
                      {entry.sentiment}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingEntry(entry);
                      setNewEntryContent(entry.content);
                      setIsPrivate(entry.isPrivate);
                      setShowNewEntry(false);
                    }}
                    className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteEntry(entry.id)}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <p className="text-gray-700 whitespace-pre-wrap mb-3">{entry.content}</p>
              
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <time dateTime={entry.createdAt}>
                  {format(new Date(entry.createdAt), 'MMM d, yyyy • h:mm a')}
                </time>
                <span>•</span>
                <span>{formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}