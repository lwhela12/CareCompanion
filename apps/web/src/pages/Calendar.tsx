import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { format, startOfDay, endOfDay, parseISO } from 'date-fns';
import { Calendar as CalendarIcon, Pill, ClipboardList, Users, Plus, RefreshCw, Filter, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { api } from '../lib/api';
import { AddAppointmentModal } from '../components/AddAppointmentModal';
import { AddTaskModal } from '../components/AddTaskModal';
import { EventDetailsModal } from '../components/EventDetailsModal';
import { TasksOverview } from '../components/TasksOverview';

interface CalendarEvent {
  id: string;
  title: string;
  start: Date | string;
  end?: Date | string;
  color?: string;
  extendedProps?: {
    type: 'medication' | 'task' | 'appointment';
    description?: string;
    medicationId?: string;
    taskId?: string;
    patientName?: string;
    status?: string;
    assignedTo?: any;
    isVirtual?: boolean;
    parentTaskId?: string;
  };
}

export default function Calendar() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAddAppointment, setShowAddAppointment] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [selectedDateForAppointment, setSelectedDateForAppointment] = useState<Date>();
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [showTasksOverview, setShowTasksOverview] = useState(false);
  const [eventFilters, setEventFilters] = useState({
    medications: true,
    tasks: true,
    medicalAppointments: true,
    socialVisits: true
  });

  useEffect(() => {
    fetchCalendarData();
  }, []); // Only fetch on mount

  // Listen for data changes from CeeCee chat (when tasks/meds are added via chat)
  useEffect(() => {
    const handleDataChanged = () => {
      fetchCalendarData();
    };
    window.addEventListener('ceecee-data-changed', handleDataChanged);
    return () => {
      window.removeEventListener('ceecee-data-changed', handleDataChanged);
    };
  }, []);

  useEffect(() => {
    // Filter events based on current filter settings
    const filtered = allEvents.filter(event => {
      const type = event.extendedProps?.type;
      
      if (type === 'medication') {
        return eventFilters.medications;
      } else if (type === 'task') {
        return eventFilters.tasks;
      } else if (type === 'appointment') {
        const isSocialVisit = event.extendedProps?.description?.includes('👥') || 
                              event.extendedProps?.description?.includes('👨‍👩‍👧‍👦');
        if (isSocialVisit) {
          return eventFilters.socialVisits;
        } else {
          return eventFilters.medicalAppointments;
        }
      }
      
      return true; // Show unknown types by default
    });
    
    setFilteredEvents(filtered);
  }, [allEvents, eventFilters]);

  const fetchCalendarData = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      
      // Get a wider date range (3 months: previous, current, next)
      const today = new Date();
      const startDate = startOfDay(new Date(today.getFullYear(), today.getMonth() - 1, 1));
      const endDate = endOfDay(new Date(today.getFullYear(), today.getMonth() + 2, 0));

      // Fetch medications with schedules
      const medicationsRes = await api.get(`/api/v1/medications?includeSchedules=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Fetch care tasks with virtual occurrences
      const tasksRes = await api.get(`/api/v1/care-tasks?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&includeVirtual=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Transform medications into calendar events
      const medicationEvents: CalendarEvent[] = [];
      if (medicationsRes.data.medications) {
        medicationsRes.data.medications.forEach((medication: any) => {
          if (medication.scheduleTimes && medication.isActive) {
            // Create events for each scheduled time
            medication.scheduleTimes.forEach((time: string) => {
              // Create events for each day in the date range
              const currentDate = new Date(startDate);
              while (currentDate <= endDate) {
                const [hours, minutes] = time.split(':');
                const eventDate = new Date(currentDate);
                eventDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                
                medicationEvents.push({
                  id: `med-${medication.id}-${eventDate.getTime()}`,
                  title: `${medication.name} - ${medication.dosage}`,
                  start: new Date(eventDate),
                  end: new Date(eventDate.getTime() + 30 * 60000), // 30 minutes
                  color: '#3B82F6', // Blue for medications
                  extendedProps: {
                    type: 'medication',
                    medicationId: medication.id,
                    patientName: medication.patient?.firstName + ' ' + medication.patient?.lastName,
                    description: medication.instructions
                  }
                });
                
                // Move to next day
                currentDate.setDate(currentDate.getDate() + 1);
              }
            });
          }
        });
      }

      // Transform care tasks into calendar events
      const taskEvents: CalendarEvent[] = [];
      if (tasksRes.data.tasks) {
        tasksRes.data.tasks.forEach((task: any) => {
          // Use dueDate, or fall back to reminderDate, or createdAt for display
          const taskDate = task.dueDate || task.reminderDate || task.createdAt;
          if (taskDate) {
            // Check the type of task based on emoji in description
            const isMedicalAppointment = task.description?.includes('🏥');
            const isSocialVisit = task.description?.includes('👥') || task.description?.includes('👨‍👩‍👧‍👦');
            const isAppointment = task.priority === 'HIGH' && (isMedicalAppointment || task.description?.includes('🧠') || task.description?.includes('🔬'));
            
            let color = '#10B981'; // Default green for tasks
            let type: 'medication' | 'task' | 'appointment' = 'task';

            if (isAppointment) {
              color = '#9333EA'; // Purple for medical appointments
              type = 'appointment';
            } else if (isSocialVisit) {
              color = '#059669'; // Emerald for social visits
              type = 'appointment';
            }
            
            // Format title with assignment info
            let displayTitle = task.title;
            if (task.assignedTo) {
              displayTitle = `${task.title} (${task.assignedTo.firstName})`;
            }

            taskEvents.push({
              id: task.isVirtual ? task.id : `task-${task.id}`,
              title: displayTitle,
              start: parseISO(taskDate),
              color,
              extendedProps: {
                type,
                taskId: task.id,
                description: task.description,
                status: task.status,
                assignedTo: task.assignedTo,
                isVirtual: task.isVirtual,
                parentTaskId: task.parentTaskId
              }
            });
          }
        });
      }

      setAllEvents([...medicationEvents, ...taskEvents]);
    } catch (error) {
      console.error('Failed to fetch calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEventClick = (info: any) => {
    const event = info.event;
    setSelectedEvent({
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      color: event.backgroundColor,
      extendedProps: event.extendedProps
    });
    setShowEventDetails(true);
  };

  const handleDateClick = (info: any) => {
    setSelectedDateForAppointment(info.date);
    setShowAddAppointment(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Care Calendar</h1>
          <div className="flex items-center gap-4">
            <p className="text-gray-600">View medications, tasks, and appointments in one place</p>
            {allEvents.length > 0 && (
              <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                Showing {filteredEvents.length} of {allEvents.length} events
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => fetchCalendarData()}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Calendar Legend & Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Legend */}
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <span className="text-sm text-gray-600">Medications</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span className="text-sm text-gray-600">Care Tasks</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-purple-500 rounded"></div>
              <span className="text-sm text-gray-600">Medical Appointments</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-emerald-600 rounded"></div>
              <span className="text-sm text-gray-600">Social Visits</span>
            </div>
          </div>

          {/* Filter Controls */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600 mr-2">Show:</span>
            
            <button
              onClick={() => {
                const allVisible = Object.values(eventFilters).every(v => v);
                if (allVisible) {
                  // Hide all
                  setEventFilters({ medications: false, tasks: false, medicalAppointments: false, socialVisits: false });
                } else {
                  // Show all
                  setEventFilters({ medications: true, tasks: true, medicalAppointments: true, socialVisits: true });
                }
              }}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors"
            >
              {Object.values(eventFilters).every(v => v) ? 'Hide All' : 'Show All'}
            </button>
            
            <button
              onClick={() => setEventFilters(prev => ({ ...prev, medications: !prev.medications }))}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                eventFilters.medications 
                  ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                  : 'bg-gray-100 text-gray-500 border border-gray-200'
              }`}
            >
              {eventFilters.medications ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              Medications
            </button>

            <button
              onClick={() => setEventFilters(prev => ({ ...prev, tasks: !prev.tasks }))}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                eventFilters.tasks 
                  ? 'bg-green-100 text-green-700 border border-green-200' 
                  : 'bg-gray-100 text-gray-500 border border-gray-200'
              }`}
            >
              {eventFilters.tasks ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              Tasks
            </button>

            <button
              onClick={() => setEventFilters(prev => ({ ...prev, medicalAppointments: !prev.medicalAppointments }))}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                eventFilters.medicalAppointments 
                  ? 'bg-purple-100 text-purple-700 border border-purple-200' 
                  : 'bg-gray-100 text-gray-500 border border-gray-200'
              }`}
            >
              {eventFilters.medicalAppointments ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              Medical
            </button>

            <button
              onClick={() => setEventFilters(prev => ({ ...prev, socialVisits: !prev.socialVisits }))}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                eventFilters.socialVisits 
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                  : 'bg-gray-100 text-gray-500 border border-gray-200'
              }`}
            >
              {eventFilters.socialVisits ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              Social
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Component */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
          }}
          events={filteredEvents}
          eventClick={handleEventClick}
          dateClick={handleDateClick}
          height="auto"
          eventTimeFormat={{
            hour: 'numeric',
            minute: '2-digit',
            meridiem: 'short'
          }}
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
        />
      </div>

      {/* Quick Actions */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <button
          onClick={() => navigate('/medications')}
          className="flex items-center justify-center gap-2 bg-blue-50 text-blue-700 px-4 py-3 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <Pill className="h-5 w-5" />
          <span>Manage Medications</span>
        </button>
        <button
          onClick={() => setShowTasksOverview(true)}
          className="flex items-center justify-center gap-2 bg-green-50 text-green-700 px-4 py-3 rounded-lg hover:bg-green-100 transition-colors"
        >
          <ClipboardList className="h-5 w-5" />
          <span>View Tasks</span>
        </button>
        <button
          onClick={() => setShowAddTask(true)}
          className="flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-3 rounded-lg hover:bg-emerald-100 transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span>Add Task</span>
        </button>
        <button
          onClick={() => setShowAddAppointment(true)}
          className="flex items-center justify-center gap-2 bg-purple-50 text-purple-700 px-4 py-3 rounded-lg hover:bg-purple-100 transition-colors"
        >
          <CalendarIcon className="h-5 w-5" />
          <span>Add Appointment</span>
        </button>
      </div>

      {/* Add Appointment Modal */}
      <AddAppointmentModal
        isOpen={showAddAppointment}
        onClose={() => {
          setShowAddAppointment(false);
          setSelectedDateForAppointment(undefined);
        }}
        onAppointmentAdded={() => {
          fetchCalendarData();
          setShowAddAppointment(false);
          setSelectedDateForAppointment(undefined);
        }}
        defaultDate={selectedDateForAppointment}
      />

      {/* Event Details Modal */}
      <EventDetailsModal
        isOpen={showEventDetails}
        onClose={() => {
          setShowEventDetails(false);
          setSelectedEvent(null);
        }}
        event={selectedEvent}
        onEventUpdated={() => {
          fetchCalendarData();
          setShowEventDetails(false);
          setSelectedEvent(null);
        }}
      />

      {/* Tasks Overview Modal */}
      <TasksOverview
        isOpen={showTasksOverview}
        onClose={() => setShowTasksOverview(false)}
      />

      {/* Add Task Modal */}
      <AddTaskModal
        isOpen={showAddTask}
        onClose={() => setShowAddTask(false)}
        onTaskAdded={() => {
          fetchCalendarData();
          setShowAddTask(false);
        }}
        defaultDate={selectedDateForAppointment}
      />
    </div>
  );
}