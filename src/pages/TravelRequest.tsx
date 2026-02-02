import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Calendar,
  MapPin,
  Plane,
  DollarSign,
  FileText,
  Save,
  X,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  User,
  Building2,
  Briefcase,
  Eye,
  Check,
  Users,
  LocateFixed,
  ArrowRight,
  Printer
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';

interface Project {
  id: string;
  code: string;
  name: string;
  description: string;
}

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
}

interface ExpenseType {
  id: string;
  name: string;
  description: string;
}

interface TravelExpense {
  id?: string;
  expense_type_id: string;
  description: string;
  estimated_cost: number;
  currency_id: string;
  expense_type?: ExpenseType;
  currency?: Currency;
}

interface TravelRequest {
  id: string;
  request_number: string;
  employee_id: string;
  request_date: string;
  departure_date: string;
  return_date: string;
  days_count: number;
  from_location: string;
  to_location: string;
  travel_purpose: string;
  transport_method: string;
  project_id: string | null;
  currency_id: string;
  travel_justification: string;
  total_estimated_cost: number;
  status: string;
  manager_approval_status: string;
  finance_approval_status: string;
  manager_comments?: string;
  finance_comments?: string;
  created_at: string;
  employee: {
    first_name: string;
    last_name: string;
    departments?: {
      name: string;
    };
    positions?: {
      title: string;
    };
  };
  project?: Project;
  currency?: Currency;
  travel_expenses: TravelExpense[];
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  departments?: {
    name: string;
  };
  positions?: {
    title: string;
  };
}

export default function TravelRequest() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'my-requests' | 'team-requests'>('my-requests');

  // Data states
  const [travelRequests, setTravelRequests] = useState<TravelRequest[]>([]);
  const [teamRequests, setTeamRequests] = useState<TravelRequest[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<TravelRequest | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    employee_id: '',
    departure_date: '',
    return_date: '',
    from_location: '',
    to_location: '',
    travel_purpose: '',
    transport_method: '',
    project_id: '',
    currency_id: '',
    travel_justification: ''
  });

  const [expenses, setExpenses] = useState<TravelExpense[]>([]);
  const [newExpense, setNewExpense] = useState<TravelExpense>({
    expense_type_id: '',
    description: '',
    estimated_cost: 0,
    currency_id: ''
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [
        projectsData,
        currenciesData,
        expenseTypesData,
        employeesData,
        requestsData,
        teamRequestsData
      ] = await Promise.all([
        supabase.from('projects').select('*').eq('status', 'active').order('name'),
        supabase.from('currencies').select('*').eq('is_active', true).order('name'),
        supabase.from('expense_types').select('*').eq('is_active', true).order('name'),
        supabase.from('profiles').select(`
          id, first_name, last_name,
          departments:profiles_department_id_fkey(name),
          positions:profiles_position_id_fkey(title)
        `).order('first_name'),
        supabase.from('travel_requests').select(`
          *,
          employee:profiles!travel_requests_employee_id_fkey(
            first_name, last_name,
            departments:profiles_department_id_fkey(name),
            positions:profiles_position_id_fkey(title)
          ),
          project:projects(code, name),
          currency:currencies(code, symbol),
          travel_expenses(
            *,
            expense_type:expense_types(name),
            currency:currencies(code, symbol)
          )
        `).eq('employee_id', user?.id).order('created_at', { ascending: false }),
        isAdmin ? supabase.from('travel_requests').select(`
          *,
          employee:profiles!travel_requests_employee_id_fkey(
            first_name, last_name,
            departments:profiles_department_id_fkey(name),
            positions:profiles_position_id_fkey(title)
          ),
          project:projects(code, name),
          currency:currencies(code, symbol),
          travel_expenses(
            *,
            expense_type:expense_types(name),
            currency:currencies(code, symbol)
          )
        `).neq('employee_id', user?.id).order('created_at', { ascending: false }) : { data: [], error: null }
      ]);

      if (projectsData.error) throw projectsData.error;
      if (currenciesData.error) throw currenciesData.error;
      if (expenseTypesData.error) throw expenseTypesData.error;
      if (employeesData.error) throw employeesData.error;
      if (requestsData.error) throw requestsData.error;
      if (teamRequestsData.error) throw teamRequestsData.error;

      setProjects(projectsData.data || []);
      setCurrencies(currenciesData.data || []);
      setExpenseTypes(expenseTypesData.data || []);
      setEmployees(employeesData.data || []);
      setTravelRequests(requestsData.data || []);
      setTeamRequests(teamRequestsData.data || []);

      // Set default currency and employee
      if (currenciesData.data?.length > 0 && !formData.currency_id) {
        const usdCurrency = currenciesData.data.find(c => c.code === 'USD') || currenciesData.data[0];
        setFormData(prev => ({ ...prev, currency_id: usdCurrency.id }));
        setNewExpense(prev => ({ ...prev, currency_id: usdCurrency.id }));
      }

      if (user?.id && !formData.employee_id) {
        setFormData(prev => ({ ...prev, employee_id: user.id }));
      }
    } catch (error: any) {
      console.error('Error fetching data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateDays = (departure: string, returnDate: string) => {
    if (!departure || !returnDate) return 0;
    const start = new Date(departure);
    const end = new Date(returnDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const handleAddExpense = () => {
    if (!newExpense.expense_type_id || !newExpense.description || newExpense.estimated_cost <= 0) {
      setError('Please fill in all expense fields');
      return;
    }

    const expenseType = expenseTypes.find(et => et.id === newExpense.expense_type_id);
    const currency = currencies.find(c => c.id === newExpense.currency_id);

    setExpenses(prev => [...prev, {
      ...newExpense,
      id: `temp-${Date.now()}`,
      expense_type: expenseType,
      currency: currency
    }]);

    setNewExpense({
      expense_type_id: '',
      description: '',
      estimated_cost: 0,
      currency_id: formData.currency_id
    });
    setError(null);
  };

  const handleRemoveExpense = (index: number) => {
    setExpenses(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (!formData.departure_date || !formData.return_date) {
        throw new Error('Please select departure and return dates');
      }

      if (new Date(formData.departure_date) >= new Date(formData.return_date)) {
        throw new Error('Return date must be after departure date');
      }

      if (expenses.length === 0) {
        throw new Error('Please add at least one expense item');
      }
      
      if (!formData.transport_method) {
        throw new Error('Please select a transport method');
      }

      // Create travel request
      const { data: travelRequest, error: requestError } = await supabase
        .from('travel_requests')
        .insert([{
          employee_id: formData.employee_id,
          departure_date: formData.departure_date,
          return_date: formData.return_date,
          from_location: formData.from_location,
          to_location: formData.to_location,
          travel_purpose: formData.travel_purpose,
          transport_method: formData.transport_method,
          project_id: formData.project_id || null,
          currency_id: formData.currency_id,
          travel_justification: formData.travel_justification
        }])
        .select()
        .single();

      if (requestError) throw requestError;

      // Create travel expenses
      const expenseInserts = expenses.map(expense => ({
        travel_request_id: travelRequest.id,
        expense_type_id: expense.expense_type_id,
        description: expense.description,
        estimated_cost: expense.estimated_cost,
        currency_id: expense.currency_id
      }));

      const { error: expensesError } = await supabase
        .from('travel_expenses')
        .insert(expenseInserts);

      if (expensesError) throw expensesError;

      setSuccess('Travel request submitted successfully');
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Error submitting travel request:', error);
      setError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      employee_id: user?.id || '',
      departure_date: '',
      return_date: '',
      from_location: '',
      to_location: '',
      travel_purpose: '',
      transport_method: '',
      project_id: '',
      currency_id: currencies.find(c => c.code === 'USD')?.id || '',
      travel_justification: ''
    });
    setExpenses([]);
    setNewExpense({
      expense_type_id: '',
      description: '',
      estimated_cost: 0,
      currency_id: currencies.find(c => c.code === 'USD')?.id || ''
    });
  };

  const handleViewRequest = (request: TravelRequest) => {
    setSelectedRequest(request);
    setShowViewModal(true);
  };

  // دالة طباعة الفاتورة
  const handlePrintInvoice = () => {
    window.print();
  };

  const handleApproval = async (requestId: string, action: 'approve' | 'reject', comments: string = '') => {
    try {
      setError(null);
      setSuccess(null);

      const { error } = await supabase
        .from('travel_requests')
        .update({
          manager_approval_status: action === 'approve' ? 'approved' : 'rejected',
          manager_comments: comments,
          status: action === 'approve' ? 'pending' : 'rejected',
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) throw error;

      setSuccess(`Travel request ${action}d successfully`);
      fetchData();
    } catch (error: any) {
      console.error('Error updating travel request:', error);
      setError(error.message);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const formatCurrency = (amount: number, currencySymbol: string) => {
    const safeAmount = amount || 0;
    return `${currencySymbol}${safeAmount.toLocaleString()}`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString();
  };

  const TabButton = ({ tab, current, icon: Icon, label, count }: { 
    tab: 'my-requests' | 'team-requests';
    current: 'my-requests' | 'team-requests';
    icon: React.ElementType;
    label: string;
    count?: number;
  }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex items-center px-4 py-2 rounded-lg ${
        tab === current
          ? 'bg-blue-100 text-blue-800'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      <Icon className="h-5 w-5 mr-2" />
      <span>{label}</span>
      {count !== undefined && count > 0 && (
        <span className="ml-2 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
          {count}
        </span>
      )}
    </button>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate('/procurement')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Procurement
        </button>

        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Travel Requests</h2>
              <p className="mt-1 text-sm text-gray-500">
                Submit and manage business travel requests
              </p>
            </div>
            <button 
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Travel Request
            </button>
          </div>

          <div className="p-6">
            {(error || success) && (
              <div className={`mb-4 ${error ? 'bg-red-50' : 'bg-green-50'} text-${error ? 'red' : 'green'}-700 p-4 rounded-md flex items-start`}>
                {error ? (
                  <AlertCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0 text-red-400" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0 text-green-400" />
                )}
                <p>{error || success}</p>
              </div>
            )}

            {/* Tabs */}
            <div className="mb-6 flex space-x-4">
              <TabButton
                tab="my-requests"
                current={activeTab}
                icon={User}
                label="My Travel Requests"
              />
              {isAdmin && (
                <TabButton
                  tab="team-requests"
                  current={activeTab}
                  icon={Users}
                  label="Team Travel Requests"
                  count={teamRequests.filter(r => r.status === 'pending').length}
                />
              )}
            </div>

            {/* Travel Requests Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Request #
                    </th>
                    {activeTab === 'team-requests' && (
                      <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Employee
                      </th>
                    )}
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Destination
                    </th>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Travel Dates
                    </th>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Cost
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
                  {(activeTab === 'my-requests' ? travelRequests : teamRequests).map((request) => (
                    <tr key={request.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {request.request_number}
                      </td>
                      {activeTab === 'team-requests' && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>
                            <div className="font-medium">
                              {request.employee.first_name} {request.employee.last_name}
                            </div>
                            <div className="text-gray-500">
                              {request.employee.positions?.title}
                            </div>
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                          <span>{request.from_location} → {request.to_location}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                          <span>{formatDate(request.departure_date)} - {formatDate(request.return_date)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {request.days_count} days
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <DollarSign className="h-4 w-4 text-gray-400 mr-1" />
                          <span>{formatCurrency(request.total_estimated_cost, request.currency?.symbol || '$')}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          getStatusBadgeColor(request.status)
                        }`}>
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleViewRequest(request)}
                            className="p-1 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {activeTab === 'team-requests' && request.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApproval(request.id, 'approve')}
                                className="p-1 bg-green-100 text-green-600 rounded-full hover:bg-green-200"
                                title="Approve"
                                >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleApproval(request.id, 'reject')}
                                className="p-1 bg-red-100 text-red-600 rounded-full hover:bg-red-200"
                                title="Reject"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* New Travel Request Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-50">
          <div className="bg-white h-full w-full overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">New Travel Request</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Request Date: {new Date().toLocaleDateString()} | Auto-generated request number will be assigned upon submission
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-500 p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8">
              <div className="max-w-6xl mx-auto">
                {/* Employee Info Display */}
                <div className="mb-8 bg-blue-50 p-6 rounded-lg">
                  <h4 className="text-lg font-medium text-blue-900 mb-4">Employee Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-blue-700">Employee Name</label>
                      <div className="mt-1 p-3 bg-white rounded-md border border-blue-200">
                        <div className="flex items-center">
                          <User className="h-5 w-5 text-blue-500 mr-2" />
                          <span className="text-gray-900 font-medium">
                            {employees.find(emp => emp.id === user?.id)?.first_name} {employees.find(emp => emp.id === user?.id)?.last_name}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-blue-700">Position</label>
                      <div className="mt-1 p-3 bg-white rounded-md border border-blue-200">
                        <div className="flex items-center">
                          <Briefcase className="h-5 w-5 text-blue-500 mr-2" />
                          <span className="text-gray-900">
                            {employees.find(emp => emp.id === user?.id)?.positions?.title || 'Not Assigned'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-blue-700">Department</label>
                      <div className="mt-1 p-3 bg-white rounded-md border border-blue-200">
                        <div className="flex items-center">
                          <Building2 className="h-5 w-5 text-blue-500 mr-2" />
                          <span className="text-gray-900">
                            {employees.find(emp => emp.id === user?.id)?.departments?.name || 'Not Assigned'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Travel Dates */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Departure Date <span className="text-red-500">*</span>
                  </label>
                  <div className="mt-1 relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="date"
                    value={formData.departure_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, departure_date: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                    className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Return Date <span className="text-red-500">*</span>
                  </label>
                  <div className="mt-1 relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="date"
                    value={formData.return_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, return_date: e.target.value }))}
                    min={formData.departure_date || new Date().toISOString().split('T')[0]}
                    className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                  </div>
                </div>

                {/* Duration Display */}
                {formData.departure_date && formData.return_date && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Duration
                    </label>
                    <div className="mt-1 p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center">
                        <Clock className="h-5 w-5 text-green-500 mr-2" />
                      <span className="text-green-700 font-semibold text-lg">
                        {calculateDays(formData.departure_date, formData.return_date)} days
                      </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Locations */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    From Location <span className="text-red-500">*</span>
                  </label>
                  <div className="mt-1 relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={formData.from_location}
                    onChange={(e) => setFormData(prev => ({ ...prev, from_location: e.target.value }))}
                    className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="e.g., Erbil, Iraq"
                    required
                  />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    To Location <span className="text-red-500">*</span>
                  </label>
                  <div className="mt-1 relative">
                    <LocateFixed className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={formData.to_location}
                    onChange={(e) => setFormData(prev => ({ ...prev, to_location: e.target.value }))}
                    className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="e.g., Baghdad, Iraq"
                    required
                  />
                  </div>
                </div>

                {/* Travel Purpose */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Travel Purpose <span className="text-red-500">*</span>
                  </label>
                  <div className="mt-1 relative">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={formData.travel_purpose}
                    onChange={(e) => setFormData(prev => ({ ...prev, travel_purpose: e.target.value }))}
                    className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="e.g., Client meeting, Training, Conference"
                    required
                  />
                  </div>
                </div>

                {/* Transport Method Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Transport Method <span className="text-red-500">*</span>
                  </label>
                  <div className="mt-1 relative">
                    <Plane className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <select
                      value={formData.transport_method}
                      onChange={(e) => setFormData(prev => ({ ...prev, transport_method: e.target.value }))}
                      className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select Method</option>
                      <option value="flight">Flight</option>
                      <option value="car">Car</option>
                      <option value="train">Train</option>
                      <option value="bus">Bus</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>


                {/* Project */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Project (Travel Costs Covered)
                  </label>
                  <div className="mt-1 relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <select
                    value={formData.project_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, project_id: e.target.value }))}
                    className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Select Project</option>
                    {projects.map(project => (
                      <option key={project.id} value={project.id}>
                        {project.code} - {project.name}
                      </option>
                    ))}
                  </select>
                  </div>
                </div>

                {/* Currency */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Currency <span className="text-red-500">*</span>
                  </label>
                  <div className="mt-1 relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <select
                    value={formData.currency_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, currency_id: e.target.value }))}
                    className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Currency</option>
                    {currencies.map(currency => (
                      <option key={currency.id} value={currency.id}>
                        {currency.code} - {currency.name} ({currency.symbol})
                      </option>
                    ))}
                  </select>
                  </div>
                </div>

                {/* Request Info Display */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Request Date
                  </label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-md border border-gray-200">
                    <div className="flex items-center">
                      <Calendar className="h-5 w-5 text-gray-400 mr-2" />
                      <span className="text-gray-900 font-medium">
                        {new Date().toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Travel Justification */}
              <div className="mt-8">
                <label className="block text-sm font-medium text-gray-700">
                  Travel Justification <span className="text-red-500">*</span>
                </label>
                <div className="mt-1 relative">
                  <FileText className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <textarea
                  value={formData.travel_justification}
                  onChange={(e) => setFormData(prev => ({ ...prev, travel_justification: e.target.value }))}
                  rows={4}
                  className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Provide detailed justification for this travel request..."
                  required
                />
                </div>
              </div>

              {/* Expenses Section */}
              <div className="mt-10">
                <div className="flex items-center mb-6">
                  <DollarSign className="h-6 w-6 text-gray-600 mr-2" />
                  <h4 className="text-xl font-semibold text-gray-900">Travel Expenses</h4>
                </div>
                
                {/* Add New Expense */}
                <div className="bg-gray-50 p-6 rounded-lg mb-6 border border-gray-200">
                  <h5 className="text-sm font-medium text-gray-700 mb-4">Add New Expense</h5>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Expense Type
                      </label>
                      <select
                        value={newExpense.expense_type_id}
                        onChange={(e) => setNewExpense(prev => ({ ...prev, expense_type_id: e.target.value }))}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      >
                        <option value="">Select Type</option>
                        {expenseTypes.map(type => (
                          <option key={type.id} value={type.id}>
                            {type.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Description
                      </label>
                      <input
                        type="text"
                        value={newExpense.description}
                        onChange={(e) => setNewExpense(prev => ({ ...prev, description: e.target.value }))}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        placeholder="e.g., Flight from Erbil to Baghdad"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Estimated Cost
                      </label>
                      <input
                        type="number"
                        value={newExpense.estimated_cost}
                        onChange={(e) => setNewExpense(prev => ({ ...prev, estimated_cost: parseFloat(e.target.value) || 0 }))}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        min="0"
                        step="0.01"
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={handleAddExpense}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                      >
                        <Plus className="h-4 w-4 inline mr-2" />
                        Add Expense
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expenses List */}
                {expenses.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                      <h5 className="text-sm font-medium text-gray-700">Expense Items</h5>
                    </div>
                    <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Description
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Cost
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {expenses.map((expense, index) => (
                          <tr key={expense.id || index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {expense.expense_type?.name}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {expense.description}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatCurrency(expense.estimated_cost, expense.currency?.symbol || '$')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                type="button"
                                onClick={() => handleRemoveExpense(index)}
                                className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-full transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                    
                    {/* Total */}
                    <div className="px-6 py-4 bg-blue-50 border-t border-blue-200">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-blue-700">Total Estimated Cost:</span>
                        <span className="text-lg font-bold text-blue-900">
                          {formatCurrency(
                            expenses.reduce((sum, exp) => sum + exp.estimated_cost, 0),
                            currencies.find(c => c.id === formData.currency_id)?.symbol || '$'
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {expenses.length === 0 && (
                  <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No expenses added yet. Please add at least one expense item.</p>
                  </div>
                )}
              </div>

              <div className="mt-10 flex justify-end space-x-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || expenses.length === 0 || !formData.transport_method}
                  className="inline-flex justify-center px-6 py-3 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Submit Request
                    </>
                  )}
                </button>
              </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Request Modal */}
      {showViewModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" id="travel-invoice-modal-content"> {/* ✅ تم إضافة هذا الـ ID هنا */}
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-800">Travel Request Details</h3>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setSelectedRequest(null);
                  }}
                  className="text-gray-400 hover:text-gray-500 transition-colors print:hidden"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6" id="printable-invoice">
              {/* ... محتوى الفاتورة ... */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Request Info */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Request Number</h4>
                    <p className="mt-1 text-lg font-semibold text-gray-900">{selectedRequest.request_number}</p>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Employee</h4>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedRequest.employee.first_name} {selectedRequest.employee.last_name}
                    </p>
                    <p className="text-xs text-gray-500">{selectedRequest.employee.positions?.title}</p>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Travel Route</h4>
                    <div className="mt-1 flex items-center text-sm text-gray-900">
                      <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                      {selectedRequest.from_location} → {selectedRequest.to_location}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Travel Dates</h4>
                    <div className="mt-1 flex items-center text-sm text-gray-900">
                      <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                      {formatDate(selectedRequest.departure_date)} - {formatDate(selectedRequest.return_date)}
                      <span className="ml-2 text-gray-500">({selectedRequest.days_count} days)</span>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Travel Purpose</h4>
                    <p className="mt-1 text-sm text-gray-900">{selectedRequest.travel_purpose}</p>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Transport Method</h4>
                    <p className="mt-1 text-sm text-gray-900 capitalize">{selectedRequest.transport_method}</p>
                  </div>

                  {selectedRequest.project && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500">Project</h4>
                      <p className="mt-1 text-sm text-gray-900">
                        {selectedRequest.project.code} - {selectedRequest.project.name}
                      </p>
                    </div>
                  )}
                </div>

                {/* Status and Approval */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Status</h4>
                    <span className={`mt-1 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      getStatusBadgeColor(selectedRequest.status)
                    }`}>
                      {selectedRequest.status.charAt(0).toUpperCase() + selectedRequest.status.slice(1)}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Manager Approval</h4>
                    <span className={`mt-1 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      getStatusBadgeColor(selectedRequest.manager_approval_status)
                    }`}>
                      {selectedRequest.manager_approval_status.charAt(0).toUpperCase() + selectedRequest.manager_approval_status.slice(1)}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Finance Approval</h4>
                    <span className={`mt-1 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      getStatusBadgeColor(selectedRequest.finance_approval_status)
                    }`}>
                      {selectedRequest.finance_approval_status.charAt(0).toUpperCase() + selectedRequest.finance_approval_status.slice(1)}
                    </span>
                  </div>

                  {/* هذا الجزء لحساب المبلغ الإجمالي من بنود المصروفات */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Total Estimated Cost</h4>
                    <p className="mt-1 text-lg font-semibold text-gray-900">
                      {formatCurrency(
                          (selectedRequest.travel_expenses || []).reduce(
                              (sum, expense) => sum + (expense.estimated_cost || 0),
                              0
                          ),
                          selectedRequest.currency?.symbol || '$'
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Travel Justification */}
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-500">Travel Justification</h4>
                <p className="mt-1 text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">
                  {selectedRequest.travel_justification}
                </p>
              </div>

              {/* Expenses */}
              {selectedRequest.travel_expenses && selectedRequest.travel_expenses.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-500 mb-3">Expense Breakdown</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-4 py-2 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                            Type
                          </th>
                          <th className="px-4 py-2 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                            Description
                          </th>
                          <th className="px-4 py-2 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase">
                            Cost
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedRequest.travel_expenses.map((expense, index) => (
                          <tr key={expense.id || index}>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {expense.expense_type?.name}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {expense.description}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">
                              {formatCurrency(expense.estimated_cost, expense.currency?.symbol || '$')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Comments */}
              {(selectedRequest.manager_comments || selectedRequest.finance_comments) && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-500 mb-3">Comments</h4>
                  {selectedRequest.manager_comments && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-gray-500">Manager Comments:</p>
                      <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">
                        {selectedRequest.manager_comments}
                      </p>
                    </div>
                  )}
                  {selectedRequest.finance_comments && (
                    <div>
                      <p className="text-xs font-medium text-gray-500">Finance Comments:</p>
                      <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">
                        {selectedRequest.finance_comments}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-gray-50 rounded-b-2xl flex justify-between items-center print:hidden">
              <button
                onClick={handlePrintInvoice}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                <Printer className="h-5 w-5 mr-2" />
                Print Invoice
              </button>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedRequest(null);
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}