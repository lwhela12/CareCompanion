import { useState, useEffect } from 'react';
import { X, Calendar, Clock, CheckCircle, AlertCircle, User } from 'lucide-react';
import { format, startOfDay, endOfDay, addDays, isToday, isTomorrow, parseISO } from 'date-fns';
import { useAuth } from '@clerk/clerk-react';
import { api } from '../lib/api';
import { cn } from '../lib/utils';

interface TasksOverviewProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate: Date;
  priority: string;
  status: string;
  assignedTo?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface GroupedTasks {
  [date: string]: Task[];
}

export function TasksOverview({ isOpen, onClose }: TasksOverviewProps) {
  const { getToken } = useAuth();
  const [tasks, setTasks] = useState<GroupedTasks>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchTasks();
    }
  }, [isOpen]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      
      // Get tasks for the next 3 days
      const today = startOfDay(new Date());
      const threeDaysLater = endOfDay(addDays(today, 2));

      const response = await api.get(`/api/v1/care-tasks?startDate=${today.toISOString()}&endDate=${threeDaysLater.toISOString()}&includeVirtual=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Group tasks by date
      const grouped: GroupedTasks = {};
      
      if (response.data.tasks) {
        response.data.tasks.forEach((task: any) => {
          if (task.dueDate) {
            const dueDate = parseISO(task.dueDate);
            // Use startOfDay to ensure proper date grouping
            const dateKey = format(startOfDay(dueDate), 'yyyy-MM-dd');
            
            if (!grouped[dateKey]) {
              grouped[dateKey] = [];
            }
            
            grouped[dateKey].push({
              id: task.id,
              title: task.title,
              description: task.description,
              dueDate,
              priority: task.priority,
              status: task.status,
              assignedTo: task.assignedTo
            });
          }
        });
      }

      // Sort tasks within each day by time
      Object.keys(grouped).forEach(dateKey => {
        grouped[dateKey].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
      });

      setTasks(grouped);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = startOfDay(new Date());
    const tomorrow = startOfDay(addDays(today, 1));
    const dateStart = startOfDay(date);
    
    if (dateStart.getTime() === today.getTime()) return 'Today';
    if (dateStart.getTime() === tomorrow.getTime()) return 'Tomorrow';
    return format(date, 'EEEE, MMM d');
  };

  const getTaskTypeIcon = (description?: string) => {
    if (description?.includes('🏥')) return '🏥';
    if (description?.includes('💊')) return '💊';
    if (description?.includes('🧠')) return '🧠';
    if (description?.includes('🔬')) return '🔬';
    if (description?.includes('👥')) return '👥';
    if (description?.includes('👨‍👩‍👧‍👦')) return '👨‍👩‍👧‍👦';
    return '📋';
  };

  const getTimeBasedColor = (dueDate: Date, status: string) => {
    if (status === 'COMPLETED') {
      return 'bg-green-50 text-green-700 border-green-200';
    }
    
    const now = new Date();
    const diffMs = dueDate.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    if (diffMs < 0) {
      // Overdue
      return 'bg-red-50 text-red-700 border-red-200';
    } else if (diffHours <= 1) {
      // Due within an hour
      return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    } else {
      // Upcoming
      return 'bg-white text-gray-700 border-gray-200';
    }
  };

  const getStatusBadge = (status: string, dueDate: Date) => {
    const now = new Date();
    const diffMs = dueDate.getTime() - now.getTime();
    
    if (status === 'COMPLETED') {
      return { text: 'Completed', color: 'bg-green-100 text-green-800' };
    } else if (diffMs < 0) {
      return { text: 'Overdue', color: 'bg-red-100 text-red-800' };
    } else if (diffMs < 60 * 60 * 1000) {
      return { text: 'Due Soon', color: 'bg-yellow-100 text-yellow-800' };
    } else {
      return { text: 'Pending', color: 'bg-gray-100 text-gray-800' };
    }
  };

  if (!isOpen) return null;

  // Get sorted date keys for the next 3 days
  const today = new Date();
  const dateKeys = [0, 1, 2].map(daysToAdd => {
    const date = addDays(today, daysToAdd);
    return format(date, 'yyyy-MM-dd');
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={onClose} />
        
        <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Upcoming Tasks</h3>
              <p className="text-sm text-gray-500">Your tasks for the next 3 days</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="space-y-6">
                {dateKeys.map((dateKey, index) => {
                  const dayTasks = tasks[dateKey] || [];
                  
                  return (
                    <div key={dateKey}>
                      <h4 className={cn(
                        "text-lg font-semibold mb-3",
                        index === 0 && "text-blue-600",
                        index === 1 && "text-purple-600"
                      )}>
                        {index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : format(addDays(new Date(), 2), 'EEEE, MMM d')}
                      </h4>
                      
                      {dayTasks.length === 0 ? (
                        <div className="text-center py-4 bg-gray-50 rounded-lg">
                          <p className="text-gray-500">No tasks scheduled</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {dayTasks.map(task => {
                            const statusBadge = getStatusBadge(task.status, task.dueDate);
                            
                            return (
                              <div
                                key={task.id}
                                className={cn(
                                  "p-4 rounded-lg border-2 transition-colors",
                                  getTimeBasedColor(task.dueDate, task.status)
                                )}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-xl">{getTaskTypeIcon(task.description)}</span>
                                      <h5 className={cn(
                                        "font-semibold",
                                        task.status === 'COMPLETED' && "line-through text-gray-500"
                                      )}>
                                        {task.title}
                                      </h5>
                                      {task.status === 'COMPLETED' && (
                                        <CheckCircle className="h-5 w-5 text-green-600" />
                                      )}
                                    </div>
                                    
                                    <div className="flex items-center gap-4 text-sm text-gray-600">
                                      <div className="flex items-center gap-1">
                                        <Clock className="h-4 w-4" />
                                        {format(task.dueDate, 'h:mm a')}
                                      </div>
                                      
                                      {task.assignedTo && (
                                        <div className="flex items-center gap-1">
                                          <User className="h-4 w-4" />
                                          {task.assignedTo.firstName} {task.assignedTo.lastName}
                                        </div>
                                      )}
                                      
                                      <div className={cn(
                                        "px-2 py-1 rounded text-xs font-medium",
                                        statusBadge.color
                                      )}>
                                        {statusBadge.text}
                                      </div>
                                      
                                      <div className={cn(
                                        "px-2 py-1 rounded text-xs font-medium",
                                        task.priority === 'HIGH' && "bg-red-200 text-red-800",
                                        task.priority === 'MEDIUM' && "bg-yellow-200 text-yellow-800",
                                        task.priority === 'LOW' && "bg-gray-200 text-gray-800"
                                      )}>
                                        {task.priority} Priority
                                      </div>
                                    </div>
                                    
                                    {task.description && (
                                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                                        {task.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-6 border-t bg-gray-50">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-500">
                Showing all tasks for the next 3 days
              </p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}