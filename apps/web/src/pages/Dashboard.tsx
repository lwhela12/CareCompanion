import { useEffect, useState } from 'react';
import { 
  Plus, 
  Calendar, 
  BarChart2, 
  FileText, 
  Pill,
  Moon,
  Users,
  TrendingUp,
  Clock,
  CheckCircle,
  Check,
  X,
  ClipboardList
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { QuickEntry } from '@/components/QuickEntry';
import { TodaySchedule } from '@/components/TodaySchedule';
import { AddTaskModal } from '@/components/AddTaskModal';

const getQuickActions = (todayStats: { tasks: number; appointments: number }) => [
  {
    icon: Plus,
    title: 'Quick Entry',
    subtitle: 'Log medication or note',
    color: 'primary',
  },
  {
    icon: Calendar,
    title: "Today's Schedule",
    subtitle: todayStats.tasks === 0 && todayStats.appointments === 0 
      ? 'All caught up for today!'
      : `${todayStats.tasks} task${todayStats.tasks !== 1 ? 's' : ''} for you, ${todayStats.appointments} appointment${todayStats.appointments !== 1 ? 's' : ''}`,
    color: 'primary',
  },
  {
    icon: ClipboardList,
    title: 'Add Task',
    subtitle: 'Create a new care task',
    color: 'primary',
  },
  {
    icon: FileText,
    title: 'Upload Document',
    subtitle: 'Medical records & more',
    color: 'primary',
  },
];

const statusCards = [
  {
    title: 'Medication Adherence',
    value: '94%',
    subtitle: 'This week',
    trend: '+3% from last week',
    trendType: 'up',
    icon: Pill,
  },
  {
    title: 'Sleep Quality',
    value: 'Good',
    subtitle: 'Last 3 nights',
    trend: 'Improving pattern',
    trendType: 'up',
    icon: Moon,
  },
  {
    title: 'Family Visits',
    value: '12',
    subtitle: 'This week',
    trend: 'Well distributed',
    trendType: 'up',
    icon: Users,
  },
];


interface TodayMedication {
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
}

interface FamilyData {
  families: Array<{
    id: string;
    name: string;
    role: string;
    patient: {
      id: string;
      firstName: string;
      lastName: string;
    };
  }>;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

export function Dashboard() {
  const [familyData, setFamilyData] = useState<FamilyData | null>(null);
  const [userName, setUserName] = useState('');
  const [todaysMedications, setTodaysMedications] = useState<TodayMedication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [showTodaySchedule, setShowTodaySchedule] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [todayStats, setTodayStats] = useState({ tasks: 0, appointments: 0 });
  const [recentActivity, setRecentActivity] = useState<Array<{
    time: string;
    title: string;
    description: string;
    type: 'medication' | 'journal' | 'task' | 'appointment';
    timestamp: Date;
  }>>([]);

  useEffect(() => {
    const fetchFamilyData = async () => {
      try {
        const response = await api.get<FamilyData>('/api/v1/families');
        setFamilyData(response.data);
        
        // Set user name from the response
        if (response.data.user) {
          setUserName(response.data.user.firstName || 'there');
        }
        
        // Fetch today's data if we have a patient
        if (response.data.families.length > 0) {
          await fetchTodayData(response.data.families[0].patient.id, response.data.user?.id);
        }
      } catch (error) {
        console.error('Error fetching family data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFamilyData();
  }, []);

  const fetchTodayData = async (patientId: string, currentUserId?: string) => {
    try {
      // Fetch today's medications
      const medsResponse = await api.get(`/api/v1/patients/${patientId}/medications/today`);
      setTodaysMedications(medsResponse.data.schedule);
      
      // Fetch today's tasks and appointments for stats
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
      
      const tasksResponse = await api.get(`/api/v1/care-tasks?startDate=${startOfDay.toISOString()}&endDate=${endOfDay.toISOString()}&includeVirtual=true`);
      
      // Count pending medications
      let pendingMedications = 0;
      if (medsResponse.data.schedule) {
        pendingMedications = medsResponse.data.schedule.filter((med: any) => 
          med.status === 'pending'
        ).length;
      }
      
      // Count tasks and appointments
      let taskCount = pendingMedications; // Start with pending medications
      let appointmentCount = 0;
      
      if (tasksResponse.data.tasks) {
        tasksResponse.data.tasks.forEach((task: any) => {
          // Skip completed tasks
          if (task.status === 'COMPLETED') {
            return;
          }
          
          // Count tasks for current user:
          // 1. Tasks explicitly assigned to current user
          // 2. Unassigned tasks (null assignedToId - includes patient assignments)
          const isForCurrentUser = !task.assignedToId || task.assignedTo?.id === currentUserId;
          
          if (!isForCurrentUser) {
            return;
          }
          
          const isMedicalAppointment = task.description?.includes('🏥');
          const isSocialVisit = task.description?.includes('👥') || task.description?.includes('👨‍👩‍👧‍👦');
          const isAppointment = task.priority === 'HIGH' && (isMedicalAppointment || task.description?.includes('🧠') || task.description?.includes('🔬')) || isSocialVisit;
          
          if (isAppointment) {
            appointmentCount++;
          } else {
            taskCount++;
          }
        });
      }
      
      setTodayStats({ tasks: taskCount, appointments: appointmentCount });
      
      // Fetch recent activity
      await fetchRecentActivity(patientId);
    } catch (error) {
      console.error('Error fetching today data:', error);
    }
  };

  const fetchRecentActivity = async (patientId?: string) => {
    try {
      const activities: Array<{
        time: string;
        title: string;
        description: string;
        type: 'medication' | 'journal' | 'task' | 'appointment';
        timestamp: Date;
      }> = [];

      // Fetch recent journal entries (last 3 days)
      try {
        const journalResponse = await api.get('/api/v1/journal?days=3');
        
        if (journalResponse.data.entries) {
          journalResponse.data.entries.slice(0, 6).forEach((entry: any) => {
            const createdAt = new Date(entry.createdAt);
            activities.push({
              time: formatTimeAgo(createdAt),
              title: `Journal entry by ${entry.user?.firstName || 'Caregiver'}`,
              description: entry.content.length > 120 ? entry.content.substring(0, 120) + '...' : entry.content,
              type: 'journal',
              timestamp: createdAt
            });
          });
        }
      } catch (error) {
        console.log('Could not fetch journal entries:', error);
      }

      // Get recent medication activity from today's schedule  
      try {
        if (patientId) {
          const medsResponse = await api.get(`/api/v1/patients/${patientId}/medications/today`);
          
          if (medsResponse.data.schedule) {
            medsResponse.data.schedule.forEach((med: any) => {
              if (med.status === 'given' && med.givenTime) {
                const givenTime = new Date(med.scheduledTime);
                // Only include medications given in the last 24 hours
                const now = new Date();
                const hoursDiff = (now.getTime() - givenTime.getTime()) / (1000 * 60 * 60);
                
                if (hoursDiff <= 24) {
                  activities.push({
                    time: formatTimeAgo(givenTime),
                    title: `${med.medicationName} administered`,
                    description: `${med.dosage} given${med.givenBy ? ` by ${med.givenBy.firstName}` : ''}`,
                    type: 'medication',
                    timestamp: givenTime
                  });
                }
              }
            });
          }
        }
      } catch (error) {
        console.log('Could not fetch medication logs:', error);
      }

      // Fetch recently completed tasks (last 3 days)
      try {
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        const endDate = new Date();
        
        const taskResponse = await api.get(`/api/v1/care-tasks?startDate=${threeDaysAgo.toISOString()}&endDate=${endDate.toISOString()}`);
        
        if (taskResponse.data.tasks) {
          taskResponse.data.tasks
            .filter((task: any) => task.status === 'COMPLETED')
            .slice(0, 4)
            .forEach((task: any) => {
              const updatedAt = new Date(task.updatedAt);
              const isMedicalAppointment = task.description?.includes('🏥');
              const isSocialVisit = task.description?.includes('👥') || task.description?.includes('👨‍👩‍👧‍👦');
              const isAppointment = task.priority === 'HIGH' && (isMedicalAppointment || task.description?.includes('🧠') || task.description?.includes('🔬')) || isSocialVisit;
              
              activities.push({
                time: formatTimeAgo(updatedAt),
                title: isAppointment ? `${task.title} completed` : `Task completed: ${task.title}`,
                description: task.description || `Completed by ${task.assignedTo?.firstName || 'caregiver'}`,
                type: isAppointment ? 'appointment' : 'task',
                timestamp: updatedAt
              });
            });
        }
      } catch (error) {
        console.log('Could not fetch completed tasks:', error);
      }

      // Sort by timestamp (most recent first) and take top 6
      activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setRecentActivity(activities.slice(0, 6));

    } catch (error) {
      console.error('Error fetching recent activity:', error);
    }
  };

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 60) {
      return diffInMinutes <= 1 ? 'Just now' : `${diffInMinutes} minutes ago`;
    } else if (diffInHours < 24) {
      return diffInHours === 1 ? '1 hour ago' : `${diffInHours} hours ago`;
    } else if (diffInDays === 1) {
      return `Yesterday, ${format(date, 'h:mm a')}`;
    } else {
      return format(date, 'MMM d, h:mm a');
    }
  };

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';
  const date = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const patientName = familyData?.families[0]?.patient?.firstName || 'your loved one';

  const handleMedicationLog = async (medication: TodayMedication, status: 'given' | 'missed' | 'refused') => {
    try {
      await api.post(`/api/v1/medications/${medication.medicationId}/log`, {
        scheduledTime: medication.scheduledTime,
        status,
      });
      
      // Refresh the medications
      if (familyData?.families[0]?.patient?.id) {
        const medsResponse = await api.get(`/api/v1/patients/${familyData.families[0].patient.id}/medications/today`);
        setTodaysMedications(medsResponse.data.schedule);
      }
    } catch (error: any) {
      console.error('Error logging medication:', error);
      if (error.response?.data) {
        console.error('Error details:', error.response.data);
      }
    }
  };

  const handleQuickAction = (actionTitle: string) => {
    switch (actionTitle) {
      case 'Quick Entry':
        setShowQuickEntry(true);
        break;
      case "Today's Schedule":
        setShowTodaySchedule(true);
        break;
      case 'Add Task':
        setShowAddTask(true);
        break;
      case 'View Insights':
        // TODO: Navigate to insights page
        break;
      case 'Upload Document':
        // TODO: Show document upload modal
        break;
    }
  };

  const handleScheduleUpdate = () => {
    // Refresh medications, stats, and recent activity when schedule items are updated
    const refreshData = async () => {
      try {
        const response = await api.get<FamilyData>('/api/v1/families');
        
        if (response.data.families.length > 0) {
          const patientId = response.data.families[0].patient.id;
          await fetchTodayData(patientId, response.data.user?.id); // This includes recent activity refresh
        }
      } catch (error) {
        console.error('Error refreshing data:', error);
      }
    };
    
    refreshData();
  };

  const handleQuickEntrySave = () => {
    // Refresh recent activity when quick entry is saved
    setShowQuickEntry(false);
    if (familyData?.families?.[0]?.patient?.id) {
      fetchRecentActivity(familyData.families[0].patient.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{greeting}, {userName}</h1>
        <p className="mt-1 text-lg text-gray-600">
          {date} • {patientName} had a good night
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {getQuickActions(todayStats).map((action) => (
          <button
            key={action.title}
            onClick={() => handleQuickAction(action.title)}
            className="flex items-center gap-4 p-5 bg-white rounded-xl border-2 border-gray-200 hover:border-primary-500 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200"
          >
            <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <action.icon className="h-6 w-6 text-primary-600" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-900">{action.title}</h3>
              <p className="text-sm text-gray-500">{action.subtitle}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {statusCards.map((card) => (
          <div key={card.title} className="card hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200">
            <div className="flex items-start justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                {card.title}
              </span>
              <card.icon className="h-5 w-5 text-gray-400" />
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{card.value}</div>
            <div className="text-sm text-gray-500 mb-3">{card.subtitle}</div>
            <div className={cn(
              'inline-flex items-center gap-1 text-sm font-semibold px-3 py-1 rounded-full',
              card.trendType === 'up' && 'text-success bg-success-light'
            )}>
              <TrendingUp className="h-4 w-4" />
              {card.trend}
            </div>
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Activity - Takes 2 columns */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Recent Activity</h2>
              <a href="#" className="text-sm font-medium text-primary-600 hover:text-primary-700">
                View all →
              </a>
            </div>
            
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />
              
              {/* Timeline items */}
              <div className="space-y-6">
                {recentActivity.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No recent activity to display</p>
                  </div>
                ) : (
                  recentActivity.map((item, index) => {
                    // Get icon and color based on activity type
                    const getActivityIcon = (type: string) => {
                      switch (type) {
                        case 'medication':
                          return 'bg-blue-500';
                        case 'journal':
                          return 'bg-green-500';
                        case 'task':
                          return 'bg-yellow-500';
                        case 'appointment':
                          return 'bg-purple-500';
                        default:
                          return 'bg-primary-500';
                      }
                    };

                    return (
                      <div key={index} className="relative flex gap-4">
                        <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center">
                          <div className={`w-4 h-4 bg-white rounded-full border-[3px] ${getActivityIcon(item.type)} z-10`} />
                        </div>
                        <div className="flex-1 pb-6">
                          <div className="text-sm text-gray-500 mb-1">{item.time}</div>
                          <div className="bg-gray-50 rounded-xl p-4">
                            <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                            <p className="text-sm text-gray-600">{item.description}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Today's Medications */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Today's Medications</h2>
            <a href="/medications" className="text-sm font-medium text-primary-600 hover:text-primary-700">
              Manage →
            </a>
          </div>
          
          <div className="space-y-3">
            {todaysMedications.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No medications scheduled today</p>
            ) : (
              todaysMedications.map((med) => {
                const isPastTime = new Date(med.scheduledTime) <= new Date();
                const canLog = med.status === 'pending' && isPastTime;
                
                return (
                  <div
                    key={`${med.medicationId}-${med.scheduledTime}`}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg transition-colors",
                      med.status === 'given' && "bg-green-50",
                      med.status === 'pending' && "bg-gray-50 hover:bg-primary-50",
                      (med.status === 'missed' || med.status === 'refused') && "bg-red-50"
                    )}
                  >
                    <div className={cn(
                      "text-sm font-semibold min-w-[60px]",
                      med.status === 'given' && "text-green-700",
                      med.status === 'pending' && "text-primary-600",
                      (med.status === 'missed' || med.status === 'refused') && "text-red-700"
                    )}>
                      {med.timeString}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 text-sm">{med.medicationName}</div>
                      <div className="text-xs text-gray-500">{med.dosage}</div>
                    </div>
                    {canLog ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleMedicationLog(med, 'given')}
                          className="p-1.5 bg-success text-white rounded hover:bg-green-700 transition-colors"
                          title="Mark as given"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleMedicationLog(med, 'missed')}
                          className="p-1.5 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                          title="Mark as missed"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center',
                        med.status === 'given' && 'bg-success text-white',
                        med.status === 'pending' && 'bg-gray-200',
                        (med.status === 'missed' || med.status === 'refused') && 'bg-red-600 text-white'
                      )}>
                        {med.status === 'given' && <CheckCircle className="h-5 w-5" />}
                        {(med.status === 'missed' || med.status === 'refused') && <X className="h-5 w-5" />}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Quick Entry Modal */}
      {showQuickEntry && (
        <QuickEntry
          onClose={() => setShowQuickEntry(false)}
          onSave={handleQuickEntrySave}
          patientName={patientName}
        />
      )}

      {/* Today's Schedule Modal */}
      {showTodaySchedule && (
        <TodaySchedule
          isOpen={showTodaySchedule}
          onClose={() => setShowTodaySchedule(false)}
          onUpdate={handleScheduleUpdate}
        />
      )}

      {/* Add Task Modal */}
      {showAddTask && (
        <AddTaskModal
          isOpen={showAddTask}
          onClose={() => setShowAddTask(false)}
          onTaskAdded={() => {
            setShowAddTask(false);
            handleScheduleUpdate();
          }}
        />
      )}
    </div>
  );
}