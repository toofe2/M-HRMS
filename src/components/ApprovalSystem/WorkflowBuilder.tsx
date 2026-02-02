import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Save,
  ArrowRight,
  ChevronUp,
  ChevronDown,
  User,
  AlertTriangle,
} from 'lucide-react';
import { ApprovalService } from '../../services/approvalService';
import { ApprovalWorkflowConfig, ApprovalPage } from '../../types/approval';
import { supabase } from '../../lib/supabase';

interface WorkflowBuilderProps {
  pageId?: string;
  workflowId?: string; // Optional: for edit mode
  onSave?: (workflowId: string) => void;
  onCancel?: () => void;
}

interface WorkflowStep {
  step_order: number;
  step_name: string;
  approver_type: 'user' | 'manager';
  approver_id?: string;
  approver_criteria?: Record<string, any>;
  required_approvals: number;
  auto_approve_after_hours?: number;
  escalation_after_hours?: number;
  escalation_to?: string;
  conditions?: Record<string, any>;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export function validateWorkflow(config: ApprovalWorkflowConfig): string[] {
  const errors: string[] = [];

  if (!config.workflow_name.trim()) {
    errors.push('Workflow name is required');
  }

  if (!config.page_id) {
    errors.push('Please select a page');
  }

  config.steps.forEach((step: any) => {
    if (!step.step_name?.trim()) {
      errors.push(`Step ${step.step_order}: Name is required`);
    }

    // Only require approver_id when type is 'user'
    if (step.approver_type === 'user' && !step.approver_id) {
      errors.push(`Step ${step.step_order}: Please select a specific user`);
    }

    if ((step.required_approvals ?? 1) < 1) {
      errors.push(`Step ${step.step_order}: Required approvals must be at least 1`);
    }

    if (
      step.auto_approve_after_hours &&
      step.escalation_after_hours &&
      step.auto_approve_after_hours >= step.escalation_after_hours
    ) {
      errors.push(`Step ${step.step_order}: Escalation must occur before auto-approval`);
    }
  });

  return errors;
}

export default function WorkflowBuilder({
  pageId,
  workflowId,
  onSave,
  onCancel,
}: WorkflowBuilderProps) {
  const [pages, setPages] = useState<ApprovalPage[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [workflowConfig, setWorkflowConfig] = useState<ApprovalWorkflowConfig>({
    id: workflowId || undefined,
    page_id: pageId || '',
    workflow_name: '',
    workflow_type: 'sequential',
    conditions: {},
    is_default: false,
    steps: [
      {
        step_order: 1,
        step_name: 'Step 1',
        approver_type: 'user',
        required_approvals: 1,
      } as any,
    ],
  });

  const [expandedSteps, setExpandedSteps] = useState<number[]>([0]);

  useEffect(() => {
    fetchInitialData();
    if (workflowId) {
      fetchExistingWorkflow(workflowId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);

      // Fetch pages
      const pagesResponse = await ApprovalService.getPages();
      if (pagesResponse.success && pagesResponse.data) {
        setPages(pagesResponse.data);
      }

      // Fetch employees (for user selection)
      const { data: employeesData, error: empErr } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .order('first_name');

      if (empErr) throw empErr;

      setEmployees(employeesData || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load initial data');
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingWorkflow = async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await ApprovalService.getWorkflow(id);
      if (response.success && response.data) {
        setWorkflowConfig({
          id: response.data.id,
          page_id: response.data.page_id || '',
          workflow_name: response.data.workflow_name,
          workflow_type: (response.data.workflow_type as any) || 'sequential',
          conditions: response.data.conditions || {},
          is_default: response.data.is_default || false,
          steps: (response.data.steps || []).map((s: any) => ({
            step_order: s.step_order,
            step_name: s.step_name,
            approver_type: s.approver_type,
            approver_id: s.approver_id ?? undefined,
            approver_criteria: s.approver_criteria ?? {},
            required_approvals: s.required_approvals ?? 1,
            auto_approve_after_hours: s.auto_approve_after_hours ?? undefined,
            escalation_after_hours: s.escalation_after_hours ?? undefined,
            escalation_to: s.escalation_to ?? undefined,
            conditions: s.conditions || {},
          })),
        });

        setExpandedSteps((response.data.steps || []).map((_: any, i: number) => i));
      } else {
        setError(response.error || 'Failed to load existing workflow');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load existing workflow');
    } finally {
      setLoading(false);
    }
  };

  const toggleStep = (index: number) => {
    setExpandedSteps((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const addStep = () => {
    const newStep: WorkflowStep = {
      step_order: workflowConfig.steps.length + 1,
      step_name: `Step ${workflowConfig.steps.length + 1}`,
      approver_type: 'user',
      required_approvals: 1,
    };

    setWorkflowConfig((prev) => ({
      ...prev,
      steps: [...prev.steps, newStep as any],
    }));

    setExpandedSteps((prev) => [...prev, workflowConfig.steps.length]);
  };

  const removeStep = (index: number) => {
    if (workflowConfig.steps.length <= 1) return;

    const newSteps = (workflowConfig.steps as any[])
      .filter((_: any, i: number) => i !== index)
      .map((step: any, i: number) => ({ ...step, step_order: i + 1 }));

    setWorkflowConfig((prev) => ({
      ...prev,
      steps: newSteps,
    }));

    setExpandedSteps((prev) =>
      prev.filter((i) => i !== index).map((i) => (i > index ? i - 1 : i))
    );
  };

  const updateStep = (index: number, updates: Partial<WorkflowStep>) => {
    const newSteps = [...(workflowConfig.steps as any[])];
    newSteps[index] = { ...newSteps[index], ...updates };

    setWorkflowConfig((prev) => ({
      ...prev,
      steps: newSteps,
    }));
  };

  /**
   * IMPORTANT:
   * - If workflowConfig.id is missing (create mode), call ensure_current_workflow_for_page first.
   * - Then save using ApprovalService.saveWorkflow (which calls update_workflow_auto_version).
   */
  const handleSave = async () => {
    const errors = validateWorkflow(workflowConfig);
    if (errors.length > 0) {
      setError(errors.join(' • '));
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let ensuredWorkflowId = workflowConfig.id;

      // Create mode: ensure workflow exists for page
      if (!ensuredWorkflowId) {
        const { data: wfId, error: ensureErr } = await supabase.rpc(
          'ensure_current_workflow_for_page',
          { p_page_id: workflowConfig.page_id }
        );

        if (ensureErr) throw ensureErr;

        ensuredWorkflowId = wfId as string;

        setWorkflowConfig((prev) => ({
          ...prev,
          id: ensuredWorkflowId,
        }));
      }

      const response = await ApprovalService.saveWorkflow({
        ...workflowConfig,
        id: ensuredWorkflowId,
      });

      if (response.success && response.data) {
        onSave?.(response.data);
      } else {
        setError(response.error || 'Failed to save workflow');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving');
    } finally {
      setLoading(false);
    }
  };

  const getApproverOptions = () => {
    return employees.map((emp) => ({
      value: emp.id,
      label: `${emp.first_name} ${emp.last_name} (${emp.email})`,
    }));
  };

  const isValid = validateWorkflow(workflowConfig).length === 0;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-5xl max-h-[90vh] flex flex-col rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b sticky top-0 bg-white z-10 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {workflowId ? 'Edit Workflow' : 'Create New Workflow'}
            </h2>
            <p className="text-sm text-gray-600">
              {workflowId ? 'Modify the existing approval workflow' : 'Design a custom approval flow'}
            </p>
          </div>

          {error && (
            <div className="text-red-600 text-sm flex items-center">
              <AlertTriangle className="h-4 w-4 mr-2" />
              {error}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-8">
            {/* Basic Configuration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Workflow Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={workflowConfig.workflow_name}
                  onChange={(e) =>
                    setWorkflowConfig((prev) => ({
                      ...prev,
                      workflow_name: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="e.g. Leave Request Approval"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Page <span className="text-red-500">*</span>
                </label>
                <select
                  value={workflowConfig.page_id}
                  onChange={(e) =>
                    setWorkflowConfig((prev) => ({
                      ...prev,
                      page_id: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Page</option>
                  {pages.map((page) => (
                    <option key={page.id} value={page.id}>
                      {page.display_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Workflow Type
                </label>
                <select
                  value={workflowConfig.workflow_type}
                  onChange={(e) =>
                    setWorkflowConfig((prev) => ({
                      ...prev,
                      workflow_type: e.target.value as any,
                    }))
                  }
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="sequential">Sequential</option>
                  <option value="parallel">Parallel</option>
                  <option value="conditional">Conditional</option>
                </select>
              </div>

              <div className="flex items-center pt-6">
                <input
                  type="checkbox"
                  checked={workflowConfig.is_default}
                  onChange={(e) =>
                    setWorkflowConfig((prev) => ({
                      ...prev,
                      is_default: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 text-sm text-gray-700">
                  Set as default workflow for this page
                </label>
              </div>
            </div>

            {/* Workflow Steps */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Approval Steps</h3>
                <button
                  onClick={addStep}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Step
                </button>
              </div>

              <div className="space-y-4">
                {(workflowConfig.steps as any[]).map((step: any, index: number) => (
                  <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Step Header */}
                    <div className="flex items-center justify-between px-5 py-3 bg-gray-50">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                          {step.step_order}
                        </div>
                        <h4 className="font-medium text-gray-900">{step.step_name}</h4>
                      </div>

                      <div className="flex items-center space-x-3">
                        <button onClick={() => toggleStep(index)} className="text-gray-600 hover:text-gray-900">
                          {expandedSteps.includes(index) ? (
                            <ChevronUp className="h-5 w-5" />
                          ) : (
                            <ChevronDown className="h-5 w-5" />
                          )}
                        </button>

                        {workflowConfig.steps.length > 1 && (
                          <button
                            onClick={() => removeStep(index)}
                            className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Step Content */}
                    {expandedSteps.includes(index) && (
                      <div className="p-5 pt-0 grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Step Name
                          </label>
                          <input
                            type="text"
                            value={step.step_name}
                            onChange={(e) => updateStep(index, { step_name: e.target.value })}
                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            placeholder="e.g. Direct Manager Approval"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Approver Type
                          </label>
                          <select
                            value={step.approver_type}
                            onChange={(e) =>
                              updateStep(index, {
                                approver_type: e.target.value as 'user' | 'manager',
                                approver_id: e.target.value === 'manager' ? undefined : step.approver_id,
                              })
                            }
                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          >
                            <option value="user">Specific User</option>
                            <option value="manager">Direct Manager</option>
                          </select>
                        </div>

                        {step.approver_type === 'user' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              <div className="flex items-center">
                                <User className="h-4 w-4 mr-2" />
                                <span>Approver</span>
                              </div>
                            </label>
                            <select
                              value={step.approver_id || ''}
                              onChange={(e) => updateStep(index, { approver_id: e.target.value })}
                              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            >
                              <option value="">Select User</option>
                              {getApproverOptions().map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Required Approvals
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={step.required_approvals}
                            onChange={(e) =>
                              updateStep(index, {
                                required_approvals: parseInt(e.target.value) || 1,
                              })
                            }
                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Auto-approve after (hours)
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={step.auto_approve_after_hours || ''}
                            onChange={(e) =>
                              updateStep(index, {
                                auto_approve_after_hours: e.target.value
                                  ? parseInt(e.target.value)
                                  : undefined,
                              })
                            }
                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            placeholder="Optional"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Escalate after (hours)
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={step.escalation_after_hours || ''}
                            onChange={(e) =>
                              updateStep(index, {
                                escalation_after_hours: e.target.value
                                  ? parseInt(e.target.value)
                                  : undefined,
                              })
                            }
                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            placeholder="Optional"
                          />
                        </div>

                        {step.auto_approve_after_hours &&
                          step.escalation_after_hours &&
                          step.auto_approve_after_hours >= step.escalation_after_hours && (
                            <div className="col-span-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                              Warning: Escalation must happen before auto-approval
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Workflow Preview */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Workflow Preview</h3>
              <div className="flex flex-wrap items-center gap-3">
                {(workflowConfig.steps as any[]).map((s: any, i: number) => (
                  <React.Fragment key={i}>
                    <div className="px-4 py-2 bg-blue-100 text-blue-800 rounded-lg font-medium">
                      {s.step_name}
                    </div>
                    {i < workflowConfig.steps.length - 1 && (
                      <ArrowRight className="h-5 w-5 text-gray-400" />
                    )}
                  </React.Fragment>
                ))}
              </div>

              <div className="mt-6 text-sm text-gray-600 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Type:</span>
                  <span>
                    {workflowConfig.workflow_type === 'sequential'
                      ? 'Sequential'
                      : workflowConfig.workflow_type === 'parallel'
                      ? 'Parallel'
                      : 'Conditional'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Steps:</span>
                  <span>{workflowConfig.steps.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Default:</span>
                  <span>{workflowConfig.is_default ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-white sticky bottom-0">
          <div className="flex items-center justify-end space-x-4">
            <button
              onClick={onCancel}
              className="px-5 py-2 text-sm font-medium text-gray-700 hover:text-gray-500"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!isValid || loading}
              className="flex items-center px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {loading ? 'Saving...' : 'Save Workflow'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
