import { SignIn } from '@clerk/clerk-react';
import { Heart, Shield, Users, Calendar } from 'lucide-react';

export default function SignInPage() {
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
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* Left side - Branding and features */}
          <div className="text-center lg:text-left">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
              Welcome back to
              <span className="block text-blue-600 mt-2">CareCompanion</span>
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              Your trusted partner in caring for aging parents. Sign in to continue managing care with confidence.
            </p>

            {/* Feature highlights */}
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Shield className="h-5 w-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-gray-900">Secure & Private</h3>
                  <p className="text-gray-600">Your family's health information is protected with enterprise-grade security</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Users className="h-5 w-5 text-green-600" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-gray-900">Family Collaboration</h3>
                  <p className="text-gray-600">Coordinate care seamlessly with family members and caregivers</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-purple-600" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-gray-900">Smart Tracking</h3>
                  <p className="text-gray-600">Never miss medications or appointments with intelligent reminders</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Sign in form */}
          <div className="flex items-center justify-center">
            <div className="w-full max-w-md">
              <div className="bg-white rounded-2xl shadow-xl p-8">
                <SignIn 
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
                  redirectUrl="/"
                  signUpUrl="/sign-up"
                />
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