import { Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from './components/layouts/DashboardLayout';
import { Dashboard } from './pages/Dashboard';
import { Patients } from './pages/Patients';
import { Medications } from './pages/Medications';
import { Journal } from './pages/Journal';
import { Family } from './pages/Family';
import { Documents } from './pages/Documents';
import { Facts } from './pages/Facts';
import { PatientPortal } from './pages/PatientPortal';
import { Onboarding } from './pages/Onboarding';
import { AcceptInvitation } from './pages/AcceptInvitation';
import { DevInvitations } from './pages/DevInvitations';
import { RootRedirect } from './components/RootRedirect';
import Calendar from './pages/Calendar';
import CalendarSettings from './pages/CalendarSettings';
import SignInPage from './pages/SignIn';
import SignUpPage from './pages/SignUp';
import { Recommendations } from './pages/Recommendations';
import { Providers } from './pages/Providers';
import { Nutrition } from './pages/Nutrition';

interface RouterProps {
  isSignedIn?: boolean;
}

export function Router({ isSignedIn }: RouterProps) {
  return (
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
            <Route path="settings/calendar" element={<CalendarSettings />} />
            <Route path="recommendations" element={<Recommendations />} />
            <Route path="providers" element={<Providers />} />
          </Route>
        </>
      ) : (
        <Route path="*" element={<Navigate to="/sign-in" replace />} />
      )}
    </Routes>
  );
}
