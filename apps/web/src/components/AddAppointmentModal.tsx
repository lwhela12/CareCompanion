import { useState } from 'react';
import { X, Calendar, Clock, MapPin, User, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@clerk/clerk-react';
import { api } from '../lib/api';

interface AddAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAppointmentAdded: () => void;
  defaultDate?: Date;
}

export function AddAppointmentModal({ isOpen, onClose, onAppointmentAdded, defaultDate }: AddAppointmentModalProps) {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    appointmentType: 'medical',
    location: '',
    provider: '',
    date: defaultDate ? format(defaultDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    time: '09:00',
    duration: '60',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = await getToken();
      
      // Combine date and time
      const [hours, minutes] = formData.time.split(':');
      const appointmentDate = new Date(formData.date);
      appointmentDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      // Get emoji and priority based on appointment type
      const getEmoji = () => {
        switch (formData.appointmentType) {
          case 'medical': return '🏥';
          case 'therapy': return '🧠';
          case 'lab': return '🔬';
          case 'social': return '👥';
          case 'family': return '👨‍👩‍👧‍👦';
          default: return '📅';
        }
      };

      const getPriority = () => {
        return ['medical', 'therapy', 'lab'].includes(formData.appointmentType) ? 'high' : 'medium';
      };

      // Create appointment as a care task with appointment type
      await api.post('/api/v1/care-tasks', {
        title: formData.title,
        description: `${getEmoji()} ${formData.provider ? `with ${formData.provider}` : ''}\n${formData.location ? `📍 ${formData.location}` : ''}\n${formData.description}`,
        dueDate: appointmentDate.toISOString(),
        priority: getPriority(),
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      onAppointmentAdded();
      onClose();
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        appointmentType: 'medical',
        location: '',
        provider: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        time: '09:00',
        duration: '60',
        notes: '',
      });
    } catch (error) {
      console.error('Failed to create appointment:', error);
      alert('Failed to create appointment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={onClose} />
        
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          <div className="flex items-center justify-between p-6 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Add Appointment</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6">
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Appointment Title
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="e.g., Cardiology Checkup"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Appointment Type
                </label>
                <select
                  value={formData.appointmentType}
                  onChange={(e) => setFormData({ ...formData, appointmentType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="medical">Medical Appointment</option>
                  <option value="therapy">Therapy Session</option>
                  <option value="lab">Lab Work</option>
                  <option value="social">Social Visit</option>
                  <option value="family">Family Visit</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Provider/Person */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <User className="inline h-4 w-4 mr-1" />
                  {['social', 'family'].includes(formData.appointmentType) ? 'Who' : 'Provider/Doctor'}
                </label>
                <input
                  type="text"
                  value={formData.provider}
                  onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder={['social', 'family'].includes(formData.appointmentType) ? 'e.g., John, Mary' : 'e.g., Dr. Smith'}
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <MapPin className="inline h-4 w-4 mr-1" />
                  Location
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="e.g., Memorial Hospital, Room 302"
                />
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="inline h-4 w-4 mr-1" />
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Clock className="inline h-4 w-4 mr-1" />
                    Time
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FileText className="inline h-4 w-4 mr-1" />
                  Notes
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="Any special instructions or things to remember..."
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.title}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Appointment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}