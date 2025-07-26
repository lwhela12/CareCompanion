import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { 
  Users, 
  Heart, 
  Calendar,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

interface FormData {
  familyName: string;
  patientFirstName: string;
  patientLastName: string;
  patientDateOfBirth: string;
  patientGender: 'male' | 'female' | 'other';
  relationship: string;
}

const steps = [
  {
    id: 'welcome',
    title: 'Welcome to CareCompanion',
    description: 'Let\'s set up your family care circle',
    icon: Heart,
  },
  {
    id: 'family',
    title: 'Create Your Family',
    description: 'Give your care circle a name',
    icon: Users,
  },
  {
    id: 'patient',
    title: 'Who Are You Caring For?',
    description: 'Tell us about your loved one',
    icon: Calendar,
  },
];

export function Onboarding() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState<FormData>({
    familyName: '',
    patientFirstName: '',
    patientLastName: '',
    patientDateOfBirth: '',
    patientGender: 'female',
    relationship: '',
  });

  const updateFormData = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return true;
      case 1:
        return formData.familyName.trim().length > 0;
      case 2:
        return (
          formData.patientFirstName.trim().length > 0 &&
          formData.patientLastName.trim().length > 0 &&
          formData.patientDateOfBirth &&
          formData.relationship.trim().length > 0
        );
      default:
        return false;
    }
  };

  const handleNext = async () => {
    if (currentStep === steps.length - 1) {
      // Submit form
      setIsSubmitting(true);
      setError('');
      
      try {
        const response = await api.post('/api/v1/families', {
          ...formData,
          patientDateOfBirth: new Date(formData.patientDateOfBirth).toISOString(),
        });
        
        // Navigate to dashboard
        navigate('/dashboard');
      } catch (err: any) {
        setError(err.response?.data?.error?.message || 'Failed to create family. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  const CurrentIcon = steps[currentStep].icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={cn(
                  'flex items-center',
                  index < steps.length - 1 && 'flex-1'
                )}
              >
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all',
                  index < currentStep && 'bg-primary-600 text-white',
                  index === currentStep && 'bg-primary-600 text-white ring-4 ring-primary-200',
                  index > currentStep && 'bg-gray-200 text-gray-500'
                )}>
                  {index < currentStep ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    index + 1
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div className={cn(
                    'flex-1 h-1 mx-2 transition-all',
                    index < currentStep ? 'bg-primary-600' : 'bg-gray-200'
                  )} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Step header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CurrentIcon className="h-10 w-10 text-primary-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {steps[currentStep].title}
            </h1>
            <p className="text-lg text-gray-600">
              {steps[currentStep].description}
            </p>
          </div>

          {/* Step content */}
          <div className="space-y-6">
            {currentStep === 0 && (
              <div className="text-center space-y-4">
                <p className="text-gray-700">
                  Welcome, {user?.firstName}! CareCompanion helps families coordinate care for aging loved ones.
                </p>
                <div className="bg-primary-50 rounded-xl p-6 text-left">
                  <h3 className="font-semibold text-gray-900 mb-3">What you'll be able to do:</h3>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary-600 mt-0.5 flex-shrink-0" />
                      <span>Track medications and appointments</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary-600 mt-0.5 flex-shrink-0" />
                      <span>Share updates with family members</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary-600 mt-0.5 flex-shrink-0" />
                      <span>Get AI-powered insights and reminders</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary-600 mt-0.5 flex-shrink-0" />
                      <span>Store important documents securely</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Family Name
                  </label>
                  <input
                    type="text"
                    value={formData.familyName}
                    onChange={(e) => updateFormData('familyName', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder="e.g., The Johnson Family"
                    autoFocus
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    This is how your family care circle will be identified
                  </p>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={formData.patientFirstName}
                      onChange={(e) => updateFormData('patientFirstName', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                      placeholder="e.g., Mary"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={formData.patientLastName}
                      onChange={(e) => updateFormData('patientLastName', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                      placeholder="e.g., Johnson"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={formData.patientDateOfBirth}
                      onChange={(e) => updateFormData('patientDateOfBirth', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                      max={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Gender
                    </label>
                    <select
                      value={formData.patientGender}
                      onChange={(e) => updateFormData('patientGender', e.target.value as 'male' | 'female' | 'other')}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    >
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Relationship
                  </label>
                  <input
                    type="text"
                    value={formData.relationship}
                    onChange={(e) => updateFormData('relationship', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder="e.g., Daughter, Son, Spouse"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
                {error}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between mt-8">
            <button
              onClick={handleBack}
              disabled={currentStep === 0}
              className={cn(
                'flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all',
                currentStep === 0
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <ChevronLeft className="h-5 w-5" />
              Back
            </button>

            <button
              onClick={handleNext}
              disabled={!canProceed() || isSubmitting}
              className={cn(
                'flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all',
                canProceed() && !isSubmitting
                  ? 'bg-primary-600 text-white hover:bg-primary-700 hover:shadow-lg'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Creating...
                </>
              ) : currentStep === steps.length - 1 ? (
                <>
                  Complete Setup
                  <Check className="h-5 w-5" />
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-5 w-5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}