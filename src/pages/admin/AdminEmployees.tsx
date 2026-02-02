import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  UserPlus, 
  Search, 
  Filter,
  Mail,
  Phone,
  Building2,
  Briefcase,
  Calendar,
  DollarSign,
  User,
  X,
  Pencil,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Shield,
  Users,
  MapPin,
  Plus
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import OptimizedImage from '../../components/OptimizedImage';

interface Department {
  id: string;
  name: string;
}

interface Position {
  id: string;
  title: string;
}

interface Office {
  id: string;
  name: string;
  location: string;
}

interface Employee {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  department_id: string | null;
  position_id: string | null;
  office_id: string | null;
  employment_status: string;
  hire_date: string;
  salary: number;
  direct_manager_id: string | null;
  departments?: {
    name: string;
  };
  positions?: {
    title: string;
  };
  offices?: {
    name: string;
    location: string;
  };
  direct_manager?: {
    first_name: string;
    last_name: string;
  };
  is_admin: boolean;
  profile_image_url?: string | null;
  avatar_url?: string | null;
}

interface NewEmployeeData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone: string;
  department_id: string;
  position_id: string;
  office_id: string;
  employment_status: string;
  hire_date: string;
  salary: number;
  direct_manager_id: string | null;
  is_admin: boolean;
}

// Improved email validation regex that follows RFC 5322 standard
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

function AdminEmployees() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showOfficeModal, setShowOfficeModal] = useState(false);
  const [modalType, setModalType] = useState<'create' | 'edit'>('create');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    department: '',
    status: '',
    office: ''
  });

  const [newEmployeeData, setNewEmployeeData] = useState<NewEmployeeData>({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '',
    department_id: '',
    position_id: '',
    office_id: '',
    employment_status: 'full-time',
    hire_date: new Date().toISOString().split('T')[0],
    salary: 0,
    direct_manager_id: null,
    is_admin: false
  });

  const [newOffice, setNewOffice] = useState({
    name: '',
    location: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [employeesData, departmentsData, positionsData, officesData] = await Promise.all([
        supabase
          .from('profiles')
          .select(`
            *,
            profile_image_url,
            avatar_url,
            departments:profiles_department_id_fkey(name),
            positions:profiles_position_id_fkey(title),
            offices:office_id(name, location),
            direct_manager:profiles!direct_manager_id(first_name, last_name)
          `)
          .order('first_name'),
        supabase
          .from('departments')
          .select('*')
          .order('name'),
        supabase
          .from('positions')
          .select('*')
          .order('title'),
        supabase
          .from('offices')
          .select('*')
          .order('name')
      ]);

      if (employeesData.error) throw new Error(`Employees fetch error: ${employeesData.error.message}`);
      if (departmentsData.error) throw new Error(`Departments fetch error: ${departmentsData.error.message}`);
      if (positionsData.error) throw new Error(`Positions fetch error: ${positionsData.error.message}`);
      if (officesData.error) throw new Error(`Offices fetch error: ${officesData.error.message}`);

      const { data: adminRoles, error: adminError } = await supabase
        .from('admin_roles')
        .select('user_id');
      if (adminError) throw new Error(`Admin roles fetch error: ${adminError.message}`);

      const adminUserIds = new Set(adminRoles.map(role => role.user_id));
      const employeesWithAdmin = employeesData.data.map(employee => ({
        ...employee,
        is_admin: adminUserIds.has(employee.id)
      }));

      setEmployees(employeesWithAdmin);
      setDepartments(departmentsData.data || []);
      setPositions(positionsData.data || []);
      setOffices(officesData.data || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOffice = async () => {
    try {
      setError(null);
      setSuccess(null);

      if (!newOffice.name || !newOffice.location) {
        throw new Error('Office name and location are required');
      }

      const { error } = await supabase
        .from('offices')
        .insert([newOffice]);

      if (error) throw error;

      setSuccess('Office created successfully');
      setShowOfficeModal(false);
      setNewOffice({ name: '', location: '' });
      fetchData();
    } catch (error: any) {
      console.error('Error creating office:', error);
      setError(error.message);
    }
  };

  const validateEmail = (email: string): boolean => {
    return EMAIL_REGEX.test(email);
  };

  const validatePassword = (password: string): boolean => {
    return password.length >= 6;
  };

  const handleCreateEmployee = async () => {
    setError(null);
    setSuccess(null);
    
    try {
      if (!validateEmail(newEmployeeData.email)) {
        throw new Error('Please enter a valid email address');
      }

      if (!validatePassword(newEmployeeData.password)) {
        throw new Error('Password must be at least 6 characters long');
      }

      if (!newEmployeeData.first_name || !newEmployeeData.last_name) {
        throw new Error('First name and last name are required');
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newEmployeeData.email,
        password: newEmployeeData.password,
        options: {
          data: {
            first_name: newEmployeeData.first_name,
            last_name: newEmployeeData.last_name
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user');

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: newEmployeeData.first_name,
          last_name: newEmployeeData.last_name,
          phone: newEmployeeData.phone || '',
          department_id: newEmployeeData.department_id || null,
          position_id: newEmployeeData.position_id || null,
          office_id: newEmployeeData.office_id || null,
          employment_status: newEmployeeData.employment_status || 'full-time',
          hire_date: newEmployeeData.hire_date || null,
          salary: newEmployeeData.salary || null,
          direct_manager_id: newEmployeeData.direct_manager_id
        })
        .eq('id', authData.user.id);

      if (profileError) throw profileError;

      if (newEmployeeData.is_admin) {
        const { error: adminError } = await supabase
          .from('admin_roles')
          .insert([{ user_id: authData.user.id }]);
        if (adminError) throw adminError;
      }

      setSuccess('Employee created successfully');
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      console.error('Error creating employee:', err);
      setError(err.message);
    }
  };

  const handleUpdateEmployee = async () => {
    if (!selectedEmployee) return;
    
    setError(null);
    setSuccess(null);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          first_name: newEmployeeData.first_name,
          last_name: newEmployeeData.last_name,
          phone: newEmployeeData.phone || '',
          department_id: newEmployeeData.department_id || null,
          position_id: newEmployeeData.position_id || null,
          office_id: newEmployeeData.office_id || null,
          employment_status: newEmployeeData.employment_status || 'full-time',
          hire_date: newEmployeeData.hire_date || null,
          salary: newEmployeeData.salary || null,
          direct_manager_id: newEmployeeData.direct_manager_id
        })
        .eq('id', selectedEmployee.id);

      if (updateError) throw updateError;

      if (newEmployeeData.is_admin && !selectedEmployee.is_admin) {
        const { error: addAdminError } = await supabase
          .from('admin_roles')
          .insert([{ user_id: selectedEmployee.id }]);
        if (addAdminError) throw addAdminError;
      } else if (!newEmployeeData.is_admin && selectedEmployee.is_admin) {
        const { error: removeAdminError } = await supabase
          .from('admin_roles')
          .delete()
          .eq('user_id', selectedEmployee.id);
        if (removeAdminError) throw removeAdminError;
      }

      setSuccess('Employee updated successfully');
      setShowModal(false);
      fetchData();
    } catch (error: any) {
      console.error('Error updating employee:', error);
      setError(error.message);
    }
  };

const handleDeleteEmployee = async (employeeId: string) => {
  if (!employeeId) {
    setError("Invalid employee id");
    return;
  }

  if (!confirm("Are you sure you want to delete this employee? This action cannot be undone.")) return;

  setError(null);
  setSuccess(null);

  try {
    // ✅ أهم جزء: نرسل بالـ Query Param حتى لو body ما يوصل
    const functionName = `delete-user?target_user_id=${encodeURIComponent(employeeId)}`;

    const { data, error: invokeError } = await supabase.functions.invoke(functionName, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-target-user-id": employeeId, // احتياط
      },
      body: JSON.stringify({ target_user_id: employeeId }), // احتياط
    });

    if (invokeError) throw invokeError;

    if (!data?.ok) {
      const details =
        typeof data?.details === "string"
          ? data.details
          : data?.error || JSON.stringify(data?.details || {});
      throw new Error(details || "Failed to delete employee");
    }

    setSuccess("Employee deleted successfully");
    fetchData();
  } catch (err: any) {
    console.error("Error deleting employee:", err);
    setError(err.message || "Failed to delete employee");
  }
};




  const filteredEmployees = employees.filter(employee => {
    const searchMatch = 
      employee.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.email.toLowerCase().includes(searchTerm.toLowerCase());

    const departmentMatch = !filters.department || employee.department_id === filters.department;
    const statusMatch = !filters.status || employee.employment_status === filters.status;
    const officeMatch = !filters.office || employee.office_id === filters.office;

    return searchMatch && departmentMatch && statusMatch && officeMatch;
  });

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/admin/settings')}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Admin Settings
          </button>
        </div>

        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">Employee Management</h2>
            <p className="mt-1 text-sm text-gray-500">
              Add, edit, and manage employee information
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
              <div className="flex items-center gap-2">
                <select
                  value={filters.department}
                  onChange={(e) => setFilters(prev => ({ ...prev, department: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Departments</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
                <select
                  value={filters.office}
                  onChange={(e) => setFilters(prev => ({ ...prev, office: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Offices</option>
                  {offices.map(office => (
                    <option key={office.id} value={office.id}>{office.name}</option>
                  ))}
                </select>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="full-time">Full Time</option>
                  <option value="part-time">Part Time</option>
                  <option value="contract">Contract</option>
                  <option value="intern">Intern</option>
                </select>
                <button
                  onClick={() => {
                    setModalType('create');
                    setSelectedEmployee(null);
                    setNewEmployeeData({
                      email: '',
                      password: '',
                      first_name: '',
                      last_name: '',
                      phone: '',
                      department_id: '',
                      position_id: '',
                      office_id: '',
                      employment_status: 'full-time',
                      hire_date: new Date().toISOString().split('T')[0],
                      salary: 0,
                      direct_manager_id: null,
                      is_admin: false
                    });
                    setShowModal(true);
                  }}
                  className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <UserPlus className="h-5 w-5" />
                  Add Employee
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
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
                        Contact
                      </th>
                      <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Department
                      </th>
                      <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Position
                      </th>
                      <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Office
                      </th>
                      <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Direct Manager
                      </th>
                      <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredEmployees.map((employee) => (
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
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{employee.email}</div>
                          <div className="text-sm text-gray-500">{employee.phone || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {employee.departments?.name || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {employee.positions?.title || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {employee.offices ? (
                            <div>
                              <div>{employee.offices.name}</div>
                              <div className="text-xs text-gray-400">{employee.offices.location}</div>
                            </div>
                          ) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {employee.direct_manager ? 
                            `${employee.direct_manager.first_name} ${employee.direct_manager.last_name}` 
                            : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            employee.is_admin
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {employee.is_admin ? 'Admin' : 'Employee'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => {
                              setModalType('edit');
                              setSelectedEmployee(employee);
                              setNewEmployeeData({
                                ...employee,
                                password: '',
                                department_id: employee.department_id || '',
                                position_id: employee.position_id || '',
                                office_id: employee.office_id || '',
                                phone: employee.phone || '',
                                direct_manager_id: employee.direct_manager_id,
                                is_admin: employee.is_admin
                              });
                              setShowModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-900 mr-4"
                          >
                            <Pencil className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteEmployee(employee.id)}
                            disabled={deletingId === employee.id}
                            className={`text-red-600 hover:text-red-900 ${deletingId === employee.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title={deletingId === employee.id ? 'Deleting…' : 'Delete'}
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
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

      {/* Employee Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium text-gray-900">
                {modalType === 'create' ? 'Add New Employee' : 'Edit Employee'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {modalType === 'create' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <div className="mt-1 relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="email"
                        value={newEmployeeData.email}
                        onChange={(e) => setNewEmployeeData(prev => ({ ...prev, email: e.target.value }))}
                        className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={newEmployeeData.password}
                      onChange={(e) => setNewEmployeeData(prev => ({ ...prev, password: e.target.value }))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      required
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  First Name <span className="text-red-500">*</span>
                </label>
                <div className="mt-1 relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={newEmployeeData.first_name}
                    onChange={(e) => setNewEmployeeData(prev => ({ ...prev, first_name: e.target.value }))}
                    className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <div className="mt-1 relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={newEmployeeData.last_name}
                    onChange={(e) => setNewEmployeeData(prev => ({ ...prev, last_name: e.target.value }))}
                    className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Phone
                </label>
                <div className="mt-1 relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="tel"
                    value={newEmployeeData.phone || ''}
                    onChange={(e) => setNewEmployeeData(prev => ({ ...prev, phone: e.target.value }))}
                    className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Department
                </label>
                <div className="mt-1 relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <select
                    value={newEmployeeData.department_id || ''}
                    onChange={(e) => setNewEmployeeData(prev => ({ ...prev, department_id: e.target.value }))}
                    className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Select Department</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Position
                </label>
                <div className="mt-1 relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <select
                    value={newEmployeeData.position_id || ''}
                    onChange={(e) => setNewEmployeeData(prev => ({ ...prev, position_id: e.target.value }))}
                    className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Select Position</option>
                    {positions.map(pos => (
                      <option key={pos.id} value={pos.id}>{pos.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Office
                </label>
                <div className="mt-1 relative flex">
                  <div className="relative flex-1">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <select
                      value={newEmployeeData.office_id || ''}
                      onChange={(e) => setNewEmployeeData(prev => ({ ...prev, office_id: e.target.value }))}
                      className="pl-10 block w-full rounded-l-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="">Select Office</option>
                      {offices.map(office => (
                        <option key={office.id} value={office.id}>
                          {office.name} - {office.location}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowOfficeModal(true);
                      setNewOffice({ name: '', location: '' });
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-r-md border border-l-0 border-gray-300"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Direct Manager
                </label>
                <div className="mt-1 relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <select
                    value={newEmployeeData.direct_manager_id || ''}
                    onChange={(e) => setNewEmployeeData(prev => ({ ...prev, direct_manager_id: e.target.value || null }))}
                    className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Select Manager</option>
                    {employees.length > 0 && employees
                      .filter(emp => emp.id !== selectedEmployee?.id)
                      .map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.first_name} {emp.last_name}
                        </option>
                      ))
                    }
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Employment Status
                </label>
                <div className="mt-1 relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <select
                    value={newEmployeeData.employment_status}
                    onChange={(e) => setNewEmployeeData(prev => ({ ...prev, employment_status: e.target.value }))}
                    className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="full-time">Full Time</option>
                    <option value="part-time">Part Time</option>
                    <option value="contract">Contract</option>
                    <option value="intern">Intern</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Hire Date
                </label>
                <div className="mt-1 relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="date"
                    value={newEmployeeData.hire_date || ''}
                    onChange={(e) => setNewEmployeeData(prev => ({ ...prev, hire_date: e.target.value }))}
                    className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Salary
                </label>
                <div className="mt-1 relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="number"
                    value={newEmployeeData.salary || ''}
                    onChange={(e) => setNewEmployeeData(prev => ({ ...prev, salary: parseFloat(e.target.value) || 0 }))}
                    className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="col-span-2">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newEmployeeData.is_admin}
                    onChange={(e) => setNewEmployeeData(prev => ({ ...prev, is_admin: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div className="ml-3">
                    <label className="text-sm font-medium text-gray-700 flex items-center">
                      <Shield className="h-4 w-4 mr-2 text-gray-400" />
                      Admin Access
                    </label>
                    <p className="text-xs text-gray-500">
                      Admins have full access to manage all employees and system settings
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={modalType === 'create' ? handleCreateEmployee : handleUpdateEmployee}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {modalType === 'create' ? 'Create Employee' : 'Update Employee'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Office Modal */}
      {showOfficeModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Add New Office</h3>
              <button
                onClick={() => setShowOfficeModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Office Name <span className="text-red-500">*</span>
                </label>
                <div className="mt-1 relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={newOffice.name}
                    onChange={(e) => setNewOffice(prev => ({ ...prev, name: e.target.value }))}
                    className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Location <span className="text-red-500">*</span>
                </label>
                <div className="mt-1 relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={newOffice.location}
                    onChange={(e) => setNewOffice(prev => ({ ...prev, location: e.target.value }))}
                    className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowOfficeModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateOffice}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Create Office
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminEmployees;
