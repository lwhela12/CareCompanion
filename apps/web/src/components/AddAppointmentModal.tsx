import { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, User, FileText, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@clerk/clerk-react';
import { api } from '../lib/api';
import { dateInputToLocalISOString, toLocalISOString } from '@/lib/utils';

interface AddAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAppointmentAdded: () => void;
  defaultDate?: Date;
}

export function AddAppointmentModal({ isOpen, onClose, onAppointmentAdded, defaultDate }: AddAppointmentModalProps) {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [patient, setPatient] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    appointmentType: 'medical',
    location: '',
    provider: '',
    assignedToId: '',
    date: defaultDate ? format(defaultDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    time: '09:00',
    duration: '60',
    notes: '',
    isRecurring: false,
    recurrenceType: 'daily' as 'daily' | 'weekly' | 'biweekly' | 'monthly',
    recurrenceEndDate: '',
  });

  useEffect(() => {
    if (isOpen) {
      fetchFamilyData();
    }
  }, [isOpen]);

  const fetchFamilyData = async () => {
    try {
      const token = await getToken();
      
      // First get user's families
      const familiesRes = await api.get('/api/v1/families', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (familiesRes.data.families && familiesRes.data.families.length > 0) {
        const familyId = familiesRes.data.families[0].id;
        
        // Then get detailed family info with members
        const familyRes = await api.get(`/api/v1/families/${familyId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (familyRes.data.family) {
          setFamilyMembers(familyRes.data.family.members || []);
          setPatient(familyRes.data.family.patient);
        }
      }
    } catch (error) {
      console.error('Failed to fetch family data:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = await getToken();
      
      // Combine date and time
      const [hours, minutes] = formData.time.split(':');
      const appointmentDate = new Date(formData.date);
      appointmentDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      const getPriority = () => {
        return ['medical', 'therapy', 'lab'].includes(formData.appointmentType) ? 'high' : 'medium';
      };

      // Build description without emoji (taskType field handles appointment distinction now)
      const descriptionParts = [];
      if (formData.provider) descriptionParts.push(`with ${formData.provider}`);
      if (formData.location) descriptionParts.push(`Location: ${formData.location}`);
      if (formData.description) descriptionParts.push(formData.description);
      const description = descriptionParts.join('\n');

      // Prepare the request body
      const requestBody: any = {
        title: formData.title,
        description: description || undefined,
        dueDate: toLocalISOString(appointmentDate),
        priority: getPriority(),
        taskType: 'appointment', // Explicitly mark as appointment
        assignedToId: formData.assignedToId || undefined,
      };

      // Add recurrence data if applicable
      if (formData.isRecurring) {
        requestBody.isRecurring = true;
        requestBody.recurrenceType = formData.recurrenceType;
        // Only include end date if provided
        if (formData.recurrenceEndDate) {
          requestBody.recurrenceEndDate = dateInputToLocalISOString(formData.recurrenceEndDate);
        }
      }

      // Create appointment(s)
      const response = await api.post('/api/v1/care-tasks', requestBody, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Show success message
      if (response.data.message) {
        alert(response.data.message);
      }

      onAppointmentAdded();
      onClose();
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        appointmentType: 'medical',
        location: '',
        provider: '',
        assignedToId: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        time: '09:00',
        duration: '60',
        notes: '',
        isRecurring: false,
        recurrenceType: 'daily',
        recurrenceEndDate: '',
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

              {/* Assigned To */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <UserCheck className="inline h-4 w-4 mr-1" />
                  Assigned To
                </label>
                <select
                  value={formData.assignedToId}
                  onChange={(e) => setFormData({ ...formData, assignedToId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">No assignment (family shared)</option>
                  {patient && (
                    <option value={`patient-${patient.id}`}>
                      {patient.firstName} {patient.lastName} (Patient)
                    </option>
                  )}
                  {familyMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.firstName} {member.lastName} ({member.role.replace('_', ' ')})
                    </option>
                  ))}
                </select>
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

              {/* Recurring Appointment */}
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    id="recurring"
                    checked={formData.isRecurring}
                    onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                    className="h-4 w-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                  />
                  <label htmlFor="recurring" className="text-sm font-medium text-gray-700">
                    Make this a recurring appointment
                  </label>
                </div>

                {formData.isRecurring && (
                  <div className="space-y-4 mb-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Repeat
                        </label>
                        <select
                          value={formData.recurrenceType}
                          onChange={(e) => setFormData({ ...formData, recurrenceType: e.target.value as any })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="biweekly">Bi-weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          End Date (Optional)
                        </label>
                        <input
                          type="date"
                          value={formData.recurrenceEndDate}
                          onChange={(e) => setFormData({ ...formData, recurrenceEndDate: e.target.value })}
                          min={formData.date}
                          placeholder="No end date"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">
                      Leave end date empty for indefinite recurrence
                    </p>
                  </div>
                )}
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
