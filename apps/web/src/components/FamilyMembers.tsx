import { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Mail,
  Shield,
  Eye,
  X,
  Check,
  Loader2,
  Copy,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

interface FamilyMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  relationship: string;
  joinedAt?: string;
}

interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  relationship: string;
  invitedBy: string;
  invitedAt: string;
  expiresAt: string;
}

const roleIcons = {
  primary_caregiver: Shield,
  caregiver: Users,
  family_member: Users,
  read_only: Eye,
};

const roleLabels = {
  primary_caregiver: 'Primary Caregiver',
  caregiver: 'Caregiver',
  family_member: 'Family Member',
  read_only: 'View Only',
};

interface FamilyMembersProps {
  familyId: string;
  currentUserRole: string;
  members: FamilyMember[];
}

export function FamilyMembers({ familyId, currentUserRole, members: initialMembers }: FamilyMembersProps) {
  const [members, setMembers] = useState<FamilyMember[]>(initialMembers);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('family_member');
  const [inviteRelationship, setInviteRelationship] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const canInvite = ['primary_caregiver', 'caregiver'].includes(currentUserRole);

  useEffect(() => {
    setMembers(initialMembers);
  }, [initialMembers]);

  useEffect(() => {
    fetchInvitations();
  }, [familyId]);

  const fetchInvitations = async () => {
    try {
      if (canInvite) {
        const invitesResponse = await api.get(`/api/v1/families/${familyId}/invitations`);
        setInvitations(invitesResponse.data.invitations);
      }
    } catch (err) {
      setError('Failed to load invitations');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInviting(true);
    setInviteError('');

    try {
      await api.post(`/api/v1/families/${familyId}/invitations`, {
        email: inviteEmail,
        role: inviteRole,
        relationship: inviteRelationship,
      });

      setInviteSuccess(true);
      setTimeout(() => {
        setShowInviteModal(false);
        setInviteEmail('');
        setInviteRole('family_member');
        setInviteRelationship('');
        setInviteSuccess(false);
        fetchInvitations();
      }, 2000);
    } catch (err: any) {
      setInviteError(err.response?.data?.error?.message || 'Failed to send invitation');
    } finally {
      setIsInviting(false);
    }
  };

  const cancelInvitation = async (invitationId: string) => {
    try {
      await api.delete(`/api/v1/families/${familyId}/invitations/${invitationId}`);
      fetchInvitations();
    } catch (err) {
      setError('Failed to cancel invitation');
    }
  };

  const copyInviteLink = (token: string) => {
    const link = `${window.location.origin}/invitation/${token}`;
    navigator.clipboard.writeText(link);
    // Show toast notification in real app
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Family Members</h2>
          <p className="text-gray-600 mt-1">
            {members.length} active member{members.length !== 1 ? 's' : ''}
            {invitations.length > 0 && ` • ${invitations.length} pending invitation${invitations.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {canInvite && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
          >
            <UserPlus className="h-5 w-5" />
            Invite Member
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* Active Members */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Members</h3>
        <div className="space-y-3">
          {members.map((member) => {
            const RoleIcon = roleIcons[member.role as keyof typeof roleIcons] || Users;
            return (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary-700 font-semibold">
                      {member.firstName[0]}{member.lastName[0]}
                    </span>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">
                      {member.firstName} {member.lastName}
                    </div>
                    <div className="text-sm text-gray-600">
                      {member.relationship} • {member.email}
                    </div>
                    {member.joinedAt && (
                      <div className="text-xs text-gray-500 mt-1">
                        Joined {new Date(member.joinedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium',
                    member.role === 'primary_caregiver' && 'bg-primary-100 text-primary-700',
                    member.role === 'caregiver' && 'bg-blue-100 text-blue-700',
                    member.role === 'family_member' && 'bg-green-100 text-green-700',
                    member.role === 'read_only' && 'bg-gray-100 text-gray-700'
                  )}>
                    <RoleIcon className="h-4 w-4" />
                    {roleLabels[member.role as keyof typeof roleLabels]}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Pending Invitations</h3>
          <div className="space-y-3">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex items-center justify-between p-4 bg-yellow-50 rounded-xl"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                    <Mail className="h-6 w-6 text-yellow-700" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{invitation.email}</div>
                    <div className="text-sm text-gray-600">
                      {invitation.relationship} • Invited by {invitation.invitedBy}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    {roleLabels[invitation.role as keyof typeof roleLabels]}
                  </span>
                  {canInvite && (
                    <button
                      onClick={() => cancelInvitation(invitation.id)}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Cancel invitation"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 pointer-events-none">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md pointer-events-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">Invite Family Member</h3>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            </div>

            <form onSubmit={handleInvite} className="p-6 space-y-4">
              {inviteSuccess ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-success-light rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="h-8 w-8 text-success" />
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">
                    Invitation Sent!
                  </h4>
                  <p className="text-gray-600">
                    An invitation has been sent to {inviteEmail}
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="family.member@example.com"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Relationship
                    </label>
                    <input
                      type="text"
                      value={inviteRelationship}
                      onChange={(e) => setInviteRelationship(e.target.value)}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="e.g., Son, Sister, Friend"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Access Level
                    </label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="caregiver">Caregiver - Can add entries and manage care</option>
                      <option value="family_member">Family Member - Can view and add updates</option>
                      <option value="read_only">View Only - Can only view information</option>
                    </select>
                  </div>

                  {inviteError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                      {inviteError}
                    </div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowInviteModal(false)}
                      className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isInviting}
                      className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isInviting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        'Send Invitation'
                      )}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}