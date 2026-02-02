import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  CalendarCheck,
  Settings,
  UserPlus,
  FileText,
  Shield,
  Database,
  Clock,
  Building2,
  Briefcase,
  Calendar,
  Bell,
  Workflow,
  GitBranch,
  Wallet,
  HandCoins,
  Layers,
  FolderKanban
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const adminModules = [
  {
    title: 'Employee Management',
    description: 'Add, edit, and manage employee information',
    icon: Users,
    path: '/admin/employees',
    color: 'bg-blue-500',
    items: [
      { name: 'Add Employee', icon: UserPlus },
      { name: 'Manage Employees', icon: FileText }
    ]
  },
  {
    title: 'Leave Management',
    description: 'Configure leave policies and handle requests',
    icon: CalendarCheck,
    path: '/admin/leave',
    color: 'bg-green-500',
    items: [
      { name: 'Leave Settings', icon: Settings },
      { name: 'Leave Requests', icon: FileText }
    ]
  },
  {
    title: 'Attendance Management',
    description: 'Monitor and manage employee attendance',
    icon: Clock,
    path: '/admin/attendance',
    color: 'bg-purple-500',
    items: [
      { name: 'Attendance Records', icon: FileText },
      { name: 'Location Settings', icon: Settings }
    ]
  },
  {
    title: 'Departments & Positions',
    description: 'Manage organizational structure and job positions',
    icon: Building2,
    path: '/admin/departments',
    color: 'bg-indigo-500',
    items: [
      { name: 'Departments', icon: Building2 },
      { name: 'Job Positions', icon: Briefcase }
    ]
  },
  {
    title: 'Office Holidays',
    description: 'Manage office-specific holidays and closures',
    icon: Calendar,
    path: '/admin/office-holidays',
    color: 'bg-orange-500',
    items: [
      { name: 'Holiday Calendar', icon: Calendar },
      { name: 'Holiday Settings', icon: Settings }
    ]
  },
  {
    title: 'Notification Monitoring',
    description: 'Monitor and track notification delivery status',
    icon: Bell,
    path: '/admin/notifications',
    color: 'bg-yellow-500',
    items: [
      { name: 'Delivery Status', icon: FileText },
      { name: 'Email Logs', icon: Settings }
    ]
  },
  {
    title: 'Programs Settings',
    description: 'Configure programs, categories and related settings',
    icon: Layers,
    path: '/admin/programs-settings',
    color: 'bg-fuchsia-600',
    items: [
      { name: 'Programs', icon: FileText },
      { name: 'Programs Settings', icon: Settings }
    ]
  },
  {
    title: 'Payroll Settings',
    description: 'Manage salary rules, allowances, deductions and payroll setup',
    icon: Wallet,
    path: '/admin/payroll',
    color: 'bg-emerald-600',
    items: [
      { name: 'Payroll Configuration', icon: Settings },
      { name: 'Salary Rules', icon: FileText }
    ]
  },
  {
    title: 'Salary Advance Settings',
    description: 'Manage advance limits, policies and approval settings',
    icon: HandCoins,
    path: '/admin/salary-advance-settings',
    color: 'bg-amber-500',
    items: [
      { name: 'Advance Policy', icon: Settings },
      { name: 'Advance Rules', icon: FileText }
    ]
  },
  {
    title: 'Approval System',
    description: 'Manage approval workflows and processes',
    icon: GitBranch,
    path: '/admin/approvals',
    color: 'bg-teal-500',
    items: [
      { name: 'Approval Dashboard', icon: Workflow },
      { name: 'Workflow Builder', icon: Settings }
    ]
  },
  {
    title: 'Approval Settings',
    description: 'Configure approval pages, roles and permissions',
    icon: Shield,
    path: '/admin/approval-settings',
    color: 'bg-cyan-500',
    items: [
      { name: 'Pages & Workflows', icon: Settings },
      { name: 'Roles & Permissions', icon: Users }
    ]
  },
  {
    title: 'System Settings',
    description: 'Manage system-wide configurations',
    icon: Database,
    path: '/admin/system',
    color: 'bg-red-500',
    items: [
      { name: 'General Settings', icon: Settings },
      { name: 'User Management', icon: Users }
    ]
  },
  {
    title: 'Project Management',
    description: 'Manage projects and their activities',
    icon: FolderKanban,
    path: '/admin/projects',
    color: 'bg-orange-500',
    items: [
      { name: 'View Projects', icon: FileText },
      { name: 'Project Settings', icon: Settings }
    ]
  }
];

export default function AdminSettings() {
  const navigate = useNavigate();
  const { isAdmin } = useAuthStore();

  if (!isAdmin) {
    navigate('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Dashboard
          </button>
        </div>

        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">Admin Settings</h2>
            <p className="mt-1 text-sm text-gray-500">
              Manage system-wide settings and configurations
            </p>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {adminModules.map((module) => (
                <div
                  key={module.path}
                  onClick={() => navigate(module.path)}
                  className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden cursor-pointer"
                >
                  <div className="p-6">
                    <div className={`inline-flex p-3 rounded-lg ${module.color}`}>
                      <module.icon className="h-6 w-6 text-white" />
                    </div>

                    <h3 className="mt-4 text-lg font-medium text-gray-900">
                      {module.title}
                    </h3>

                    <p className="mt-2 text-sm text-gray-500">
                      {module.description}
                    </p>

                    <div className="mt-4 space-y-2">
                      {module.items.map((item, index) => (
                        <div key={index} className="flex items-center text-sm text-gray-600">
                          <item.icon className="h-4 w-4 mr-2" />
                          {item.name}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
