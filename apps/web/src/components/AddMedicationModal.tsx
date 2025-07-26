import { useState } from 'react';
import { 
  X, 
  Plus, 
  Minus,
  Loader2,
  Clock,
  Calendar,
  Pill
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AddMedicationModalProps {
  patientId: string;
  onClose: () => void;
  onAdd: (medicationData: any) => Promise<void>;
}

const commonFrequencies = [
  { label: 'Once daily', value: 'once daily', times: 1 },
  { label: 'Twice daily', value: 'twice daily', times: 2 },
  { label: 'Three times daily', value: 'three times daily', times: 3 },
  { label: 'Four times daily', value: 'four times daily', times: 4 },
  { label: 'Every 8 hours', value: 'every 8 hours', times: 3 },
  { label: 'Every 12 hours', value: 'every 12 hours', times: 2 },
  { label: 'As needed', value: 'as needed', times: 0 },
];

const dosageUnits = ['pills', 'tablets', 'capsules', 'ml', 'mg', 'drops'];

export function AddMedicationModal({ patientId, onClose, onAdd }: AddMedicationModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    dosage: '',
    dosageAmount: '',
    dosageUnit: 'pills',
    frequency: 'twice daily',
    scheduleTimes: ['08:00', '20:00'],
    instructions: '',
    prescribedBy: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    currentSupply: '',
    trackSupply: false,
    refillThreshold: '7',
  });

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleFrequencyChange = (frequency: string) => {
    const selected = commonFrequencies.find(f => f.value === frequency);
    if (selected) {
      updateFormData('frequency', frequency);
      
      // Set default times based on frequency
      let times: string[] = [];
      switch (selected.times) {
        case 1:
          times = ['08:00'];
          break;
        case 2:
          times = ['08:00', '20:00'];
          break;
        case 3:
          times = ['08:00', '14:00', '20:00'];
          break;
        case 4:
          times = ['08:00', '12:00', '16:00', '20:00'];
          break;
        default:
          times = [];
      }
      updateFormData('scheduleTimes', times);
    }
  };

  const addScheduleTime = () => {
    updateFormData('scheduleTimes', [...formData.scheduleTimes, '12:00']);
  };

  const removeScheduleTime = (index: number) => {
    const newTimes = formData.scheduleTimes.filter((_, i) => i !== index);
    updateFormData('scheduleTimes', newTimes);
  };

  const updateScheduleTime = (index: number, value: string) => {
    const newTimes = [...formData.scheduleTimes];
    newTimes[index] = value;
    updateFormData('scheduleTimes', newTimes);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const data = {
        name: formData.name,
        dosage: formData.dosage,
        dosageAmount: formData.trackSupply && formData.dosageAmount ? Number(formData.dosageAmount) : undefined,
        dosageUnit: formData.trackSupply ? formData.dosageUnit : undefined,
        frequency: formData.frequency,
        scheduleTimes: formData.scheduleTimes.filter(t => t !== ''),
        instructions: formData.instructions || undefined,
        prescribedBy: formData.prescribedBy || undefined,
        startDate: new Date(formData.startDate).toISOString(),
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : undefined,
        currentSupply: formData.trackSupply && formData.currentSupply ? Number(formData.currentSupply) : undefined,
        refillThreshold: formData.trackSupply ? Number(formData.refillThreshold) : undefined,
      };

      await onAdd(data);
    } catch (err: any) {
      setError(err.message || 'Failed to add medication');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
                <Pill className="h-5 w-5 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Add Medication</h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Basic Information */}
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900">Basic Information</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Medication Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateFormData('name', e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="e.g., Metformin"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dosage <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.dosage}
                  onChange={(e) => updateFormData('dosage', e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="e.g., 500mg, 2 pills"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prescribed by
              </label>
              <input
                type="text"
                value={formData.prescribedBy}
                onChange={(e) => updateFormData('prescribedBy', e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="e.g., Dr. Smith"
              />
            </div>
          </div>

          {/* Schedule */}
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900">Schedule</h4>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Frequency <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.frequency}
                onChange={(e) => handleFrequencyChange(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {commonFrequencies.map((freq) => (
                  <option key={freq.value} value={freq.value}>
                    {freq.label}
                  </option>
                ))}
              </select>
            </div>

            {formData.frequency !== 'as needed' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Times <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {formData.scheduleTimes.map((time, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="time"
                        value={time}
                        onChange={(e) => updateScheduleTime(index, e.target.value)}
                        className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        required
                      />
                      {formData.scheduleTimes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeScheduleTime(index)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addScheduleTime}
                    className="flex items-center gap-2 text-primary-600 hover:text-primary-700 text-sm font-medium"
                  >
                    <Plus className="h-4 w-4" />
                    Add time
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => updateFormData('startDate', e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => updateFormData('endDate', e.target.value)}
                  min={formData.startDate}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Instructions
            </label>
            <textarea
              value={formData.instructions}
              onChange={(e) => updateFormData('instructions', e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              rows={3}
              placeholder="e.g., Take with food, avoid alcohol"
            />
          </div>

          {/* Supply Tracking */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="trackSupply"
                checked={formData.trackSupply}
                onChange={(e) => updateFormData('trackSupply', e.target.checked)}
                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <label htmlFor="trackSupply" className="font-semibold text-gray-900">
                Track pill supply and refills
              </label>
            </div>

            {formData.trackSupply && (
              <div className="grid grid-cols-3 gap-4 pl-7">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dosage Amount
                  </label>
                  <input
                    type="number"
                    value={formData.dosageAmount}
                    onChange={(e) => updateFormData('dosageAmount', e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="e.g., 2"
                    min="0.1"
                    step="0.1"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Unit
                  </label>
                  <select
                    value={formData.dosageUnit}
                    onChange={(e) => updateFormData('dosageUnit', e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    {dosageUnits.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Supply
                  </label>
                  <input
                    type="number"
                    value={formData.currentSupply}
                    onChange={(e) => updateFormData('currentSupply', e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="e.g., 60"
                    min="0"
                  />
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Medication'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}