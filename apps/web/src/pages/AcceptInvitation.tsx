import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { 
  Users, 
  Heart, 
  Loader2,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { api } from '@/lib/api';

interface InvitationDetails {
  family: {
    id: string;
    name: string;
    patient: {
      firstName: string;
      lastName: string;
    };
    role: string;
  };
}

export function AcceptInvitation() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useUser();
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');
  const [invitationDetails, setInvitationDetails] = useState<InvitationDetails | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    
    if (!isSignedIn) {
      // Save the invitation token and redirect to sign in
      sessionStorage.setItem('pendingInvitation', token || '');
      navigate('/sign-in');
      return;
    }

    // If signed in, accept the invitation
    acceptInvitation();
  }, [isLoaded, isSignedIn, token, navigate]);

  const acceptInvitation = async () => {
    if (!token) {
      setError('Invalid invitation link');
      setStatus('error');
      return;
    }

    try {
      const response = await api.post(`/api/v1/invitations/${token}/accept`);
      setInvitationDetails(response.data);
      setStatus('success');
      
      // Redirect to dashboard after 3 seconds
      setTimeout(() => {
        navigate('/dashboard');
      }, 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to accept invitation');
      setStatus('error');
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        {status === 'loading' && (
          <div className="text-center">
            <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Loader2 className="h-10 w-10 text-primary-600 animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Accepting Invitation
            </h2>
            <p className="text-gray-600">
              Please wait while we process your invitation...
            </p>
          </div>
        )}

        {status === 'success' && invitationDetails && (
          <div className="text-center">
            <div className="w-20 h-20 bg-success-light rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-10 w-10 text-success" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Welcome to {invitationDetails.family.name}!
            </h2>
            <p className="text-gray-600 mb-6">
              You've been added as a {invitationDetails.family.role.replace('_', ' ')} 
              for {invitationDetails.family.patient.firstName} {invitationDetails.family.patient.lastName}.
            </p>
            <div className="bg-primary-50 rounded-xl p-4 text-sm text-primary-800">
              <Users className="h-5 w-5 inline mr-2" />
              Redirecting to your dashboard...
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="h-10 w-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Invitation Error
            </h2>
            <p className="text-gray-600 mb-6">
              {error}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/sign-in')}
                className="w-full px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/')}
                className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                Go to Home
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}