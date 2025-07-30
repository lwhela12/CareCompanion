import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { api } from '@/lib/api';

export function useOnboarding() {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useUser();
  const [isChecking, setIsChecking] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    // Add a small delay to ensure Clerk session is fully initialized
    const timer = setTimeout(() => {
      checkOnboardingStatus();
    }, 500);

    return () => clearTimeout(timer);
  }, [isLoaded, isSignedIn]);

  const checkOnboardingStatus = async () => {
    try {
      const response = await api.get('/api/v1/families');
      const families = response.data.families;
      const pendingInvitation = response.data.pendingInvitation;

      if (families.length === 0) {
        // Check if user has a pending invitation from the API
        if (pendingInvitation) {
          // User has a pending invitation, redirect to accept it
          navigate(`/invitation/${pendingInvitation.token}`);
        } else {
          // User has no families and no invitations, needs onboarding
          setNeedsOnboarding(true);
          navigate('/onboarding');
        }
      } else {
        // User has families, check if there's a pending invitation in session storage
        const sessionInvitation = sessionStorage.getItem('pendingInvitation');
        if (sessionInvitation) {
          sessionStorage.removeItem('pendingInvitation');
          navigate(`/invitation/${sessionInvitation}`);
        } else {
          setNeedsOnboarding(false);
        }
      }
    } catch (error) {
      console.error('Failed to check onboarding status:', error);
    } finally {
      setIsChecking(false);
    }
  };

  return { isChecking, needsOnboarding };
}