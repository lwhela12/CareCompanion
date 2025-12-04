import { useState } from 'react';
import {
  X,
  Edit2,
  Save,
  XCircle,
  Utensils,
  Clock,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { nutritionApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface MealDetailModalProps {
  meal: any; // MealLog with nutritionData
  nutritionGoals?: any; // NutritionRecommendation
  hasDietaryInfo?: boolean; // Whether patient has dietary restrictions set
  onClose: () => void;
  onUpdate: () => void;
}

const MEAL_TYPE_LABELS: Record<string, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
  SNACK: 'Snack',
  OTHER: 'Other',
};

export function MealDetailModal({
  meal,
  nutritionGoals,
  hasDietaryInfo = false,
  onClose,
  onUpdate,
}: MealDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Initialize form data from meal's nutrition data
  const [formData, setFormData] = useState({
    estimatedCalories: meal.nutritionData?.estimatedCalories || 0,
    proteinGrams: meal.nutritionData?.proteinGrams || 0,
    carbsGrams: meal.nutritionData?.carbsGrams || 0,
    fatGrams: meal.nutritionData?.fatGrams || 0,
    sodiumMg: meal.nutritionData?.sodiumMg || 0,
    fiberGrams: meal.nutritionData?.fiberGrams || 0,
    sugarGrams: meal.nutritionData?.sugarGrams || 0,
    portionSize: meal.nutritionData?.portionSize || '',
    foodItems: meal.nutritionData?.foodItems || [],
    meetsGuidelines: meal.meetsGuidelines ?? null,
    concerns: meal.concerns || [],
  });

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');

    try {
      // Validate nutrition values
      if (formData.estimatedCalories < 0 || formData.estimatedCalories > 10000) {
        throw new Error('Calories must be between 0 and 10,000');
      }
      if (formData.proteinGrams < 0 || formData.proteinGrams > 500) {
        throw new Error('Protein must be between 0 and 500g');
      }

      // Call API to update meal
      await nutritionApi.updateMealLog(meal.id, {
        nutritionData: {
          estimatedCalories: formData.estimatedCalories,
          proteinGrams: formData.proteinGrams,
          carbsGrams: formData.carbsGrams,
          fatGrams: formData.fatGrams,
          sodiumMg: formData.sodiumMg,
          fiberGrams: formData.fiberGrams,
          sugarGrams: formData.sugarGrams,
          portionSize: formData.portionSize,
          foodItems: formData.foodItems,
        },
        meetsGuidelines: formData.meetsGuidelines,
        concerns: formData.concerns,
      });

      toast.success('Nutrition data updated successfully');
      setIsEditing(false);
      onUpdate(); // Refresh parent data
    } catch (err: any) {
      console.error('Save error:', err);
      setError(err.message || 'Failed to save changes');
      toast.error(err.message || 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form data to original values
    setFormData({
      estimatedCalories: meal.nutritionData?.estimatedCalories || 0,
      proteinGrams: meal.nutritionData?.proteinGrams || 0,
      carbsGrams: meal.nutritionData?.carbsGrams || 0,
      fatGrams: meal.nutritionData?.fatGrams || 0,
      sodiumMg: meal.nutritionData?.sodiumMg || 0,
      fiberGrams: meal.nutritionData?.fiberGrams || 0,
      sugarGrams: meal.nutritionData?.sugarGrams || 0,
      portionSize: meal.nutritionData?.portionSize || '',
      foodItems: meal.nutritionData?.foodItems || [],
      meetsGuidelines: meal.meetsGuidelines ?? null,
      concerns: meal.concerns || [],
    });
    setIsEditing(false);
    setError('');
  };

  // Calculate macro percentages for distribution
  const totalMacros = formData.proteinGrams + formData.carbsGrams + formData.fatGrams;
  const proteinPercent = totalMacros > 0 ? (formData.proteinGrams / totalMacros) * 100 : 0;
  const carbsPercent = totalMacros > 0 ? (formData.carbsGrams / totalMacros) * 100 : 0;
  const fatPercent = totalMacros > 0 ? (formData.fatGrams / totalMacros) * 100 : 0;

  // Determine concern level for traffic light colors
  const getConcernLevel = () => {
    if (formData.concerns.length === 0) return 'none';
    const hasSafetyConcern = formData.concerns.some((c: string) =>
      c.toLowerCase().includes('choking') ||
      c.toLowerCase().includes('allergen') ||
      c.toLowerCase().includes('texture')
    );
    return hasSafetyConcern ? 'high' : 'medium';
  };

  const concernLevel = getConcernLevel();
  const concernColors = {
    none: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800',
    high: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  };

  // Format date/time
  const consumedDate = new Date(meal.consumedAt);
  const formattedDate = consumedDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const formattedTime = consumedDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 p-6 flex items-center justify-between z-10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <Utensils className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {MEAL_TYPE_LABELS[meal.mealType] || meal.mealType}
              </h2>
              <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                <Clock className="w-4 h-4" />
                <span>
                  {formattedDate} at {formattedTime}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 transition-colors flex items-center space-x-2"
              >
                <Edit2 className="w-4 h-4" />
                <span>Edit</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Photos Gallery */}
          {meal.photoUrls && meal.photoUrls.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Photos</h3>
              <div className="grid grid-cols-3 gap-3">
                {meal.photoUrls.map((url: string, index: number) => (
                  <img
                    key={index}
                    src={url}
                    alt={`Meal photo ${index + 1}`}
                    className="w-full h-40 object-cover rounded-lg border border-gray-200 dark:border-slate-600"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Food Items */}
          {formData.foodItems.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Food Items</h3>
              <div className="flex flex-wrap gap-2">
                {formData.foodItems.map((item: string, index: number) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-full text-sm"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Nutrition Overview */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Nutrition Details</h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Calories */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Calories</div>
                {isEditing ? (
                  <input
                    type="number"
                    value={formData.estimatedCalories}
                    onChange={(e) =>
                      updateField('estimatedCalories', parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                  />
                ) : (
                  <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {formData.estimatedCalories || '—'}
                    {formData.estimatedCalories > 0 && (
                      <span className="text-sm font-normal text-gray-600 dark:text-gray-400"> kcal</span>
                    )}
                  </div>
                )}
                {nutritionGoals?.dailyCalories && formData.estimatedCalories > 0 && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                      <span>Daily Goal</span>
                      <span>
                        {Math.round((formData.estimatedCalories / nutritionGoals.dailyCalories) * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-slate-600 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{
                          width: `${Math.min((formData.estimatedCalories / nutritionGoals.dailyCalories) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Protein */}
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Protein</div>
                {isEditing ? (
                  <input
                    type="number"
                    value={formData.proteinGrams}
                    onChange={(e) =>
                      updateField('proteinGrams', parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                  />
                ) : (
                  <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {formData.proteinGrams || '—'}
                    {formData.proteinGrams > 0 && (
                      <span className="text-sm font-normal text-gray-600 dark:text-gray-400"> g</span>
                    )}
                  </div>
                )}
                {nutritionGoals?.proteinGrams && formData.proteinGrams > 0 && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                      <span>Daily Goal</span>
                      <span>
                        {Math.round((formData.proteinGrams / nutritionGoals.proteinGrams) * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-slate-600 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{
                          width: `${Math.min((formData.proteinGrams / nutritionGoals.proteinGrams) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Carbs */}
              <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Carbohydrates</div>
                {isEditing ? (
                  <input
                    type="number"
                    value={formData.carbsGrams}
                    onChange={(e) =>
                      updateField('carbsGrams', parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                  />
                ) : (
                  <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {formData.carbsGrams || '—'}
                    {formData.carbsGrams > 0 && (
                      <span className="text-sm font-normal text-gray-600 dark:text-gray-400"> g</span>
                    )}
                  </div>
                )}
              </div>

              {/* Fat */}
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Fat</div>
                {isEditing ? (
                  <input
                    type="number"
                    value={formData.fatGrams}
                    onChange={(e) => updateField('fatGrams', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                  />
                ) : (
                  <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {formData.fatGrams || '—'}
                    {formData.fatGrams > 0 && (
                      <span className="text-sm font-normal text-gray-600 dark:text-gray-400"> g</span>
                    )}
                  </div>
                )}
              </div>

              {/* Fiber */}
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Fiber</div>
                {isEditing ? (
                  <input
                    type="number"
                    value={formData.fiberGrams}
                    onChange={(e) =>
                      updateField('fiberGrams', parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                  />
                ) : (
                  <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {formData.fiberGrams || '—'}
                    {formData.fiberGrams > 0 && (
                      <span className="text-sm font-normal text-gray-600 dark:text-gray-400"> g</span>
                    )}
                  </div>
                )}
              </div>

              {/* Sugar */}
              <div className="p-4 bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Sugar</div>
                {isEditing ? (
                  <input
                    type="number"
                    value={formData.sugarGrams}
                    onChange={(e) =>
                      updateField('sugarGrams', parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                  />
                ) : (
                  <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {formData.sugarGrams || '—'}
                    {formData.sugarGrams > 0 && (
                      <span className="text-sm font-normal text-gray-600 dark:text-gray-400"> g</span>
                    )}
                  </div>
                )}
              </div>

              {/* Sodium */}
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Sodium</div>
                {isEditing ? (
                  <input
                    type="number"
                    value={formData.sodiumMg}
                    onChange={(e) => updateField('sodiumMg', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                  />
                ) : (
                  <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {formData.sodiumMg || '—'}
                    {formData.sodiumMg > 0 && (
                      <span className="text-sm font-normal text-gray-600 dark:text-gray-400"> mg</span>
                    )}
                  </div>
                )}
              </div>

              {/* Portion Size */}
              <div className="p-4 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Portion Size</div>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.portionSize}
                    onChange={(e) => updateField('portionSize', e.target.value)}
                    placeholder="e.g., 1 cup, medium plate"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-600 text-gray-900 dark:text-gray-100"
                  />
                ) : (
                  <div className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {formData.portionSize || '—'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Macro Distribution */}
          {totalMacros > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Macro Distribution</h3>
              <div className="space-y-3">
                {/* Protein Bar */}
                <div>
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <span>Protein</span>
                    <span>{Math.round(proteinPercent)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-slate-600 rounded-full h-3">
                    <div
                      className="bg-green-600 h-3 rounded-full"
                      style={{ width: `${proteinPercent}%` }}
                    />
                  </div>
                </div>

                {/* Carbs Bar */}
                <div>
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <span>Carbohydrates</span>
                    <span>{Math.round(carbsPercent)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-slate-600 rounded-full h-3">
                    <div
                      className="bg-orange-600 h-3 rounded-full"
                      style={{ width: `${carbsPercent}%` }}
                    />
                  </div>
                </div>

                {/* Fat Bar */}
                <div>
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <span>Fat</span>
                    <span>{Math.round(fatPercent)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-slate-600 rounded-full h-3">
                    <div
                      className="bg-yellow-600 h-3 rounded-full"
                      style={{ width: `${fatPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Guideline Adherence */}
          <div
            className={cn(
              'p-4 border rounded-lg',
              formData.meetsGuidelines
                ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                : formData.meetsGuidelines === false
                  ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
                  : 'bg-gray-50 border-gray-200 dark:bg-slate-700 dark:border-slate-600'
            )}
          >
            <div className="flex items-center space-x-2">
              {formData.meetsGuidelines ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : formData.meetsGuidelines === false ? (
                <Info className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              ) : (
                <Info className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              )}
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {formData.meetsGuidelines
                  ? 'Meets Nutrition Guidelines'
                  : formData.meetsGuidelines === false
                    ? 'Does Not Meet Guidelines'
                    : 'Guidelines Not Evaluated'}
              </span>
            </div>
          </div>

          {/* Concerns - Only show if patient has dietary restrictions set */}
          {hasDietaryInfo && formData.concerns.length > 0 && (
            <div className={cn('p-4 border rounded-lg', concernColors[concernLevel])}>
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium mb-2">
                    {concernLevel === 'high' ? 'Safety Concerns' : 'Nutrition Concerns'}
                  </h3>
                  <ul className="space-y-1">
                    {formData.concerns.map((concern: string, index: number) => (
                      <li key={index} className="text-sm">
                        • {concern}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* AI Metadata */}
          {meal.nutritionData?.confidence && (
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <h3 className="font-medium text-gray-900 dark:text-gray-100">AI Analysis</h3>
              </div>
              <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <div className="flex items-center justify-between">
                  <span>Confidence Level:</span>
                  <span
                    className={cn(
                      'px-2 py-1 rounded-full text-xs font-medium',
                      meal.nutritionData.confidence === 'high'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : meal.nutritionData.confidence === 'medium'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                    )}
                  >
                    {meal.nutritionData.confidence.toUpperCase()}
                  </span>
                </div>
                {meal.nutritionData.reasoning && (
                  <div>
                    <span className="font-medium">Reasoning:</span>
                    <p className="mt-1 text-gray-600 dark:text-gray-400">{meal.nutritionData.reasoning}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI Recommendations */}
          {meal.nutritionData?.recommendations &&
            meal.nutritionData.recommendations.length > 0 && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">Recommendations</h3>
                </div>
                <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                  {meal.nutritionData.recommendations.map((rec: string, index: number) => (
                    <li key={index}>• {rec}</li>
                  ))}
                </ul>
              </div>
            )}

          {/* Notes */}
          {meal.notes && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Notes</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600">
                {meal.notes}
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-start space-x-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Edit Mode Actions */}
          {isEditing && (
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-slate-700">
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors flex items-center space-x-2"
              >
                <XCircle className="w-4 h-4" />
                <span>Cancel</span>
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className={cn(
                  'px-4 py-2 rounded-lg text-white font-medium transition-colors flex items-center space-x-2',
                  isSaving ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600'
                )}
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
