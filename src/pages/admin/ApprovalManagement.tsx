import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  RefreshCw,
  Workflow,
  BarChart3,
  Trash2,
} from 'lucide-react';
import { ApprovalService } from '../../services/approvalService';
import { useApprovalSystem, useApprovalWorkflows } from '../../hooks/useApprovalSystem';
import ApprovalDashboard from '../../components/ApprovalSystem/ApprovalDashboard';
import WorkflowBuilder from '../../components/ApprovalSystem/WorkflowBuilder';
import { ApprovalPage } from '../../types/approval';

type Tab = 'dashboard' | 'workflows' | 'statistics';

const ApprovalManagement: React.FC = () => {
  const navigate = useNavigate();

  /** Global approval statistics */
  const { statistics, refresh } = useApprovalSystem();

  /** Tabs */
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  /** Pages (entities like Timesheet, Leave, etc.) */
  const [pages, setPages] = useState<ApprovalPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string>('');

  /** Workflows for selected page */
  const {
    workflows,
    loading: workflowsLoading,
    refresh: refreshWorkflows,
  } = useApprovalWorkflows(selectedPageId);

  /** UI state */
  const [showWorkflowBuilder, setShowWorkflowBuilder] = useState(false);
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null); // ← Added (A)
  const [loadingPages, setLoadingPages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  /* ----------------------------------
   * Load approval pages on mount
   * ---------------------------------- */
  useEffect(() => {
    loadPages();
    refresh(); // load dashboard stats
  }, []);

  const loadPages = async () => {
    try {
      setLoadingPages(true);
      setError(null);
      const response = await ApprovalService.getPages();
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to load approval pages');
      }
      setPages(response.data);
      // Auto-select first page if available
      if (response.data.length > 0) {
        setSelectedPageId(response.data[0].id);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingPages(false);
    }
  };

  /* ----------------------------------
   * Workflow actions
   * ---------------------------------- */
  const handleWorkflowSaved = () => {
    setShowWorkflowBuilder(false);
    setEditingWorkflowId(null);
    setSuccess('Workflow saved successfully');
    refreshWorkflows();
    refresh();
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return;

    try {
      const response = await ApprovalService.deleteWorkflow(workflowId);
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete workflow');
      }
      setSuccess('Workflow deleted successfully');
      refreshWorkflows();
      refresh();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  /* ----------------------------------
   * Render
   * ---------------------------------- */
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <button
              onClick={() => navigate('/admin/settings')}
              className="flex items-center text-gray-600 hover:text-gray-900 mb-2"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Settings
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Approval Management</h1>
            <p className="text-gray-600">Manage approval workflows and monitor system activity</p>
          </div>
          <button
            onClick={refresh}
            className="flex items-center px-4 py-2 bg-white border rounded-lg hover:bg-gray-100"
          >
            <RefreshCw className="h-5 w-5 mr-2" />
            Refresh
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {success}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 mb-8">
          <TabButton
            active={activeTab === 'dashboard'}
            onClick={() => setActiveTab('dashboard')}
            label="Dashboard"
            icon={BarChart3}
          />
          <TabButton
            active={activeTab === 'workflows'}
            onClick={() => setActiveTab('workflows')}
            label="Workflows"
            icon={Workflow}
          />
          <TabButton
            active={activeTab === 'statistics'}
            onClick={() => setActiveTab('statistics')}
            label="Statistics"
            icon={BarChart3}
          />
        </div>

        {/* Content */}
        {activeTab === 'dashboard' && <ApprovalDashboard />}
        {activeTab === 'statistics' && <ApprovalDashboard showStatisticsOnly />}
        
        {activeTab === 'workflows' && (
          <div className="space-y-6">
            {/* Page selector */}
            <div className="bg-white p-6 rounded-lg border">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Workflows</h2>
                <button
                  onClick={() => {
                    setEditingWorkflowId(null);
                    setShowWorkflowBuilder(true);
                  }}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Workflow
                </button>
              </div>

              {loadingPages ? (
                <p>Loading pages…</p>
              ) : (
                <select
                  value={selectedPageId}
                  onChange={(e) => setSelectedPageId(e.target.value)}
                  className="border rounded-lg px-3 py-2"
                >
                  {pages.map((page) => (
                    <option key={page.id} value={page.id}>
                      {page.display_name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Workflow list */}
            <div className="bg-white p-6 rounded-lg border">
              {workflowsLoading ? (
                <p>Loading workflows…</p>
              ) : workflows.length === 0 ? (
                <p className="text-gray-600">No workflows found for this page.</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-gray-500">
                      <th>Name</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {workflows.map((wf) => (
                      <tr key={wf.id} className="border-t">
                        <td className="py-2">{wf.workflow_name}</td>
                        <td>{wf.workflow_type}</td>
                        <td>{wf.is_active ? 'Active' : 'Inactive'}</td>
                        <td className="text-right flex justify-end gap-3">
                          {/* ← Modified (B) */}
                          <button
                            onClick={() => {
                              setEditingWorkflowId(wf.id);
                              setShowWorkflowBuilder(true);
                            }}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteWorkflow(wf.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Workflow Builder Modal */}
      {showWorkflowBuilder && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-xl shadow-2xl overflow-hidden">
            <WorkflowBuilder
              pageId={selectedPageId}
              workflowId={editingWorkflowId || undefined}           // ← Modified (C)
              onSave={() => {
                setShowWorkflowBuilder(false);
                setEditingWorkflowId(null);
                refreshWorkflows();
                refresh();
              }}
              onCancel={() => {
                setShowWorkflowBuilder(false);
                setEditingWorkflowId(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

/* ----------------------------------
 * Small reusable tab button
 * ---------------------------------- */
const TabButton = ({
  active,
  onClick,
  label,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ElementType;
}) => (
  <button
    onClick={onClick}
    className={`flex items-center px-4 py-2 rounded-lg border ${
      active
        ? 'bg-blue-100 text-blue-800 border-blue-300'
        : 'bg-white text-gray-600 hover:bg-gray-100'
    }`}
  >
    <Icon className="h-5 w-5 mr-2" />
    {label}
  </button>
);

export default ApprovalManagement;