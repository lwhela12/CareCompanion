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
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { AddMedicationModal } from '@/components/AddMedicationModal';
import { EditMedicationModal } from '@/components/EditMedicationModal';
import { format } from 'date-fns';

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
        setTodaySchedule(scheduleResponse.data.schedule);
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
    try {
      await api.post(`/api/v1/medications/${scheduleItem.medicationId}/log`, {
        scheduledTime: scheduleItem.scheduledTime,
        status,
      });
      fetchData();
    } catch (err) {
      setError('Failed to log medication');
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
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  const pendingCount = todaySchedule.filter(s => s.status === 'pending').length;
  const givenCount = todaySchedule.filter(s => s.status === 'given').length;
  const missedCount = todaySchedule.filter(s => s.status === 'missed' || s.status === 'refused').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Medications</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track medications and adherence
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          Add Medication
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* Today's Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending Today</p>
              <p className="text-2xl font-bold text-gray-900">{pendingCount}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Given Today</p>
              <p className="text-2xl font-bold text-gray-900">{givenCount}</p>
            </div>
            <div className="w-12 h-12 bg-success-light rounded-xl flex items-center justify-center">
              <Check className="h-6 w-6 text-success" />
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Missed/Refused</p>
              <p className="text-2xl font-bold text-gray-900">{missedCount}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <X className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Today's Schedule */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Today's Schedule</h2>
          <span className="text-sm text-gray-500">
            {format(new Date(), 'EEEE, MMMM d')}
          </span>
        </div>

        {todaySchedule.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No medications scheduled for today</p>
        ) : (
          <div className="space-y-3">
            {todaySchedule.map((item) => (
              <div
                key={`${item.medicationId}-${item.scheduledTime}`}
                className={cn(
                  "flex items-center justify-between p-4 rounded-xl transition-all",
                  item.status === 'given' && "bg-green-50",
                  item.status === 'pending' && "bg-gray-50 hover:bg-gray-100",
                  (item.status === 'missed' || item.status === 'refused') && "bg-red-50"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "text-sm font-semibold min-w-[60px]",
                    item.status === 'given' && "text-green-700",
                    item.status === 'pending' && "text-primary-600",
                    (item.status === 'missed' || item.status === 'refused') && "text-red-700"
                  )}>
                    {item.timeString}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{item.medicationName}</div>
                    <div className="text-sm text-gray-600">{item.dosage}</div>
                    {item.givenBy && (
                      <div className="text-xs text-gray-500 mt-1">
                        Given by {item.givenBy.firstName} {item.givenBy.lastName} at{' '}
                        {format(new Date(item.givenTime!), 'h:mm a')}
                      </div>
                    )}
                  </div>
                </div>
                
                {item.status === 'pending' && new Date(item.scheduledTime) <= new Date() ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleLogMedication(item, 'given')}
                      className="p-2 bg-success text-white rounded-lg hover:bg-green-700 transition-colors"
                      title="Mark as given"
                    >
                      <Check className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleLogMedication(item, 'missed')}
                      className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      title="Mark as missed"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                ) : (
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    item.status === 'given' && "bg-success text-white",
                    item.status === 'pending' && "bg-gray-200",
                    (item.status === 'missed' || item.status === 'refused') && "bg-red-600 text-white"
                  )}>
                    {item.status === 'given' && <Check className="h-5 w-5" />}
                    {(item.status === 'missed' || item.status === 'refused') && <X className="h-5 w-5" />}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Medications */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Active Medications</h2>
        
        {medications.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No active medications</p>
        ) : (
          <div className="grid gap-4">
            {medications.map((medication) => (
              <div
                key={medication.id}
                className="border border-gray-200 rounded-xl p-4 hover:border-primary-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">{medication.name}</h3>
                    <p className="text-gray-600">{medication.dosage} • {medication.frequency}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedMedication(medication)}
                      className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(medication.id)}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Schedule:</span>
                    <p className="font-medium">{medication.scheduleTime.join(', ')}</p>
                  </div>
                  
                  {medication.prescribedBy && (
                    <div>
                      <span className="text-gray-500">Prescribed by:</span>
                      <p className="font-medium">{medication.prescribedBy}</p>
                    </div>
                  )}
                  
                  {medication.currentSupply !== null && medication.currentSupply !== undefined && (
                    <div>
                      <span className="text-gray-500">Supply remaining:</span>
                      <p className={cn(
                        "font-medium",
                        medication.needsRefill && "text-red-600"
                      )}>
                        {medication.currentSupply} {medication.dosageUnit || 'pills'}
                        {medication.daysRemaining !== null && ` (${medication.daysRemaining} days)`}
                      </p>
                    </div>
                  )}
                </div>

                {medication.instructions && (
                  <div className="mt-3 text-sm">
                    <span className="text-gray-500">Instructions:</span>
                    <p className="text-gray-700">{medication.instructions}</p>
                  </div>
                )}

                {medication.needsRefill && (
                  <div className="mt-3 p-3 bg-yellow-50 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2 text-yellow-700">
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
                      className="flex items-center gap-1 text-sm text-yellow-700 font-medium hover:text-yellow-800"
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