import { useState, useMemo } from 'react';
import { X, Loader2, Plus, Minus, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { recommendationsApi } from '@/lib/api';
import { parseMedicationFromRecommendation } from '@/lib/parseMedicationFromRecommendation';

interface RecommendationAcceptModalProps {
  recommendation: {
    id: string;
    type: string;
    title: string;
    description: string;
    frequency?: string;
    duration?: string;
    priority: string;
  };
  onClose: () => void;
  onAccept: () => void;
}

export function RecommendationAcceptModal({
  recommendation,
  onClose,
  onAccept,
}: RecommendationAcceptModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Parse medication details from recommendation text
  const parsedMedicationData = useMemo(() => {
    if (recommendation.type === 'MEDICATION') {
      return parseMedicationFromRecommendation(recommendation);
    }
    return null;
  }, [recommendation]);

  // Medication fields - pre-populated with parsed data
  const [medicationData, setMedicationData] = useState({
    dosage: parsedMedicationData?.dosage || '',
    frequency: parsedMedicationData?.frequency || recommendation.frequency || 'twice daily',
    scheduleTimes: parsedMedicationData?.scheduleTimes || ['08:00', '20:00'],
    instructions: parsedMedicationData?.instructions || '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    currentSupply: '',
    refillThreshold: '7',
  });

  // Checklist fields
  const [checklistData, setChecklistData] = useState({
    category: getCategoryFromType(recommendation.type),
    scheduledTime: '09:00',
  });

  // Care task fields
  const [careTaskData, setCareTaskData] = useState({
    dueDate: '',
    reminderDate: '',
    priority: recommendation.priority === 'URGENT' || recommendation.priority === 'HIGH' ? 'HIGH' : 'MEDIUM',
  });

  // Nutrition recommendation fields (for DIET type)
  const [nutritionData, setNutritionData] = useState({
    dailyCalories: '',
    proteinGrams: '',
    restrictions: [] as string[],
    goals: [] as string[],
    specialInstructions: '',
  });

  const commonRestrictions = ['Low Sodium', 'Low Sugar', 'Diabetic-Friendly', 'Heart-Healthy', 'Soft Foods', 'Pureed', 'Gluten-Free', 'Dairy-Free'];
  const commonGoals = ['Weight Management', 'Heart Health', 'Blood Sugar Control', 'Hydration', 'Protein Intake', 'Digestive Health'];

  const toggleRestriction = (restriction: string) => {
    setNutritionData(prev => ({
      ...prev,
      restrictions: prev.restrictions.includes(restriction)
        ? prev.restrictions.filter(r => r !== restriction)
        : [...prev.restrictions, restriction],
    }));
  };

  const toggleGoal = (goal: string) => {
    setNutritionData(prev => ({
      ...prev,
      goals: prev.goals.includes(goal)
        ? prev.goals.filter(g => g !== goal)
        : [...prev.goals, goal],
    }));
  };

  function getCategoryFromType(type: string): string {
    const mapping: Record<string, string> = {
      MEDICATION: 'MEDICATION',
      EXERCISE: 'EXERCISE',
      DIET: 'MEALS',
      THERAPY: 'THERAPY',
      LIFESTYLE: 'OTHER',
    };
    return mapping[type] || 'OTHER';
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      let acceptanceData: any = {};

      if (recommendation.type === 'MEDICATION') {
        acceptanceData = {
          medicationData: {
            dosage: medicationData.dosage,
            frequency: medicationData.frequency,
            scheduleTimes: medicationData.scheduleTimes,
            instructions: medicationData.instructions,
            startDate: new Date(medicationData.startDate).toISOString(),
            endDate: medicationData.endDate ? new Date(medicationData.endDate).toISOString() : undefined,
            currentSupply: medicationData.currentSupply ? parseInt(medicationData.currentSupply) : undefined,
            refillThreshold: parseInt(medicationData.refillThreshold),
          },
        };
      } else if (recommendation.type === 'DIET') {
        acceptanceData = {
          nutritionRecommendationData: {
            dailyCalories: nutritionData.dailyCalories ? parseInt(nutritionData.dailyCalories) : undefined,
            proteinGrams: nutritionData.proteinGrams ? parseFloat(nutritionData.proteinGrams) : undefined,
            restrictions: nutritionData.restrictions,
            goals: nutritionData.goals,
            specialInstructions: nutritionData.specialInstructions || undefined,
          },
        };
      } else if (['EXERCISE', 'LIFESTYLE', 'THERAPY'].includes(recommendation.type)) {
        acceptanceData = {
          checklistData: {
            category: checklistData.category,
            scheduledTime: checklistData.scheduledTime,
          },
        };
      } else if (['FOLLOWUP', 'TESTS', 'MONITORING'].includes(recommendation.type)) {
        acceptanceData = {
          careTaskData: {
            dueDate: careTaskData.dueDate ? new Date(careTaskData.dueDate).toISOString() : undefined,
            reminderDate: careTaskData.reminderDate ? new Date(careTaskData.reminderDate).toISOString() : undefined,
            priority: careTaskData.priority,
          },
        };
      }

      await recommendationsApi.accept(recommendation.id, acceptanceData);
      toast.success('Recommendation accepted and added to your plan');
      onAccept();
    } catch (err: any) {
      console.error('Failed to accept recommendation:', err);
      setError(err.response?.data?.error?.message || 'Failed to accept recommendation');
      toast.error('Failed to accept recommendation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addScheduleTime = () => {
    setMedicationData(prev => ({
      ...prev,
      scheduleTimes: [...prev.scheduleTimes, '12:00'],
    }));
  };

  const removeScheduleTime = (index: number) => {
    setMedicationData(prev => ({
      ...prev,
      scheduleTimes: prev.scheduleTimes.filter((_, i) => i !== index),
    }));
  };

  const updateScheduleTime = (index: number, value: string) => {
    setMedicationData(prev => ({
      ...prev,
      scheduleTimes: prev.scheduleTimes.map((time, i) => (i === index ? value : time)),
    }));
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4 pb-20 pt-4 text-center sm:block sm:p-0">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="inline-block w-full max-w-2xl transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:align-middle">
          {/* Header */}
          <div className="border-b border-gray-200 bg-white px-6 py-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Accept Recommendation</h3>
              <button
                onClick={onClose}
                className="rounded-md text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit}>
            <div className="max-h-[calc(100vh-200px)] overflow-y-auto px-6 py-4">
              {/* Recommendation Summary */}
              <div className="mb-6 rounded-lg bg-gray-50 p-4">
                <h4 className="font-medium text-gray-900">{recommendation.title}</h4>
                <p className="mt-1 text-sm text-gray-600">{recommendation.description}</p>
              </div>

              {error && (
                <div className="mb-4 rounded-md bg-red-50 p-4">
                  <div className="flex">
                    <AlertTriangle className="h-5 w-5 text-red-400" />
                    <div className="ml-3">
                      <p className="text-sm text-red-800">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Medication Form */}
              {recommendation.type === 'MEDICATION' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Dosage <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={medicationData.dosage}
                      onChange={(e) => setMedicationData({ ...medicationData, dosage: e.target.value })}
                      placeholder="e.g., 10mg, 2 tablets"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Frequency <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={medicationData.frequency}
                      onChange={(e) => setMedicationData({ ...medicationData, frequency: e.target.value })}
                      placeholder="e.g., twice daily"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Schedule Times <span className="text-red-500">*</span>
                    </label>
                    <div className="mt-2 space-y-2">
                      {medicationData.scheduleTimes.map((time, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="time"
                            required
                            value={time}
                            onChange={(e) => updateScheduleTime(idx, e.target.value)}
                            className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                          />
                          {medicationData.scheduleTimes.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeScheduleTime(idx)}
                              className="rounded-md p-2 text-red-600 hover:bg-red-50"
                            >
                              <Minus className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={addScheduleTime}
                      className="mt-2 inline-flex items-center text-sm text-indigo-600 hover:text-indigo-700"
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Add time
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Instructions</label>
                    <textarea
                      value={medicationData.instructions}
                      onChange={(e) => setMedicationData({ ...medicationData, instructions: e.target.value })}
                      rows={3}
                      placeholder="e.g., Take with food"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Start Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={medicationData.startDate}
                        onChange={(e) => setMedicationData({ ...medicationData, startDate: e.target.value })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">End Date</label>
                      <input
                        type="date"
                        value={medicationData.endDate}
                        onChange={(e) => setMedicationData({ ...medicationData, endDate: e.target.value })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Current Supply</label>
                      <input
                        type="number"
                        min="0"
                        value={medicationData.currentSupply}
                        onChange={(e) => setMedicationData({ ...medicationData, currentSupply: e.target.value })}
                        placeholder="Number of pills"
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Refill Threshold (days)</label>
                      <input
                        type="number"
                        min="1"
                        value={medicationData.refillThreshold}
                        onChange={(e) => setMedicationData({ ...medicationData, refillThreshold: e.target.value })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Nutrition Recommendation Form (DIET type) */}
              {recommendation.type === 'DIET' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 mb-4">
                    Set nutrition goals and guidelines to track meal compliance.
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Daily Calories (Optional)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={nutritionData.dailyCalories}
                        onChange={(e) => setNutritionData({ ...nutritionData, dailyCalories: e.target.value })}
                        placeholder="e.g., 2000"
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Daily Protein (g, Optional)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={nutritionData.proteinGrams}
                        onChange={(e) => setNutritionData({ ...nutritionData, proteinGrams: e.target.value })}
                        placeholder="e.g., 60"
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Dietary Restrictions
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {commonRestrictions.map((restriction) => (
                        <button
                          key={restriction}
                          type="button"
                          onClick={() => toggleRestriction(restriction)}
                          className={cn(
                            'px-3 py-2 rounded-md text-sm font-medium transition-colors border',
                            nutritionData.restrictions.includes(restriction)
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          )}
                        >
                          {restriction}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nutrition Goals
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {commonGoals.map((goal) => (
                        <button
                          key={goal}
                          type="button"
                          onClick={() => toggleGoal(goal)}
                          className={cn(
                            'px-3 py-2 rounded-md text-sm font-medium transition-colors border',
                            nutritionData.goals.includes(goal)
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          )}
                        >
                          {goal}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Special Instructions
                    </label>
                    <textarea
                      value={nutritionData.specialInstructions}
                      onChange={(e) => setNutritionData({ ...nutritionData, specialInstructions: e.target.value })}
                      rows={3}
                      placeholder="e.g., Avoid grapefruit, Take with meals, Texture modifications needed..."
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}

              {/* Checklist Form */}
              {['EXERCISE', 'LIFESTYLE', 'THERAPY'].includes(recommendation.type) && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Category</label>
                    <select
                      value={checklistData.category}
                      onChange={(e) => setChecklistData({ ...checklistData, category: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                    >
                      <option value="MEDICATION">Medication</option>
                      <option value="EXERCISE">Exercise</option>
                      <option value="MEALS">Meals</option>
                      <option value="HYGIENE">Hygiene</option>
                      <option value="SOCIAL">Social</option>
                      <option value="THERAPY">Therapy</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Scheduled Time</label>
                    <input
                      type="time"
                      value={checklistData.scheduledTime}
                      onChange={(e) => setChecklistData({ ...checklistData, scheduledTime: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}

              {/* Care Task Form */}
              {['FOLLOWUP', 'TESTS', 'MONITORING'].includes(recommendation.type) && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Due Date</label>
                    <input
                      type="date"
                      value={careTaskData.dueDate}
                      onChange={(e) => setCareTaskData({ ...careTaskData, dueDate: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Reminder Date</label>
                    <input
                      type="date"
                      value={careTaskData.reminderDate}
                      onChange={(e) => setCareTaskData({ ...careTaskData, reminderDate: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Priority</label>
                    <select
                      value={careTaskData.priority}
                      onChange={(e) => setCareTaskData({ ...careTaskData, priority: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                    >
                      <option value="HIGH">High</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="LOW">Low</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Accepting...
                    </>
                  ) : (
                    'Accept & Add to Plan'
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
