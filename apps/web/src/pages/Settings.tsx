import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
  Loader2,
  CheckCircle,
  XCircle,
  Bell,
  Moon,
  Mail,
  Clock,
  Shield,
  AlertCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'notifications'>('notifications');

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const response = await api.get('/api/v1/users/notification-preferences', {
        headers: { Authorization: `Bearer ${token}` },
      });

      setPreferences(response.data.preferences);
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
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card bg-red-50 border border-red-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Failed to load preferences</h3>
              <p className="text-sm text-red-700 mt-1">Please try refreshing the page.</p>
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
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your account preferences and notification settings.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('notifications')}
            className={`
              pb-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${
                activeTab === 'notifications'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </div>
          </button>
        </nav>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-green-800">{successMessage}</p>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-green-600 hover:text-green-800"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-800">{errorMessage}</p>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-600 hover:text-red-800"
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
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Mail className="h-5 w-5 text-primary-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Email Notifications</h3>
                  <p className="text-sm text-gray-600 mt-1">
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
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>
          </div>

          {/* Notification Types */}
          <div className="card">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Bell className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Notification Types</h3>
                <p className="text-sm text-gray-600 mt-1">
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

              <div className="border-t border-gray-200 my-4"></div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-xs font-medium text-gray-700 mb-3">Optional Digests (Opt-in)</p>

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
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Moon className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Quiet Hours</h3>
                  <p className="text-sm text-gray-600 mt-1">
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
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer disabled:opacity-50 disabled:cursor-not-allowed peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            {preferences.quietHoursEnabled && (
              <div className="mt-6 space-y-4 p-4 bg-purple-50 rounded-lg border border-purple-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Start Time */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Clock className="h-4 w-4 inline mr-1" />
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={preferences.quietHoursStart || ''}
                      onChange={(e) => updatePreference('quietHoursStart', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  {/* End Time */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Clock className="h-4 w-4 inline mr-1" />
                      End Time
                    </label>
                    <input
                      type="time"
                      value={preferences.quietHoursEnd || ''}
                      onChange={(e) => updatePreference('quietHoursEnd', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Timezone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Timezone
                  </label>
                  <select
                    value={preferences.quietHoursTimezone || ''}
                    onChange={(e) => updatePreference('quietHoursTimezone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Select timezone...</option>
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-start gap-2 text-sm text-purple-800 bg-purple-100 p-3 rounded-lg">
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
          <div className="card bg-gray-50">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                <Shield className="h-5 w-5 text-gray-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-700">Coming Soon</h3>
                <p className="text-sm text-gray-600 mt-1 mb-3">
                  Additional notification channels will be available in future updates:
                </p>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                    SMS / Text Message Notifications
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                    Push Notifications (Mobile App)
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
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
          <label className="text-sm font-medium text-gray-900">
            {label}
          </label>
          {critical && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
              Important
            </span>
          )}
          {comingSoon && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
              Coming Soon
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600 mt-1">{description}</p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-4">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled || comingSoon}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer disabled:opacity-50 disabled:cursor-not-allowed peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
      </label>
    </div>
  );
}
