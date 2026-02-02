// src/pages/Dashboard.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserCircle,
  Calendar,
  Clock,
  FileClock,
  Wallet,
  HandCoins,
  GitBranch,
  PackageCheck,
  Settings,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import NotificationBell from '../components/NotificationBell';
import SettingsButton from '../components/SettingsButton';
import OptimizedImage from '../components/OptimizedImage';
import EmailStatusIndicator from '../components/EmailStatusIndicator';

const modules = [
  {
    title: 'Personal Information',
    icon: UserCircle,
    path: '/personal-info',
    color: 'bg-blue-500',
  },
  {
    title: 'Vacation Management',
    icon: Calendar,
    path: '/vacation',
    color: 'bg-green-500',
  },
  {
    title: 'Attendance Tracking',
    icon: Clock,
    path: '/attendance',
    color: 'bg-purple-500',
  },
  {
    title: 'Timesheet',
    icon: FileClock,
    path: '/timesheet',
    color: 'bg-teal-500',
  },
  {
    title: 'Payroll',
    icon: Wallet,
    path: '/payroll',
    color: 'bg-emerald-600',
  },
  {
    title: 'Salary Advance Request',
    icon: HandCoins,
    path: '/salary-advance',
    color: 'bg-yellow-500',
  },
  {
    title: 'Office Holidays',
    icon: Calendar,
    path: '/office-holidays',
    color: 'bg-orange-500',
  },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuthStore();

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">
                HRMS Dashboard
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              <NotificationBell />
              <SettingsButton />

              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 rounded-full overflow-hidden bg-gray-100">
                  {user?.user_metadata?.profile_image_url ||
                  user?.user_metadata?.avatar_url ? (
                    <OptimizedImage
                      src={
                        user.user_metadata.profile_image_url ||
                        user.user_metadata.avatar_url
                      }
                      alt="Profile"
                      width={32}
                      height={32}
                      className="h-8 w-8 object-cover"
                    />
                  ) : (
                    <div className="h-8 w-8 bg-blue-100 flex items-center justify-center">
                      <span className="text-blue-600 text-sm font-medium">
                        {user?.email?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <span className="text-gray-700 text-sm">{user?.email}</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => (
            <div
              key={module.path}
              onClick={() => navigate(module.path)}
              className="bg-white rounded-lg shadow-lg cursor-pointer transition-transform hover:scale-105"
            >
              <div className="p-6">
                <div className={`inline-flex p-3 rounded-lg ${module.color}`}>
                  <module.icon className="h-6 w-6 text-white" />
                </div>

                <h3 className="mt-4 text-lg font-medium text-gray-900">
                  {module.title}
                </h3>

                <p className="mt-2 text-sm text-gray-500">
                  Manage your {module.title.toLowerCase()}
                </p>
              </div>
            </div>
          ))}

          {/* Admin Settings */}
          {isAdmin && (
            <div
              onClick={() => navigate('/admin/settings')}
              className="bg-white rounded-lg shadow-lg cursor-pointer transition-transform hover:scale-105"
            >
              <div className="p-6">
                <div className="inline-flex p-3 rounded-lg bg-gray-600">
                  <Settings className="h-6 w-6 text-white" />
                </div>

                <h3 className="mt-4 text-lg font-medium text-gray-900">
                  Admin Settings
                </h3>

                <p className="mt-2 text-sm text-gray-500">
                  Manage system configurations
                </p>
              </div>
            </div>
          )}

          {/* Admin Procurement Masters */}
          {isAdmin && (
            <div
              onClick={() => navigate('/admin/procurement')}
              className="bg-white rounded-lg shadow-lg cursor-pointer transition-transform hover:scale-105"
            >
              <div className="p-6">
                <div className="inline-flex p-3 rounded-lg bg-gray-800">
                  <Settings className="h-6 w-6 text-white" />
                </div>

                <h3 className="mt-4 text-lg font-medium text-gray-900">
                  Procurement Admin
                </h3>

                <p className="mt-2 text-sm text-gray-500">
                  Exchange rates, routes, hotels, services, thresholds
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      <EmailStatusIndicator />
    </div>
  );
}
