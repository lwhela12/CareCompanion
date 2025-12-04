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
  Info,
  Lightbulb,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { cn, localDayBounds } from '@/lib/utils';
import { api, nutritionApi } from '@/lib/api';
import { LogMealModal } from '@/components/LogMealModal';
import { MealDetailModal } from '@/components/MealDetailModal';
import { NutritionGuidelinesModal } from '@/components/NutritionGuidelinesModal';

interface MealLog {
  id: string;
  mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK' | 'OTHER';
  consumedAt: string;
  description?: string;
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
  analysisStatus: 'NONE' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
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
  BREAKFAST: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  LUNCH: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  DINNER: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  SNACK: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  OTHER: 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-400',
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
  const [patientName, setPatientName] = useState<string>('');
  const [hasDietaryInfo, setHasDietaryInfo] = useState(false);
  const [hasNutritionGuidelines, setHasNutritionGuidelines] = useState(false);
  const [nutritionGuidelines, setNutritionGuidelines] = useState<any>(null);
  const [showGuidelinesModal, setShowGuidelinesModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-refresh when there are meals with pending analysis
  useEffect(() => {
    const hasPendingAnalysis = todaysMeals.some(
      (meal) => meal.analysisStatus === 'PENDING' || meal.analysisStatus === 'PROCESSING'
    );

    if (hasPendingAnalysis) {
      const interval = setInterval(() => {
        fetchData();
      }, 5000); // Refresh every 5 seconds

      return () => clearInterval(interval);
    }
    return undefined;
  }, [todaysMeals]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      // First get the patient ID
      const familiesResponse = await api.get('/api/v1/families');
      if (familiesResponse.data.families.length > 0) {
        const family = familiesResponse.data.families[0];
        const patientIdFromFamily = family.patient.id;
        setPatientId(patientIdFromFamily);
        setPatientName(family.patient.firstName || 'Patient');

        // Fetch today's meals, weekly summary, and templates
        const { startISO, endISO, startDate, endDate } = localDayBounds(new Date());

        const [mealsResponse, summaryResponse, templatesResponse] = await Promise.all([
          nutritionApi.getMealLogs(patientIdFromFamily, { startDate: startISO, endDate: endISO }),
          nutritionApi.getWeeklySummary(patientIdFromFamily),
          nutritionApi.getMealTemplates(patientIdFromFamily),
        ]);

        const meals = mealsResponse.data.meals || mealsResponse.data.mealLogs || [];
        const filteredMeals = meals.filter((meal: any) => {
          const ts = new Date(meal.consumedAt || meal.createdAt);
          return ts >= startDate && ts <= endDate;
        });

        setTodaysMeals(filteredMeals);
        setWeeklySummary(summaryResponse.data.summary);
        setTemplates(templatesResponse.data.templates);
        // Set whether patient has dietary restrictions (for conditional concerns display)
        setHasDietaryInfo(mealsResponse.data.hasDietaryInfo ?? false);
        // Set whether patient has nutrition guidelines set
        setHasNutritionGuidelines(mealsResponse.data.hasNutritionGuidelines ?? false);
        // Set nutrition guidelines data
        setNutritionGuidelines(mealsResponse.data.nutritionGuidelines ?? null);
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
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-red-800 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Nutrition</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Track meals and monitor nutrition</p>
        </div>
        <button
          onClick={() => setShowLogMealModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="w-5 h-5 mr-2" />
          Log Meal
        </button>
      </div>

      {/* Setup Nutrition Guidelines Banner - only show when no guidelines exist */}
      {!hasNutritionGuidelines && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-blue-900 dark:text-blue-100">
                Set Up Nutrition Guidelines
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Ask CeeCee to help create personalized nutrition guidelines based on your loved one's health needs.
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-2 italic">
                Try: "Help me set up nutrition guidelines for {patientName || 'Mom'}"
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Weekly Summary Cards */}
      {weeklySummary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Meals This Week</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{weeklySummary.totalMeals}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{weeklySummary.daysWithMeals}/7 days</p>
              </div>
              <Utensils className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Avg Calories/Meal</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {weeklySummary.averageCalories ? Math.round(weeklySummary.averageCalories) : '—'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Past 7 days</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
          </div>

          <div
            onClick={hasNutritionGuidelines && nutritionGuidelines ? () => setShowGuidelinesModal(true) : undefined}
            className={cn(
              "bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4",
              hasNutritionGuidelines && nutritionGuidelines && "cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            )}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Guideline Adherence</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {weeklySummary.guidelineAdherence !== null
                    ? `${weeklySummary.guidelineAdherence}%`
                    : '—'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {hasNutritionGuidelines ? 'Click to view guidelines' : 'Meals meeting goals'}
                </p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
          </div>

          {hasDietaryInfo && (
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Concerns</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{weeklySummary.totalConcerns}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Items flagged</p>
                </div>
                <AlertCircle className={cn(
                  "w-8 h-8",
                  weeklySummary.totalConcerns > 0 ? "text-yellow-600 dark:text-yellow-400" : "text-gray-400 dark:text-gray-500"
                )} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Today's Meals */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Today's Meals - {format(new Date(), 'MMMM d, yyyy')}
              </h2>
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400">{todaysMeals.length} logged</span>
          </div>
        </div>

        <div className="p-6">
          {todaysMeals.length === 0 ? (
            <div className="text-center py-12">
              <Utensils className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400">No meals logged today</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Click "Log Meal" to track a meal</p>
            </div>
          ) : (
            <div className="space-y-4">
              {todaysMeals.map((meal) => (
                <div
                  key={meal.id}
                  onClick={() => handleMealClick(meal)}
                  className="border border-gray-200 dark:border-slate-600 rounded-lg p-4 hover:border-gray-300 dark:hover:border-slate-500 transition-colors cursor-pointer"
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
                        <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {format(new Date(meal.consumedAt), 'h:mm a')}
                        </span>
                        {meal.template && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Template: {meal.template.name}
                          </span>
                        )}
                      </div>

                      {/* Food Items */}
                      {meal.nutritionData?.foodItems && meal.nutritionData.foodItems.length > 0 && (
                        <div className="mb-2">
                          <p className="text-sm text-gray-900 dark:text-gray-100 font-medium">
                            {meal.nutritionData.foodItems.slice(0, 5).join(', ')}
                            {meal.nutritionData.foodItems.length > 5 && `, +${meal.nutritionData.foodItems.length - 5} more`}
                          </p>
                        </div>
                      )}

                      {/* Analysis Status */}
                      {(meal.analysisStatus === 'PENDING' || meal.analysisStatus === 'PROCESSING') && (
                        <div className="flex items-center space-x-2 mb-2 text-blue-600 dark:text-blue-400">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-xs">Analyzing nutrition...</span>
                        </div>
                      )}
                      {meal.analysisStatus === 'FAILED' && (
                        <div className="flex items-center space-x-2 mb-2 text-red-600 dark:text-red-400">
                          <XCircle className="w-4 h-4" />
                          <span className="text-xs">Analysis failed</span>
                        </div>
                      )}

                      {/* Nutrition Info */}
                      {meal.nutritionData && meal.analysisStatus === 'COMPLETED' && (
                        <div className="flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-400 mb-2">
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
                              className="w-16 h-16 object-cover rounded border border-gray-200 dark:border-slate-600"
                            />
                          ))}
                          {meal.photoUrls.length > 3 && (
                            <div className="w-16 h-16 bg-gray-100 dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600 flex items-center justify-center text-xs text-gray-600 dark:text-gray-400">
                              +{meal.photoUrls.length - 3}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Concerns - Only show if user has dietary restrictions set */}
                      {hasDietaryInfo && meal.concerns && meal.concerns.length > 0 && (
                        <div className="flex items-start space-x-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded mt-2">
                          <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs font-medium text-yellow-900 dark:text-yellow-400">Concerns:</p>
                            <p className="text-xs text-yellow-800 dark:text-yellow-300">{meal.concerns.join('; ')}</p>
                          </div>
                        </div>
                      )}

                      {/* Guideline Check */}
                      {meal.analysisStatus === 'COMPLETED' && meal.meetsGuidelines !== null && (
                        <div className="flex items-center space-x-2 mt-2">
                          {meal.meetsGuidelines ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                              <span className="text-xs text-green-700 dark:text-green-400">Meets nutrition guidelines</span>
                            </>
                          ) : (
                            <>
                              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              <span className="text-xs text-blue-700 dark:text-blue-400">May need adjustment to meet guidelines</span>
                            </>
                          )}
                        </div>
                      )}

                      {/* Description */}
                      {meal.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 italic">"{meal.description}"</p>
                      )}

                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Logged by {meal.loggedBy.firstName} {meal.loggedBy.lastName}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDeleteMeal(meal.id)}
                      className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors ml-4"
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
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Quick Log Templates</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Common meals for faster logging</p>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => {
                    // TODO: Quick log with template
                    toast('Quick logging with template coming soon!');
                  }}
                  className="text-left border border-gray-200 dark:border-slate-600 rounded-lg p-4 hover:border-blue-500 hover:bg-blue-50 dark:hover:border-blue-500 dark:hover:bg-blue-900/20 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <span className={cn(
                        "inline-block px-2 py-1 text-xs font-medium rounded-full mb-2",
                        MEAL_TYPE_COLORS[template.mealType]
                      )}>
                        {MEAL_TYPE_LABELS[template.mealType]}
                      </span>
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">{template.name}</h3>
                      {template.nutritionData?.foodItems && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {template.nutritionData.foodItems.slice(0, 3).join(', ')}
                        </p>
                      )}
                      {template.nutritionData?.estimatedCalories && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          ~{template.nutritionData.estimatedCalories} cal
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500" />
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
          hasDietaryInfo={hasDietaryInfo}
          onClose={handleDetailModalClose}
          onUpdate={handleMealUpdate}
        />
      )}

      {showGuidelinesModal && nutritionGuidelines && (
        <NutritionGuidelinesModal
          guidelines={nutritionGuidelines}
          patientName={patientName}
          onClose={() => setShowGuidelinesModal(false)}
        />
      )}
    </div>
  );
}
