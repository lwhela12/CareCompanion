import { useCallback, useState } from 'react';
import { useClerk, useAuth } from '@clerk/clerk-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

/**
 * Custom hook for handling logout with CeeCee conversation logging
 * This hook logs all unlogged conversations to the journal before signing out
 */
export function useLogout() {
  const { signOut } = useClerk();
  const { getToken } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);

    try {
      // First, log all unlogged conversations to the journal
      const token = await getToken();
      if (token) {
        try {
          const response = await api.post(
            '/api/v1/conversations/log-all-to-journal',
            {},
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          if (response.data.loggedCount > 0) {
            console.log(
              `Logged ${response.data.loggedCount} conversation(s) to journal before logout`
            );
          }
        } catch (logError) {
          // Don't prevent logout if logging fails - just log the error
          console.error('Failed to log conversations before logout:', logError);
        }
      }

      // Now sign out
      await signOut();
    } catch (error) {
      console.error('Logout failed:', error);
      toast.error('Failed to sign out. Please try again.');
      setIsLoggingOut(false);
    }
  }, [signOut, getToken]);

  return {
    handleLogout,
    isLoggingOut,
  };
}

/**
 * A component wrapper that provides a custom sign out button
 * Use this instead of UserButton when you need logout hook functionality
 */
export function useSignOutWithLogging() {
  const { handleLogout, isLoggingOut } = useLogout();

  // Return a function that can be passed to Clerk UserButton's signOutCallback
  // Note: Clerk's UserButton doesn't support this directly, so we'll need
  // to create a custom implementation or intercept differently
  return {
    handleLogout,
    isLoggingOut,
  };
}
