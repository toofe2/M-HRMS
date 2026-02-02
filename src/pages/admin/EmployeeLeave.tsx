import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Search,
  AlertCircle,
  CheckCircle2,
  Building2,
  Plus
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import OptimizedImage from '../../components/OptimizedImage';

interface EmployeeLeaveBalance {
  employee_id: string;
  leave_type_id: string;
  leave_type_name: string;
  total_allowance: number;
  used_days: number;
  available_days: number;
  carry_forward_days: number;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  profile_image_url?: string | null;
  avatar_url?: string | null;
  departments: {
    name: string;
  };
}

interface LeaveType {
  id: string;
  name: string;
  description: string;
  annual_allowance: number;
}

interface LeaveBalance {
  [leaveTypeId: string]: {
    total_allowance: number;
    used_days: number;
    available_days: number;
    carry_forward_days: number;
  };
}

interface Department {
  id: string;
  name: string;
}

export default function EmployeeLeave() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [employeeBalances, setEmployeeBalances] = useState<{ [employeeId: string]: EmployeeLeaveBalance[] }>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [editBalance, setEditBalance] = useState<LeaveBalance>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [employeesData, departmentsData, leaveTypesData] = await Promise.all([
        supabase
          .from('profiles')
          .select(`
            id,
            first_name,
            last_name,
            email,
          profile_image_url,
          avatar_url,
            departments:profiles_department_id_fkey(name)
          `)
          .order('first_name'),
        supabase
          .from('departments')
          .select('id, name')
          .order('name'),
        supabase
          .from('leave_types')
          .select('*')
          .order('name')
      ]);

      if (employeesData.error) throw employeesData.error;
      if (departmentsData.error) throw departmentsData.error;
      if (leaveTypesData.error) throw leaveTypesData.error;

      setEmployees(employeesData.data || []);
      setDepartments(departmentsData.data || []);
      setLeaveTypes(leaveTypesData.data || []);

      // جلب رصيد الإجازات للموظفين
      await fetchEmployeeBalances(employeesData.data || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployeeBalances = async (employees: Employee[]) => {
    try {
      const currentYear = new Date().getFullYear();
      const { data: balancesData, error } = await supabase
        .from('employee_leave_balances_view')
        .select('*')
        .eq('year', currentYear)
        .in('employee_id', employees.map(emp => emp.id));

      if (error) throw error;

      // تجميع الرصيد حسب الموظف
      const groupedBalances: { [employeeId: string]: EmployeeLeaveBalance[] } = {};
      balancesData?.forEach(balance => {
        if (!groupedBalances[balance.employee_id]) {
          groupedBalances[balance.employee_id] = [];
        }
        groupedBalances[balance.employee_id].push(balance);
      });

      setEmployeeBalances(groupedBalances);
    } catch (error: any) {
      console.error('Error fetching employee balances:', error);
      setError(error.message);
    }
  };

  const handleUpdateBalance = async () => {
    if (!selectedEmployee) return;

    try {
      setError(null);
      setSuccess(null);

      // تحديث رصيد كل نوع إجازة
      const currentYear = new Date().getFullYear();
      const updatePromises = Object.entries(editBalance).map(async ([leaveTypeId, balanceData]) => {
        const { error } = await supabase
          .from('employee_leave_balances')
          .update({
            total_allowance: balanceData.total_allowance,
            used_days: balanceData.used_days,
            updated_at: new Date().toISOString()
          })
          .eq('employee_id', selectedEmployee)
          .eq('leave_type_id', leaveTypeId)
          .eq('year', currentYear);

        if (error) throw error;
      });

      await Promise.all(updatePromises);

      setSuccess('Leave balance updated successfully');
      setShowModal(false);
      fetchData();
    } catch (error: any) {
      console.error('Error updating balance:', error);
      setError(error.message);
    }
  };

  const filteredEmployees = employees.filter(employee => {
    const searchMatch = 
      employee.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.email.toLowerCase().includes(searchTerm.toLowerCase());

    const departmentMatch = !selectedDepartment || employee.departments?.name === selectedDepartment;

    return searchMatch && departmentMatch;
  });

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/admin/leave')}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Leave Management
          </button>
        </div>

        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">Employee Leave Balances</h2>
            <p className="mt-1 text-sm text-gray-500">
              Manage and view employee leave balances
            </p>
          </div>

          {(error || success) && (
            <div className={`mb-6 p-4 rounded-md ${
              error ? 'bg-red-50' : 'bg-green-50'
            }`}>
              <div className="flex">
                <div className="flex-shrink-0">
                  {error ? (
                    <AlertCircle className="h-5 w-5 text-red-400" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                  )}
                </div>
                <div className="ml-3">
                  <p className={`text-sm ${
                    error ? 'text-red-800' : 'text-green-800'
                  }`}>
                    {error || success}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="p-6">
            {/* Filters */}
            <div className="mb-6 flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search employees..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="sm:w-64">
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Departments</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.name}>{dept.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Employee List */}
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
                        Employee
                      </th>
                      <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Department
                      </th>
                      {leaveTypes.map(type => (
                        <th key={type.id} className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {type.name} Leave
                        </th>
                      ))}
                      <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredEmployees.map((employee) => {
                      return (
                        <tr key={employee.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10">
                                {employee.profile_image_url || employee.avatar_url ? (
                                  <OptimizedImage
                                    src={employee.profile_image_url || employee.avatar_url}
                                    alt={`${employee.first_name} ${employee.last_name}`}
                                    width={40}
                                    height={40}
                                    className="h-10 w-10 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                    <span className="text-blue-600 font-medium">
                                      {employee.first_name[0]}{employee.last_name[0]}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">
                                  {employee.first_name} {employee.last_name}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {employee.email}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {employee.departments?.name || '-'}
                          </td>
                          {leaveTypes.map(type => (
                            <td key={type.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {(() => {
                                const employeeBalance = employeeBalances[employee.id];
                                if (!employeeBalance) return '0 days';
                                
                                const typeBalance = employeeBalance.find(b => 
                                  b.leave_type_name.toLowerCase() === type.name.toLowerCase()
                                );
                                
                                return typeBalance ? `${typeBalance.available_days} days` : '0 days';
                              })()}
                            </td>
                          ))}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <button
                              onClick={() => {
                                setSelectedEmployee(employee.id);
                                
                                // تحضير بيانات التعديل
                                const employeeBalance = employeeBalances[employee.id] || [];
                                const editData: LeaveBalance = {};
                                
                                leaveTypes.forEach(type => {
                                  const typeBalance = employeeBalance.find(b => 
                                    b.leave_type_name.toLowerCase() === type.name.toLowerCase()
                                  );
                                  
                                  editData[type.id] = typeBalance ? {
                                    total_allowance: typeBalance.total_allowance,
                                    used_days: typeBalance.used_days,
                                    available_days: typeBalance.available_days,
                                    carry_forward_days: typeBalance.carry_forward_days
                                  } : {
                                    total_allowance: type.annual_allowance,
                                    used_days: 0,
                                    available_days: type.annual_allowance,
                                    carry_forward_days: 0
                                  };
                                });
                                
                                setEditBalance(editData);
                                setShowModal(true);
                              }}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Update Balance
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Balance Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Update Leave Balance
            </h3>

            <div className="space-y-4">
              {leaveTypes.map(type => (
                <div key={type.id}>
                  <label className="block text-sm font-medium text-gray-700">
                    {type.name} Leave - Total Allowance
                  </label>
                  <input
                    type="number"
                    value={editBalance[type.id]?.total_allowance || 0}
                    onChange={(e) => setEditBalance(prev => ({
                      ...prev,
                      [type.id]: {
                        ...prev[type.id],
                        total_allowance: parseInt(e.target.value) || 0
                      }
                    }))}
                    min="0"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Used: {editBalance[type.id]?.used_days || 0} days, 
                    Available: {(editBalance[type.id]?.total_allowance || 0) - (editBalance[type.id]?.used_days || 0)} days
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateBalance}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Update Balance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}