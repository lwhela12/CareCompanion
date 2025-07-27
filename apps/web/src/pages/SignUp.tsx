import { SignUp } from '@clerk/clerk-react';
import { Heart, CheckCircle, Clock, Brain } from 'lucide-react';

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col">
      {/* Header */}
      <header className="p-6">
        <div className="max-w-7xl mx-auto flex items-center gap-2">
          <Heart className="h-8 w-8 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">CareCompanion</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* Left side - Branding and benefits */}
          <div className="text-center lg:text-left">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
              Start caring with
              <span className="block text-blue-600 mt-2">confidence</span>
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              Join thousands of families who trust CareCompanion to help manage care for their aging parents.
            </p>

            {/* Benefits */}
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                <div className="text-left">
                  <h3 className="font-semibold text-gray-900">Free to get started</h3>
                  <p className="text-gray-600">No credit card required. Upgrade when you need more features.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                <div className="text-left">
                  <h3 className="font-semibold text-gray-900">Set up in minutes</h3>
                  <p className="text-gray-600">Quick onboarding gets you tracking medications right away.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                <div className="text-left">
                  <h3 className="font-semibold text-gray-900">Invite family members</h3>
                  <p className="text-gray-600">Share care responsibilities with unlimited family members.</p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mt-8 pt-8 border-t border-gray-200">
              <div>
                <div className="text-3xl font-bold text-blue-600">10k+</div>
                <div className="text-sm text-gray-600">Families</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-green-600">500k+</div>
                <div className="text-sm text-gray-600">Meds tracked</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-purple-600">99.9%</div>
                <div className="text-sm text-gray-600">Uptime</div>
              </div>
            </div>
          </div>

          {/* Right side - Sign up form */}
          <div className="flex items-center justify-center">
            <div className="w-full max-w-md">
              <div className="bg-white rounded-2xl shadow-xl p-8">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">Create your account</h3>
                  <p className="text-gray-600 mt-2">Start your free trial today</p>
                </div>
                
                <SignUp 
                  appearance={{
                    elements: {
                      rootBox: "mx-auto",
                      card: "shadow-none",
                      headerTitle: "hidden",
                      headerSubtitle: "hidden",
                      socialButtonsBlockButton: "border-gray-300 hover:bg-gray-50",
                      dividerLine: "bg-gray-200",
                      dividerText: "text-gray-500",
                      formFieldLabel: "text-gray-700 font-medium",
                      formFieldInput: "border-gray-300 focus:border-blue-500 focus:ring-blue-500",
                      formButtonPrimary: "bg-blue-600 hover:bg-blue-700 text-white",
                      footerActionLink: "text-blue-600 hover:text-blue-700 font-medium",
                      identityPreviewText: "text-gray-700",
                      identityPreviewEditButton: "text-blue-600 hover:text-blue-700",
                      formFieldInputShowPasswordButton: "text-gray-500 hover:text-gray-700",
                      otpCodeFieldInput: "border-gray-300 focus:border-blue-500 focus:ring-blue-500",
                      formResendCodeLink: "text-blue-600 hover:text-blue-700",
                    },
                    layout: {
                      socialButtonsPlacement: "top",
                      showOptionalFields: false,
                      termsPageUrl: "/terms",
                      privacyPageUrl: "/privacy",
                    },
                    variables: {
                      colorPrimary: "#2563EB",
                      colorText: "#111827",
                      colorTextSecondary: "#6B7280",
                      colorBackground: "#FFFFFF",
                      colorInputBackground: "#FFFFFF",
                      colorInputText: "#111827",
                      borderRadius: "0.5rem",
                    }
                  }}
                  redirectUrl="/onboarding"
                  signInUrl="/sign-in"
                />
              </div>

              {/* Trust badges */}
              <div className="mt-6 flex items-center justify-center gap-6 text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>24/7 Support</span>
                </div>
                <div className="flex items-center gap-1">
                  <Brain className="h-4 w-4" />
                  <span>AI-Powered</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-sm text-gray-600">
        <p>&copy; 2025 CareCompanion. Built with love for family caregivers.</p>
      </footer>
    </div>
  );
}