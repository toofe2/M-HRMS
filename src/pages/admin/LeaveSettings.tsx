import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft,
  Settings,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  CheckCircle2,
  X
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface LeaveType {
  id: string;
  name: string;
  description: string;
  paid: boolean;
  annual_allowance: number;
  requires_approval: boolean;
  is_active: boolean;
}

export default function LeaveSettings() {
  const navigate = useNavigate();
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedLeaveType, setSelectedLeaveType] = useState<LeaveType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newLeaveType, setNewLeaveType] = useState<Partial<LeaveType>>({
    name: '',
    description: '',
    paid: true,
    annual_allowance: 0,
    requires_approval: true,
    is_active: true
  });

  useEffect(() => {
    fetchLeaveTypes();
  }, []);

  const fetchLeaveTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_types')
        .select('*')
        .order('name');

      if (error) throw error;
      setLeaveTypes(data || []);
    } catch (error: any) {
      console.error('Error fetching leave types:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (selectedLeaveType) {
        // Update existing leave type
        const { error } = await supabase
          .from('leave_types')
          .update(newLeaveType)
          .eq('id', selectedLeaveType.id);

        if (error) throw error;
        setSuccess('Leave type updated successfully');
      } else {
        // Create new leave type
        const { error } = await supabase
          .from('leave_types')
          .insert([newLeaveType]);

        if (error) throw error;
        setSuccess('Leave type created successfully');
      }

      setShowModal(false);
      fetchLeaveTypes();
    } catch (error: any) {
      console.error('Error saving leave type:', error);
      setError(error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this leave type? This action cannot be undone.')) return;

    try {
      const { error } = await supabase
        .from('leave_types')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setSuccess('Leave type deleted successfully');
      fetchLeaveTypes();
    } catch (error: any) {
      console.error('Error deleting leave type:', error);
      setError(error.message);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      setError(null);
      setSuccess(null);

      const { error } = await supabase
        .from('leave_types')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      
      setSuccess(`Leave type ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      fetchLeaveTypes();
    } catch (error: any) {
      console.error('Error toggling leave type status:', error);
      setError(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/admin/leave')}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Leave Management
          </button>
        </div>

        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Leave Settings</h2>
              <p className="mt-1 text-sm text-gray-500">
                Configure leave types and policies
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedLeaveType(null);
                setNewLeaveType({
                  name: '',
                  description: '',
                  paid: true,
                  annual_allowance: 0,
                  requires_approval: true,
                  is_active: true
                });
                setShowModal(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Leave Type
            </button>
          </div>

          {(error || success) && (
            <div className={`p-4 ${error ? 'bg-red-50' : 'bg-green-50'}`}>
              <div className="flex">
                <div className="flex-shrink-0">
                  {error ? (
                    <AlertCircle className="h-5 w-5 text-red-400" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                  )}
                </div>
                <div className="ml-3">
                  <p className={`text-sm ${error ? 'text-red-800' : 'text-green-800'}`}>
                    {error || success}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="p-6">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Annual Allowance
                      </th>
                      <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Payment Status
                      </th>
                      <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Approval Required
                      </th>
                      <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {leaveTypes.map((leaveType) => (
                      <tr key={leaveType.id} className={!leaveType.is_active ? 'opacity-60 bg-gray-50' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          <div className="flex items-center">
                            {leaveType.name}
                            {!leaveType.is_active && (
                              <span className="ml-2 px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                                Disabled
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {leaveType.description}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {leaveType.annual_allowance} days
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            leaveType.paid
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {leaveType.paid ? 'Paid' : 'Unpaid'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {leaveType.requires_approval ? 'Yes' : 'No'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            leaveType.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {leaveType.is_active ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => {
                                setSelectedLeaveType(leaveType);
                                setNewLeaveType(leaveType);
                                setShowModal(true);
                              }}
                              className="p-1 text-blue-600 hover:text-blue-900"
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleToggleActive(leaveType.id, leaveType.is_active)}
                              className={`p-1 ${
                                leaveType.is_active 
                                  ? 'text-yellow-600 hover:text-yellow-900' 
                                  : 'text-green-600 hover:text-green-900'
                              }`}
                              title={leaveType.is_active ? 'Disable' : 'Enable'}
                            >
                              {leaveType.is_active ? (
                                <X className="h-4 w-4" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDelete(leaveType.id)}
                              className="p-1 text-red-600 hover:text-red-900"
                              title="Delete Permanently"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Leave Type Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {selectedLeaveType ? 'Edit Leave Type' : 'Add Leave Type'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Name
                </label>
                <input
                  type="text"
                  value={newLeaveType.name}
                  onChange={(e) => setNewLeaveType(prev => ({ ...prev, name: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  value={newLeaveType.description}
                  onChange={(e) => setNewLeaveType(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Annual Allowance (days)
                </label>
                <input
                  type="number"
                  value={newLeaveType.annual_allowance}
                  onChange={(e) => setNewLeaveType(prev => ({ ...prev, annual_allowance: parseInt(e.target.value) }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                  min="0"
                />
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newLeaveType.paid}
                    onChange={(e) => setNewLeaveType(prev => ({ ...prev, paid: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-700">
                    Paid Leave
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newLeaveType.requires_approval}
                    onChange={(e) => setNewLeaveType(prev => ({ ...prev, requires_approval: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-700">
                    Requires Approval
                  </label>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={newLeaveType.is_active}
                  onChange={(e) => setNewLeaveType(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-700">
                  Active (employees can request this leave type)
                </label>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {selectedLeaveType ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}