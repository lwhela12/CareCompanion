import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ExternalLink, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface Invitation {
  id: string;
  email: string;
  token: string;
  role: string;
  relationship: string;
  invitationType: 'CAREGIVER' | 'PATIENT';
  status: string;
  expiresAt: string;
  family: {
    name: string;
  };
}

/**
 * DEV ONLY: Testing page to view and accept invitations without email
 * This page helps with testing when using test emails that can't receive real emails
 */
export function DevInvitations() {
  const navigate = useNavigate();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [emailFilter, setEmailFilter] = useState('');

  useEffect(() => {
    fetchInvitations();
  }, []);

  const fetchInvitations = async () => {
    try {
      setIsLoading(true);
      // This is a dev endpoint - we'll need to create it
      const response = await api.get('/api/v1/invitations/all');
      setInvitations(response.data.invitations);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load invitations');
    } finally {
      setIsLoading(false);
    }
  };

  const acceptInvitation = async (token: string) => {
    navigate(`/invitation/${token}`);
  };

  const copyInviteLink = (token: string) => {
    const link = `${window.location.origin}/invitation/${token}`;
    navigator.clipboard.writeText(link);
    toast.success('Invitation link copied!');
  };

  const filteredInvitations = invitations.filter(inv =>
    emailFilter === '' || inv.email.toLowerCase().includes(emailFilter.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-900 mb-1">Development Tool</h3>
              <p className="text-sm text-yellow-800">
                This page is for testing invitations with test emails. It shows all pending invitations
                and allows you to accept them directly without needing email access.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">All Pending Invitations</h1>
              <p className="text-gray-600 mt-1">
                {invitations.length} invitation{invitations.length !== 1 ? 's' : ''} pending
              </p>
            </div>
            <button
              onClick={fetchInvitations}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Refresh
            </button>
          </div>

          {/* Filter */}
          <div className="mb-6">
            <input
              type="text"
              value={emailFilter}
              onChange={(e) => setEmailFilter(e.target.value)}
              placeholder="Filter by email..."
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              {error}
            </div>
          )}

          {/* Invitations List */}
          {filteredInvitations.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">
                {emailFilter ? 'No invitations match your filter' : 'No pending invitations'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredInvitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="border-2 border-gray-200 rounded-lg p-4 hover:border-primary-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Mail className="h-5 w-5 text-gray-400" />
                        <span className="font-semibold text-gray-900">{invitation.email}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          invitation.invitationType === 'PATIENT'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {invitation.invitationType}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>Family: <span className="font-medium">{invitation.family.name}</span></p>
                        <p>Role: <span className="font-medium">{invitation.role.replace('_', ' ')}</span></p>
                        <p>Relationship: <span className="font-medium">{invitation.relationship}</span></p>
                        <p>Expires: <span className="font-medium">{new Date(invitation.expiresAt).toLocaleString()}</span></p>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                          {invitation.token.substring(0, 20)}...
                        </code>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 ml-4">
                      <button
                        onClick={() => acceptInvitation(invitation.token)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Accept Now
                      </button>
                      <button
                        onClick={() => copyInviteLink(invitation.token)}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Copy Link
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h3 className="font-semibold text-blue-900 mb-2">How to Test Patient Invitations:</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
            <li>Invite a patient (e.g., sue@test.com) from the Family page</li>
            <li>The invitation will appear here</li>
            <li>Either:
              <ul className="list-disc list-inside ml-6 mt-1">
                <li>Sign out, create a Clerk account with that email, then come back here and click "Accept Now"</li>
                <li>Or use a different browser/incognito to sign up with the invited email and click "Accept Now"</li>
              </ul>
            </li>
            <li>You'll be redirected to accept the invitation and set up as a patient user</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
