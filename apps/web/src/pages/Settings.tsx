import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
  Loader2,
  CheckCircle,
  XCircle,
  Bell,
  Moon,
  Sun,
  Mail,
  Clock,
  Shield,
  AlertCircle,
  MessageSquare,
  Users,
  BookOpen,
  Palette,
  Monitor,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useTheme } from '@/providers/ThemeProvider';
import toast from 'react-hot-toast';

interface NotificationPreferences {
  emailEnabled: boolean;
  medicationReminders: boolean;
  careTaskReminders: boolean;
  insightAlerts: boolean;
  dailySummaries: boolean;
  weeklyReports: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  quietHoursTimezone: string | null;
  smsEnabled: boolean;
  phoneNumber: string | null;
  pushEnabled: boolean;
  // CeeCee settings
  ceeceeAutoLogEnabled: boolean;
  ceeceeLogVisibleTo: string[];
}

interface FamilyMember {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

// Common US timezones
const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Phoenix', label: 'Arizona Time (MST)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)' },
];

export function Settings() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'notifications' | 'ceecee' | 'appearance'>('notifications');
  const { theme, setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const token = await getToken();

      // Load preferences first
      const prefsResponse = await api.get('/api/v1/users/notification-preferences', {
        headers: { Authorization: `Bearer ${token}` },
      });

      setPreferences(prefsResponse.data.preferences);

      // Then try to load family data (this may fail if user has no families yet)
      try {
        // First get the list of families
        const familiesResponse = await api.get('/api/v1/families', {
          headers: { Authorization: `Bearer ${token}` },
        });

        // If user has families, get details of the first one
        if (familiesResponse.data.families && familiesResponse.data.families.length > 0) {
          const familyId = familiesResponse.data.families[0].id;
          const familyDetailsResponse = await api.get(`/api/v1/families/${familyId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          const family = familyDetailsResponse.data.family;
          if (family?.members) {
            const members = family.members.map((m: any) => ({
              id: m.id,
              firstName: m.firstName,
              lastName: m.lastName,
              role: m.role,
            }));
            setFamilyMembers(members);

            // Find current user ID by email match
            const currentUserEmail = prefsResponse.data.email;
            const currentMember = family.members.find((m: any) => m.email === currentUserEmail);
            if (currentMember) {
              setCurrentUserId(currentMember.id);
            }
          }
        }
      } catch (familyError) {
        // Family data is optional for settings, don't fail if it's not available
        console.log('Could not load family data:', familyError);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
      setErrorMessage('Failed to load notification preferences');
      toast.error('Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!preferences) return;

    // Validate quiet hours
    if (preferences.quietHoursEnabled) {
      if (!preferences.quietHoursStart || !preferences.quietHoursEnd || !preferences.quietHoursTimezone) {
        setErrorMessage('Please configure all quiet hours settings (start time, end time, and timezone)');
        toast.error('Complete quiet hours configuration');
        return;
      }
    }

    try {
      setSaving(true);
      setErrorMessage(null);

      const token = await getToken();
      await api.patch(
        '/api/v1/users/notification-preferences',
        preferences,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setSuccessMessage('Notification preferences updated successfully');
      toast.success('Preferences saved!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      console.error('Error saving preferences:', error);
      const message = error.response?.data?.message || 'Failed to save preferences';
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K]
  ) => {
    if (!preferences) return;
    setPreferences({
      ...preferences,
      [key]: value,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600 dark:text-primary-400" />
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Failed to load preferences</h3>
              <p className="text-sm text-red-700 dark:text-red-400 mt-1">Please try refreshing the page.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage your account preferences and notification settings.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-slate-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('notifications')}
            className={`
              pb-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${
                activeTab === 'notifications'
                  ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-slate-600'
              }
            `}
          >
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </div>
          </button>
          <button
            onClick={() => setActiveTab('ceecee')}
            className={`
              pb-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${
                activeTab === 'ceecee'
                  ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-slate-600'
              }
            `}
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              CeeCee
            </div>
          </button>
          <button
            onClick={() => setActiveTab('appearance')}
            className={`
              pb-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${
                activeTab === 'appearance'
                  ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-slate-600'
              }
            `}
          >
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Appearance
            </div>
          </button>
        </nav>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-green-800 dark:text-green-300">{successMessage}</p>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-800 dark:text-red-300">{errorMessage}</p>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Notifications Tab Content */}
      {activeTab === 'notifications' && (
        <div className="space-y-6">
          {/* Master Email Toggle */}
          <div className="card">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                  <Mail className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Email Notifications</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Master toggle for all email notifications. When disabled, you won't receive any emails from CareCompanion.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={preferences.emailEnabled}
                  onChange={(e) => updatePreference('emailEnabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-900/50 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 dark:after:border-slate-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>
          </div>

          {/* Notification Types */}
          <div className="card">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                <Bell className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Notification Types</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Choose which types of notifications you want to receive via email.
                </p>
              </div>
            </div>

            <div className="space-y-4 mt-6">
              <NotificationToggle
                label="Medication Reminders"
                description="Receive reminders 30 minutes before scheduled medications"
                checked={preferences.medicationReminders}
                onChange={(checked) => updatePreference('medicationReminders', checked)}
                disabled={!preferences.emailEnabled}
                critical
              />

              <NotificationToggle
                label="Care Task Reminders"
                description="Get notified about upcoming care tasks and appointments"
                checked={preferences.careTaskReminders}
                onChange={(checked) => updatePreference('careTaskReminders', checked)}
                disabled={!preferences.emailEnabled}
                critical
              />

              <NotificationToggle
                label="Insight Alerts"
                description="Receive alerts about important patterns or changes detected"
                checked={preferences.insightAlerts}
                onChange={(checked) => updatePreference('insightAlerts', checked)}
                disabled={!preferences.emailEnabled}
              />

              <div className="border-t border-gray-200 dark:border-slate-700 my-4"></div>

              <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-lg">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">Optional Digests (Opt-in)</p>

                <div className="space-y-3">
                  <NotificationToggle
                    label="Daily Summaries"
                    description="Daily recap of activities, medications, and notes (coming soon)"
                    checked={preferences.dailySummaries}
                    onChange={(checked) => updatePreference('dailySummaries', checked)}
                    disabled={!preferences.emailEnabled}
                    comingSoon
                  />

                  <NotificationToggle
                    label="Weekly Reports"
                    description="Weekly summary with trends and insights (coming soon)"
                    checked={preferences.weeklyReports}
                    onChange={(checked) => updatePreference('weeklyReports', checked)}
                    disabled={!preferences.emailEnabled}
                    comingSoon
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Quiet Hours */}
          <div className="card">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                  <Moon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Quiet Hours</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Set specific hours when you don't want to receive notifications (e.g., during sleep).
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={preferences.quietHoursEnabled}
                  onChange={(e) => updatePreference('quietHoursEnabled', e.target.checked)}
                  disabled={!preferences.emailEnabled}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-900/50 rounded-full peer disabled:opacity-50 disabled:cursor-not-allowed peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 dark:after:border-slate-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            {preferences.quietHoursEnabled && (
              <div className="mt-6 space-y-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Start Time */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <Clock className="h-4 w-4 inline mr-1" />
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={preferences.quietHoursStart || ''}
                      onChange={(e) => updatePreference('quietHoursStart', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  {/* End Time */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <Clock className="h-4 w-4 inline mr-1" />
                      End Time
                    </label>
                    <input
                      type="time"
                      value={preferences.quietHoursEnd || ''}
                      onChange={(e) => updatePreference('quietHoursEnd', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Timezone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Timezone
                  </label>
                  <select
                    value={preferences.quietHoursTimezone || ''}
                    onChange={(e) => updatePreference('quietHoursTimezone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Select timezone...</option>
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-start gap-2 text-sm text-purple-800 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/40 p-3 rounded-lg">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <p>
                    During quiet hours, non-critical notifications will be held until the quiet period ends.
                    {preferences.quietHoursStart && preferences.quietHoursEnd && (
                      <> You'll receive notifications outside of {preferences.quietHoursStart} - {preferences.quietHoursEnd}.</>
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Future Features */}
          <div className="card bg-gray-50 dark:bg-slate-800/50">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-full flex items-center justify-center flex-shrink-0">
                <Shield className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Coming Soon</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 mb-3">
                  Additional notification channels will be available in future updates:
                </p>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full"></span>
                    SMS / Text Message Notifications
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full"></span>
                    Push Notifications (Mobile App)
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
            <button
              onClick={loadPreferences}
              className="btn btn-secondary"
              disabled={saving}
            >
              Reset
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Save Preferences
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* CeeCee Tab Content */}
      {activeTab === 'ceecee' && (
        <div className="space-y-6">
          {/* Auto-log Toggle */}
          <div className="card">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-teal-100 dark:bg-teal-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                  <BookOpen className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Auto-log Conversations</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Automatically log CeeCee conversations to your journal when you log out or at the end of each day.
                    This helps keep a record of care activities and discussions.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={preferences.ceeceeAutoLogEnabled}
                  onChange={(e) => updatePreference('ceeceeAutoLogEnabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 dark:peer-focus:ring-teal-900/50 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 dark:after:border-slate-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
              </label>
            </div>
          </div>

          {/* Visibility Settings */}
          {preferences.ceeceeAutoLogEnabled && (
            <div className="card">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                  <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Journal Entry Visibility</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Choose which family members can see your CeeCee conversation summaries in the journal.
                    By default, entries are private to you.
                  </p>
                </div>
              </div>

              <div className="space-y-3 mt-6">
                {/* Private option */}
                <label className="flex items-center p-3 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer">
                  <input
                    type="radio"
                    name="visibility"
                    checked={preferences.ceeceeLogVisibleTo.length === 0}
                    onChange={() => updatePreference('ceeceeLogVisibleTo', [])}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-slate-600"
                  />
                  <div className="ml-3">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Private to me only</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Only you can see your CeeCee conversation logs</p>
                  </div>
                </label>

                {/* Specific members option */}
                <div className="p-3 rounded-lg border border-gray-200 dark:border-slate-700">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="visibility"
                      checked={preferences.ceeceeLogVisibleTo.length > 0}
                      onChange={() => {
                        // If switching to specific members, select all by default
                        if (preferences.ceeceeLogVisibleTo.length === 0) {
                          const otherMembers = familyMembers
                            .filter(m => m.id !== currentUserId)
                            .map(m => m.id);
                          updatePreference('ceeceeLogVisibleTo', otherMembers);
                        }
                      }}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-slate-600"
                    />
                    <div className="ml-3">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Share with specific family members</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Select who can see your conversation logs</p>
                    </div>
                  </label>

                  {/* Family member checkboxes */}
                  {preferences.ceeceeLogVisibleTo.length > 0 && (
                    <div className="mt-4 ml-7 space-y-2">
                      {familyMembers
                        .filter(m => m.id !== currentUserId)
                        .map((member) => (
                          <label key={member.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={preferences.ceeceeLogVisibleTo.includes(member.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  updatePreference('ceeceeLogVisibleTo', [...preferences.ceeceeLogVisibleTo, member.id]);
                                } else {
                                  const newList = preferences.ceeceeLogVisibleTo.filter(id => id !== member.id);
                                  // If no one is selected, switch back to private
                                  if (newList.length === 0) {
                                    updatePreference('ceeceeLogVisibleTo', []);
                                  } else {
                                    updatePreference('ceeceeLogVisibleTo', newList);
                                  }
                                }
                              }}
                              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-slate-600 rounded"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {member.firstName} {member.lastName}
                              <span className="text-gray-400 dark:text-gray-500 ml-1 text-xs">
                                ({member.role.replace('_', ' ')})
                              </span>
                            </span>
                          </label>
                        ))}
                      {familyMembers.filter(m => m.id !== currentUserId).length === 0 && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic">No other family members to share with.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Info Card */}
          <div className="card bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-teal-800 dark:text-teal-300">How CeeCee Logging Works</h4>
                <ul className="text-sm text-teal-700 dark:text-teal-400 mt-2 space-y-1 list-disc list-inside">
                  <li>Conversations are summarized using AI and logged as journal entries</li>
                  <li>Logging happens when you log out or automatically at 11:00 PM daily</li>
                  <li>Summaries capture key topics and actions without including raw conversation text</li>
                  <li>You can manually log individual conversations from the chat interface</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
            <button
              onClick={loadPreferences}
              className="btn btn-secondary"
              disabled={saving}
            >
              Reset
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Save Preferences
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Appearance Tab Content */}
      {activeTab === 'appearance' && (
        <div className="space-y-6">
          {/* Theme Selection */}
          <div className="card">
            <div className="flex items-start gap-3 mb-6">
              <div className="w-10 h-10 bg-violet-100 dark:bg-violet-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                <Palette className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Theme</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Choose how CareCompanion looks to you. Select a single theme, or sync with your system settings.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Light Mode */}
              <button
                onClick={() => setTheme('light')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  theme === 'light'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-200 to-orange-300 flex items-center justify-center">
                    <Sun className="h-6 w-6 text-amber-600" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-gray-900 dark:text-gray-100">Light</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Clean and bright</p>
                  </div>
                  {theme === 'light' && (
                    <CheckCircle className="h-5 w-5 text-primary-500" />
                  )}
                </div>
              </button>

              {/* Dark Mode */}
              <button
                onClick={() => setTheme('dark')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  theme === 'dark'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
                    <Moon className="h-6 w-6 text-slate-300" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-gray-900 dark:text-gray-100">Dark</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Easy on the eyes</p>
                  </div>
                  {theme === 'dark' && (
                    <CheckCircle className="h-5 w-5 text-primary-500" />
                  )}
                </div>
              </button>

              {/* System */}
              <button
                onClick={() => setTheme('system')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  theme === 'system'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                    <Monitor className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-gray-900 dark:text-gray-100">System</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Match your device</p>
                  </div>
                  {theme === 'system' && (
                    <CheckCircle className="h-5 w-5 text-primary-500" />
                  )}
                </div>
              </button>
            </div>

            {theme === 'system' && (
              <div className="mt-4 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Currently using <span className="font-medium">{resolvedTheme === 'dark' ? 'dark' : 'light'} mode</span> based on your system settings.
                </p>
              </div>
            )}
          </div>

          {/* Info Card */}
          <div className="card bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-violet-600 dark:text-violet-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-violet-800 dark:text-violet-300">Theme Tip</h4>
                <p className="text-sm text-violet-700 dark:text-violet-400 mt-1">
                  You can also quickly toggle between light and dark mode using the button in the sidebar.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper component for notification toggles
interface NotificationToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  critical?: boolean;
  comingSoon?: boolean;
}

function NotificationToggle({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  critical = false,
  comingSoon = false,
}: NotificationToggleProps) {
  return (
    <div className="flex items-start justify-between py-3">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {label}
          </label>
          {critical && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
              Important
            </span>
          )}
          {comingSoon && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-400">
              Coming Soon
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{description}</p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-4">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled || comingSoon}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-900/50 rounded-full peer disabled:opacity-50 disabled:cursor-not-allowed peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 dark:after:border-slate-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
      </label>
    </div>
  );
}
