import { Outlet, NavLink } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
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
  LogOut,
  Sun,
  Moon,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useLogout } from '@/hooks/useLogout';
import { useTheme } from '@/providers/ThemeProvider';
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
  const { user } = useUser();
  const { handleLogout, isLoggingOut } = useLogout();
  const { resolvedTheme, toggleTheme } = useTheme();

  if (isChecking) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-900/50 dark:bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Floating mobile menu button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-30 p-2 rounded-lg bg-white dark:bg-slate-800 shadow-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 shadow-lg dark:shadow-slate-950/50 transform transition-transform duration-300 lg:translate-x-0 border-r border-gray-200 dark:border-slate-800',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-6 border-b border-gray-200 dark:border-slate-800">
            <h1 className="text-xl font-bold text-primary-600 dark:text-primary-400">CareCompanion</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 overflow-y-auto">
            <ul className="space-y-1">
              {navigation.map((item) => (
                <li key={item.name}>
                  <NavLink
                    to={item.href}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors',
                        isActive
                          ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-gray-200'
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
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Dev Tools
                  </p>
                </div>
                <ul className="space-y-1">
                  {devNavigation.map((item) => (
                    <li key={item.name}>
                      <NavLink
                        to={item.href}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors',
                            isActive
                              ? 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-gray-200'
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
          <div className="border-t border-gray-200 dark:border-slate-800 p-4">
            <div className="flex items-center gap-3 px-4 py-2">
              {user?.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt="Profile"
                  className="h-8 w-8 rounded-full"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                    {user?.firstName?.[0] || 'U'}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {user?.primaryEmailAddress?.emailAddress}
                </p>
              </div>
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="mt-2 w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-gray-200 rounded-lg transition-colors"
              aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {resolvedTheme === 'dark' ? (
                <>
                  <Sun className="h-4 w-4" />
                  <span>Light mode</span>
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4" />
                  <span>Dark mode</span>
                </>
              )}
            </button>

            {/* Sign out */}
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="mt-1 w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              {isLoggingOut ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Signing out...</span>
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4" />
                  <span>Sign out</span>
                </>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Page content */}
        <main className="p-4 sm:p-6 pt-16 lg:pt-6">
          <ErrorBoundary fallbackType="inline">
            <Outlet />
          </ErrorBoundary>
        </main>
        <ChatWidget />
      </div>
    </div>
  );
}
