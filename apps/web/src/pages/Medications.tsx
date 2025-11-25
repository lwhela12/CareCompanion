import { useState, useEffect } from 'react';
import {
  Pill,
  Plus,
  Clock,
  AlertCircle,
  Calendar,
  RefreshCw,
  ChevronRight,
  Edit2,
  Trash2,
  Check,
  X,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { cn, localDayBounds } from '@/lib/utils';
import { api } from '@/lib/api';
import { AddMedicationModal } from '@/components/AddMedicationModal';
import { EditMedicationModal } from '@/components/EditMedicationModal';

interface Medication {
  id: string;
  name: string;
  dosage: string;
  dosageAmount?: number;
  dosageUnit?: string;
  frequency: string;
  scheduleTime: string[];
  instructions?: string;
  prescribedBy?: string;
  startDate: string;
  endDate?: string;
  currentSupply?: number;
  lastRefillDate?: string;
  refillThreshold: number;
  isActive: boolean;
  daysRemaining?: number;
  needsRefill?: boolean;
  createdBy: {
    firstName: string;
    lastName: string;
  };
}

interface TodayScheduleItem {
  medicationId: string;
  medicationName: string;
  dosage: string;
  scheduledTime: string;
  timeString: string;
  status: 'pending' | 'given' | 'missed' | 'refused';
  givenTime?: string;
  givenBy?: {
    firstName: string;
    lastName: string;
  };
  notes?: string;
  logId?: string;
}

export function Medications() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [todaySchedule, setTodaySchedule] = useState<TodayScheduleItem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [patientId, setPatientId] = useState<string | null>(null);
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // First get the patient ID
      const familiesResponse = await api.get('/api/v1/families');
      if (familiesResponse.data.families.length > 0) {
        const patientIdFromFamily = familiesResponse.data.families[0].patient.id;
        setPatientId(patientIdFromFamily);
        
        // Fetch medications and today's schedule
        const [medsResponse, scheduleResponse] = await Promise.all([
          api.get(`/api/v1/patients/${patientIdFromFamily}/medications`),
          api.get(`/api/v1/patients/${patientIdFromFamily}/medications/today`)
        ]);
        
        setMedications(medsResponse.data.medications);
        const { startDate, endDate } = localDayBounds();
        const filteredSchedule = Array.isArray(scheduleResponse.data.schedule)
          ? scheduleResponse.data.schedule.filter((item: any) => {
              const ts = new Date(item.scheduledTime);
              return ts >= startDate && ts <= endDate;
            })
          : [];
        setTodaySchedule(filteredSchedule);
      }
    } catch (err) {
      setError('Failed to load medication data');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMedication = async (medicationData: any) => {
    try {
      await api.post('/api/v1/medications', {
        patientId,
        ...medicationData,
      });
      fetchData();
      setShowAddModal(false);
    } catch (err: any) {
      throw new Error(err.response?.data?.error?.message || 'Failed to add medication');
    }
  };

  const handleUpdateMedication = async (medicationId: string, medicationData: any) => {
    try {
      await api.put(`/api/v1/medications/${medicationId}`, medicationData);
      fetchData();
      setSelectedMedication(null);
    } catch (err: any) {
      throw new Error(err.response?.data?.error?.message || 'Failed to update medication');
    }
  };

  const handleLogMedication = async (scheduleItem: TodayScheduleItem, status: 'given' | 'missed' | 'refused') => {
    console.log('Medications page - handleLogMedication called:', { scheduleItem, status });

    try {
      console.log('Sending medication log request...');
      const response = await api.post(`/api/v1/medications/${scheduleItem.medicationId}/log`, {
        scheduledTime: scheduleItem.scheduledTime,
        status,
      });
      console.log('Medication log response:', response.data);

      // Show success message
      const statusText = status === 'given' ? 'administered' : status;
      toast.success(`${scheduleItem.medicationName} marked as ${statusText}`);

      console.log('Fetching updated data...');
      fetchData();
    } catch (err: any) {
      console.error('Error logging medication:', err);
      console.error('Full error object:', {
        message: err.message,
        response: err.response,
        request: err.request,
        config: err.config
      });
      const errorMessage = err.response?.data?.error?.message || err.message || 'Failed to log medication';
      toast.error(errorMessage);
    }
  };

  const handleRefill = async (medication: Medication, pillsAdded: number) => {
    try {
      await api.post(`/api/v1/medications/${medication.id}/refill`, {
        pillsAdded,
      });
      fetchData();
    } catch (err) {
      setError('Failed to record refill');
    }
  };

  const handleDelete = async (medicationId: string) => {
    if (!confirm('Are you sure you want to remove this medication?')) return;
    
    try {
      await api.delete(`/api/v1/medications/${medicationId}`);
      fetchData();
    } catch (err) {
      setError('Failed to remove medication');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600 dark:text-primary-400" />
      </div>
    );
  }

  const pendingCount = todaySchedule.filter(s => s.status === 'pending').length;
  const givenCount = todaySchedule.filter(s => s.status === 'given').length;
  const missedCount = todaySchedule.filter(s => s.status === 'missed' || s.status === 'refused').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Medications</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Track medications and adherence
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors w-full sm:w-auto"
        >
          <Plus className="h-5 w-5" />
          Add Medication
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* Today's Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card dark:bg-slate-800 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Pending Today</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{pendingCount}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl flex items-center justify-center">
              <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
        </div>

        <div className="card dark:bg-slate-800 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Given Today</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{givenCount}</p>
            </div>
            <div className="w-12 h-12 bg-success-light dark:bg-green-900/30 rounded-xl flex items-center justify-center">
              <Check className="h-6 w-6 text-success dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="card dark:bg-slate-800 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Missed/Refused</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{missedCount}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
              <X className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Today's Schedule */}
      <div className="card dark:bg-slate-800 dark:border-slate-700">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Today's Schedule</h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {format(new Date(), 'EEEE, MMMM d')}
          </span>
        </div>

        {todaySchedule.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">No medications scheduled for today</p>
        ) : (
          <div className="space-y-3">
            {todaySchedule.map((item) => {
              const scheduledTime = new Date(item.scheduledTime);
              const now = new Date();
              const isPastTime = scheduledTime <= now;
              const minutesUntil = Math.floor((scheduledTime.getTime() - now.getTime()) / (1000 * 60));
              const minutesLate = Math.floor((now.getTime() - scheduledTime.getTime()) / (1000 * 60));

              return (
                <div
                  key={`${item.medicationId}-${item.scheduledTime}`}
                  className={cn(
                    "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl transition-all",
                    item.status === 'given' && "bg-green-50 dark:bg-green-900/20",
                    item.status === 'pending' && "bg-gray-50 hover:bg-gray-100 dark:bg-slate-700/50 dark:hover:bg-slate-700",
                    (item.status === 'missed' || item.status === 'refused') && "bg-red-50 dark:bg-red-900/20"
                  )}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 w-full">
                    <div className={cn(
                      "text-sm font-semibold min-w-[60px]",
                      item.status === 'given' && "text-green-700 dark:text-green-400",
                      item.status === 'pending' && "text-primary-600 dark:text-primary-400",
                      (item.status === 'missed' || item.status === 'refused') && "text-red-700 dark:text-red-400"
                    )}>
                      {item.timeString}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 dark:text-gray-100">{item.medicationName}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{item.dosage}</div>
                      {item.status === 'given' && item.givenTime && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Given {item.givenBy ? `by ${item.givenBy.firstName} ${item.givenBy.lastName}` : ''} at{' '}
                          {format(new Date(item.givenTime), 'h:mm a')}
                        </div>
                      )}
                      {item.status === 'pending' && !isPastTime && (
                        <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          Due in {minutesUntil} min
                        </div>
                      )}
                      {item.status === 'pending' && isPastTime && minutesLate > 0 && (
                        <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                          {minutesLate} min late
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto sm:justify-end">
                    <button
                      onClick={(e) => {
                        console.log('Medications page - Given button clicked', { item });
                        e.preventDefault();
                        e.stopPropagation();
                        handleLogMedication(item, 'given');
                      }}
                      className={cn(
                        "p-2 text-white rounded-lg hover:bg-green-700 transition-colors w-full sm:w-auto justify-center flex",
                        item.status === 'given' ? 'bg-green-700' : 'bg-success'
                      )}
                      title="Mark as given"
                    >
                      <Check className="h-5 w-5" />
                    </button>
                    <button
                      onClick={(e) => {
                        console.log('Medications page - Missed button clicked', { item });
                        e.preventDefault();
                        e.stopPropagation();
                        handleLogMedication(item, 'missed');
                      }}
                      className={cn(
                        "p-2 text-white rounded-lg hover:bg-red-700 transition-colors w-full sm:w-auto justify-center flex",
                        item.status === 'missed' || item.status === 'refused' ? 'bg-red-700' : 'bg-red-600'
                      )}
                      title="Mark as missed"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Medications */}
      <div className="card dark:bg-slate-800 dark:border-slate-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Active Medications</h2>

        {medications.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">No active medications</p>
        ) : (
          <div className="grid gap-4">
            {medications.map((medication) => (
              <div
                key={medication.id}
                className="border border-gray-200 dark:border-slate-600 rounded-xl p-4 hover:border-primary-300 dark:hover:border-primary-600 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-lg">{medication.name}</h3>
                    <p className="text-gray-600 dark:text-gray-400">{medication.dosage} • {medication.frequency}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedMedication(medication)}
                      className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:text-gray-400 dark:hover:text-primary-400 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(medication.id)}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Schedule:</span>
                    <p className="font-medium dark:text-gray-200">{medication.scheduleTime.join(', ')}</p>
                  </div>

                  {medication.prescribedBy && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Prescribed by:</span>
                      <p className="font-medium dark:text-gray-200">{medication.prescribedBy}</p>
                    </div>
                  )}

                  {medication.currentSupply !== null && medication.currentSupply !== undefined && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Supply remaining:</span>
                      <p className={cn(
                        "font-medium dark:text-gray-200",
                        medication.needsRefill && "text-red-600 dark:text-red-400"
                      )}>
                        {medication.currentSupply} {medication.dosageUnit || 'pills'}
                        {medication.daysRemaining !== null && ` (${medication.daysRemaining} days)`}
                      </p>
                    </div>
                  )}
                </div>

                {medication.instructions && (
                  <div className="mt-3 text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Instructions:</span>
                    <p className="text-gray-700 dark:text-gray-300">{medication.instructions}</p>
                  </div>
                )}

                {medication.needsRefill && (
                  <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">Refill needed soon</span>
                    </div>
                    <button
                      onClick={() => {
                        const pills = prompt('How many pills were added?');
                        if (pills && !isNaN(Number(pills))) {
                          handleRefill(medication, Number(pills));
                        }
                      }}
                      className="flex items-center justify-center gap-1 text-sm text-yellow-700 dark:text-yellow-400 font-medium hover:text-yellow-800 dark:hover:text-yellow-300 w-full sm:w-auto"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Record Refill
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Medication Modal */}
      {showAddModal && patientId && (
        <AddMedicationModal
          patientId={patientId}
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddMedication}
        />
      )}

      {/* Edit Medication Modal */}
      {selectedMedication && (
        <EditMedicationModal
          medication={selectedMedication}
          onClose={() => setSelectedMedication(null)}
          onUpdate={handleUpdateMedication}
        />
      )}
    </div>
  );
}
