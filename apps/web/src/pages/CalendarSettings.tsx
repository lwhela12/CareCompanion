import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
  Loader2,
  CheckCircle,
  XCircle,
  Trash2,
  RefreshCw,
  Calendar as CalendarIcon,
  AlertCircle,
} from 'lucide-react';
import { api } from '@/lib/api';

interface CalendarConnection {
  id: string;
  provider: 'GOOGLE' | 'APPLE';
  calendarName: string | null;
  syncEnabled: boolean;
  syncEventTypes: string[];
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  user: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  createdAt: string;
}

export default function CalendarSettings() {
  const { getToken } = useAuth();
  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [connectionToDelete, setConnectionToDelete] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadConnections();

    // Check for success/error messages from OAuth callback
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      setSuccessMessage('Calendar connected successfully!');
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
      // Reload connections
      setTimeout(loadConnections, 500);
    } else if (params.get('error')) {
      setErrorMessage('Failed to connect calendar. Please try again.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const loadConnections = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const response = await api.get('/api/v1/calendar/connections', {
        headers: { Authorization: `Bearer ${token}` },
      });

      setConnections(response.data.connections || []);
    } catch (error) {
      console.error('Error loading connections:', error);
      setErrorMessage('Failed to load calendar connections');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGoogle = async () => {
    try {
      const token = await getToken();
      const response = await api.get('/api/v1/calendar/auth/google', {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Redirect to Google OAuth
      window.location.href = response.data.authUrl;
    } catch (error) {
      console.error('Error initiating Google OAuth:', error);
      setErrorMessage('Failed to connect to Google Calendar');
    }
  };

  const handleUpdateEventTypes = async (
    connectionId: string,
    eventType: string,
    checked: boolean
  ) => {
    try {
      const token = await getToken();
      const connection = connections.find((c) => c.id === connectionId);
      if (!connection) return;

      const newEventTypes = checked
        ? [...connection.syncEventTypes, eventType]
        : connection.syncEventTypes.filter((t) => t !== eventType);

      await api.put(
        `/api/v1/calendar/connections/${connectionId}`,
        { syncEventTypes: newEventTypes },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      await loadConnections();
      setSuccessMessage('Event types updated successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error updating event types:', error);
      setErrorMessage('Failed to update event types');
    }
  };

  const handleToggleSync = async (connectionId: string, enabled: boolean) => {
    try {
      const token = await getToken();
      await api.put(
        `/api/v1/calendar/connections/${connectionId}`,
        { syncEnabled: enabled },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      await loadConnections();
      setSuccessMessage(enabled ? 'Sync enabled' : 'Sync disabled');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error toggling sync:', error);
      setErrorMessage('Failed to toggle sync');
    }
  };

  const handleManualSync = async (connectionId: string) => {
    try {
      setSyncing(connectionId);
      const token = await getToken();
      await api.post(
        `/api/v1/calendar/connections/${connectionId}/sync`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      await loadConnections();
      setSuccessMessage('Calendar synced successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error syncing:', error);
      setErrorMessage('Failed to sync calendar');
    } finally {
      setSyncing(null);
    }
  };

  const handleDeleteConnection = async () => {
    if (!connectionToDelete) return;

    try {
      const token = await getToken();
      await api.delete(`/api/v1/calendar/connections/${connectionToDelete}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      await loadConnections();
      setSuccessMessage('Calendar disconnected successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
      setDeleteDialogOpen(false);
      setConnectionToDelete(null);
    } catch (error) {
      console.error('Error deleting connection:', error);
      setErrorMessage('Failed to disconnect calendar');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Calendar Integration</h1>
        <p className="mt-1 text-sm text-gray-500">
          Connect your Google or Apple Calendar to automatically sync appointments,
          medications, and care tasks.
        </p>
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

      {/* No Connections State */}
      {connections.length === 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No calendars connected
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Connect a calendar to automatically sync your care events to your personal
            calendar.
          </p>
          <button onClick={handleConnectGoogle} className="btn-primary inline-flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Connect Google Calendar
          </button>
        </div>
      )}

      {/* Connections List */}
      {connections.map((connection) => (
        <div key={connection.id} className="card">
          {/* Connection Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <CalendarIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {connection.calendarName || 'Google Calendar'}
                </h3>
                {connection.syncEnabled && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full mt-1">
                    <CheckCircle className="h-3 w-3" />
                    Active
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                setConnectionToDelete(connection.id);
                setDeleteDialogOpen(true);
              }}
              className="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>

          {/* Connection Info */}
          {connection.user && (
            <p className="text-sm text-gray-600 mb-2">
              Connected by: {connection.user.firstName} {connection.user.lastName}
            </p>
          )}

          {connection.lastSyncAt && (
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
              <span>Last synced: {new Date(connection.lastSyncAt).toLocaleString()}</span>
              {connection.lastSyncStatus === 'error' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                  <XCircle className="h-3 w-3" />
                  Sync Error
                </span>
              )}
            </div>
          )}

          <hr className="my-4 border-gray-200" />

          {/* Event Types */}
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Sync Event Types:</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={connection.syncEventTypes.includes('MEDICATION')}
                  onChange={(e) =>
                    handleUpdateEventTypes(connection.id, 'MEDICATION', e.target.checked)
                  }
                  className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Medications</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={connection.syncEventTypes.includes('CARE_TASK')}
                  onChange={(e) =>
                    handleUpdateEventTypes(connection.id, 'CARE_TASK', e.target.checked)
                  }
                  className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Care Tasks</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={connection.syncEventTypes.includes('APPOINTMENT')}
                  onChange={(e) =>
                    handleUpdateEventTypes(connection.id, 'APPOINTMENT', e.target.checked)
                  }
                  className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Appointments</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => handleToggleSync(connection.id, !connection.syncEnabled)}
              className="btn-secondary text-sm"
            >
              {connection.syncEnabled ? 'Disable Sync' : 'Enable Sync'}
            </button>
            <button
              onClick={() => handleManualSync(connection.id)}
              disabled={syncing === connection.id || !connection.syncEnabled}
              className="btn-primary text-sm inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {syncing === connection.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sync Now
            </button>
          </div>
        </div>
      ))}

      {/* Add Another Calendar Button */}
      {connections.length > 0 && (
        <button
          onClick={handleConnectGoogle}
          className="btn-secondary w-full inline-flex items-center justify-center gap-2"
        >
          <CalendarIcon className="h-5 w-5" />
          Connect Another Calendar
        </button>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={() => setDeleteDialogOpen(false)}
            />

            {/* Dialog */}
            <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Disconnect Calendar?
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to disconnect this calendar? This will stop syncing
                events to the calendar.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDeleteDialogOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button onClick={handleDeleteConnection} className="btn-danger">
                  Disconnect
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
