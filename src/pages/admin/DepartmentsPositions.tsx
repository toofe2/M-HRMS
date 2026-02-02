import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Building2, 
  Briefcase,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  CheckCircle2,
  X,
  Save,
  Users,
  ChevronRight
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Department {
  id: string;
  name: string;
  description: string;
  manager_id: string | null;
  created_at: string;
  manager?: {
    first_name: string;
    last_name: string;
  };
}

interface Position {
  id: string;
  title: string;
  department_id: string;
  description: string;
  requirements: string;
  salary_range_min: number;
  salary_range_max: number;
  created_at: string;
  departments?: {
    name: string;
  };
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
}

export default function DepartmentsPositions() {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [departmentForm, setDepartmentForm] = useState({
    name: '',
    description: '',
    manager_id: ''
  });
  const [positionForm, setPositionForm] = useState({
    title: '',
    department_id: '',
    description: '',
    requirements: '',
    salary_range_min: 0,
    salary_range_max: 0
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [departmentsData, positionsData, employeesData] = await Promise.all([
        supabase
          .from('departments')
          .select(`
            *,
            manager:profiles!departments_manager_id_fkey (
              first_name,
              last_name
            )
          `)
          .order('name'),
        supabase
          .from('positions')
          .select(`
            *,
            departments (
              name
            )
          `)
          .order('title'),
        supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .order('first_name')
      ]);

      if (departmentsData.error) throw departmentsData.error;
      if (positionsData.error) throw positionsData.error;
      if (employeesData.error) throw employeesData.error;

      setDepartments(departmentsData.data || []);
      setPositions(positionsData.data || []);
      setEmployees(employeesData.data || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDepartmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (!departmentForm.name) {
        throw new Error('Department name is required');
      }

      if (selectedDepartment) {
        // Update existing department
        const { error } = await supabase
          .from('departments')
          .update({
            name: departmentForm.name,
            description: departmentForm.description,
            manager_id: departmentForm.manager_id || null
          })
          .eq('id', selectedDepartment.id);

        if (error) throw error;
        setSuccess('Department updated successfully');
      } else {
        // Create new department
        const { error } = await supabase
          .from('departments')
          .insert([{
            name: departmentForm.name,
            description: departmentForm.description,
            manager_id: departmentForm.manager_id || null
          }]);

        if (error) throw error;
        setSuccess('Department created successfully');
      }

      setShowDepartmentModal(false);
      setDepartmentForm({ name: '', description: '', manager_id: '' });
      fetchData();
    } catch (error: any) {
      console.error('Error saving department:', error);
      setError(error.message);
    }
  };

  const handlePositionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (!positionForm.title || !positionForm.department_id) {
        throw new Error('Position title and department are required');
      }

      if (selectedPosition) {
        // Update existing position
        const { error } = await supabase
          .from('positions')
          .update({
            title: positionForm.title,
            department_id: positionForm.department_id,
            description: positionForm.description,
            requirements: positionForm.requirements,
            salary_range_min: positionForm.salary_range_min,
            salary_range_max: positionForm.salary_range_max
          })
          .eq('id', selectedPosition.id);

        if (error) throw error;
        setSuccess('Position updated successfully');
      } else {
        // Create new position
        const { error } = await supabase
          .from('positions')
          .insert([{
            title: positionForm.title,
            department_id: positionForm.department_id,
            description: positionForm.description,
            requirements: positionForm.requirements,
            salary_range_min: positionForm.salary_range_min,
            salary_range_max: positionForm.salary_range_max
          }]);

        if (error) throw error;
        setSuccess('Position created successfully');
      }

      setShowPositionModal(false);
      setPositionForm({
        title: '',
        department_id: '',
        description: '',
        requirements: '',
        salary_range_min: 0,
        salary_range_max: 0
      });
      fetchData();
    } catch (error: any) {
      console.error('Error saving position:', error);
      setError(error.message);
    }
  };

  const handleDeleteDepartment = async (departmentId: string) => {
    if (!confirm('Are you sure you want to delete this department? This will also delete all associated positions.')) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      // First delete all positions in this department
      const { error: positionsError } = await supabase
        .from('positions')
        .delete()
        .eq('department_id', departmentId);

      if (positionsError) throw positionsError;

      // Then delete the department
      const { error: departmentError } = await supabase
        .from('departments')
        .delete()
        .eq('id', departmentId);

      if (departmentError) throw departmentError;

      setSuccess('Department and associated positions deleted successfully');
      fetchData();
    } catch (error: any) {
      console.error('Error deleting department:', error);
      setError(error.message);
    }
  };

  const handleDeletePosition = async (positionId: string) => {
    if (!confirm('Are you sure you want to delete this position?')) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      const { error } = await supabase
        .from('positions')
        .delete()
        .eq('id', positionId);

      if (error) throw error;

      setSuccess('Position deleted successfully');
      fetchData();
    } catch (error: any) {
      console.error('Error deleting position:', error);
      setError(error.message);
    }
  };

  const formatSalaryRange = (min: number, max: number) => {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
    return `${formatter.format(min)} - ${formatter.format(max)}`;
  };

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
            <h2 className="text-xl font-semibold text-gray-800">Departments & Positions</h2>
            <p className="mt-1 text-sm text-gray-500">
              Manage organizational structure and job positions
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
            {/* Departments Section */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Departments</h3>
                <button
                  onClick={() => {
                    setSelectedDepartment(null);
                    setDepartmentForm({
                      name: '',
                      description: '',
                      manager_id: ''
                    });
                    setShowDepartmentModal(true);
                  }}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Department
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Department
                      </th>
                      <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Manager
                      </th>
                      <th className="px-6 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {departments.map((department) => (
                      <tr key={department.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Building2 className="h-5 w-5 text-gray-400 mr-2" />
                            <span className="text-sm font-medium text-gray-900">
                              {department.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-500 line-clamp-2">
                            {department.description || '-'}
                          </p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Users className="h-5 w-5 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-900">
                              {department.manager ? 
                                `${department.manager.first_name} ${department.manager.last_name}` : 
                                'Not Assigned'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => {
                              setSelectedDepartment(department);
                              setDepartmentForm({
                                name: department.name,
                                description: department.description || '',
                                manager_id: department.manager_id || ''
                              });
                              setShowDepartmentModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-900 mr-4"
                          >
                            <Pencil className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteDepartment(department.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Positions Section */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Positions</h3>
                <button
                  onClick={() => {
                    setSelectedPosition(null);
                    setPositionForm({
                      title: '',
                      department_id: '',
                      description: '',
                      requirements: '',
                      salary_range_min: 0,
                      salary_range_max: 0
                    });
                    setShowPositionModal(true);
                  }}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Position
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Position
                      </th>
                      <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Department
                      </th>
                      <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Salary Range
                      </th>
                      <th className="px-6 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {positions.map((position) => (
                      <tr key={position.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Briefcase className="h-5 w-5 text-gray-400 mr-2" />
                            <span className="text-sm font-medium text-gray-900">
                              {position.title}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Building2 className="h-5 w-5 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-900">
                              {position.departments?.name || 'Unknown Department'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-500 line-clamp-2">
                            {position.description || '-'}
                          </p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">
                            {formatSalaryRange(position.salary_range_min, position.salary_range_max)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => {
                              setSelectedPosition(position);
                              setPositionForm({
                                title: position.title,
                                department_id: position.department_id,
                                description: position.description || '',
                                requirements: position.requirements || '',
                                salary_range_min: position.salary_range_min,
                                salary_range_max: position.salary_range_max
                              });
                              setShowPositionModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-900 mr-4"
                          >
                            <Pencil className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDeletePosition(position.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Department Modal */}
      {showDepartmentModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {selectedDepartment ? 'Edit Department' : 'Add Department'}
              </h3>
              <button
                onClick={() => setShowDepartmentModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleDepartmentSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Department Name
                </label>
                <input
                  type="text"
                  value={departmentForm.name}
                  onChange={(e) => setDepartmentForm(prev => ({ ...prev, name: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  value={departmentForm.description}
                  onChange={(e) => setDepartmentForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Department Manager
                </label>
                <select
                  value={departmentForm.manager_id}
                  onChange={(e) => setDepartmentForm(prev => ({ ...prev, manager_id: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">Select Manager</option>
                  {employees.map(employee => (
                    <option key={employee.id} value={employee.id}>
                      {employee.first_name} {employee.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowDepartmentModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Save className="h-4 w-4 inline-block mr-2" />
                  {selectedDepartment ? 'Update Department' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Position Modal */}
      {showPositionModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {selectedPosition ? 'Edit Position' : 'Add Position'}
              </h3>
              <button
                onClick={() => setShowPositionModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handlePositionSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Position Title
                </label>
                <input
                  type="text"
                  value={positionForm.title}
                  onChange={(e) => setPositionForm(prev => ({ ...prev, title: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Department
                </label>
                <select
                  value={positionForm.department_id}
                  onChange={(e) => setPositionForm(prev => ({ ...prev, department_id: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Department</option>
                  {departments.map(department => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  value={positionForm.description}
                  onChange={(e) => setPositionForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Requirements
                </label>
                <textarea
                  value={positionForm.requirements}
                  onChange={(e) => setPositionForm(prev => ({ ...prev, requirements: e.target.value }))}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Minimum Salary
                  </label>
                  <input
                    type="number"
                    value={positionForm.salary_range_min}
                    onChange={(e) => setPositionForm(prev => ({ ...prev, salary_range_min: Number(e.target.value) }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    min="0"
                    step="1000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Maximum Salary
                  </label>
                  <input
                    type="number"
                    value={positionForm.salary_range_max}
                    onChange={(e) => setPositionForm(prev => ({ ...prev, salary_range_max: Number(e.target.value) }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    min="0"
                    step="1000"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowPositionModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Save className="h-4 w-4 inline-block mr-2" />
                  {selectedPosition ? 'Update Position' : 'Create Position'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}