import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';

/**
 * Component that handles post-login redirects based on user type
 * - PATIENT users → /patient portal
 * - CAREGIVER with families → /dashboard
 * - CAREGIVER without families → /onboarding
 */
export function RootRedirect() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkUserAndRedirect = async () => {
      try {
        const response = await api.get('/api/v1/families');
        const { families, user } = response.data;

        // Check if user is a PATIENT
        if (user?.userType === 'PATIENT') {
          console.log('Patient user detected, redirecting to /patient');
          navigate('/patient', { replace: true });
          return;
        }

        // Check if caregiver has pending invitation
        if (response.data.pendingInvitation) {
          console.log('Pending invitation found, redirecting to accept invitation');
          navigate(`/invitation/${response.data.pendingInvitation.token}`, { replace: true });
          return;
        }

        // Caregiver with families → dashboard
        if (families && families.length > 0) {
          console.log('Caregiver with families, redirecting to /dashboard');
          navigate('/dashboard', { replace: true });
          return;
        }

        // Caregiver without families → onboarding
        console.log('Caregiver without families, redirecting to /onboarding');
        navigate('/onboarding', { replace: true });
      } catch (error) {
        console.error('Error checking user type:', error);
        // Default to dashboard on error
        navigate('/dashboard', { replace: true });
      } finally {
        setIsLoading(false);
      }
    };

    checkUserAndRedirect();
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return null;
}
