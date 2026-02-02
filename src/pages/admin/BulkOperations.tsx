import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft,
  Upload,
  Download,
  Users,
  User,
  Calendar,
  Settings,
  AlertCircle,
  CheckCircle2,
  FileText,
  Database,
  RefreshCw,
  Plus,
  Minus,
  RotateCcw,
  Save,
  Search,
  Building2,
  UserCheck
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface BulkOperation {
  id: string;
  type: 'balance_adjustment' | 'balance_reset' | 'new_year_setup' | 'policy_update';
  description: string;
  affected_employees: number;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
  completed_at?: string;
  error_message?: string;
}

interface Department {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  department_id: string;
  departments?: {
    name: string;
  };
}

interface LeaveType {
  id: string;
  name: string;
  annual_allowance: number;
}

interface BulkAdjustment {
  department_id: string;
  employee_ids: string[];
  leave_type_id: string;
  operation: 'add' | 'subtract' | 'set';
  amount: number;
  reason: string;
  apply_to: 'all' | 'selected';
}

export default function BulkOperations() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [operations, setOperations] = useState<BulkOperation[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'operations' | 'history'>('operations');
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showNewYearModal, setShowNewYearModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [bulkAdjustment, setBulkAdjustment] = useState<BulkAdjustment>({
    department_id: '',
    employee_ids: [],
    leave_type_id: '',
    operation: 'add',
    amount: 0,
    reason: '',
    apply_to: 'all'
  });

  const [newYearSetup, setNewYearSetup] = useState({
    year: new Date().getFullYear() + 1,
    carry_forward_enabled: true,
    max_carry_forward: 7,
    reset_all_balances: false
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    // Filter employees based on selected department and search term
    if (bulkAdjustment.department_id) {
      const deptEmployees = employees.filter(emp => emp.department_id === bulkAdjustment.department_id);
      const filtered = deptEmployees.filter(emp => {
        const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
        const email = emp.email.toLowerCase();
        const search = searchTerm.toLowerCase();
        return fullName.includes(search) || email.includes(search);
      });
      setFilteredEmployees(filtered);
    } else {
      setFilteredEmployees([]);
    }
  }, [bulkAdjustment.department_id, employees, searchTerm]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [departmentsData, employeesData, leaveTypesData, operationsData] = await Promise.all([
        supabase.from('departments').select('id, name').order('name'),
        supabase.from('profiles').select(`
          id, 
          first_name, 
          last_name, 
          email, 
          department_id,
          departments:profiles_department_id_fkey(name)
        `).order('first_name'),
        supabase.from('leave_types').select('id, name, annual_allowance').eq('is_active', true).order('name'),
        supabase.from('bulk_operations').select('*').order('created_at', { ascending: false }).limit(10)
      ]);

      if (departmentsData.error) throw departmentsData.error;
      if (employeesData.error) throw employeesData.error;
      if (leaveTypesData.error) throw leaveTypesData.error;
      if (operationsData.error) throw operationsData.error;

      setDepartments(departmentsData.data || []);
      setEmployees(employeesData.data || []);
      setLeaveTypes(leaveTypesData.data || []);
      setOperations(operationsData.data || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAdjustment = async () => {
    try {
      setProcessing(true);
      setError(null);
      setSuccess(null);

      if (!bulkAdjustment.leave_type_id || !bulkAdjustment.reason) {
        throw new Error('Please fill in all required fields');
      }

      let targetEmployees: string[] = [];

      if (bulkAdjustment.apply_to === 'all' && bulkAdjustment.department_id) {
        // Apply to all employees in department
        targetEmployees = filteredEmployees.map(emp => emp.id);
      } else if (bulkAdjustment.apply_to === 'selected') {
        // Apply to selected employees only
        targetEmployees = bulkAdjustment.employee_ids;
      }

      if (targetEmployees.length === 0) {
        throw new Error('No employees selected for the operation');
      }

      const currentYear = new Date().getFullYear();

      // Perform bulk adjustment for each employee
      for (const employeeId of targetEmployees) {
        // Get current balance
        const { data: currentBalance, error: balanceError } = await supabase
          .from('employee_leave_balances')
          .select('total_allowance, used_days')
          .eq('employee_id', employeeId)
          .eq('leave_type_id', bulkAdjustment.leave_type_id)
          .eq('year', currentYear)
          .maybeSingle();

        if (balanceError) throw balanceError;

        let newTotalAllowance = currentBalance?.total_allowance || 0;

        // Calculate new allowance based on operation
        switch (bulkAdjustment.operation) {
          case 'add':
            newTotalAllowance += bulkAdjustment.amount;
            break;
          case 'subtract':
            newTotalAllowance = Math.max(0, newTotalAllowance - bulkAdjustment.amount);
            break;
          case 'set':
            newTotalAllowance = bulkAdjustment.amount;
            break;
        }

        // Update or insert balance
        const { error: updateError } = await supabase
          .from('employee_leave_balances')
          .upsert([{
            employee_id: employeeId,
            leave_type_id: bulkAdjustment.leave_type_id,
            year: currentYear,
            total_allowance: newTotalAllowance,
            used_days: currentBalance?.used_days || 0,
            carry_forward_days: 0,
            updated_at: new Date().toISOString()
          }], { 
            onConflict: 'employee_id,leave_type_id,year',
            ignoreDuplicates: false 
          });

        if (updateError) throw updateError;

        // Log the adjustment
        const { error: logError } = await supabase
          .from('leave_balance_adjustments')
          .insert({
            employee_id: employeeId,
            leave_type_id: bulkAdjustment.leave_type_id,
            year: currentYear,
            adjustment_type: bulkAdjustment.operation,
            previous_balance: currentBalance?.total_allowance || 0,
            adjustment_amount: bulkAdjustment.amount,
            new_balance: newTotalAllowance,
            reason: bulkAdjustment.reason,
            created_by: (await supabase.auth.getUser()).data.user?.id
          });

        if (logError) throw logError;
      }

      setSuccess(`Successfully updated leave balances for ${targetEmployees.length} employees`);
      setShowAdjustmentModal(false);
      setBulkAdjustment({
        department_id: '',
        employee_ids: [],
        leave_type_id: '',
        operation: 'add',
        amount: 0,
        reason: '',
        apply_to: 'all'
      });
      fetchData();
    } catch (error: any) {
      console.error('Error performing bulk adjustment:', error);
      setError(error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleNewYearSetup = async () => {
    try {
      setProcessing(true);
      setError(null);
      setSuccess(null);

      // Call the database function to create new year balances
      const { data, error } = await supabase.rpc('create_new_year_leave_balances', {
        target_year: newYearSetup.year
      });

      if (error) throw error;

      setSuccess(`Successfully set up leave balances for ${data || 0} employees for year ${newYearSetup.year}`);
      setShowNewYearModal(false);
      fetchData();
    } catch (error: any) {
      console.error('Error setting up new year:', error);
      setError(error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleSyncBalances = async () => {
    try {
      setProcessing(true);
      setError(null);
      setSuccess(null);

      const { data, error } = await supabase.rpc('sync_leave_balances_with_requests');

      if (error) throw error;

      setSuccess(`Successfully synchronized ${data || 0} leave balance records`);
      fetchData();
    } catch (error: any) {
      console.error('Error syncing balances:', error);
      setError(error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleEmployeeSelection = (employeeId: string, checked: boolean) => {
    setBulkAdjustment(prev => ({
      ...prev,
      employee_ids: checked 
        ? [...prev.employee_ids, employeeId]
        : prev.employee_ids.filter(id => id !== employeeId)
    }));
  };

  const handleSelectAllEmployees = (checked: boolean) => {
    setBulkAdjustment(prev => ({
      ...prev,
      employee_ids: checked ? filteredEmployees.map(emp => emp.id) : []
    }));
  };

  const OperationCard = ({ title, description, icon: Icon, color, onClick, disabled = false }: {
    title: string;
    description: string;
    icon: React.ElementType;
    color: string;
    onClick: () => void;
    disabled?: boolean;
  }) => (
    <div
      onClick={disabled ? undefined : onClick}
      className={`bg-white border border-gray-200 rounded-lg p-6 transition-all duration-200 ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md cursor-pointer'
      }`}
    >
      <div className={`inline-flex p-3 rounded-lg ${color} mb-4`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  );

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
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">Bulk Leave Operations</h2>
            <p className="mt-1 text-sm text-gray-500">
              Perform bulk operations on employee leave balances and policies
            </p>
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
            {/* Tab Navigation */}
            <div className="mb-6 border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('operations')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'operations'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Operations
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'history'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  History
                </button>
              </nav>
            </div>

            {activeTab === 'operations' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <OperationCard
                  title="Sync Leave Balances"
                  description="Synchronize leave balances with approved requests"
                  icon={RefreshCw}
                  color="bg-blue-500"
                  onClick={handleSyncBalances}
                  disabled={processing}
                />
                <OperationCard
                  title="Bulk Balance Adjustment"
                  description="Adjust leave balances for multiple employees"
                  icon={Settings}
                  color="bg-green-500"
                  onClick={() => setShowAdjustmentModal(true)}
                  disabled={processing}
                />
                <OperationCard
                  title="New Year Setup"
                  description="Set up leave balances for the new year"
                  icon={Calendar}
                  color="bg-purple-500"
                  onClick={() => setShowNewYearModal(true)}
                  disabled={processing}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Operation History</h3>
                {operations.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">No operations found</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Bulk operations history will appear here
                    </p>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Operation
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Affected Employees
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {operations.map((operation) => (
                          <tr key={operation.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {operation.type.replace('_', ' ').replace(/(^\w|\s\w)/g, m => m.toUpperCase())}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {operation.description}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {operation.affected_employees}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                operation.status === 'completed' ? 'bg-green-100 text-green-800' :
                                operation.status === 'failed' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {operation.status.charAt(0).toUpperCase() + operation.status.slice(1)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(operation.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bulk Adjustment Modal */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium text-gray-900">Bulk Balance Adjustment</h3>
              <button
                onClick={() => setShowAdjustmentModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <ArrowLeft className="h-5 w-5 rotate-45" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Settings */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Department <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={bulkAdjustment.department_id}
                    onChange={(e) => {
                      setBulkAdjustment(prev => ({ 
                        ...prev, 
                        department_id: e.target.value,
                        employee_ids: [] // Reset selected employees when department changes
                      }));
                      setSearchTerm(''); // Reset search
                    }}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select Department</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Leave Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={bulkAdjustment.leave_type_id}
                    onChange={(e) => setBulkAdjustment(prev => ({ ...prev, leave_type_id: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select Leave Type</option>
                    {leaveTypes.map(type => (
                      <option key={type.id} value={type.id}>
                        {type.name} Leave ({type.annual_allowance} days)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Operation <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'add', label: 'Add Days', icon: Plus, color: 'bg-green-100 text-green-700' },
                      { value: 'subtract', label: 'Subtract Days', icon: Minus, color: 'bg-red-100 text-red-700' },
                      { value: 'set', label: 'Set Balance', icon: Settings, color: 'bg-blue-100 text-blue-700' }
                    ].map(op => (
                      <button
                        key={op.value}
                        onClick={() => setBulkAdjustment(prev => ({ ...prev, operation: op.value as any }))}
                        className={`p-3 rounded-lg border-2 transition-colors ${
                          bulkAdjustment.operation === op.value
                            ? `${op.color} border-current`
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <op.icon className="h-5 w-5 mx-auto mb-1" />
                        <span className="text-xs font-medium">{op.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount (days) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={bulkAdjustment.amount}
                    onChange={(e) => setBulkAdjustment(prev => ({ ...prev, amount: parseInt(e.target.value) || 0 }))}
                    min="0"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Apply To <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setBulkAdjustment(prev => ({ ...prev, apply_to: 'all', employee_ids: [] }))}
                      className={`p-3 rounded-lg border-2 transition-colors ${
                        bulkAdjustment.apply_to === 'all'
                          ? 'bg-blue-100 text-blue-700 border-blue-300'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <Users className="h-5 w-5 mx-auto mb-1" />
                      <span className="text-xs font-medium">All in Department</span>
                    </button>
                    <button
                      onClick={() => setBulkAdjustment(prev => ({ ...prev, apply_to: 'selected' }))}
                      className={`p-3 rounded-lg border-2 transition-colors ${
                        bulkAdjustment.apply_to === 'selected'
                          ? 'bg-blue-100 text-blue-700 border-blue-300'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <UserCheck className="h-5 w-5 mx-auto mb-1" />
                      <span className="text-xs font-medium">Selected Employees</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={bulkAdjustment.reason}
                    onChange={(e) => setBulkAdjustment(prev => ({ ...prev, reason: e.target.value }))}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Explain the reason for this adjustment..."
                    required
                  />
                </div>
              </div>

              {/* Right Column - Employee Selection */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Employee Selection
                  </label>
                  
                  {bulkAdjustment.department_id ? (
                    <div className="border border-gray-200 rounded-lg p-4">
                      {bulkAdjustment.apply_to === 'selected' && (
                        <div className="mb-4">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Search employees..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                          
                          <div className="mt-2 flex items-center">
                            <input
                              type="checkbox"
                              checked={filteredEmployees.length > 0 && bulkAdjustment.employee_ids.length === filteredEmployees.length}
                              onChange={(e) => handleSelectAllEmployees(e.target.checked)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label className="ml-2 text-sm text-gray-700">
                              Select All ({filteredEmployees.length} employees)
                            </label>
                          </div>
                        </div>
                      )}

                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {filteredEmployees.length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-4">
                            {bulkAdjustment.department_id ? 'No employees found in this department' : 'Select a department first'}
                          </p>
                        ) : (
                          filteredEmployees.map(employee => (
                            <div key={employee.id} className="flex items-center p-2 hover:bg-gray-50 rounded">
                              {bulkAdjustment.apply_to === 'selected' ? (
                                <input
                                  type="checkbox"
                                  checked={bulkAdjustment.employee_ids.includes(employee.id)}
                                  onChange={(e) => handleEmployeeSelection(employee.id, e.target.checked)}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-3"
                                />
                              ) : (
                                <div className="w-4 h-4 mr-3 flex items-center justify-center">
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                </div>
                              )}
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-900">
                                  {employee.first_name} {employee.last_name}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {employee.email}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                        <div className="flex items-center">
                          <Building2 className="h-5 w-5 text-blue-500 mr-2" />
                          <div>
                            <p className="text-sm font-medium text-blue-800">
                              {bulkAdjustment.apply_to === 'all' ? 'All Employees' : 'Selected Employees'}
                            </p>
                            <p className="text-xs text-blue-600">
                              {bulkAdjustment.apply_to === 'all' 
                                ? `${filteredEmployees.length} employees will be affected`
                                : `${bulkAdjustment.employee_ids.length} employees selected`
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-lg p-8 text-center">
                      <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-sm text-gray-500">
                        Select a department to view employees
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowAdjustmentModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkAdjustment}
                disabled={processing || !bulkAdjustment.department_id || !bulkAdjustment.leave_type_id || !bulkAdjustment.reason}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {processing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2 inline-block"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2 inline-block" />
                    Apply Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Year Setup Modal */}
      {showNewYearModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium text-gray-900">New Year Leave Setup</h3>
              <button
                onClick={() => setShowNewYearModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <ArrowLeft className="h-5 w-5 rotate-45" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Year <span className="text-red-500">*</span>
                </label>
                <select
                  value={newYearSetup.year}
                  onChange={(e) => setNewYearSetup(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {Array.from({ length: 5 }, (_, i) => {
                    const year = new Date().getFullYear() + i;
                    return (
                      <option key={year} value={year}>{year}</option>
                    );
                  })}
                </select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newYearSetup.carry_forward_enabled}
                    onChange={(e) => setNewYearSetup(prev => ({ ...prev, carry_forward_enabled: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 text-sm text-gray-700">
                    Enable carry forward from previous year
                  </label>
                </div>

                {newYearSetup.carry_forward_enabled && (
                  <div className="ml-6">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Maximum carry forward days
                    </label>
                    <input
                      type="number"
                      value={newYearSetup.max_carry_forward}
                      onChange={(e) => setNewYearSetup(prev => ({ ...prev, max_carry_forward: parseInt(e.target.value) || 0 }))}
                      min="0"
                      max="30"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                )}

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newYearSetup.reset_all_balances}
                    onChange={(e) => setNewYearSetup(prev => ({ ...prev, reset_all_balances: e.target.checked }))}
                    className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 text-sm text-gray-700">
                    Reset all existing balances for this year
                  </label>
                </div>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-yellow-400" />
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-yellow-800">Important</h4>
                    <p className="mt-1 text-sm text-yellow-700">
                      This operation will create leave balances for all employees for the year {newYearSetup.year}.
                      {newYearSetup.reset_all_balances && ' Existing balances for this year will be reset.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowNewYearModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleNewYearSetup}
                disabled={processing}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {processing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2 inline-block"></div>
                    Setting Up...
                  </>
                ) : (
                  <>
                    <Calendar className="h-4 w-4 mr-2 inline-block" />
                    Setup New Year
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}