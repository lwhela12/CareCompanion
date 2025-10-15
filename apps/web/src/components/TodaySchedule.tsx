import { useState, useEffect } from 'react';
import { X, Clock, Pill, Calendar, User, Check, CheckCircle, AlertCircle } from 'lucide-react';
import { format, parseISO, isToday, isBefore, isAfter } from 'date-fns';
import { useAuth } from '@clerk/clerk-react';
import { api } from '../lib/api';
import { cn } from '../lib/utils';

interface TodayScheduleProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

interface ScheduleItem {
  id: string;
  type: 'medication' | 'task' | 'appointment';
  title: string;
  time: Date;
  status: 'pending' | 'completed' | 'missed' | 'given' | 'refused';
  description?: string;
  assignedTo?: {
    firstName: string;
    lastName: string;
  };
  medication?: {
    id: string;
    name: string;
    dosage: string;
  };
  taskId?: string;
  reminderDate?: string;
  dueDate?: string;
}

export function TodaySchedule({ isOpen, onClose, onUpdate }: TodayScheduleProps) {
  const { getToken } = useAuth();
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'today' | 'all' | 'pending'>('today');

  useEffect(() => {
    if (isOpen) {
      fetchTodaySchedule();
    }
  }, [isOpen, viewMode]);

  const fetchTodaySchedule = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

      // Get user's family and patient first
      const familyRes = await api.get('/api/v1/families', {
        headers: { Authorization: `Bearer ${token}` }
      });

      const items: ScheduleItem[] = [];
      const currentUserId = familyRes.data.user?.id;

      // Fetch today's medications using the same endpoint as dashboard
      if (familyRes.data.families && familyRes.data.families.length > 0) {
        const patientId = familyRes.data.families[0].patient.id;
        const medicationsRes = await api.get(`/api/v1/patients/${patientId}/medications/today`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        // Process medications - these come pre-processed with proper status
        if (medicationsRes.data.schedule) {
          medicationsRes.data.schedule.forEach((med: any) => {
            const scheduleTime = new Date(med.scheduledTime);
            
            // Convert status to our format
            let status: 'pending' | 'given' | 'missed' | 'refused' = 'pending';
            switch (med.status) {
              case 'given':
                status = 'given';
                break;
              case 'missed':
                status = 'missed';
                break;
              case 'refused':
                status = 'refused';
                break;
              default:
                status = 'pending';
            }

            items.push({
              id: `med-${med.medicationId}-${med.timeString}`,
              type: 'medication',
              title: `${med.medicationName} - ${med.dosage}`,
              time: scheduleTime,
              status,
              description: '', // Instructions not included in today endpoint
              medication: {
                id: med.medicationId,
                name: med.medicationName,
                dosage: med.dosage
              }
            });
          });
        }
      }

      // Fetch care tasks based on view mode
      let tasksUrl = '/api/v1/care-tasks?includeVirtual=true';
      if (viewMode === 'today') {
        tasksUrl += `&startDate=${startOfDay.toISOString()}&endDate=${endOfDay.toISOString()}`;
      } else {
        // For 'all' and 'pending' modes, get tasks from the last month to next 3 months
        // This provides a reasonable window without loading everything
        const oneMonthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
        const threeMonthsFromNow = new Date(today.getFullYear(), today.getMonth() + 3, today.getDate());
        tasksUrl += `&startDate=${oneMonthAgo.toISOString()}&endDate=${threeMonthsFromNow.toISOString()}`;
      }
      
      const tasksRes = await api.get(tasksUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Process care tasks
      if (tasksRes.data.tasks) {
        tasksRes.data.tasks.forEach((task: any) => {
          // Skip completed tasks
          if (task.status === 'COMPLETED') {
            return;
          }
          
          // Only include tasks assigned to current user or unassigned tasks
          if (task.assignedToId && task.assignedTo?.id !== currentUserId) {
            return; // Skip tasks assigned to other users
          }
          
          // Determine if task should be shown based on view mode
          let shouldInclude = false;
          let displayTime = new Date();
          
          if (viewMode === 'today') {
            // For today view, task should appear if:
            // 1. Due date is today (appointments/one-time tasks)
            // 2. Today is between reminder date and due date (multi-day tasks)
            // 3. Task has reminder date <= today and no due date (open-ended tasks)
            
            if (task.dueDate && !task.reminderDate) {
              // One-time task/appointment - only show on due date
              const dueDate = parseISO(task.dueDate);
              shouldInclude = isToday(dueDate);
              displayTime = dueDate;
            } else if (task.reminderDate) {
              // Task with reminder date
              const reminderDate = parseISO(task.reminderDate);
              const today = new Date();
              
              if (reminderDate <= today) {
                if (task.dueDate) {
                  const dueDate = parseISO(task.dueDate);
                  shouldInclude = dueDate >= today;
                  displayTime = dueDate;
                } else {
                  // No due date - open-ended task
                  shouldInclude = true;
                  displayTime = today; // Show at current time for sorting
                }
              }
            }
          } else if (viewMode === 'pending') {
            // 'pending' mode - show tasks that are:
            // 1. Not yet started (reminder date in future) OR
            // 2. Open-ended (no due date) OR
            // 3. Due in the future
            
            if (task.reminderDate) {
              const reminderDate = parseISO(task.reminderDate);
              const today = new Date();
              
              if (reminderDate > today) {
                // Task hasn't started yet
                shouldInclude = true;
                displayTime = reminderDate;
              } else if (!task.dueDate) {
                // Task has started but no due date - open-ended
                shouldInclude = true;
                displayTime = today;
              } else {
                // Task has started, check if due in future
                const dueDate = parseISO(task.dueDate);
                if (dueDate > today) {
                  shouldInclude = true;
                  displayTime = dueDate;
                }
              }
            } else if (task.dueDate) {
              // No reminder date, just due date
              const dueDate = parseISO(task.dueDate);
              const today = new Date();
              if (dueDate > today) {
                shouldInclude = true;
                displayTime = dueDate;
              }
            } else {
              // No dates at all - always pending
              shouldInclude = true;
              displayTime = new Date();
            }
          } else {
            // 'all' mode - include everything
            shouldInclude = true;
            displayTime = task.dueDate ? parseISO(task.dueDate) : 
                         task.reminderDate ? parseISO(task.reminderDate) : 
                         new Date();
          }
          
          if (shouldInclude) {
            const isMedicalAppointment = task.description?.includes('🏥');
            const isSocialVisit = task.description?.includes('👥') || task.description?.includes('👨‍👩‍👧‍👦');
            const type = (task.priority === 'HIGH' && (isMedicalAppointment || task.description?.includes('🧠') || task.description?.includes('🔬'))) || isSocialVisit ? 'appointment' : 'task';
            
            // For 'all' and 'pending' modes, only include tasks, not appointments
            if ((viewMode === 'all' || viewMode === 'pending') && type === 'appointment') {
              return;
            }
            
            items.push({
              id: `task-${task.id}`,
              type,
              title: task.title,
              time: displayTime,
              status: task.status?.toLowerCase() === 'completed' ? 'completed' : 'pending',
              description: task.description,
              assignedTo: task.assignedTo,
              taskId: task.id,
              reminderDate: task.reminderDate,
              dueDate: task.dueDate
            });
          }
        });
      }

      // Sort by time
      items.sort((a, b) => a.time.getTime() - b.time.getTime());
      setScheduleItems(items);
    } catch (error) {
      console.error('Failed to fetch today\'s schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMedicationLog = async (item: ScheduleItem, status: 'given' | 'missed' | 'refused') => {
    console.log('TodaySchedule - handleMedicationLog called:', { item, status });

    if (!item.medication) {
      console.error('No medication data in item:', item);
      return;
    }

    try {
      console.log('Sending medication log request...');
      const response = await api.post(`/api/v1/medications/${item.medication.id}/log`, {
        scheduledTime: item.time.toISOString(),
        status,
      }, {
        headers: { Authorization: `Bearer ${await getToken()}` }
      });
      console.log('Medication log response:', response.data);

      // Update local state
      setScheduleItems(items =>
        items.map(i =>
          i.id === item.id ? { ...i, status } : i
        )
      );

      // Notify parent component of update
      if (onUpdate) onUpdate();
    } catch (error: any) {
      console.error('Failed to log medication:', error);
      console.error('Full error object:', {
        message: error.message,
        response: error.response,
        request: error.request,
        config: error.config
      });
      alert('Failed to log medication. Please try again.');
    }
  };

  const handleTaskComplete = async (item: ScheduleItem) => {
    if (!item.taskId) return;
    
    try {
      await api.post(`/api/v1/care-tasks/${item.taskId}/complete`, {
        notes: 'Completed via Today\'s Schedule'
      }, {
        headers: { Authorization: `Bearer ${await getToken()}` }
      });
      
      // Update local state
      setScheduleItems(items => 
        items.map(i => 
          i.id === item.id ? { ...i, status: 'completed' } : i
        )
      );
      
      // Notify parent component of update
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Failed to complete task:', error);
      alert('Failed to complete task. Please try again.');
    }
  };

  const getItemIcon = (item: ScheduleItem) => {
    switch (item.type) {
      case 'medication':
        return <Pill className="h-5 w-5" />;
      case 'appointment':
        return <Calendar className="h-5 w-5" />;
      default:
        return <CheckCircle className="h-5 w-5" />;
    }
  };

  const getItemColor = (item: ScheduleItem) => {
    switch (item.type) {
      case 'medication':
        return 'bg-blue-100 text-blue-700';
      case 'appointment':
        return item.description?.includes('👥') || item.description?.includes('👨‍👩‍👧‍👦') 
          ? 'bg-emerald-100 text-emerald-700' 
          : 'bg-purple-100 text-purple-700';
      default:
        return 'bg-green-100 text-green-700';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'given':
        return 'text-green-600 bg-green-50';
      case 'missed':
      case 'refused':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={onClose} />
        
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {viewMode === 'today' ? "Today's Schedule" : viewMode === 'all' ? 'All Tasks' : 'Pending Tasks'}
                </h3>
                <p className="text-sm text-gray-500">
                  {viewMode === 'today' 
                    ? format(new Date(), 'EEEE, MMMM d, yyyy')
                    : viewMode === 'all'
                    ? 'All care tasks (excluding appointments)'
                    : 'Future and open-ended tasks'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* View Mode Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('today')}
                className={cn(
                  "flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  viewMode === 'today'
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                )}
              >
                Today
              </button>
              <button
                onClick={() => setViewMode('all')}
                className={cn(
                  "flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  viewMode === 'all'
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                )}
              >
                All
              </button>
              <button
                onClick={() => setViewMode('pending')}
                className={cn(
                  "flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  viewMode === 'pending'
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                )}
              >
                Pending
              </button>
            </div>
          </div>

          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : scheduleItems.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">
                  {viewMode === 'today' 
                    ? 'No scheduled items for today' 
                    : viewMode === 'pending'
                    ? 'No pending tasks'
                    : 'No tasks found'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {scheduleItems.map((item) => {
                  const now = new Date();
                  const isPast = isBefore(item.time, now);
                  const isUpcoming = isAfter(item.time, now) &&
                    (item.time.getTime() - now.getTime()) < 30 * 60 * 1000; // Within 30 minutes
                  const minutesUntil = Math.floor((item.time.getTime() - now.getTime()) / (1000 * 60));
                  const minutesLate = Math.floor((now.getTime() - item.time.getTime()) / (1000 * 60));

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-lg border-2",
                        item.status === 'completed' || item.status === 'given' ? 'border-green-200 bg-green-50' :
                        item.status === 'missed' || item.status === 'refused' ? 'border-red-200 bg-red-50' :
                        isUpcoming ? 'border-yellow-200 bg-yellow-50' :
                        'border-gray-200 bg-white'
                      )}
                    >
                      <div className={cn("p-2 rounded-lg", getItemColor(item))}>
                        {getItemIcon(item)}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-gray-900">{item.title}</h4>
                          <span className={cn(
                            "text-xs px-2 py-1 rounded-full font-medium",
                            getStatusColor(item.status)
                          )}>
                            {item.status.replace('_', ' ')}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          {viewMode === 'pending' && (item.reminderDate || item.dueDate) ? (
                            <>
                              {item.reminderDate && (
                                <div className="flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  <span>Starts: {format(parseISO(item.reminderDate), 'MMM d')}</span>
                                </div>
                              )}
                              {item.dueDate && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-4 w-4" />
                                  <span>Due: {format(parseISO(item.dueDate), 'MMM d')}</span>
                                </div>
                              )}
                              {!item.dueDate && (
                                <span className="text-xs text-gray-500">Open-ended</span>
                              )}
                            </>
                          ) : (
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {format(item.time, 'h:mm a')}
                              {item.type === 'medication' && !isPast && minutesUntil > 0 && (
                                <span className="text-blue-600 ml-2">Due in {minutesUntil} min</span>
                              )}
                              {item.type === 'medication' && isPast && minutesLate > 0 && item.status === 'pending' && (
                                <span className="text-orange-600 ml-2">{minutesLate} min late</span>
                              )}
                            </div>
                          )}

                          {item.assignedTo && (
                            <div className="flex items-center gap-1">
                              <User className="h-4 w-4" />
                              {item.assignedTo.firstName} {item.assignedTo.lastName}
                            </div>
                          )}
                        </div>

                        {item.description && (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2">
                        {item.type === 'medication' && (
                          <>
                            <button
                              onClick={(e) => {
                                console.log('TodaySchedule - Given button clicked', { item });
                                e.preventDefault();
                                e.stopPropagation();
                                handleMedicationLog(item, 'given');
                              }}
                              className={cn(
                                "p-2 text-white rounded hover:bg-green-700 transition-colors",
                                item.status === 'given' ? 'bg-green-700' : 'bg-green-600'
                              )}
                              title="Mark as given"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                console.log('TodaySchedule - Missed button clicked', { item });
                                e.preventDefault();
                                e.stopPropagation();
                                handleMedicationLog(item, 'missed');
                              }}
                              className={cn(
                                "p-2 text-white rounded hover:bg-red-700 transition-colors",
                                item.status === 'missed' || item.status === 'refused' ? 'bg-red-700' : 'bg-red-600'
                              )}
                              title="Mark as missed"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        
                        {(item.type === 'task' || item.type === 'appointment') && item.status === 'pending' && (
                          <button
                            onClick={() => handleTaskComplete(item)}
                            className="p-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                            title="Mark as complete"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                        
                        {(item.status === 'completed' || item.status === 'given') && (
                          <div className="p-2 bg-green-600 text-white rounded">
                            <CheckCircle className="h-4 w-4" />
                          </div>
                        )}
                        
                        {(item.status === 'missed' || item.status === 'refused') && (
                          <div className="p-2 bg-red-600 text-white rounded">
                            <AlertCircle className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}