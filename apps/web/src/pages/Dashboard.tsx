import { Activity, Users, Pill, AlertCircle } from 'lucide-react';

const stats = [
  {
    name: 'Active Patients',
    value: '2',
    icon: Users,
    change: '+1 this month',
    changeType: 'positive',
  },
  {
    name: 'Medications Today',
    value: '8',
    icon: Pill,
    change: '95% adherence',
    changeType: 'positive',
  },
  {
    name: 'Care Tasks',
    value: '5',
    icon: Activity,
    change: '2 pending',
    changeType: 'neutral',
  },
  {
    name: 'Active Alerts',
    value: '1',
    icon: AlertCircle,
    change: 'Requires attention',
    changeType: 'negative',
  },
];

export function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Overview of your family's care status
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.name} className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {stat.value}
                </p>
                <p
                  className={cn(
                    'mt-2 text-sm',
                    stat.changeType === 'positive' && 'text-success',
                    stat.changeType === 'negative' && 'text-error',
                    stat.changeType === 'neutral' && 'text-gray-500'
                  )}
                >
                  {stat.change}
                </p>
              </div>
              <div
                className={cn(
                  'p-3 rounded-lg',
                  stat.changeType === 'positive' && 'bg-success-light',
                  stat.changeType === 'negative' && 'bg-error-light',
                  stat.changeType === 'neutral' && 'bg-gray-100'
                )}
              >
                <stat.icon
                  className={cn(
                    'h-6 w-6',
                    stat.changeType === 'positive' && 'text-success-dark',
                    stat.changeType === 'negative' && 'text-error-dark',
                    stat.changeType === 'neutral' && 'text-gray-600'
                  )}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent activity placeholder */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Recent Activity
        </h2>
        <div className="space-y-4">
          <p className="text-gray-500">Activity feed coming soon...</p>
        </div>
      </div>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}