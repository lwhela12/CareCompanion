import { useState, useEffect } from 'react';
import {
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  Loader2,
  Calendar,
  User,
  ChevronRight,
  Eye,
  Check,
  X as XIcon,
  AlertCircle as AlertCircleIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { recommendationsApi } from '@/lib/api';
import { RecommendationAcceptModal } from '@/components/RecommendationAcceptModal';

interface Recommendation {
  id: string;
  type: string;
  title: string;
  description: string;
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'PENDING' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'COMPLETED' | 'DISMISSED';
  frequency?: string;
  duration?: string;
  visitDate?: string;
  createdAt: string;
  provider?: {
    id: string;
    name: string;
    specialty?: string;
  };
  document?: {
    id: string;
    title: string;
    createdAt: string;
  };
  linkedMedication?: {
    id: string;
    name: string;
    dosage: string;
    isActive: boolean;
  };
  linkedCareTask?: {
    id: string;
    title: string;
    status: string;
    dueDate?: string;
  };
  linkedChecklistItem?: {
    id: string;
    title: string;
    category: string;
    isActive: boolean;
  };
}

const tabs = [
  { id: 'PENDING', label: 'Pending', icon: Clock },
  { id: 'ACKNOWLEDGED', label: 'Reviewed', icon: Eye },
  { id: 'IN_PROGRESS', label: 'In Progress', icon: CheckCircle },
  { id: 'COMPLETED', label: 'Completed', icon: CheckCircle },
  { id: 'DISMISSED', label: 'Dismissed', icon: XCircle },
];

const priorityColors = {
  URGENT: 'bg-red-100 text-red-800 border-red-300',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-300',
  MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  LOW: 'bg-gray-100 text-gray-800 border-gray-300',
};

const typeLabels: Record<string, string> = {
  MEDICATION: 'Medication',
  EXERCISE: 'Exercise',
  DIET: 'Diet',
  THERAPY: 'Therapy',
  LIFESTYLE: 'Lifestyle',
  MONITORING: 'Monitoring',
  FOLLOWUP: 'Follow-up',
  TESTS: 'Tests',
};

export function Recommendations() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('PENDING');
  const [selectedRecommendation, setSelectedRecommendation] = useState<Recommendation | null>(null);
  const [showAcceptModal, setShowAcceptModal] = useState(false);

  useEffect(() => {
    fetchRecommendations();
  }, [activeTab]);

  const fetchRecommendations = async () => {
    try {
      setIsLoading(true);
      setError('');
      const response = await recommendationsApi.getAll({ status: activeTab });
      setRecommendations(response.data.recommendations);
    } catch (err: any) {
      console.error('Failed to fetch recommendations:', err);
      setError(err.response?.data?.error?.message || 'Failed to load recommendations');
      toast.error('Failed to load recommendations');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcknowledge = async (id: string) => {
    try {
      await recommendationsApi.acknowledge(id);
      toast.success('Recommendation marked as reviewed');
      fetchRecommendations();
    } catch (err: any) {
      console.error('Failed to acknowledge recommendation:', err);
      toast.error(err.response?.data?.error?.message || 'Failed to update recommendation');
    }
  };

  const handleAccept = (recommendation: Recommendation) => {
    setSelectedRecommendation(recommendation);
    setShowAcceptModal(true);
  };

  const handleAcceptComplete = () => {
    setShowAcceptModal(false);
    setSelectedRecommendation(null);
    fetchRecommendations();
  };

  const handleDismiss = async (id: string) => {
    const reason = prompt('Reason for dismissing (optional):');
    if (reason === null) return; // User cancelled

    try {
      await recommendationsApi.dismiss(id, reason);
      toast.success('Recommendation dismissed');
      fetchRecommendations();
    } catch (err: any) {
      console.error('Failed to dismiss recommendation:', err);
      toast.error(err.response?.data?.error?.message || 'Failed to dismiss recommendation');
    }
  };

  // Group recommendations by document
  const groupedRecommendations = recommendations.reduce((groups, rec) => {
    const key = rec.document?.id || 'no-document';
    if (!groups[key]) {
      groups[key] = {
        document: rec.document,
        visitDate: rec.visitDate,
        provider: rec.provider,
        recommendations: [],
      };
    }
    groups[key].recommendations.push(rec);
    return groups;
  }, {} as Record<string, any>);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Recommendations</h1>
          <p className="mt-2 text-gray-600">
            Review and manage recommendations from healthcare providers
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const count = recommendations.length;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition-colors',
                    isActive
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  )}
                >
                  <Icon className="mr-2 h-5 w-5" />
                  {tab.label}
                  {isActive && count > 0 && (
                    <span className="ml-2 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-600">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        ) : error ? (
          <div className="rounded-lg bg-red-50 p-4">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error loading recommendations</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        ) : Object.keys(groupedRecommendations).length === 0 ? (
          <div className="rounded-lg bg-white p-12 text-center shadow-sm">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No recommendations</h3>
            <p className="mt-2 text-sm text-gray-500">
              {activeTab === 'PENDING'
                ? 'Upload medical documents to get personalized recommendations from your healthcare providers.'
                : `No ${tabs.find(t => t.id === activeTab)?.label.toLowerCase()} recommendations.`}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.values(groupedRecommendations).map((group: any, idx: number) => (
              <div key={idx} className="rounded-lg bg-white shadow-sm">
                {/* Group Header */}
                <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      {group.document && (
                        <h3 className="text-sm font-medium text-gray-900">
                          {group.document.title}
                        </h3>
                      )}
                      <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                        {group.provider && (
                          <div className="flex items-center">
                            <User className="mr-1.5 h-4 w-4" />
                            {group.provider.name}
                            {group.provider.specialty && ` - ${group.provider.specialty}`}
                          </div>
                        )}
                        {group.visitDate && (
                          <div className="flex items-center">
                            <Calendar className="mr-1.5 h-4 w-4" />
                            {format(new Date(group.visitDate), 'MMM d, yyyy')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recommendations */}
                <div className="divide-y divide-gray-200">
                  {group.recommendations.map((rec: Recommendation) => (
                    <div key={rec.id} className="px-6 py-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                                priorityColors[rec.priority]
                              )}
                            >
                              {rec.priority}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                              {typeLabels[rec.type] || rec.type}
                            </span>
                          </div>
                          <h4 className="mt-2 text-base font-medium text-gray-900">{rec.title}</h4>
                          <p className="mt-1 text-sm text-gray-600">{rec.description}</p>

                          {/* Details */}
                          <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                            {rec.frequency && <span>Frequency: {rec.frequency}</span>}
                            {rec.duration && <span>Duration: {rec.duration}</span>}
                          </div>

                          {/* Linked entity */}
                          {(rec.linkedMedication || rec.linkedCareTask || rec.linkedChecklistItem) && (
                            <div className="mt-3 rounded-md bg-green-50 p-3">
                              <div className="flex items-center">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <span className="ml-2 text-sm text-green-800">
                                  {rec.linkedMedication && `Added to medications: ${rec.linkedMedication.name}`}
                                  {rec.linkedCareTask && `Added to tasks: ${rec.linkedCareTask.title}`}
                                  {rec.linkedChecklistItem && `Added to checklist: ${rec.linkedChecklistItem.title}`}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        {activeTab === 'PENDING' && (
                          <div className="ml-4 flex flex-col gap-2">
                            <button
                              onClick={() => handleAccept(rec)}
                              className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
                            >
                              <Check className="mr-1.5 h-4 w-4" />
                              Accept
                            </button>
                            <button
                              onClick={() => handleAcknowledge(rec.id)}
                              className="inline-flex items-center rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                            >
                              <Eye className="mr-1.5 h-4 w-4" />
                              Review Later
                            </button>
                            <button
                              onClick={() => handleDismiss(rec.id)}
                              className="inline-flex items-center rounded-md bg-white px-3 py-1.5 text-sm font-medium text-red-700 ring-1 ring-inset ring-red-300 hover:bg-red-50"
                            >
                              <XIcon className="mr-1.5 h-4 w-4" />
                              Dismiss
                            </button>
                          </div>
                        )}
                        {activeTab === 'ACKNOWLEDGED' && (
                          <div className="ml-4 flex flex-col gap-2">
                            <button
                              onClick={() => handleAccept(rec)}
                              className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
                            >
                              <Check className="mr-1.5 h-4 w-4" />
                              Accept
                            </button>
                            <button
                              onClick={() => handleDismiss(rec.id)}
                              className="inline-flex items-center rounded-md bg-white px-3 py-1.5 text-sm font-medium text-red-700 ring-1 ring-inset ring-red-300 hover:bg-red-50"
                            >
                              <XIcon className="mr-1.5 h-4 w-4" />
                              Dismiss
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Accept Modal */}
      {showAcceptModal && selectedRecommendation && (
        <RecommendationAcceptModal
          recommendation={selectedRecommendation}
          onClose={() => {
            setShowAcceptModal(false);
            setSelectedRecommendation(null);
          }}
          onAccept={handleAcceptComplete}
        />
      )}
    </div>
  );
}
