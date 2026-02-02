import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  Calendar,
  AlertCircle,
  CheckCircle2,
  X,
  Pencil,
  Trash2,
  Save,
  Building2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface OfficeHoliday {
  id: string;
  office_id: string;
  name: string;
  description: string;
  date: string;
  is_recurring: boolean;
}

interface Office {
  id: string;
  name: string;
  location: string;
}

export default function AdminOfficeHolidays() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [holidays, setHolidays] = useState<OfficeHoliday[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState<OfficeHoliday | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedOffice, setSelectedOffice] = useState<string>('');

  const [newHoliday, setNewHoliday] = useState({
    office_id: '',
    name: '',
    description: '',
    date: '',
    is_recurring: false
  });

  useEffect(() => {
    fetchData();
  }, [selectedYear, selectedOffice]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch offices
      const { data: officesData, error: officesError } = await supabase
        .from('offices')
        .select('*')
        .order('name');

      if (officesError) throw officesError;
      setOffices(officesData || []);

      // Fetch holidays
      let query = supabase
        .from('office_holidays')
        .select('*')
        .order('date');

      if (selectedOffice) {
        query = query.eq('office_id', selectedOffice);
      }

      const { data: holidaysData, error: holidaysError } = await query;

      if (holidaysError) throw holidaysError;

      // Filter holidays based on year and recurring status
      const filteredHolidays = holidaysData?.filter(holiday => {
        const holidayYear = new Date(holiday.date).getFullYear();
        return holidayYear === selectedYear || holiday.is_recurring;
      });

      setHolidays(filteredHolidays || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
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
      if (!newHoliday.name || !newHoliday.date) {
        throw new Error('Please fill in all required fields');
      }

      if (selectedHoliday) {
        // Update existing holiday
        const { error } = await supabase
          .from('office_holidays')
          .update(newHoliday)
          .eq('id', selectedHoliday.id);

        if (error) throw error;
        setSuccess('Holiday updated successfully');
      } else {
        // Create new holiday
        // If no office is selected, create holiday for all offices
        if (!newHoliday.office_id) {
          const holidayPromises = offices.map(office => 
            supabase
              .from('office_holidays')
              .insert([{
                ...newHoliday,
                office_id: office.id
              }])
          );

          await Promise.all(holidayPromises);
          setSuccess('Holiday created for all offices successfully');
        } else {
          const { error } = await supabase
            .from('office_holidays')
            .insert([newHoliday]);

          if (error) throw error;
          setSuccess('Holiday created successfully');
        }
      }

      setShowModal(false);
      fetchData();
    } catch (error: any) {
      console.error('Error saving holiday:', error);
      setError(error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this holiday?')) return;

    try {
      const { error } = await supabase
        .from('office_holidays')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setSuccess('Holiday deleted successfully');
      fetchData();
    } catch (error: any) {
      console.error('Error deleting holiday:', error);
      setError(error.message);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const groupHolidaysByMonth = () => {
    const grouped: { [key: string]: OfficeHoliday[] } = {};
    holidays.forEach(holiday => {
      const month = new Date(holiday.date).toLocaleString('en-US', { month: 'long' });
      if (!grouped[month]) {
        grouped[month] = [];
      }
      grouped[month].push(holiday);
    });
    return grouped;
  };

  const getOfficeDetails = (officeId: string) => {
    return offices.find(office => office.id === officeId);
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
          <button
            onClick={() => {
              setSelectedHoliday(null);
              setNewHoliday({
                office_id: '',
                name: '',
                description: '',
                date: '',
                is_recurring: false
              });
              setShowModal(true);
            }}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Holiday
          </button>
        </div>

        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">Office Holidays</h2>
            <p className="mt-1 text-sm text-gray-500">
              Manage office-specific holidays and closures
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
            <div className="mb-6 flex flex-wrap gap-4">
              <div className="w-48">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Year
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  {Array.from({ length: 5 }, (_, i) => selectedYear - 2 + i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <div className="w-64">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Office
                </label>
                <select
                  value={selectedOffice}
                  onChange={(e) => setSelectedOffice(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">All Offices</option>
                  {offices.map(office => (
                    <option key={office.id} value={office.id}>
                      {office.name} - {office.location}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : holidays.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No holidays found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  There are no holidays scheduled for the selected criteria.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {Object.entries(groupHolidaysByMonth()).map(([month, monthHolidays]) => (
                  <div key={month} className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">{month}</h3>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {monthHolidays.map(holiday => {
                        const office = getOfficeDetails(holiday.office_id);
                        return (
                          <div
                            key={holiday.id}
                            className="bg-white rounded-lg shadow-sm p-4 border border-gray-200"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <Building2 className="h-5 w-5 text-gray-400" />
                                <span className="text-sm font-medium text-gray-900">
                                  {office?.name || 'All Offices'}
                                </span>
                              </div>
                              {holiday.is_recurring && (
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                                  Recurring
                                </span>
                              )}
                            </div>
                            <h4 className="text-lg font-medium text-gray-900 mb-2">
                              {holiday.name}
                            </h4>
                            <div className="space-y-2">
                              <div className="flex items-center text-sm text-gray-500">
                                <Calendar className="h-4 w-4 mr-2" />
                                <time dateTime={holiday.date} className="font-medium">
                                  {formatDate(holiday.date)}
                                </time>
                              </div>
                              {office?.location && (
                                <div className="flex items-center text-sm text-gray-500">
                                  <Building2 className="h-4 w-4 mr-2" />
                                  {office.location}
                                </div>
                              )}
                              {holiday.description && (
                                <p className="text-sm text-gray-600 mt-2">
                                  {holiday.description}
                                </p>
                              )}
                            </div>
                            <div className="mt-4 flex justify-end space-x-2">
                              <button
                                onClick={() => {
                                  setSelectedHoliday(holiday);
                                  setNewHoliday({
                                    office_id: holiday.office_id,
                                    name: holiday.name,
                                    description: holiday.description,
                                    date: holiday.date,
                                    is_recurring: holiday.is_recurring
                                  });
                                  setShowModal(true);
                                }}
                                className="p-1 text-blue-600 hover:text-blue-800"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(holiday.id)}
                                className="p-1 text-red-600 hover:text-red-800"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Holiday Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {selectedHoliday ? 'Edit Holiday' : 'Add Holiday'}
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
                  Office <span className="text-red-500">*</span>
                </label>
                <select
                  value={newHoliday.office_id}
                  onChange={(e) => setNewHoliday(prev => ({ ...prev, office_id: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">All Offices</option>
                  {offices.map(office => (
                    <option key={office.id} value={office.id}>
                      {office.name} - {office.location}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Holiday Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newHoliday.name}
                  onChange={(e) => setNewHoliday(prev => ({ ...prev, name: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  value={newHoliday.description}
                  onChange={(e) => setNewHoliday(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={newHoliday.date}
                  onChange={(e) => setNewHoliday(prev => ({ ...prev, date: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={newHoliday.is_recurring}
                  onChange={(e) => setNewHoliday(prev => ({ ...prev, is_recurring: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-900">
                  Recurring annually
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
                  <Save className="h-4 w-4 inline-block mr-2" />
                  {selectedHoliday ? 'Update Holiday' : 'Create Holiday'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}