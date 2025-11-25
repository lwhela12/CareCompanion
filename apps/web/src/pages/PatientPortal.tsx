import { useState, useEffect } from 'react';
import { Check, Circle, Pill, Utensils, Dumbbell, Droplet, Users, Activity, Loader2, Plus, Edit2, Trash2, X, LogOut } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { cn, localDayBounds } from '@/lib/utils';
import { api } from '@/lib/api';
import { useLogout } from '@/hooks/useLogout';

interface ChecklistItem {
  id: string;
  medicationId?: string;
  type: 'medication' | 'checklist';
  category: string;
  title: string;
  description?: string;
  time?: string;
  scheduledTime?: string;
  completed: boolean;
  completedAt?: string;
  status?: string;
}

interface TaskGroup {
  title: string;
  subtitle: string;
  items: ChecklistItem[];
  colorClass: string;
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'MEDICATION':
      return Pill;
    case 'MEALS':
      return Utensils;
    case 'EXERCISE':
      return Dumbbell;
    case 'HYGIENE':
      return Droplet;
    case 'SOCIAL':
      return Users;
    case 'THERAPY':
      return Activity;
    default:
      return Circle;
  }
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'MEDICATION':
      return 'bg-blue-100 text-blue-700 border-blue-300';
    case 'MEALS':
      return 'bg-orange-100 text-orange-700 border-orange-300';
    case 'EXERCISE':
      return 'bg-green-100 text-green-700 border-green-300';
    case 'HYGIENE':
      return 'bg-purple-100 text-purple-700 border-purple-300';
    case 'SOCIAL':
      return 'bg-pink-100 text-pink-700 border-pink-300';
    case 'THERAPY':
      return 'bg-indigo-100 text-indigo-700 border-indigo-300';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-300';
  }
};

export function PatientPortal() {
  const { handleLogout, isLoggingOut } = useLogout();
  const [medications, setMedications] = useState<ChecklistItem[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientName, setPatientName] = useState('');
  const [selectedItem, setSelectedItem] = useState<ChecklistItem | null>(null);
  const [notes, setNotes] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'OTHER' as const,
    time: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);

      // Get patient ID from family
      const familyResponse = await api.get('/api/v1/families');
      const patientIdFromFamily = familyResponse.data.families[0]?.patient?.id;
      const patientFirstName = familyResponse.data.families[0]?.patient?.firstName || 'Patient';

      if (!patientIdFromFamily) {
        toast.error('No patient found');
        return;
      }

      setPatientId(patientIdFromFamily);
      setPatientName(patientFirstName);

      // Get today's checklist
      const response = await api.get(`/api/v1/patients/${patientIdFromFamily}/checklist/today`);
      const { startDate, endDate } = localDayBounds();

      const filteredMeds = Array.isArray(response.data.medications)
        ? response.data.medications.filter((med: any) => {
            if (!med.scheduledTime) return true;
            const ts = new Date(med.scheduledTime);
            return ts >= startDate && ts <= endDate;
          })
        : [];

      const filteredChecklist = Array.isArray(response.data.checklist)
        ? response.data.checklist.filter((item: any) => {
            if (item.scheduledTime) {
              const ts = new Date(item.scheduledTime);
              return ts >= startDate && ts <= endDate;
            }
            return true;
          })
        : [];

      setMedications(filteredMeds);
      setChecklist(filteredChecklist);
    } catch (error: any) {
      console.error('Error fetching checklist:', error);
      toast.error('Failed to load checklist');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChecklistComplete = async (item: ChecklistItem) => {
    // Show note modal for both medication and checklist items
    setSelectedItem(item);
    setNotes('');
  };

  const submitChecklistLog = async () => {
    if (!selectedItem) return;

    try {
      if (selectedItem.type === 'medication') {
        // Log medication
        if (!selectedItem.medicationId || !selectedItem.scheduledTime) {
          toast.error('Invalid medication data');
          return;
        }

        await api.post(`/api/v1/medications/${selectedItem.medicationId}/log`, {
          scheduledTime: selectedItem.scheduledTime,
          status: 'given',
          notes: notes || undefined,
        });

        toast.success(`✓ ${selectedItem.title} marked as taken`);
      } else {
        // Log checklist item
        await api.post(`/api/v1/patients/checklist/${selectedItem.id}/log`, {
          notes: notes || undefined,
        });

        toast.success(`✓ ${selectedItem.title} completed!`);
      }

      setSelectedItem(null);
      setNotes('');
      fetchData();
    } catch (error: any) {
      console.error('Error logging item:', error);
      toast.error('Failed to log item');
    }
  };

  const handleCreateItem = async () => {
    if (!patientId || !formData.title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    try {
      await api.post('/api/v1/patients/checklist', {
        patientId,
        title: formData.title,
        description: formData.description || undefined,
        category: formData.category,
        scheduledTime: formData.time || undefined,
      });

      toast.success('Checklist item created!');
      setIsCreating(false);
      setFormData({ title: '', description: '', category: 'OTHER', time: '' });
      fetchData();
    } catch (error: any) {
      console.error('Error creating checklist item:', error);
      toast.error('Failed to create checklist item');
    }
  };

  const handleUpdateItem = async () => {
    if (!editingItem || !formData.title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    try {
      await api.put(`/api/v1/patients/checklist/${editingItem.id}`, {
        title: formData.title,
        description: formData.description || undefined,
        category: formData.category,
        scheduledTime: formData.time || undefined,
      });

      toast.success('Checklist item updated!');
      setEditingItem(null);
      setFormData({ title: '', description: '', category: 'OTHER', time: '' });
      fetchData();
    } catch (error: any) {
      console.error('Error updating checklist item:', error);
      toast.error('Failed to update checklist item');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this checklist item?')) {
      return;
    }

    try {
      await api.delete(`/api/v1/patients/checklist/${itemId}`);
      toast.success('Checklist item deleted');
      fetchData();
    } catch (error: any) {
      console.error('Error deleting checklist item:', error);
      toast.error('Failed to delete checklist item');
    }
  };

  const startEditing = (item: ChecklistItem) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      description: item.description || '',
      category: item.category as any,
      time: item.time || '',
    });
  };

  // Organize tasks into time-based groups
  const organizeTasksByTime = (): TaskGroup[] => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    const allTasks = [...medications, ...checklist];

    const doNow: ChecklistItem[] = [];
    const comingUp: ChecklistItem[] = [];
    const completedTasks: ChecklistItem[] = [];
    const noTime: ChecklistItem[] = [];

    allTasks.forEach(task => {
      if (task.completed) {
        completedTasks.push(task);
      } else if (!task.time) {
        noTime.push(task);
      } else {
        const [hours, minutes] = task.time.split(':').map(Number);
        const taskTimeInMinutes = hours * 60 + minutes;
        const timeDiff = taskTimeInMinutes - currentTimeInMinutes;

        if (timeDiff <= 30) {
          doNow.push(task);
        } else {
          comingUp.push(task);
        }
      }
    });

    // Sort by time
    const sortByTime = (a: ChecklistItem, b: ChecklistItem) =>
      (a.time || '').localeCompare(b.time || '');

    doNow.sort(sortByTime);
    comingUp.sort(sortByTime);
    noTime.sort((a, b) => a.title.localeCompare(b.title));
    completedTasks.sort((a, b) =>
      (b.completedAt || '').localeCompare(a.completedAt || '')
    );

    const groups: TaskGroup[] = [];

    if (doNow.length > 0) {
      groups.push({
        title: 'Do Now',
        subtitle: 'Due now or overdue',
        items: doNow,
        colorClass: 'border-red-400 bg-red-50',
      });
    }

    if (comingUp.length > 0) {
      groups.push({
        title: 'Coming Up',
        subtitle: 'Scheduled for later',
        items: comingUp,
        colorClass: 'border-blue-400 bg-blue-50',
      });
    }

    if (noTime.length > 0) {
      groups.push({
        title: 'Anytime Today',
        subtitle: 'No specific time',
        items: noTime,
        colorClass: 'border-gray-400 bg-gray-50',
      });
    }

    if (completedTasks.length > 0) {
      groups.push({
        title: 'Completed',
        subtitle: `${completedTasks.length} done!`,
        items: completedTasks,
        colorClass: 'border-green-400 bg-green-50',
      });
    }

    return groups;
  };

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good Morning' : currentHour < 17 ? 'Good Afternoon' : 'Good Evening';

  const completedCount = [...medications, ...checklist].filter(item => item.completed).length;
  const totalCount = medications.length + checklist.length;
  const completionPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const taskGroups = organizeTasksByTime();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
        <Loader2 className="h-16 w-16 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Impersonation Banner (if applicable - will be added later) */}
        {/* This will show when a caregiver is logged in as patient */}

        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="p-3 rounded-2xl bg-white/80 hover:bg-white shadow border border-gray-200 flex items-center justify-center gap-2 w-full sm:w-auto disabled:opacity-50"
              title="Sign out"
            >
              {isLoggingOut ? (
                <>
                  <Loader2 className="h-5 w-5 text-gray-700 animate-spin" />
                  <span className="text-sm font-medium text-gray-700">Signing out...</span>
                </>
              ) : (
                <>
                  <LogOut className="h-5 w-5 text-gray-700" />
                  <span className="text-sm font-medium text-gray-700">Sign out</span>
                </>
              )}
            </button>

            <button
              onClick={() => {
                setIsCreating(true);
                setFormData({ title: '', description: '', category: 'OTHER', time: '' });
              }}
              className="p-3 sm:p-4 rounded-2xl bg-primary-600 hover:bg-primary-700 transition-colors shadow-lg flex items-center justify-center gap-2 w-full sm:w-auto"
              title="Add New Task"
            >
              <Plus className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              <span className="text-white font-semibold">Add item</span>
            </button>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-2">
            {greeting}, {patientName}!
          </h1>
          <p className="text-lg sm:text-2xl text-gray-600">
            {format(new Date(), 'EEEE, MMMM d')}
          </p>

          {/* Progress Bar */}
          {totalCount > 0 && (
            <div className="mt-6 max-w-md mx-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg font-semibold text-gray-700">
                  {completedCount} of {totalCount} completed
                </span>
                <span className="text-lg font-bold text-primary-600">
                  {completionPercent}%
                </span>
              </div>
              <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-500"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Time-Organized Tasks */}
        {taskGroups.map((group) => (
          <div key={group.title} className="mb-8">
            <div className={cn(
              'p-4 rounded-2xl border-4 mb-4',
              group.colorClass
            )}>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <span className="leading-tight">{group.title}</span>
                <span className="text-lg sm:text-xl font-semibold text-gray-600">{group.subtitle}</span>
              </h2>
            </div>
            <div className="space-y-3">
              {group.items.map((item) => {
                const Icon = item.type === 'medication' ? Pill : getCategoryIcon(item.category);
                const isUrgent = group.title === 'Do Now';
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'p-6 rounded-2xl border-4 transition-all duration-200 relative',
                      item.completed
                        ? 'bg-green-50 border-green-300 opacity-75'
                        : isUrgent
                        ? 'bg-white border-red-400 hover:shadow-lg animate-pulse'
                        : `bg-white ${item.type === 'medication' ? 'border-blue-300' : getCategoryColor(item.category).split(' ')[2]} hover:shadow-lg`
                    )}
                  >
                    {/* Edit/Delete buttons for checklist items only */}
                    {item.type === 'checklist' && !item.completed && (
                      <div className={cn(
                        "absolute flex gap-2",
                        isUrgent ? "top-12 right-2" : "top-2 right-2"
                      )}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditing(item);
                          }}
                          className="p-2 rounded-lg bg-blue-100 hover:bg-blue-200 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4 text-blue-700" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteItem(item.id);
                          }}
                          className="p-2 rounded-lg bg-red-100 hover:bg-red-200 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-red-700" />
                        </button>
                      </div>
                    )}

                    {isUrgent && !item.completed && (
                      <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                        URGENT
                      </div>
                    )}

                    <button
                      onClick={() => !item.completed && handleChecklistComplete(item)}
                      disabled={item.completed}
                      className="w-full text-left"
                    >
                      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
                        <div className={cn(
                          'w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0',
                          item.completed
                            ? 'bg-green-200'
                            : isUrgent
                            ? 'bg-red-100'
                            : item.type === 'medication'
                            ? 'bg-blue-100'
                            : getCategoryColor(item.category)
                        )}>
                          {item.completed ? (
                            <Check className="h-10 w-10 text-green-700" strokeWidth={3} />
                          ) : (
                            <Icon className={cn(
                              'h-10 w-10',
                              isUrgent ? 'text-red-700' : item.type === 'medication' ? 'text-blue-700' : ''
                            )} />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1 flex-wrap">
                            <span className="text-xl sm:text-2xl font-bold text-gray-900">{item.title}</span>
                            {item.time && (
                              <span className={cn(
                                'text-lg sm:text-xl font-bold px-3 py-1 rounded-lg',
                                isUrgent ? 'bg-red-200 text-red-900' : 'bg-gray-200 text-gray-700'
                              )}>
                                {item.time}
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-base sm:text-lg text-gray-600">{item.description}</p>
                          )}
                          {item.type === 'medication' && (
                            <span className="inline-block mt-2 px-3 py-1 bg-blue-100 text-blue-700 text-sm font-semibold rounded-lg">
                              MEDICATION
                            </span>
                          )}
                          {item.type === 'checklist' && (
                            <span className={cn(
                              'inline-block mt-2 px-3 py-1 text-sm font-semibold rounded-lg',
                              getCategoryColor(item.category)
                            )}>
                              {item.category}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Empty State */}
        {totalCount === 0 && (
          <div className="text-center py-16">
            <Check className="h-24 w-24 text-green-500 mx-auto mb-4" />
            <h2 className="text-4xl font-bold text-gray-900 mb-2">
              All Done!
            </h2>
            <p className="text-2xl text-gray-600">
              Great job today!
            </p>
          </div>
        )}

        {/* All Complete State */}
        {totalCount > 0 && completedCount === totalCount && (
          <div className="mt-8 text-center py-12 bg-green-50 rounded-3xl border-4 border-green-300">
            <Check className="h-24 w-24 text-green-600 mx-auto mb-4" />
            <h2 className="text-4xl font-bold text-green-900 mb-2">
              All Done Today!
            </h2>
            <p className="text-2xl text-green-700">
              Excellent work!
            </p>
          </div>
        )}
      </div>

      {/* Notes Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8">
            <h3 className="text-3xl font-bold text-gray-900 mb-4">
              {selectedItem.title}
            </h3>
            <p className="text-xl text-gray-600 mb-6">
              Would you like to add any notes?
            </p>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              className="w-full p-4 border-2 border-gray-300 rounded-xl text-xl resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-6"
              rows={4}
            />

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedItem(null)}
                className="flex-1 px-6 py-4 text-xl font-semibold text-gray-700 bg-gray-200 rounded-xl hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitChecklistLog}
                className="flex-1 px-6 py-4 text-xl font-semibold text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors"
              >
                Complete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Item Modal */}
      {(isCreating || editingItem) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-3xl font-bold text-gray-900">
                {isCreating ? 'Add New Task' : 'Edit Task'}
              </h3>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setEditingItem(null);
                  setFormData({ title: '', description: '', category: 'OTHER', time: '' });
                }}
                className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <X className="h-6 w-6 text-gray-600" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              {/* Title */}
              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Morning walk"
                  className="w-full p-4 border-2 border-gray-300 rounded-xl text-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Additional details..."
                  className="w-full p-4 border-2 border-gray-300 rounded-xl text-lg resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  rows={3}
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-2">
                  Category *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                  className="w-full p-4 border-2 border-gray-300 rounded-xl text-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="MEALS">Meals</option>
                  <option value="EXERCISE">Exercise</option>
                  <option value="HYGIENE">Hygiene</option>
                  <option value="SOCIAL">Social</option>
                  <option value="THERAPY">Therapy</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              {/* Time */}
              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-2">
                  Time (Optional)
                </label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  className="w-full p-4 border-2 border-gray-300 rounded-xl text-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Leave blank for anytime tasks. Tasks due within 30 minutes will show as urgent.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setIsCreating(false);
                  setEditingItem(null);
                  setFormData({ title: '', description: '', category: 'OTHER', time: '' });
                }}
                className="flex-1 px-6 py-4 text-xl font-semibold text-gray-700 bg-gray-200 rounded-xl hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={isCreating ? handleCreateItem : handleUpdateItem}
                className="flex-1 px-6 py-4 text-xl font-semibold text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors"
              >
                {isCreating ? 'Create' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
