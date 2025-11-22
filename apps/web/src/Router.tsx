import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from './components/layouts/DashboardLayout';
import { RootRedirect } from './components/RootRedirect';

// Lazy load pages for better performance
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Patients = lazy(() => import('./pages/Patients').then(m => ({ default: m.Patients })));
const Medications = lazy(() => import('./pages/Medications').then(m => ({ default: m.Medications })));
const Journal = lazy(() => import('./pages/Journal').then(m => ({ default: m.Journal })));
const Family = lazy(() => import('./pages/Family').then(m => ({ default: m.Family })));
const Documents = lazy(() => import('./pages/Documents').then(m => ({ default: m.Documents })));
const Facts = lazy(() => import('./pages/Facts').then(m => ({ default: m.Facts })));
const PatientPortal = lazy(() => import('./pages/PatientPortal').then(m => ({ default: m.PatientPortal })));
const Onboarding = lazy(() => import('./pages/Onboarding').then(m => ({ default: m.Onboarding })));
const AcceptInvitation = lazy(() => import('./pages/AcceptInvitation').then(m => ({ default: m.AcceptInvitation })));
const DevInvitations = lazy(() => import('./pages/DevInvitations').then(m => ({ default: m.DevInvitations })));
const Calendar = lazy(() => import('./pages/Calendar'));
const CalendarSettings = lazy(() => import('./pages/CalendarSettings'));
const SignInPage = lazy(() => import('./pages/SignIn'));
const SignUpPage = lazy(() => import('./pages/SignUp'));
const Recommendations = lazy(() => import('./pages/Recommendations').then(m => ({ default: m.Recommendations })));
const Providers = lazy(() => import('./pages/Providers').then(m => ({ default: m.Providers })));
const Nutrition = lazy(() => import('./pages/Nutrition').then(m => ({ default: m.Nutrition })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));

// Loading spinner for lazy-loaded pages
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>
  );
}

interface RouterProps {
  isSignedIn?: boolean;
}

export function Router({ isSignedIn }: RouterProps) {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes */}
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/sign-up/*" element={<SignUpPage />} />
        <Route path="/invitation/:token" element={<AcceptInvitation />} />

        {/* Protected routes */}
        {isSignedIn ? (
          <>
            {/* Root redirect - checks user type and redirects appropriately */}
            <Route index element={<RootRedirect />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/patient" element={<PatientPortal />} />
            <Route path="/dev/invitations" element={<DevInvitations />} />
            <Route element={<DashboardLayout />}>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="patients" element={<Patients />} />
              <Route path="medications" element={<Medications />} />
              <Route path="nutrition" element={<Nutrition />} />
              <Route path="journal" element={<Journal />} />
              <Route path="documents" element={<Documents />} />
              <Route path="facts" element={<Facts />} />
              <Route path="family" element={<Family />} />
              <Route path="calendar" element={<Calendar />} />
              <Route path="settings" element={<Settings />} />
              <Route path="settings/calendar" element={<CalendarSettings />} />
              <Route path="recommendations" element={<Recommendations />} />
              <Route path="providers" element={<Providers />} />
            </Route>
          </>
        ) : (
          <Route path="*" element={<Navigate to="/sign-in" replace />} />
        )}
      </Routes>
    </Suspense>
  );
}
