import { 
  Plus, 
  Calendar, 
  BarChart2, 
  FileText, 
  Pill,
  Moon,
  Users,
  TrendingUp,
  Clock,
  CheckCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

const quickActions = [
  {
    icon: Plus,
    title: 'Quick Entry',
    subtitle: 'Log medication or note',
    color: 'primary',
  },
  {
    icon: Calendar,
    title: "Today's Schedule",
    subtitle: '3 tasks, 2 appointments',
    color: 'primary',
  },
  {
    icon: BarChart2,
    title: 'View Insights',
    subtitle: 'Weekly patterns & trends',
    color: 'primary',
  },
  {
    icon: FileText,
    title: 'Upload Document',
    subtitle: 'Medical records & more',
    color: 'primary',
  },
];

const statusCards = [
  {
    title: 'Medication Adherence',
    value: '94%',
    subtitle: 'This week',
    trend: '+3% from last week',
    trendType: 'up',
    icon: Pill,
  },
  {
    title: 'Sleep Quality',
    value: 'Good',
    subtitle: 'Last 3 nights',
    trend: 'Improving pattern',
    trendType: 'up',
    icon: Moon,
  },
  {
    title: 'Family Visits',
    value: '12',
    subtitle: 'This week',
    trend: 'Well distributed',
    trendType: 'up',
    icon: Users,
  },
];

const recentActivity = [
  {
    time: '30 minutes ago',
    title: 'Morning medications given',
    description: 'Aricept 10mg, Metformin 500mg - taken with breakfast',
  },
  {
    time: '8:00 AM',
    title: 'Good morning mood',
    description: 'Mom woke up refreshed, recognized everyone, ate full breakfast',
  },
  {
    time: 'Yesterday, 7:30 PM',
    title: 'Evening confusion episode',
    description: 'Brief disorientation about the day, resolved after reassurance',
  },
  {
    time: 'Yesterday, 2:00 PM',
    title: 'Physical therapy completed',
    description: '45-minute session, good participation, balance improving',
  },
];

const todaysMedications = [
  {
    time: '8:00 AM',
    name: 'Aricept',
    dose: '10mg - Memory support',
    status: 'given',
  },
  {
    time: '8:00 AM',
    name: 'Metformin',
    dose: '500mg - Diabetes',
    status: 'given',
  },
  {
    time: '2:00 PM',
    name: 'Lisinopril',
    dose: '10mg - Blood pressure',
    status: 'pending',
  },
  {
    time: '8:00 PM',
    name: 'Metformin',
    dose: '500mg - Diabetes',
    status: 'pending',
  },
];

export function Dashboard() {
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';
  const userName = 'Sarah'; // This would come from user context
  const date = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{greeting}, {userName}</h1>
        <p className="mt-1 text-lg text-gray-600">
          {date} • Mom had a good night
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {quickActions.map((action) => (
          <button
            key={action.title}
            className="flex items-center gap-4 p-5 bg-white rounded-xl border-2 border-gray-200 hover:border-primary-500 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200"
          >
            <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <action.icon className="h-6 w-6 text-primary-600" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-900">{action.title}</h3>
              <p className="text-sm text-gray-500">{action.subtitle}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {statusCards.map((card) => (
          <div key={card.title} className="card hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200">
            <div className="flex items-start justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                {card.title}
              </span>
              <card.icon className="h-5 w-5 text-gray-400" />
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{card.value}</div>
            <div className="text-sm text-gray-500 mb-3">{card.subtitle}</div>
            <div className={cn(
              'inline-flex items-center gap-1 text-sm font-semibold px-3 py-1 rounded-full',
              card.trendType === 'up' && 'text-success bg-success-light'
            )}>
              <TrendingUp className="h-4 w-4" />
              {card.trend}
            </div>
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Activity - Takes 2 columns */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Recent Activity</h2>
              <a href="#" className="text-sm font-medium text-primary-600 hover:text-primary-700">
                View all →
              </a>
            </div>
            
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />
              
              {/* Timeline items */}
              <div className="space-y-6">
                {recentActivity.map((item, index) => (
                  <div key={index} className="relative flex gap-4">
                    <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center">
                      <div className="w-4 h-4 bg-white rounded-full border-[3px] border-primary-500 z-10" />
                    </div>
                    <div className="flex-1 pb-6">
                      <div className="text-sm text-gray-500 mb-1">{item.time}</div>
                      <div className="bg-gray-50 rounded-xl p-4">
                        <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                        <p className="text-sm text-gray-600">{item.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Today's Medications */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Today's Medications</h2>
            <a href="#" className="text-sm font-medium text-primary-600 hover:text-primary-700">
              Manage →
            </a>
          </div>
          
          <div className="space-y-3">
            {todaysMedications.map((med, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-primary-50 cursor-pointer transition-colors"
              >
                <div className="text-sm font-semibold text-primary-600 min-w-[60px]">
                  {med.time}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 text-sm">{med.name}</div>
                  <div className="text-xs text-gray-500">{med.dose}</div>
                </div>
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center',
                  med.status === 'given' ? 'bg-success text-white' : 'bg-gray-200'
                )}>
                  {med.status === 'given' && <CheckCircle className="h-5 w-5" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}