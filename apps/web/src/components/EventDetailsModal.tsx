import { X, Calendar, Clock, MapPin, User, Pill, FileText, Users } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@clerk/clerk-react';
import { api } from '../lib/api';
import { useState } from 'react';

interface EventDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: any;
  onEventUpdated?: () => void;
}

export function EventDetailsModal({ isOpen, onClose, event, onEventUpdated }: EventDetailsModalProps) {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);

  if (!isOpen || !event) return null;

  const eventType = event.extendedProps?.type || 'task';
  const isAppointment = eventType === 'appointment' || (eventType === 'task' && event.color === '#9333EA');
  const isSocialVisit = event.extendedProps?.description?.includes('👥');
  const isMedication = eventType === 'medication';

  const handleMarkComplete = async () => {
    if (eventType !== 'task' && eventType !== 'appointment') return;
    
    setLoading(true);
    try {
      const token = await getToken();
      const taskId = event.extendedProps.taskId;
      
      await api.post(`/api/v1/care-tasks/${taskId}/complete`, {
        notes: 'Completed via calendar'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (onEventUpdated) onEventUpdated();
      onClose();
    } catch (error) {
      console.error('Failed to mark task complete:', error);
      alert('Failed to mark task complete');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (eventType !== 'task' && eventType !== 'appointment') return;
    
    if (!confirm('Are you sure you want to delete this event?')) return;
    
    setLoading(true);
    try {
      const token = await getToken();
      const taskId = event.extendedProps.taskId;
      
      await api.delete(`/api/v1/care-tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (onEventUpdated) onEventUpdated();
      onClose();
    } catch (error) {
      console.error('Failed to delete task:', error);
      alert('Failed to delete task');
    } finally {
      setLoading(false);
    }
  };

  const getIcon = () => {
    if (isMedication) return <Pill className="h-5 w-5" />;
    if (isSocialVisit) return <Users className="h-5 w-5" />;
    if (isAppointment) return <Calendar className="h-5 w-5" />;
    return <FileText className="h-5 w-5" />;
  };

  const getEventTypeLabel = () => {
    if (isMedication) return 'Medication';
    if (isSocialVisit) return 'Social Visit';
    if (isAppointment) return 'Appointment';
    return 'Task';
  };

  const getEventColor = () => {
    if (isMedication) return 'bg-blue-100 text-blue-700';
    if (isSocialVisit) return 'bg-green-100 text-green-700';
    if (isAppointment) return 'bg-purple-100 text-purple-700';
    return 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={onClose} />
        
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          <div className="flex items-center justify-between p-6 border-b">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${getEventColor()}`}>
                {getIcon()}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{event.title}</h3>
                <p className="text-sm text-gray-500">{getEventTypeLabel()}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6">
            <div className="space-y-4">
              {/* Date and Time */}
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {format(new Date(event.start), 'EEEE, MMMM d, yyyy')}
                  </p>
                  <p className="text-sm text-gray-600">
                    {format(new Date(event.start), 'h:mm a')}
                    {event.end && ` - ${format(new Date(event.end), 'h:mm a')}`}
                  </p>
                </div>
              </div>

              {/* Description */}
              {event.extendedProps?.description && (
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">
                      {event.extendedProps.description}
                    </p>
                  </div>
                </div>
              )}

              {/* Patient (for medications) */}
              {event.extendedProps?.patientName && (
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-600">
                      Patient: {event.extendedProps.patientName}
                    </p>
                  </div>
                </div>
              )}

              {/* Status (for tasks/appointments) */}
              {event.extendedProps?.status && (
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 mt-0.5">
                    <div className={`w-2 h-2 rounded-full mx-auto mt-1.5 ${
                      event.extendedProps.status === 'completed' ? 'bg-green-500' : 
                      event.extendedProps.status === 'in_progress' ? 'bg-yellow-500' : 
                      'bg-gray-400'
                    }`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">
                      Status: {event.extendedProps.status.replace('_', ' ')}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            {(eventType === 'task' || eventType === 'appointment') && event.extendedProps?.status !== 'completed' && (
              <div className="flex gap-3 mt-6 pt-6 border-t">
                <button
                  onClick={handleMarkComplete}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Updating...' : 'Mark Complete'}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            )}

            {isMedication && (
              <div className="mt-6 pt-6 border-t">
                <p className="text-sm text-gray-500 text-center">
                  To manage this medication, go to the Medications page
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}