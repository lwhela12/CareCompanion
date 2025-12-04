import {
  X,
  Flame,
  Beef,
  Wheat,
  Droplet,
  Target,
  MessageCircle,
  Calendar,
} from 'lucide-react';
import { format } from 'date-fns';

interface NutritionGuidelinesModalProps {
  guidelines: {
    dailyCalories?: number | null;
    proteinGrams?: number | null;
    carbsGrams?: number | null;
    fatGrams?: number | null;
    sodiumMg?: number | null;
    goals?: string[];
    restrictions?: string[];
    specialInstructions?: string | null;
    updatedAt?: string;
  };
  patientName: string;
  onClose: () => void;
}

export function NutritionGuidelinesModal({
  guidelines,
  patientName,
  onClose,
}: NutritionGuidelinesModalProps) {
  // Format the update date if available
  const formattedDate = guidelines.updatedAt
    ? format(new Date(guidelines.updatedAt), 'MMM d, yyyy')
    : null;

  // Format goal/restriction text for display (e.g., "heart-healthy" -> "Heart Healthy")
  const formatLabel = (text: string) => {
    return text
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 p-6 flex items-center justify-between z-10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <Target className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Nutrition Guidelines
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Daily targets for {patientName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Daily Targets */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Daily Targets
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {/* Calories */}
              {guidelines.dailyCalories != null && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center space-x-2 mb-1">
                    <Flame className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                      Calories
                    </span>
                  </div>
                  <p className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                    {guidelines.dailyCalories.toLocaleString()} cal
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">per day</p>
                </div>
              )}

              {/* Protein */}
              {guidelines.proteinGrams != null && (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                  <div className="flex items-center space-x-2 mb-1">
                    <Beef className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                      Protein
                    </span>
                  </div>
                  <p className="text-lg font-semibold text-green-900 dark:text-green-100">
                    {Math.round(guidelines.proteinGrams)}g
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400">per day</p>
                </div>
              )}

              {/* Carbs */}
              {guidelines.carbsGrams != null && (
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 border border-orange-200 dark:border-orange-800">
                  <div className="flex items-center space-x-2 mb-1">
                    <Wheat className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                      Carbs
                    </span>
                  </div>
                  <p className="text-lg font-semibold text-orange-900 dark:text-orange-100">
                    {Math.round(guidelines.carbsGrams)}g
                  </p>
                  <p className="text-xs text-orange-600 dark:text-orange-400">per day</p>
                </div>
              )}

              {/* Fat */}
              {guidelines.fatGrams != null && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center space-x-2 mb-1">
                    <Droplet className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                    <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                      Fat
                    </span>
                  </div>
                  <p className="text-lg font-semibold text-yellow-900 dark:text-yellow-100">
                    {Math.round(guidelines.fatGrams)}g
                  </p>
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">per day</p>
                </div>
              )}

              {/* Sodium */}
              {guidelines.sodiumMg != null && (
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 border border-red-200 dark:border-red-800 col-span-2">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                      Sodium Limit
                    </span>
                  </div>
                  <p className="text-lg font-semibold text-red-900 dark:text-red-100">
                    {guidelines.sodiumMg.toLocaleString()}mg
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400">maximum per day</p>
                </div>
              )}
            </div>
          </div>

          {/* Goals */}
          {guidelines.goals && guidelines.goals.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Nutrition Goals
              </h3>
              <div className="flex flex-wrap gap-2">
                {guidelines.goals.map((goal, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-sm font-medium"
                  >
                    {formatLabel(goal)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Restrictions */}
          {guidelines.restrictions && guidelines.restrictions.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Dietary Restrictions
              </h3>
              <div className="flex flex-wrap gap-2">
                {guidelines.restrictions.map((restriction, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full text-sm font-medium"
                  >
                    {formatLabel(restriction)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Special Instructions */}
          {guidelines.specialInstructions && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Special Instructions
              </h3>
              <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 border border-gray-200 dark:border-slate-600">
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  {guidelines.specialInstructions}
                </p>
              </div>
            </div>
          )}

          {/* Last Updated */}
          {formattedDate && (
            <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
              <Calendar className="w-3 h-3" />
              <span>Last updated {formattedDate}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-slate-700 p-4 bg-gray-50 dark:bg-slate-900/50">
          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <MessageCircle className="w-4 h-4" />
            <span>To update these guidelines, ask CeeCee for help.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
