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

      if (families.length === 0) {
        // User has no families, needs onboarding
        setNeedsOnboarding(true);
        navigate('/onboarding');
      } else {
        // User has families, check if there's a pending invitation
        const pendingInvitation = sessionStorage.getItem('pendingInvitation');
        if (pendingInvitation) {
          sessionStorage.removeItem('pendingInvitation');
          navigate(`/invitation/${pendingInvitation}`);
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