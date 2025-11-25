import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { UserCircle, Mail, Key, LogIn, X, Send } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface PatientPortalAccessProps {
  familyId: string;
  patientId: string;
  patientName: string;
}

interface PatientUser {
  id: string;
  email: string;
  hasAccount: boolean;
}

export function PatientPortalAccess({ familyId, patientId, patientName }: PatientPortalAccessProps) {
  const [patientUser, setPatientUser] = useState<PatientUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    checkPatientPortalStatus();
  }, [patientId]);

  const checkPatientPortalStatus = async () => {
    try {
      // Get patient details including user account status
      const response = await api.get(`/api/v1/families/${familyId}`);
      const family = response.data.family;

      // Check if patient has a user account
      // This would need a new endpoint or include user info in patient data
      // For now, we'll just check invitations
      setPatientUser(null);
    } catch (error) {
      console.error('Error checking patient portal status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendInvitation = async () => {
    if (!email) {
      toast.error('Please enter an email address');
      return;
    }

    try {
      await api.post(`/api/v1/families/${familyId}/invite-patient`, {
        email,
      });

      toast.success(`Invitation sent to ${email}!`);
      setShowInviteModal(false);
      setEmail('');
      checkPatientPortalStatus();
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Failed to send invitation';
      toast.error(message);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    try {
      await api.post('/api/v1/auth/reset-patient-password', {
        patientId,
        newPassword,
      });

      toast.success('Password reset successfully!');
      setShowResetPasswordModal(false);
      setNewPassword('');
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Failed to reset password';
      toast.error(message);
    }
  };

  const handleLoginAsPatient = async () => {
    try {
      const response = await api.post('/api/v1/auth/impersonate', {
        patientId,
      });

      toast.success(`Logging in as ${patientName}...`);
      sessionStorage.setItem('impersonation', JSON.stringify(response.data));
      window.location.href = '/patient';
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Failed to login as patient';
      toast.error(message);
    }
  };

  if (isLoading) {
    return (
      <div className="card dark:bg-slate-800">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-slate-700 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="card dark:bg-slate-800">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            Patient Portal Access
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage {patientName}'s portal access and login
          </p>
        </div>
      </div>

      {patientUser?.hasAccount ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div>
              <p className="font-medium text-green-900 dark:text-green-300">Portal Access Enabled</p>
              <p className="text-sm text-green-700 dark:text-green-400 mt-1">{patientUser.email}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleLoginAsPatient}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
              >
                <LogIn className="h-4 w-4" />
                Login as Patient
              </button>
              <button
                onClick={() => setShowResetPasswordModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors text-sm"
              >
                <Key className="h-4 w-4" />
                Reset Password
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {patientName} doesn't have portal access yet. Send an invitation to set up their account.
            </p>
          </div>
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Mail className="h-4 w-4" />
            Send Portal Invitation
          </button>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-gray-900">Invite to Portal</h3>
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setEmail('');
                }}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            <p className="text-gray-600 mb-4">
              Send {patientName} an invitation to access their patient portal. They'll be able to view their checklist and log daily activities.
            </p>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="patient@example.com"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setEmail('');
                }}
                className="flex-1 px-4 py-3 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSendInvitation}
                className="flex-1 px-4 py-3 text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors font-semibold flex items-center justify-center gap-2"
              >
                <Send className="h-4 w-4" />
                Send Invitation
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Reset Password Modal */}
      {showResetPasswordModal && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-gray-900">Reset Password</h3>
              <button
                onClick={() => {
                  setShowResetPasswordModal(false);
                  setNewPassword('');
                }}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            <p className="text-gray-600 mb-4">
              Set a new password for {patientName} to use when logging into the patient portal.
            </p>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <p className="text-sm text-gray-500 mt-1">
                You can share this password with {patientName} so they can login independently.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowResetPasswordModal(false);
                  setNewPassword('');
                }}
                className="flex-1 px-4 py-3 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                className="flex-1 px-4 py-3 text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors font-semibold"
              >
                Reset Password
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
