import { Routes, Route, Navigate } from 'react-router-dom';
import { SignIn, SignUp } from '@clerk/clerk-react';
import { DashboardLayout } from './components/layouts/DashboardLayout';
import { Dashboard } from './pages/Dashboard';
import { Patients } from './pages/Patients';
import { Medications } from './pages/Medications';
import { Journal } from './pages/Journal';
import { Family } from './pages/Family';
import { Onboarding } from './pages/Onboarding';
import { AcceptInvitation } from './pages/AcceptInvitation';

interface RouterProps {
  isSignedIn?: boolean;
}

export function Router({ isSignedIn }: RouterProps) {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/sign-in/*" element={<SignIn routing="path" path="/sign-in" />} />
      <Route path="/sign-up/*" element={<SignUp routing="path" path="/sign-up" />} />
      <Route path="/invitation/:token" element={<AcceptInvitation />} />
      
      {/* Protected routes */}
      {isSignedIn ? (
        <>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="patients" element={<Patients />} />
            <Route path="medications" element={<Medications />} />
            <Route path="journal" element={<Journal />} />
            <Route path="family" element={<Family />} />
          </Route>
        </>
      ) : (
        <Route path="*" element={<Navigate to="/sign-in" replace />} />
      )}
    </Routes>
  );
}