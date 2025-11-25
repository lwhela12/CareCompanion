import { useState, useEffect } from 'react';
import { X, Calendar, ClipboardList, User, FileText, UserCheck, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@clerk/clerk-react';
import { api } from '../lib/api';
import { dateInputToLocalISOString } from '@/lib/utils';

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskAdded: () => void;
  defaultDate?: Date;
}

export function AddTaskModal({ isOpen, onClose, onTaskAdded, defaultDate }: AddTaskModalProps) {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [patient, setPatient] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    reminderDate: defaultDate ? format(defaultDate, 'yyyy-MM-dd') : '',
    dueDate: '',
    assignedToId: '',
    priority: 'medium',
    notes: '',
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
      
      // Build request body
      const requestBody: any = {
        title: formData.title,
        description: formData.description || formData.notes,
        priority: formData.priority,
        taskType: 'task', // Explicitly mark as task (not appointment)
        assignedToId: formData.assignedToId || undefined,
      };

      // Add reminder date if provided
      if (formData.reminderDate) {
        requestBody.reminderDate = dateInputToLocalISOString(formData.reminderDate);
      }

      // Add due date if provided
      if (formData.dueDate) {
        requestBody.dueDate = dateInputToLocalISOString(formData.dueDate);
      }

      // Create task
      const response = await api.post('/api/v1/care-tasks', requestBody, {
        headers: { Authorization: `Bearer ${token}` }
      });

      onTaskAdded();
      onClose();
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        reminderDate: defaultDate ? format(defaultDate, 'yyyy-MM-dd') : '',
        dueDate: '',
        assignedToId: '',
        priority: 'medium',
        notes: '',
      });
    } catch (error: any) {
      console.error('Failed to create task:', error);
      if (error.response?.data?.message) {
        alert(error.response.data.message);
      } else {
        alert('Failed to create task. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-opacity-70 dark:bg-black" onClick={onClose} />

        <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full">
          <div className="flex items-center justify-between p-6 border-b dark:border-slate-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Add Task</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-300"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6">
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <ClipboardList className="inline h-4 w-4 mr-1" />
                  Task Title
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="e.g., Change bed sheets, Call insurance company"
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
              </div>

              {/* Assigned To */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <UserCheck className="inline h-4 w-4 mr-1" />
                  Assigned To
                </label>
                <select
                  value={formData.assignedToId}
                  onChange={(e) => setFormData({ ...formData, assignedToId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
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

              {/* Reminder Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Clock className="inline h-4 w-4 mr-1" />
                  Reminder Date (Optional)
                </label>
                <input
                  type="date"
                  value={formData.reminderDate}
                  onChange={(e) => setFormData({ ...formData, reminderDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Task will start appearing in daily lists from this date</p>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Calendar className="inline h-4 w-4 mr-1" />
                  Due Date (Optional)
                </label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  min={formData.reminderDate}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Task deadline - leave empty for open-ended tasks</p>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <FileText className="inline h-4 w-4 mr-1" />
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="Any additional details or instructions..."
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.title}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
