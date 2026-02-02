// src/pages/procurement/ProcurementDashboard.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ClipboardList, FileText, Receipt, PackageCheck, BadgeCheck, ScrollText } from 'lucide-react';

const procurementModules = [
  {
    title: 'Approvals',
    description: 'Review and take action on pending approvals',
    icon: BadgeCheck,
    path: '/procurement/approvals',
    color: 'bg-emerald-700',
  },
  {
    title: 'Summary Requests (SR)',
    description: 'Activity Plan summaries (snapshot) + status tracking',
    icon: ScrollText,
    path: '/procurement/summary',
    color: 'bg-indigo-500',
  },
  {
    title: 'Activity Plans',
    description: 'Create and manage activity plans',
    icon: ClipboardList,
    path: '/procurement/activity-plans',
    color: 'bg-indigo-600',
  },
  {
    title: 'Purchase Requests (PR)',
    description: 'Create and track purchase requests',
    icon: FileText,
    path: '/procurement/pr',
    color: 'bg-indigo-700',
  },
  {
    title: 'Purchase Orders (PO)',
    description: 'Manage purchase orders',
    icon: Receipt,
    path: '/procurement/po',
    color: 'bg-indigo-800',
  },
  {
    title: 'Goods Received (GRN)',
    description: 'Confirm goods receipt notes',
    icon: PackageCheck,
    path: '/procurement/grn',
    color: 'bg-indigo-900',
  },
];

export default function ProcurementDashboard() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                type="button"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>

              <div className="h-6 w-px bg-gray-200" />

              <h1 className="text-lg font-bold text-gray-900">Procurement</h1>
            </div>

            <div className="text-sm text-gray-500">
              Activity Plan → PR → (PO if required) → GRN
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {procurementModules.map((m) => (
            <div
              key={m.path}
              onClick={() => navigate(m.path)}
              className="bg-white rounded-lg shadow-lg cursor-pointer transition-transform hover:scale-105"
              role="button"
              tabIndex={0}
            >
              <div className="p-6">
                <div className={`inline-flex p-3 rounded-lg ${m.color}`}>
                  <m.icon className="h-6 w-6 text-white" />
                </div>

                <h3 className="mt-4 text-lg font-medium text-gray-900">{m.title}</h3>
                <p className="mt-2 text-sm text-gray-500">{m.description}</p>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
