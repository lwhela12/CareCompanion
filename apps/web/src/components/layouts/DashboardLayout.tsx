import { Outlet, NavLink } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import {
  Home,
  Users,
  Pill,
  Book,
  Users2,
  Calendar,
  FileText,
  Menu,
  X,
  Loader2,
  Code,
  ClipboardList,
  Stethoscope,
  Utensils,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useOnboarding } from '@/hooks/useOnboarding';
import { ChatWidget } from '@/components/ChatWidget';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Recommendations', href: '/recommendations', icon: ClipboardList },
  { name: 'Providers', href: '/providers', icon: Stethoscope },
  { name: 'Medications', href: '/medications', icon: Pill },
  { name: 'Nutrition', href: '/nutrition', icon: Utensils },
  { name: 'Journal', href: '/journal', icon: Book },
  { name: 'Documents', href: '/documents', icon: FileText },
  { name: 'Facts', href: '/facts', icon: FileText },
  { name: 'Calendar', href: '/calendar', icon: Calendar },
  { name: 'Family', href: '/family', icon: Users2 },
  { name: 'Settings', href: '/settings', icon: SettingsIcon },
];

const devNavigation = [
  { name: 'Dev: Invitations', href: '/dev/invitations', icon: Code },
];

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isChecking } = useOnboarding();

  if (isChecking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-900/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-6 border-b">
            <h1 className="text-xl font-bold text-primary-600">CareCompanion</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-500 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6">
            <ul className="space-y-2">
              {navigation.map((item) => (
                <li key={item.name}>
                  <NavLink
                    to={item.href}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors',
                        isActive
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      )
                    }
                  >
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </NavLink>
                </li>
              ))}
            </ul>

            {/* Dev Tools Section */}
            {import.meta.env.DEV && (
              <div className="mt-8">
                <div className="px-4 mb-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Dev Tools
                  </p>
                </div>
                <ul className="space-y-2">
                  {devNavigation.map((item) => (
                    <li key={item.name}>
                      <NavLink
                        to={item.href}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors',
                            isActive
                              ? 'bg-yellow-50 text-yellow-700'
                              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                          )
                        }
                      >
                        <item.icon className="h-5 w-5" />
                        {item.name}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </nav>

          {/* User section */}
          <div className="border-t p-4">
            <div className="flex items-center gap-3 px-4 py-3">
              <UserButton afterSignOutUrl="/sign-in" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">Account</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white border-b">
          <div className="flex h-16 items-center gap-4 px-4 sm:px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-500 hover:text-gray-700"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-800">
                Welcome back
              </h2>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6">
          <ErrorBoundary fallbackType="inline">
            <Outlet />
          </ErrorBoundary>
        </main>
        <ChatWidget />
      </div>
    </div>
  );
}
