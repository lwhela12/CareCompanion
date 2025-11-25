import { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Download,
  Trash2,
  Upload,
  Search,
  Filter,
  File,
  Calendar,
  User,
  Tag,
  Loader2,
  AlertCircle,
  Wand2,
  Eye,
  RefreshCw,
  Edit2,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { UploadDocumentModal } from '@/components/UploadDocumentModal';

interface Document {
  id: string;
  title: string;
  description?: string;
  type: 'MEDICAL_RECORD' | 'FINANCIAL' | 'LEGAL' | 'INSURANCE' | 'OTHER';
  url: string;
  tags: string[];
  parsingStatus?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  parsedData?: any;
  uploadedBy: {
    firstName: string;
    lastName: string;
  };
  createdAt: string;
  updatedAt: string;
}

const DOCUMENT_TYPES = [
  { value: 'all', label: 'All Documents' },
  { value: 'MEDICAL_RECORD', label: 'Medical Records' },
  { value: 'FINANCIAL', label: 'Financial' },
  { value: 'LEGAL', label: 'Legal' },
  { value: 'INSURANCE', label: 'Insurance' },
  { value: 'OTHER', label: 'Other' },
];

const getDocumentTypeIcon = (type: string) => {
  switch (type) {
    case 'MEDICAL_RECORD':
      return '🏥';
    case 'FINANCIAL':
      return '💰';
    case 'LEGAL':
      return '⚖️';
    case 'INSURANCE':
      return '🛡️';
    default:
      return '📄';
  }
};

const getDocumentTypeColor = (type: string) => {
  switch (type) {
    case 'MEDICAL_RECORD':
      return 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700';
    case 'FINANCIAL':
      return 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700';
    case 'LEGAL':
      return 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700';
    case 'INSURANCE':
      return 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700';
    default:
      return 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-600';
  }
};

export function Documents() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [error, setError] = useState('');
  const [showParseModal, setShowParseModal] = useState(false);
  const [parseTarget, setParseTarget] = useState<Document | null>(null);
  const [parseStatus, setParseStatus] = useState<string>('');
  const [parseStream, setParseStream] = useState<string>('');
  const [parseResult, setParseResult] = useState<any>(null);
  const [parseError, setParseError] = useState<string>('');
  const [isParsing, setIsParsing] = useState<boolean>(false);
  // Rename modal state (pops out edit box with full title)
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Document | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState('');
  const renameTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    filterDocuments();
  }, [documents, searchQuery, selectedType]);

  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/api/v1/documents');
      setDocuments(response.data.documents);
      setError('');
    } catch (err: any) {
      console.error('Error fetching documents:', err);
      setError('Failed to load documents');
      toast.error('Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  };

  const filterDocuments = () => {
    let filtered = documents;

    // Filter by type
    if (selectedType !== 'all') {
      filtered = filtered.filter(doc => doc.type === selectedType);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(doc =>
        doc.title.toLowerCase().includes(query) ||
        doc.description?.toLowerCase().includes(query) ||
        doc.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    setFilteredDocuments(filtered);
  };

  const getAuthToken = async (): Promise<string> => {
    try {
      // @ts-ignore
      const token = await window.Clerk?.session?.getToken();
      return token || '';
    } catch (e) {
      return '';
    }
  };

  const beginParse = async (doc: Document) => {
    setParseTarget(doc);
    setShowParseModal(true);
    setParseStatus('Starting...');
    setParseStream('');
    setParseResult(null);
    setParseError('');
    setIsParsing(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const resp = await fetch(`${apiUrl}/api/v1/documents/${doc.id}/parse`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await getAuthToken()}`,
        },
      });

      if (!resp.ok || !resp.body) {
        throw new Error('Failed to start parsing');
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
            if (evt.type === 'status') {
              setParseStatus(evt.status || '');
            } else if (evt.type === 'delta' && typeof evt.text === 'string') {
              setParseStream((prev) => prev + evt.text);
            } else if (evt.type === 'result') {
              setParseResult(evt.parsed);
            } else if (evt.type === 'error') {
              setParseError(evt.message || 'Parsing failed');
            } else if (evt.type === 'done') {
              // no-op
            }
          } catch (_) {
            // ignore parse errors
          }
        }
      }
      // refresh list to reflect parsedData/parsingStatus
      await fetchDocuments();
    } catch (e: any) {
      setParseError(e?.message || 'Failed to parse document');
    } finally {
      setIsParsing(false);
    }
  };

  const closeParseModal = () => {
    setShowParseModal(false);
    setParseTarget(null);
    setParseStatus('');
    setParseStream('');
    setParseResult(null);
    setParseError('');
    setIsParsing(false);
  };

  // Open rename modal (shows full title in an expanded editor)
  const openRenameModal = (doc: Document) => {
    setRenameTarget(doc);
    setRenameTitle(doc.title);
    setRenameError('');
    setShowRenameModal(true);
  };

  // Auto-size textarea when opening or typing
  useEffect(() => {
    if (showRenameModal && renameTextareaRef.current) {
      const el = renameTextareaRef.current;
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [showRenameModal, renameTitle]);

  const submitRename = async () => {
    if (!renameTarget) return;
    const newTitle = renameTitle.trim();
    if (!newTitle) {
      setRenameError('Title cannot be empty');
      return;
    }
    setRenameSaving(true);
    setRenameError('');
    try {
      const res = await api.put(`/api/v1/documents/${renameTarget.id}`, { title: newTitle });
      setDocuments((prev) => prev.map(d => d.id === renameTarget.id ? { ...d, title: res.data.document.title } : d));
      setFilteredDocuments((prev) => prev.map(d => d.id === renameTarget.id ? { ...d, title: res.data.document.title } : d));
      setShowRenameModal(false);
    } catch (e: any) {
      setRenameError(e?.response?.data?.error?.message || 'Failed to rename document');
    } finally {
      setRenameSaving(false);
    }
  };

  const renderStatusPill = (status?: Document['parsingStatus']) => {
    if (!status) return null;
    if (status === 'COMPLETED') {
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700 ml-2 shrink-0">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Parsed
        </span>
      );
    }
    if (status === 'PROCESSING') {
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-700 ml-2 shrink-0">
          <Clock className="h-3.5 w-3.5" />
          Parsing
        </span>
      );
    }
    if (status === 'FAILED') {
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700 ml-2 shrink-0" title="Parsing failed">
          <XCircle className="h-3.5 w-3.5" />
          Failed
        </span>
      );
    }
    // PENDING or unknown
    return null;
  };

  const handleDownload = async (document: Document) => {
    try {
      const response = await api.get(`/api/v1/documents/${document.id}/download`);
      const { downloadUrl } = response.data;

      // Open download URL in new tab
      window.open(downloadUrl, '_blank');
      toast.success('Download started');
    } catch (err: any) {
      console.error('Error downloading document:', err);
      toast.error('Failed to download document');
    }
  };

  const handleDelete = async (document: Document) => {
    if (!confirm(`Are you sure you want to delete "${document.title}"?`)) {
      return;
    }

    try {
      await api.delete(`/api/v1/documents/${document.id}`);
      toast.success('Document deleted successfully');
      fetchDocuments();
    } catch (err: any) {
      console.error('Error deleting document:', err);
      toast.error('Failed to delete document');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] dark:bg-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600 dark:text-primary-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Documents</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage medical records, financial documents, and more
          </p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 dark:bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-700 dark:hover:bg-primary-600 transition-colors w-full sm:w-auto"
        >
          <Upload className="h-5 w-5" />
          Upload Document
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* Search and Filter Bar */}
      <div className="card dark:bg-slate-800 dark:border-slate-700">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-slate-700 dark:text-gray-100 dark:placeholder-gray-400"
            />
          </div>

          {/* Type Filter */}
          <div className="sm:w-64">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500" />
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none bg-white dark:bg-slate-700 dark:text-gray-100"
              >
                {DOCUMENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Documents Grid */}
      {filteredDocuments.length === 0 ? (
        <div className="card dark:bg-slate-800 dark:border-slate-700 text-center py-12">
          <FileText className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No documents found</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {searchQuery || selectedType !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Upload your first document to get started'}
          </p>
          {!searchQuery && selectedType === 'all' && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 dark:bg-primary-500 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-600 transition-colors"
            >
              <Upload className="h-5 w-5" />
              Upload Document
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map((doc) => (
            <div
              key={doc.id}
              className="card dark:bg-slate-800 hover:shadow-lg transition-shadow border-2 border-gray-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-600 overflow-hidden flex flex-col h-full"
            >
              {/* Document Icon and Type */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 bg-gray-100 dark:bg-slate-700 rounded-lg flex items-center justify-center text-2xl">
                    {getDocumentTypeIcon(doc.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 break-words">{doc.title}</h3>
                        <span
                          className={cn(
                            'inline-block text-xs px-2 py-1 rounded-full border mt-1',
                            getDocumentTypeColor(doc.type)
                          )}
                        >
                          {doc.type.replace('_', ' ')}
                        </span>
                      </div>
                      <button
                        onClick={() => openRenameModal(doc)}
                        className="p-2 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg shrink-0"
                        title="Rename document"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
                {/* Parsing status badge */}
                <div className="shrink-0">{renderStatusPill(doc.parsingStatus)}</div>
              </div>

              {/* Description */}
              {doc.description && (
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">{doc.description}</p>
              )}

              {/* Tags */}
              {doc.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3 max-h-16 overflow-hidden">
                  {doc.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded"
                    >
                      <Tag className="h-3 w-3" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Metadata */}
              <div className="space-y-2 text-xs text-gray-500 dark:text-gray-400 mb-4">
                <div className="flex items-center gap-2">
                  <User className="h-3 w-3" />
                  <span>
                    Uploaded by {doc.uploadedBy.firstName} {doc.uploadedBy.lastName}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-3 w-3" />
                  <span>{format(new Date(doc.createdAt), 'MMM d, yyyy')}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-200 dark:border-slate-700">
                <button
                  onClick={() => handleDownload(doc)}
                  className="flex-1 basis-full sm:basis-auto flex items-center justify-center gap-2 px-3 py-2 bg-primary-600 dark:bg-primary-500 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-600 transition-colors text-sm font-medium"
                >
                  <Download className="h-4 w-4" />
                  Download
                </button>
                <button
                  onClick={() => beginParse(doc)}
                  disabled={doc.parsingStatus === 'PROCESSING'}
                  className={cn(
                    'flex-1 basis-full sm:basis-auto flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium',
                    doc.parsingStatus === 'PROCESSING'
                      ? 'bg-gray-200 dark:bg-slate-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                      : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50'
                  )}
                  title={doc.parsingStatus === 'COMPLETED' ? 'Re-parse document' : 'Parse document'}
                >
                  {doc.parsingStatus === 'COMPLETED' ? <RefreshCw className="h-4 w-4" /> : <Wand2 className="h-4 w-4" />}
                  {doc.parsingStatus === 'COMPLETED' ? 'Re-parse' : 'Parse'}
                </button>
                {doc.parsedData && (
                  <button
                    onClick={() => {
                      setParseTarget(doc);
                      setParseResult(doc.parsedData);
                      setParseStream('');
                      setParseStatus('');
                      setParseError('');
                      setShowParseModal(true);
                    }}
                    className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors shrink-0"
                    title="View structured data"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(doc)}
                  className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors shrink-0"
                  title="Delete document"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Document Modal */}
      {showUploadModal && (
        <UploadDocumentModal
          onClose={() => setShowUploadModal(false)}
          onUploadComplete={() => {
            setShowUploadModal(false);
            fetchDocuments();
            toast.success('Document uploaded successfully!');
          }}
        />
      )}

      {/* Parse Modal */}
      {showParseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 p-4">
          <div className="w-full max-w-3xl bg-white dark:bg-slate-800 rounded-xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{parseTarget?.title} - AI Parsing</h3>
              </div>
              <button onClick={closeParseModal} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">X</button>
            </div>
            <div className="p-4 space-y-4 max-h-[70vh] overflow-auto">
              {parseError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded text-red-700 dark:text-red-300 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {parseError}
                </div>
              )}
              {parseStatus && (
                <div className="text-sm text-gray-600 dark:text-gray-300">Status: <span className="font-medium">{parseStatus}</span></div>
              )}
              {isParsing && (
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Parsing in progress...
                </div>
              )}
              {parseStream && (
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Model output (stream):</div>
                  <pre className="bg-gray-50 dark:bg-slate-700 rounded-lg p-3 text-xs overflow-auto whitespace-pre-wrap dark:text-gray-200">{parseStream}</pre>
                </div>
              )}
              {parseResult && (
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Parsed structured data:</div>
                  <pre className="bg-gray-50 dark:bg-slate-700 rounded-lg p-3 text-xs overflow-auto dark:text-gray-200">{JSON.stringify(parseResult, null, 2)}</pre>
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t dark:border-slate-700 flex items-center justify-end gap-2">
              <button onClick={closeParseModal} className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-slate-600">Close</button>
              {parseTarget && !isParsing && (
                <button
                  onClick={() => beginParse(parseTarget)}
                  className="px-4 py-2 rounded-lg bg-indigo-600 dark:bg-indigo-500 text-white hover:bg-indigo-700 dark:hover:bg-indigo-600 flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Re-parse
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Rename Document</h3>
              </div>
              <button onClick={() => setShowRenameModal(false)} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">X</button>
            </div>
            <div className="p-4 space-y-3">
              {renameError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {renameError}
                </div>
              )}
              <div>
                <label className="label dark:text-gray-300">Title</label>
                <textarea
                  ref={renameTextareaRef}
                  value={renameTitle}
                  onChange={(e) => {
                    setRenameTitle(e.target.value);
                    if (renameTextareaRef.current) {
                      renameTextareaRef.current.style.height = 'auto';
                      renameTextareaRef.current.style.height = `${renameTextareaRef.current.scrollHeight}px`;
                    }
                  }}
                  className="w-full border-2 border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 h-auto min-h-[64px] max-h-64 overflow-auto whitespace-pre-wrap break-words resize-none bg-white dark:bg-slate-700 dark:text-gray-100"
                  placeholder="Enter a new title"
                  rows={3}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Full title is visible and editable.</p>
              </div>
            </div>
            <div className="px-4 py-3 border-t dark:border-slate-700 flex items-center justify-end gap-2">
              <button onClick={() => setShowRenameModal(false)} className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-slate-600">Cancel</button>
              <button
                onClick={submitRename}
                disabled={renameSaving}
                className="px-4 py-2 rounded-lg bg-primary-600 dark:bg-primary-500 text-white hover:bg-primary-700 dark:hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {renameSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
