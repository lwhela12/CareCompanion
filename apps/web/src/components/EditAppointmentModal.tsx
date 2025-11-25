import { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, User, FileText, UserCheck, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@clerk/clerk-react';
import { api } from '../lib/api';
import { toLocalISOString } from '@/lib/utils';

interface EditAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAppointmentUpdated: () => void;
  task: any;
}

export function EditAppointmentModal({ isOpen, onClose, onAppointmentUpdated, task }: EditAppointmentModalProps) {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [patient, setPatient] = useState<any>(null);
  const [editMode, setEditMode] = useState<'occurrence' | 'series'>('occurrence');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    appointmentType: 'medical',
    location: '',
    provider: '',
    assignedToId: '',
    date: '',
    time: '',
    duration: '60',
    notes: '',
  });

  useEffect(() => {
    if (isOpen && task) {
      fetchFamilyData();
      initializeFormData();
    }
  }, [isOpen, task]);

  const initializeFormData = () => {
    if (!task) return;

    // Parse the task data
    // For virtual tasks, use the virtual date instead of the template's due date
    const dueDate = task.virtualDate ? new Date(task.virtualDate) : new Date(task.dueDate);
    const description = task.description || '';
    
    // Extract appointment type from description
    let appointmentType = 'medical';
    if (description.includes('👥')) appointmentType = 'social';
    else if (description.includes('👨‍👩‍👧‍👦')) appointmentType = 'family';
    else if (description.includes('🧠')) appointmentType = 'therapy';
    else if (description.includes('🔬')) appointmentType = 'lab';
    
    // Extract provider and location from description
    const lines = description.split('\n');
    let provider = '';
    let location = '';
    let notes = '';
    
    lines.forEach((line: string) => {
      if (line.includes('with ')) {
        provider = line.replace(/.*with /, '').trim();
      } else if (line.includes('📍 ')) {
        location = line.replace('📍 ', '').trim();
      } else if (!line.includes('🏥') && !line.includes('👥') && !line.includes('🧠') && !line.includes('🔬') && !line.includes('👨‍👩‍👧‍👦')) {
        notes += (notes ? '\n' : '') + line;
      }
    });

    // Clean up title - remove assignee name in parentheses if present
    let cleanTitle = task.title;
    const titleMatch = cleanTitle.match(/^(.*?)\s*\([^)]+\)$/);
    if (titleMatch) {
      cleanTitle = titleMatch[1].trim();
    }

    setFormData({
      title: cleanTitle,
      description: notes.trim(),
      appointmentType,
      location,
      provider,
      assignedToId: task.assignedToId || '',
      date: format(dueDate, 'yyyy-MM-dd'),
      time: format(dueDate, 'HH:mm'),
      duration: '60',
      notes: notes.trim(),
    });
  };

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
      
      // If editing a virtual occurrence only, materialize it first
      if (isVirtual && editMode === 'occurrence' && task.id.includes('_virtual_')) {
        // Materialize the virtual task
        const materializeResponse = await api.post(`/api/v1/care-tasks/${task.id}/materialize`, {
          virtualDate: task.virtualDate
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Update task reference to the materialized version
        task.id = materializeResponse.data.task.id;
      }
      
      // Combine date and time properly to avoid timezone issues
      const dateTimeString = `${formData.date}T${formData.time}:00`;
      const appointmentDate = new Date(dateTimeString);

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

      // Prepare update data
      const updateData: any = {
        title: formData.title,
        description: `${getEmoji()} ${formData.provider ? `with ${formData.provider}` : ''}\n${formData.location ? `📍 ${formData.location}` : ''}\n${formData.description}`,
        dueDate: toLocalISOString(appointmentDate),
        priority: getPriority(),
      };

      // Handle assignedToId - send null to clear assignment
      if (formData.assignedToId) {
        updateData.assignedToId = formData.assignedToId;
      } else {
        updateData.assignedToId = null;
      }

      // Determine which task to update based on edit mode
      let taskIdToUpdate = task.id;
      
      if (editMode === 'series') {
        // If editing series, update the parent template
        if (task.parentTaskId) {
          taskIdToUpdate = task.parentTaskId;
        } else if (isVirtual && task.id.includes('_virtual_')) {
          // For virtual tasks, extract the parent ID
          taskIdToUpdate = task.id.split('_virtual_')[0];
        }
        // If none of the above, it might be the template itself, so use task.id
      }

      // Update the task or series
      if (editMode === 'series' && (task.parentTaskId || task.isRecurrenceTemplate || isVirtual)) {
        // Use the series endpoint for updating all occurrences
        const response = await api.put(`/api/v1/care-tasks/${taskIdToUpdate}/series`, updateData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.data.message) {
          console.log(response.data.message);
        }
      } else {
        // Regular update for single occurrence
        await api.put(`/api/v1/care-tasks/${taskIdToUpdate}`, updateData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      onAppointmentUpdated();
      onClose();
    } catch (error) {
      console.error('Failed to update appointment:', error);
      alert('Failed to update appointment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isVirtual = task?.isVirtual;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={onClose} />
        
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          <div className="flex items-center justify-between p-6 border-b">
            <h3 className="text-lg font-semibold text-gray-900">
              {isVirtual ? 'Edit Recurring Appointment' : 'Edit Appointment'}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {(isVirtual || task?.parentTaskId) && (
            <div className="px-6 pt-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-3 mb-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium">This is a recurring appointment</p>
                    <p className="mt-1">Choose whether to edit just this occurrence or the entire series.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="editMode"
                      value="occurrence"
                      checked={editMode === 'occurrence'}
                      onChange={(e) => setEditMode(e.target.value as 'occurrence' | 'series')}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-sm font-medium text-amber-800">This occurrence only</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="editMode"
                      value="series"
                      checked={editMode === 'series'}
                      onChange={(e) => setEditMode(e.target.value as 'occurrence' | 'series')}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-sm font-medium text-amber-800">All occurrences</span>
                  </label>
                </div>
              </div>
            </div>
          )}

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
                {loading ? 'Updating...' : 'Update Appointment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
