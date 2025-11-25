import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Calendar,
  BarChart2,
  FileText,
  Pill,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  Check,
  X,
  ClipboardList,
  UserCircle,
  LogIn,
  Key,
  Lightbulb,
  Minus
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { cn, localDayBounds, startEndOfLocalDay, toLocalISOString } from '@/lib/utils';
import { api } from '@/lib/api';
import { getCachedDashboardData, clearDashboardCache } from '@/lib/dashboardCache';
import { QuickEntry } from '@/components/QuickEntry';
import { TodaySchedule } from '@/components/TodaySchedule';
import { AddTaskModal } from '@/components/AddTaskModal';
import { UploadDocumentModal } from '@/components/UploadDocumentModal';
import { CeeCeeName } from '@/components/CeeCeeName';

const getQuickActions = (todayStats: { tasks: number; appointments: number }) => [
  {
    icon: Plus,
    title: 'Quick Entry',
    subtitle: 'Log medication or note',
    color: 'primary',
    action: 'quick-entry',
  },
  {
    icon: Calendar,
    title: "Today's Schedule",
    subtitle: todayStats.tasks === 0 && todayStats.appointments === 0
      ? 'All caught up for today!'
      : `${todayStats.tasks} task${todayStats.tasks !== 1 ? 's' : ''} for you, ${todayStats.appointments} appointment${todayStats.appointments !== 1 ? 's' : ''}`,
    color: 'primary',
    action: 'schedule',
  },
  {
    icon: UserCircle,
    title: 'Patient Portal',
    subtitle: 'View patient checklist',
    color: 'primary',
    action: 'patient-portal',
  },
  {
    icon: FileText,
    title: 'Upload Document',
    subtitle: 'Medical records & more',
    color: 'primary',
    action: 'upload',
  },
];

// Status cards are now dynamic - defined in component with live data


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

// Check for cached data outside component to use in initial state
const getInitialState = () => {
  const cachedData = getCachedDashboardData();
  if (cachedData) {
    return {
      familyData: cachedData.familyData,
      userName: cachedData.familyData.user?.firstName || 'there',
      todaysMedications: cachedData.todaysMedications,
      isLoading: false,
      hadCache: true,
    };
  }
  return {
    familyData: null as FamilyData | null,
    userName: '',
    todaysMedications: [] as TodayMedication[],
    isLoading: true,
    hadCache: false,
  };
};

export function Dashboard() {
  // Get initial state from cache if available (prevents loading flash)
  const initialState = getInitialState();

  const [familyData, setFamilyData] = useState<FamilyData | null>(initialState.familyData);
  const [userName, setUserName] = useState(initialState.userName);
  const [todaysMedications, setTodaysMedications] = useState<TodayMedication[]>(initialState.todaysMedications);
  const [isLoading, setIsLoading] = useState(initialState.isLoading);
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [showTodaySchedule, setShowTodaySchedule] = useState(false);
  const [showTodayAppointments, setShowTodayAppointments] = useState(false);
  const [todayAppointments, setTodayAppointments] = useState<Array<{
    id: string;
    title: string;
    description?: string;
    dueDate: string;
    status: string;
    priority: string;
  }>>([]);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showUploadDocument, setShowUploadDocument] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [todayStats, setTodayStats] = useState({ tasks: 0, appointments: 0 });
  const [recentActivity, setRecentActivity] = useState<Array<{
    time: string;
    title: string;
    description: string;
    type: 'medication' | 'journal' | 'task' | 'appointment';
    timestamp: Date;
    isCeeCee?: boolean;
  }>>([]);
  const [statusData, setStatusData] = useState({
    medicationAdherence: { value: '--', subtitle: 'This week', trend: '', trendType: 'neutral' as 'up' | 'down' | 'neutral' },
    tasksRemaining: { value: '--', subtitle: 'Today', trend: '', trendType: 'neutral' as 'up' | 'down' | 'neutral' },
    appointmentsToday: { value: '--', subtitle: 'Today', trend: '', trendType: 'neutral' as 'up' | 'down' | 'neutral' },
    recommendationsToReview: { value: '--', subtitle: 'Pending review', trend: '', trendType: 'neutral' as 'up' | 'down' | 'neutral' },
  });

  useEffect(() => {
    const fetchFamilyData = async () => {
      try {
        // If we used cache during initialization, we already have family data
        // but still need to fetch the rest (status cards, recent activity, etc.)
        if (initialState.hadCache) {
          clearDashboardCache();
          // Fetch today's data to populate status cards, recent activity, etc.
          if (initialState.familyData?.families?.length > 0) {
            await fetchTodayData(
              initialState.familyData.families[0].patient.id,
              initialState.familyData.user?.id
            );
          }
          return;
        }

        // Normal fetch flow (no cache)
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

  // Listen for data changes from CeeCee chat (when tasks/meds are added via chat)
  useEffect(() => {
    const handleDataChanged = async () => {
      // Refetch data when CeeCee makes changes
      if (familyData?.families[0]?.patient?.id) {
        await fetchTodayData(familyData.families[0].patient.id, familyData.user?.id);
      }
    };
    window.addEventListener('ceecee-data-changed', handleDataChanged);
    return () => {
      window.removeEventListener('ceecee-data-changed', handleDataChanged);
    };
  }, [familyData]);

  const fetchTodayData = async (patientId: string, currentUserId?: string) => {
    try {
      // Fetch today's medications
      const medsResponse = await api.get(`/api/v1/patients/${patientId}/medications/today`);
      const { startDate: medStart, endDate: medEnd } = localDayBounds();
      const filteredMeds = Array.isArray(medsResponse.data.schedule)
        ? medsResponse.data.schedule.filter((m: any) => {
            const ts = new Date(m.scheduledTime);
            return ts >= medStart && ts <= medEnd;
          })
        : [];
      setTodaysMedications(filteredMeds);
      
      // Fetch today's tasks and appointments for stats
      const today = new Date();
      const { start: startOfDay, end: endOfDay } = startEndOfLocalDay(today);
      
      const tasksResponse = await api.get(`/api/v1/care-tasks?startDate=${startOfDay}&endDate=${endOfDay}&includeVirtual=true`);
      
      // Count pending medications from the FILTERED list (same as what's displayed)
      let pendingMedications = 0;
      if (filteredMeds && filteredMeds.length > 0) {
        pendingMedications = filteredMeds.filter((med: any) =>
          med.status === 'pending'
        ).length;
      }
      
      // Count tasks and appointments (separate them properly)
      let taskCount = pendingMedications; // Start with pending medications
      let appointmentCount = 0;
      const appointmentsList: Array<{
        id: string;
        title: string;
        description?: string;
        dueDate: string;
        status: string;
        priority: string;
      }> = [];

      if (tasksResponse.data.tasks) {
        tasksResponse.data.tasks.forEach((task: any) => {
          // Check if this is an appointment using the taskType field
          const isAppointment = task.taskType === 'APPOINTMENT';

          // Count tasks for current user:
          // 1. Tasks explicitly assigned to current user
          // 2. Unassigned tasks (null assignedToId - includes patient assignments)
          const isForCurrentUser = !task.assignedToId || task.assignedTo?.id === currentUserId;

          if (!isForCurrentUser) {
            return;
          }

          if (isAppointment) {
            // Collect all appointments (including completed) for the list
            appointmentsList.push({
              id: task.id,
              title: task.title,
              description: task.description,
              dueDate: task.dueDate,
              status: task.status,
              priority: task.priority,
            });
            // Only count non-completed appointments
            if (task.status !== 'COMPLETED') {
              appointmentCount++;
            }
          } else {
            // Only count non-completed tasks
            if (task.status !== 'COMPLETED') {
              taskCount++;
            }
          }
        });
      }

      // Store today's appointments for the modal
      setTodayAppointments(appointmentsList);
      setTodayStats({ tasks: taskCount, appointments: appointmentCount });

      // Fetch status card data
      await fetchStatusCardData(patientId, medsResponse.data.schedule, taskCount, appointmentCount);

      // Fetch recent activity
      await fetchRecentActivity(patientId);
    } catch (error) {
      console.error('Error fetching today data:', error);
    }
  };

  const fetchStatusCardData = async (patientId: string, todaySchedule: any[], pendingTaskCount: number, appointmentCount: number) => {
    try {
      // 1. Calculate medication adherence for the week
      // We'll use today's data for now and calculate weekly adherence
      let givenCount = 0;
      let totalScheduled = 0;

      if (todaySchedule && todaySchedule.length > 0) {
        // For now, calculate from today's schedule
        // In future, could add a weekly endpoint
        const now = new Date();
        todaySchedule.forEach((med: any) => {
          const scheduledTime = new Date(med.scheduledTime);
          // Only count past scheduled times
          if (scheduledTime <= now) {
            totalScheduled++;
            if (med.status === 'given') {
              givenCount++;
            }
          }
        });
      }

      const adherencePercent = totalScheduled > 0
        ? Math.round((givenCount / totalScheduled) * 100)
        : 100;
      const adherenceTrend = adherencePercent >= 90 ? 'On track' : adherencePercent >= 70 ? 'Needs attention' : 'Below target';
      const adherenceTrendType = adherencePercent >= 90 ? 'up' : adherencePercent >= 70 ? 'neutral' : 'down';

      // 2. Tasks remaining (already calculated)
      const tasksTrend = pendingTaskCount === 0 ? 'All done!' : pendingTaskCount <= 3 ? 'Almost there' : 'Stay focused';
      const tasksTrendType = pendingTaskCount === 0 ? 'up' : pendingTaskCount <= 3 ? 'neutral' : 'neutral';

      // 3. Appointments today
      const appointmentsTrend = appointmentCount === 0 ? 'None scheduled' : appointmentCount === 1 ? 'Coming up' : `${appointmentCount} scheduled`;
      const appointmentsTrendType = 'neutral';

      // 4. Fetch recommendations needing review
      let pendingRecommendations = 0;
      try {
        const recsResponse = await api.get('/api/v1/recommendations');
        if (recsResponse.data.recommendations) {
          pendingRecommendations = recsResponse.data.recommendations.filter((rec: any) =>
            rec.status === 'PENDING' || rec.status === 'ACTIVE'
          ).length;
        }
      } catch (error) {
        console.log('Could not fetch recommendations:', error);
      }

      const recsTrend = pendingRecommendations === 0 ? 'All reviewed' : pendingRecommendations === 1 ? 'Review when ready' : 'Needs attention';
      const recsTrendType = pendingRecommendations === 0 ? 'up' : pendingRecommendations <= 2 ? 'neutral' : 'down';

      setStatusData({
        medicationAdherence: {
          value: `${adherencePercent}%`,
          subtitle: 'Today',
          trend: adherenceTrend,
          trendType: adherenceTrendType as 'up' | 'down' | 'neutral',
        },
        tasksRemaining: {
          value: String(pendingTaskCount),
          subtitle: 'Today',
          trend: tasksTrend,
          trendType: tasksTrendType as 'up' | 'down' | 'neutral',
        },
        appointmentsToday: {
          value: String(appointmentCount),
          subtitle: 'Today',
          trend: appointmentsTrend,
          trendType: appointmentsTrendType as 'up' | 'down' | 'neutral',
        },
        recommendationsToReview: {
          value: String(pendingRecommendations),
          subtitle: 'Pending review',
          trend: recsTrend,
          trendType: recsTrendType as 'up' | 'down' | 'neutral',
        },
      });
    } catch (error) {
      console.error('Error fetching status card data:', error);
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
        isCeeCee?: boolean;
      }> = [];

      // Fetch recent journal entries (last 3 days)
      try {
        const journalResponse = await api.get('/api/v1/journal?days=3');
        
        if (journalResponse.data.entries) {
          journalResponse.data.entries.slice(0, 6).forEach((entry: any) => {
            const createdAt = new Date(entry.createdAt);
            activities.push({
              time: formatTimeAgo(createdAt),
              title: entry.autoGenerated ? 'Journal entry by' : `Journal entry by ${entry.user?.firstName || 'Caregiver'}`,
              description: entry.content.length > 120 ? entry.content.substring(0, 120) + '...' : entry.content,
              type: 'journal',
              timestamp: createdAt,
              isCeeCee: entry.autoGenerated
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

        const taskResponse = await api.get(`/api/v1/care-tasks?startDate=${toLocalISOString(threeDaysAgo)}&endDate=${toLocalISOString(endDate)}`);

        if (taskResponse.data.tasks) {
          // Show completed tasks
          taskResponse.data.tasks
            .filter((task: any) => task.status === 'COMPLETED')
            .slice(0, 4)
            .forEach((task: any) => {
              const updatedAt = new Date(task.updatedAt);
              const isAppointment = task.taskType === 'APPOINTMENT';

              activities.push({
                time: formatTimeAgo(updatedAt),
                title: isAppointment ? `${task.title} completed` : `Task completed: ${task.title}`,
                description: task.description || `Completed by ${task.assignedTo?.firstName || 'caregiver'}`,
                type: isAppointment ? 'appointment' : 'task',
                timestamp: updatedAt
              });
            });

          // Also show recently CREATED tasks (last hour) so new items appear immediately
          const oneHourAgo = new Date();
          oneHourAgo.setHours(oneHourAgo.getHours() - 1);

          taskResponse.data.tasks
            .filter((task: any) => {
              const createdAt = new Date(task.createdAt);
              return task.status === 'PENDING' && createdAt >= oneHourAgo;
            })
            .slice(0, 4)
            .forEach((task: any) => {
              const createdAt = new Date(task.createdAt);
              const isAppointment = task.taskType === 'APPOINTMENT';

              activities.push({
                time: formatTimeAgo(createdAt),
                title: `Added: ${task.title}`,
                description: task.dueDate ? `Due ${format(new Date(task.dueDate), 'MMM d')}` : (task.description || 'New task'),
                type: isAppointment ? 'appointment' : 'task',
                timestamp: createdAt
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
  const patientId = familyData?.families[0]?.patient?.id;

  const handleLoginAsPatient = async () => {
    if (!patientId) {
      toast.error('No patient found');
      return;
    }

    try {
      const response = await api.post('/api/v1/auth/impersonate', {
        patientId,
      });

      toast.success(`Logging in as ${patientName}...`);

      // Store impersonation data in sessionStorage
      sessionStorage.setItem('impersonation', JSON.stringify(response.data));

      // Redirect to patient portal
      window.location.href = '/patient';
    } catch (error: any) {
      console.error('Error impersonating patient:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to login as patient');
    }
  };

  const handleResetPassword = async () => {
    if (!patientId) {
      toast.error('No patient found');
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    try {
      await api.post('/api/v1/auth/reset-patient-password', {
        patientId,
        newPassword,
      });

      toast.success('Password reset successfully!');
      setShowResetPassword(false);
      setNewPassword('');
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to reset password');
    }
  };

  const handleMedicationLog = async (medication: TodayMedication, status: 'given' | 'missed' | 'refused') => {
    console.log('handleMedicationLog called:', { medication, status });

    try {
      console.log('Sending medication log request...');
      const response = await api.post(`/api/v1/medications/${medication.medicationId}/log`, {
        scheduledTime: medication.scheduledTime,
        status,
      });
      console.log('Medication log response:', response.data);

      // Show success message
      const statusText = status === 'given' ? 'administered' : status;
      toast.success(`${medication.medicationName} marked as ${statusText}`);

      // Refresh the medications
      if (familyData?.families[0]?.patient?.id) {
        console.log('Refreshing medications...');
        const medsResponse = await api.get(`/api/v1/patients/${familyData.families[0].patient.id}/medications/today`);
        setTodaysMedications(medsResponse.data.schedule);
        console.log('Medications refreshed');
      }
    } catch (error: any) {
      console.error('Error logging medication:', error);
      console.error('Full error object:', {
        message: error.message,
        response: error.response,
        request: error.request,
        config: error.config
      });
      const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to log medication';
      toast.error(errorMessage);
    }
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'quick-entry':
        setShowQuickEntry(true);
        break;
      case 'schedule':
        setShowTodaySchedule(true);
        break;
      case 'add-task':
        setShowAddTask(true);
        break;
      case 'patient-portal':
        window.location.href = '/patient';
        break;
      case 'upload':
        setShowUploadDocument(true);
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
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{greeting}, {userName}</h1>
          <p className="mt-1 text-lg text-gray-600 dark:text-gray-400">
            {date} • {patientName} had a good night
          </p>
        </div>

        {/* Patient Actions */}
        {patientId && (
          <div className="flex flex-wrap gap-2 w-full md:w-auto md:justify-end">
            <button
              onClick={handleLoginAsPatient}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex-1 md:flex-none"
              title={`Login as ${patientName}`}
            >
              <LogIn className="h-5 w-5" />
              <span>Login as {patientName}</span>
            </button>
            <button
              onClick={() => setShowResetPassword(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors flex-1 md:flex-none"
              title="Reset patient password"
            >
              <Key className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {getQuickActions(todayStats).map((action) => (
          <button
            key={action.action}
            onClick={() => handleQuickAction(action.action)}
            className="flex items-center gap-4 p-5 bg-white dark:bg-slate-800 rounded-xl border-2 border-gray-200 dark:border-slate-700 hover:border-primary-500 dark:hover:border-primary-400 hover:-translate-y-0.5 hover:shadow-lg dark:hover:shadow-slate-900/50 transition-all duration-200 w-full text-left"
          >
            <div className="w-12 h-12 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <action.icon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{action.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{action.subtitle}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Medication Adherence */}
        <div className="card hover:-translate-y-0.5 hover:shadow-lg dark:hover:shadow-slate-900/50 transition-all duration-200">
          <div className="flex items-start justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Medication Adherence
            </span>
            <Pill className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">{statusData.medicationAdherence.value}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">{statusData.medicationAdherence.subtitle}</div>
          {statusData.medicationAdherence.trend && (
            <div className={cn(
              'inline-flex items-center gap-1 text-sm font-semibold px-3 py-1 rounded-full',
              statusData.medicationAdherence.trendType === 'up' && 'text-success bg-success-light dark:bg-success/20',
              statusData.medicationAdherence.trendType === 'down' && 'text-red-600 bg-red-100 dark:bg-red-900/20',
              statusData.medicationAdherence.trendType === 'neutral' && 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20'
            )}>
              {statusData.medicationAdherence.trendType === 'up' && <TrendingUp className="h-4 w-4" />}
              {statusData.medicationAdherence.trendType === 'down' && <TrendingDown className="h-4 w-4" />}
              {statusData.medicationAdherence.trendType === 'neutral' && <Minus className="h-4 w-4" />}
              {statusData.medicationAdherence.trend}
            </div>
          )}
        </div>

        {/* Tasks Remaining */}
        <button
          onClick={() => setShowTodaySchedule(true)}
          className="card hover:-translate-y-0.5 hover:shadow-lg dark:hover:shadow-slate-900/50 transition-all duration-200 block w-full text-left"
        >
          <div className="flex items-start justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Tasks Remaining
            </span>
            <ClipboardList className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">{statusData.tasksRemaining.value}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">{statusData.tasksRemaining.subtitle}</div>
          {statusData.tasksRemaining.trend && (
            <div className={cn(
              'inline-flex items-center gap-1 text-sm font-semibold px-3 py-1 rounded-full',
              statusData.tasksRemaining.trendType === 'up' && 'text-success bg-success-light dark:bg-success/20',
              statusData.tasksRemaining.trendType === 'down' && 'text-red-600 bg-red-100 dark:bg-red-900/20',
              statusData.tasksRemaining.trendType === 'neutral' && 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20'
            )}>
              {statusData.tasksRemaining.trendType === 'up' && <TrendingUp className="h-4 w-4" />}
              {statusData.tasksRemaining.trendType === 'down' && <TrendingDown className="h-4 w-4" />}
              {statusData.tasksRemaining.trendType === 'neutral' && <Minus className="h-4 w-4" />}
              {statusData.tasksRemaining.trend}
            </div>
          )}
        </button>

        {/* Appointments Today */}
        <button
          onClick={() => setShowTodayAppointments(true)}
          className="card hover:-translate-y-0.5 hover:shadow-lg dark:hover:shadow-slate-900/50 transition-all duration-200 block w-full text-left"
        >
          <div className="flex items-start justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Appointments
            </span>
            <Calendar className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">{statusData.appointmentsToday.value}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">{statusData.appointmentsToday.subtitle}</div>
          {statusData.appointmentsToday.trend && (
            <div className={cn(
              'inline-flex items-center gap-1 text-sm font-semibold px-3 py-1 rounded-full',
              statusData.appointmentsToday.trendType === 'up' && 'text-success bg-success-light dark:bg-success/20',
              statusData.appointmentsToday.trendType === 'down' && 'text-red-600 bg-red-100 dark:bg-red-900/20',
              statusData.appointmentsToday.trendType === 'neutral' && 'text-purple-600 bg-purple-100 dark:bg-purple-900/20'
            )}>
              {statusData.appointmentsToday.trendType === 'up' && <TrendingUp className="h-4 w-4" />}
              {statusData.appointmentsToday.trendType === 'down' && <TrendingDown className="h-4 w-4" />}
              {statusData.appointmentsToday.trendType === 'neutral' && <Calendar className="h-4 w-4" />}
              {statusData.appointmentsToday.trend}
            </div>
          )}
        </button>

        {/* Recommendations to Review */}
        <Link to="/recommendations" className="card hover:-translate-y-0.5 hover:shadow-lg dark:hover:shadow-slate-900/50 transition-all duration-200 block">
          <div className="flex items-start justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Recommendations
            </span>
            <Lightbulb className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">{statusData.recommendationsToReview.value}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">{statusData.recommendationsToReview.subtitle}</div>
          {statusData.recommendationsToReview.trend && (
            <div className={cn(
              'inline-flex items-center gap-1 text-sm font-semibold px-3 py-1 rounded-full',
              statusData.recommendationsToReview.trendType === 'up' && 'text-success bg-success-light dark:bg-success/20',
              statusData.recommendationsToReview.trendType === 'down' && 'text-red-600 bg-red-100 dark:bg-red-900/20',
              statusData.recommendationsToReview.trendType === 'neutral' && 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20'
            )}>
              {statusData.recommendationsToReview.trendType === 'up' && <TrendingUp className="h-4 w-4" />}
              {statusData.recommendationsToReview.trendType === 'down' && <TrendingDown className="h-4 w-4" />}
              {statusData.recommendationsToReview.trendType === 'neutral' && <Minus className="h-4 w-4" />}
              {statusData.recommendationsToReview.trend}
            </div>
          )}
        </Link>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Activity - Takes 2 columns */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Recent Activity</h2>
              <Link to="/journal" className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300">
                View all →
              </Link>
            </div>

            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-slate-700" />

              {/* Timeline items */}
              <div className="space-y-6">
                {recentActivity.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400">No recent activity to display</p>
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
                          <div className={`w-4 h-4 bg-white dark:bg-slate-800 rounded-full border-[3px] ${getActivityIcon(item.type)} z-10`} />
                        </div>
                        <div className="flex-1 pb-6">
                          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">{item.time}</div>
                          <div className="bg-gray-50 dark:bg-slate-800/70 rounded-xl p-4">
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                              {item.title}{item.isCeeCee && <> <CeeCeeName /></>}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{item.description}</p>
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Today's Medications</h2>
            <a href="/medications" className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300">
              Manage →
            </a>
          </div>

          <div className="space-y-3">
            {todaysMedications.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No medications scheduled today</p>
            ) : (
              todaysMedications.map((med) => {
                const scheduledTime = new Date(med.scheduledTime);
                const now = new Date();
                const isPastTime = scheduledTime <= now;
                const minutesUntil = Math.floor((scheduledTime.getTime() - now.getTime()) / (1000 * 60));
                const minutesLate = Math.floor((now.getTime() - scheduledTime.getTime()) / (1000 * 60));

                return (
                  <div
                    key={`${med.medicationId}-${med.scheduledTime}`}
                    className={cn(
                      "flex flex-col gap-3 p-3 rounded-lg transition-colors sm:flex-row sm:items-center sm:gap-4",
                      med.status === 'given' && "bg-green-50 dark:bg-green-900/20",
                      med.status === 'pending' && "bg-gray-50 dark:bg-slate-800/70 hover:bg-primary-50 dark:hover:bg-primary-900/20",
                      (med.status === 'missed' || med.status === 'refused') && "bg-red-50 dark:bg-red-900/20"
                    )}
                  >
                    <div className="flex w-full items-center gap-3 sm:gap-4 sm:w-auto">
                      <div className={cn(
                        "text-sm font-semibold min-w-[60px]",
                        med.status === 'given' && "text-green-700 dark:text-green-400",
                        med.status === 'pending' && "text-primary-600 dark:text-primary-400",
                        (med.status === 'missed' || med.status === 'refused') && "text-red-700 dark:text-red-400"
                      )}>
                        {med.timeString}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{med.medicationName}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{med.dosage}</div>
                        {med.status === 'given' && med.givenTime && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Given {med.givenBy ? `by ${med.givenBy.firstName}` : ''} at {format(new Date(med.givenTime), 'h:mm a')}
                          </div>
                        )}
                        {med.status === 'pending' && !isPastTime && (
                          <div className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                            Due in {minutesUntil} min
                          </div>
                        )}
                        {med.status === 'pending' && isPastTime && minutesLate > 0 && (
                          <div className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
                            {minutesLate} min late
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 w-full sm:w-auto sm:justify-end">
                      <button
                        onClick={(e) => {
                          console.log('Given button clicked', { med });
                          e.preventDefault();
                          e.stopPropagation();
                          handleMedicationLog(med, 'given');
                        }}
                        className={cn(
                          "p-1.5 text-white rounded hover:bg-green-700 transition-colors w-full sm:w-auto justify-center flex",
                          med.status === 'given' ? 'bg-green-700' : 'bg-success'
                        )}
                        title="Mark as given"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          console.log('Missed button clicked', { med });
                          e.preventDefault();
                          e.stopPropagation();
                          handleMedicationLog(med, 'missed');
                        }}
                        className={cn(
                          "p-1.5 text-white rounded hover:bg-red-700 transition-colors w-full sm:w-auto justify-center flex",
                          med.status === 'missed' || med.status === 'refused' ? 'bg-red-700' : 'bg-red-600'
                        )}
                        title="Mark as missed"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
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

      {/* Today's Appointments Modal */}
      {showTodayAppointments && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-black dark:bg-opacity-70" onClick={() => setShowTodayAppointments(false)} />

            <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden">
              <div className="p-6 border-b dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Today's Appointments</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
                  </div>
                  <button
                    onClick={() => setShowTodayAppointments(false)}
                    className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-300"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {todayAppointments.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">No appointments scheduled for today</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {todayAppointments
                      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                      .map((appointment) => {
                        const appointmentTime = new Date(appointment.dueDate);
                        const now = new Date();
                        const isPast = appointmentTime < now;
                        const isCompleted = appointment.status === 'COMPLETED';

                        return (
                          <div
                            key={appointment.id}
                            className={cn(
                              "p-4 rounded-lg border-2",
                              isCompleted ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/30' :
                              isPast ? 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/30' :
                              'border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-900/30'
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <div className={cn(
                                "p-2 rounded-lg",
                                isCompleted ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                                'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400'
                              )}>
                                <Calendar className="h-5 w-5" />
                              </div>
                              <div className="flex-1">
                                <h4 className="font-semibold text-gray-900 dark:text-gray-100">{appointment.title}</h4>
                                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  <Clock className="h-4 w-4" />
                                  {format(appointmentTime, 'h:mm a')}
                                  {isCompleted && (
                                    <span className="text-green-600 dark:text-green-400 font-medium ml-2">Attended</span>
                                  )}
                                  {isPast && !isCompleted && (
                                    <span className="text-orange-600 dark:text-orange-400 font-medium ml-2">Past</span>
                                  )}
                                </div>
                                {appointment.description && (
                                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">
                                    {appointment.description.replace(/[🏥🧠🔬👥👨‍👩‍👧‍👦📅]/g, '').trim()}
                                  </p>
                                )}
                              </div>
                              {isPast && !isCompleted && (
                                <button
                                  onClick={async () => {
                                    try {
                                      await api.post(`/api/v1/care-tasks/${appointment.id}/complete`, {
                                        notes: 'Marked as attended'
                                      });
                                      handleScheduleUpdate();
                                      setShowTodayAppointments(false);
                                      toast.success('Appointment marked as attended');
                                    } catch (error) {
                                      toast.error('Failed to update appointment');
                                    }
                                  }}
                                  className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 transition-colors"
                                >
                                  Attended
                                </button>
                              )}
                              {isCompleted && (
                                <div className="p-2 bg-green-600 text-white rounded">
                                  <CheckCircle className="h-4 w-4" />
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

      {/* Upload Document Modal */}
      {showUploadDocument && (
        <UploadDocumentModal
          onClose={() => setShowUploadDocument(false)}
          onUploadComplete={() => {
            toast.success('Document uploaded successfully!');
            // Could add document activity to recent activity here
          }}
        />
      )}

      {/* Reset Password Modal */}
      {showResetPassword && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Reset Password</h3>
              <button
                onClick={() => {
                  setShowResetPassword(false);
                  setNewPassword('');
                }}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Set a new password for {patientName} to use when logging into the patient portal.
            </p>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                You can share this password with {patientName} so they can login independently.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowResetPassword(false);
                  setNewPassword('');
                }}
                className="flex-1 px-4 py-3 text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-slate-700 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                className="flex-1 px-4 py-3 text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors font-semibold"
              >
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
