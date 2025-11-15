import { useState, useEffect } from 'react';
import {
  Utensils,
  Plus,
  TrendingUp,
  AlertCircle,
  Calendar,
  Clock,
  ChevronRight,
  Loader2,
  Camera,
  Mic,
  CheckCircle2,
  XCircle,
  Info
} from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { api, nutritionApi } from '@/lib/api';
import { LogMealModal } from '@/components/LogMealModal';
import { MealDetailModal } from '@/components/MealDetailModal';

interface MealLog {
  id: string;
  mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK' | 'OTHER';
  consumedAt: string;
  notes?: string;
  photoUrls: string[];
  voiceNoteUrl?: string;
  nutritionData?: {
    estimatedCalories?: number;
    proteinGrams?: number;
    carbsGrams?: number;
    fatGrams?: number;
    sodiumMg?: number;
    portionSize?: string;
    foodItems: string[];
  };
  meetsGuidelines?: boolean;
  concerns: string[];
  template?: {
    id: string;
    name: string;
  };
  loggedBy: {
    firstName: string;
    lastName: string;
  };
  createdAt: string;
}

interface MealTemplate {
  id: string;
  name: string;
  mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK' | 'OTHER';
  nutritionData: {
    estimatedCalories?: number;
    proteinGrams?: number;
    foodItems: string[];
  };
  photoUrl?: string;
}

interface WeeklySummary {
  totalMeals: number;
  mealsByType: Record<string, number>;
  averageCalories: number | null;
  averageProtein: number | null;
  totalConcerns: number;
  topConcerns: string[];
  guidelineAdherence: number | null;
  daysWithMeals: number;
}

const MEAL_TYPE_LABELS: Record<string, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
  SNACK: 'Snack',
  OTHER: 'Other',
};

const MEAL_TYPE_COLORS: Record<string, string> = {
  BREAKFAST: 'bg-orange-100 text-orange-700',
  LUNCH: 'bg-blue-100 text-blue-700',
  DINNER: 'bg-purple-100 text-purple-700',
  SNACK: 'bg-green-100 text-green-700',
  OTHER: 'bg-gray-100 text-gray-700',
};

export function Nutrition() {
  const [todaysMeals, setTodaysMeals] = useState<MealLog[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(null);
  const [templates, setTemplates] = useState<MealTemplate[]>([]);
  const [showLogMealModal, setShowLogMealModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<MealLog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [patientId, setPatientId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      // First get the patient ID
      const familiesResponse = await api.get('/api/v1/families');
      if (familiesResponse.data.families.length > 0) {
        const patientIdFromFamily = familiesResponse.data.families[0].patient.id;
        setPatientId(patientIdFromFamily);

        // Fetch today's meals, weekly summary, and templates
        const [mealsResponse, summaryResponse, templatesResponse] = await Promise.all([
          nutritionApi.getTodaysMeals(patientIdFromFamily),
          nutritionApi.getWeeklySummary(patientIdFromFamily),
          nutritionApi.getMealTemplates(patientIdFromFamily),
        ]);

        setTodaysMeals(mealsResponse.data.meals);
        setWeeklySummary(summaryResponse.data.summary);
        setTemplates(templatesResponse.data.templates);
      }
    } catch (err) {
      setError('Failed to load nutrition data');
      console.error(err);
      toast.error('Failed to load nutrition data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogMeal = async (mealData: any) => {
    if (!patientId) return;

    try {
      await nutritionApi.createMealLog(patientId, {
        patientId,
        ...mealData,
      });
      toast.success('Meal logged successfully');
      fetchData();
      setShowLogMealModal(false);
    } catch (err: any) {
      console.error('Error logging meal:', err);
      const errorMessage = err.response?.data?.error?.message || 'Failed to log meal';
      toast.error(errorMessage);
      throw err;
    }
  };

  const handleMealClick = (meal: MealLog) => {
    setSelectedMeal(meal);
    setShowDetailModal(true);
  };

  const handleDetailModalClose = () => {
    setShowDetailModal(false);
    setSelectedMeal(null);
  };

  const handleMealUpdate = () => {
    fetchData(); // Refresh data after update
  };

  const handleDeleteMeal = async (mealLogId: string) => {
    if (!confirm('Are you sure you want to delete this meal log?')) return;

    try {
      await nutritionApi.deleteMealLog(mealLogId);
      toast.success('Meal log deleted');
      fetchData();
    } catch (err: any) {
      console.error('Error deleting meal:', err);
      toast.error('Failed to delete meal log');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Nutrition</h1>
          <p className="text-gray-600 mt-1">Track meals and monitor nutrition</p>
        </div>
        <button
          onClick={() => setShowLogMealModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="w-5 h-5 mr-2" />
          Log Meal
        </button>
      </div>

      {/* Weekly Summary Cards */}
      {weeklySummary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Meals This Week</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{weeklySummary.totalMeals}</p>
                <p className="text-xs text-gray-500 mt-1">{weeklySummary.daysWithMeals}/7 days</p>
              </div>
              <Utensils className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Calories/Meal</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {weeklySummary.averageCalories ? Math.round(weeklySummary.averageCalories) : '—'}
                </p>
                <p className="text-xs text-gray-500 mt-1">Past 7 days</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Guideline Adherence</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {weeklySummary.guidelineAdherence !== null
                    ? `${weeklySummary.guidelineAdherence}%`
                    : '—'}
                </p>
                <p className="text-xs text-gray-500 mt-1">Meals meeting goals</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Concerns</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{weeklySummary.totalConcerns}</p>
                <p className="text-xs text-gray-500 mt-1">Items flagged</p>
              </div>
              <AlertCircle className={cn(
                "w-8 h-8",
                weeklySummary.totalConcerns > 0 ? "text-yellow-600" : "text-gray-400"
              )} />
            </div>
          </div>
        </div>
      )}

      {/* Today's Meals */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                Today's Meals - {format(new Date(), 'MMMM d, yyyy')}
              </h2>
            </div>
            <span className="text-sm text-gray-600">{todaysMeals.length} logged</span>
          </div>
        </div>

        <div className="p-6">
          {todaysMeals.length === 0 ? (
            <div className="text-center py-12">
              <Utensils className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No meals logged today</p>
              <p className="text-sm text-gray-500 mt-1">Click "Log Meal" to track a meal</p>
            </div>
          ) : (
            <div className="space-y-4">
              {todaysMeals.map((meal) => (
                <div
                  key={meal.id}
                  onClick={() => handleMealClick(meal)}
                  className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className={cn(
                          "px-2 py-1 text-xs font-medium rounded-full",
                          MEAL_TYPE_COLORS[meal.mealType]
                        )}>
                          {MEAL_TYPE_LABELS[meal.mealType]}
                        </span>
                        <span className="text-sm text-gray-600 flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {format(new Date(meal.consumedAt), 'h:mm a')}
                        </span>
                        {meal.template && (
                          <span className="text-xs text-gray-500">
                            Template: {meal.template.name}
                          </span>
                        )}
                      </div>

                      {/* Food Items */}
                      {meal.nutritionData?.foodItems && meal.nutritionData.foodItems.length > 0 && (
                        <div className="mb-2">
                          <p className="text-sm text-gray-900 font-medium">
                            {meal.nutritionData.foodItems.slice(0, 5).join(', ')}
                            {meal.nutritionData.foodItems.length > 5 && `, +${meal.nutritionData.foodItems.length - 5} more`}
                          </p>
                        </div>
                      )}

                      {/* Nutrition Info */}
                      {meal.nutritionData && (
                        <div className="flex flex-wrap gap-3 text-xs text-gray-600 mb-2">
                          {meal.nutritionData.estimatedCalories && (
                            <span>~{meal.nutritionData.estimatedCalories} cal</span>
                          )}
                          {meal.nutritionData.proteinGrams && (
                            <span>{meal.nutritionData.proteinGrams}g protein</span>
                          )}
                          {meal.nutritionData.portionSize && (
                            <span>{meal.nutritionData.portionSize}</span>
                          )}
                        </div>
                      )}

                      {/* Photos */}
                      {meal.photoUrls && meal.photoUrls.length > 0 && (
                        <div className="flex gap-2 mb-2">
                          {meal.photoUrls.slice(0, 3).map((url, idx) => (
                            <img
                              key={idx}
                              src={url}
                              alt={`Meal photo ${idx + 1}`}
                              className="w-16 h-16 object-cover rounded border border-gray-200"
                            />
                          ))}
                          {meal.photoUrls.length > 3 && (
                            <div className="w-16 h-16 bg-gray-100 rounded border border-gray-200 flex items-center justify-center text-xs text-gray-600">
                              +{meal.photoUrls.length - 3}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Concerns */}
                      {meal.concerns && meal.concerns.length > 0 && (
                        <div className="flex items-start space-x-2 p-2 bg-yellow-50 border border-yellow-200 rounded mt-2">
                          <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs font-medium text-yellow-900">Concerns:</p>
                            <p className="text-xs text-yellow-800">{meal.concerns.join('; ')}</p>
                          </div>
                        </div>
                      )}

                      {/* Guideline Check */}
                      {meal.meetsGuidelines !== null && (
                        <div className="flex items-center space-x-2 mt-2">
                          {meal.meetsGuidelines ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                              <span className="text-xs text-green-700">Meets nutrition guidelines</span>
                            </>
                          ) : (
                            <>
                              <Info className="w-4 h-4 text-blue-600" />
                              <span className="text-xs text-blue-700">May need adjustment to meet guidelines</span>
                            </>
                          )}
                        </div>
                      )}

                      {/* Notes */}
                      {meal.notes && (
                        <p className="text-sm text-gray-600 mt-2 italic">"{meal.notes}"</p>
                      )}

                      <p className="text-xs text-gray-500 mt-2">
                        Logged by {meal.loggedBy.firstName} {meal.loggedBy.lastName}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDeleteMeal(meal.id)}
                      className="text-gray-400 hover:text-red-600 transition-colors ml-4"
                      title="Delete meal log"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Meal Templates */}
      {templates.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Quick Log Templates</h2>
            <p className="text-sm text-gray-600 mt-1">Common meals for faster logging</p>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => {
                    // TODO: Quick log with template
                    toast.info('Quick logging with template coming soon!');
                  }}
                  className="text-left border border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:bg-blue-50 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <span className={cn(
                        "inline-block px-2 py-1 text-xs font-medium rounded-full mb-2",
                        MEAL_TYPE_COLORS[template.mealType]
                      )}>
                        {MEAL_TYPE_LABELS[template.mealType]}
                      </span>
                      <h3 className="font-medium text-gray-900">{template.name}</h3>
                      {template.nutritionData?.foodItems && (
                        <p className="text-xs text-gray-600 mt-1">
                          {template.nutritionData.foodItems.slice(0, 3).join(', ')}
                        </p>
                      )}
                      {template.nutritionData?.estimatedCalories && (
                        <p className="text-xs text-gray-500 mt-1">
                          ~{template.nutritionData.estimatedCalories} cal
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Log Meal Modal */}
      {showLogMealModal && patientId && (
        <LogMealModal
          patientId={patientId}
          templates={templates}
          onClose={() => setShowLogMealModal(false)}
          onLog={handleLogMeal}
        />
      )}

      {showDetailModal && selectedMeal && (
        <MealDetailModal
          meal={selectedMeal}
          onClose={handleDetailModalClose}
          onUpdate={handleMealUpdate}
        />
      )}
    </div>
  );
}
