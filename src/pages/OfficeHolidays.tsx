import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft,
  Calendar,
  Building2,
  AlertCircle,
  Info,
  MapPin,
  Clock
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface OfficeHoliday {
  id: string;
  office_id: string;
  name: string;
  description: string;
  date: string;
  is_recurring: boolean;
  offices?: {
    name: string;
    location: string;
  };
}

interface Office {
  id: string;
  name: string;
  location: string;
}

interface GroupedHoliday {
  name: string;
  description: string;
  date: string;
  is_recurring: boolean;
  offices: {
    name: string;
    location: string;
  }[];
}

export default function OfficeHolidays() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [holidays, setHolidays] = useState<OfficeHoliday[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedOffice, setSelectedOffice] = useState<string>('');

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
        .select(`
          *,
          offices:office_id (
            name,
            location
          )
        `)
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

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const groupHolidaysByDate = () => {
    const grouped: { [key: string]: GroupedHoliday[] } = {};
    const holidayMap: { [key: string]: { [key: string]: GroupedHoliday } } = {};

    holidays.forEach(holiday => {
      const month = new Date(holiday.date).toLocaleString('en-US', { month: 'long' });
      const dateKey = holiday.date;
      const nameKey = `${holiday.name}-${dateKey}`;

      if (!grouped[month]) {
        grouped[month] = [];
      }

      if (!holidayMap[month]) {
        holidayMap[month] = {};
      }

      if (!holidayMap[month][nameKey]) {
        holidayMap[month][nameKey] = {
          name: holiday.name,
          description: holiday.description,
          date: holiday.date,
          is_recurring: holiday.is_recurring,
          offices: []
        };
        grouped[month].push(holidayMap[month][nameKey]);
      }

      if (holiday.offices) {
        holidayMap[month][nameKey].offices.push(holiday.offices);
      }
    });

    return grouped;
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Dashboard
          </button>
        </div>

        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">Office Holidays</h2>
            <p className="mt-1 text-sm text-gray-500">
              View office holidays and closures
            </p>
          </div>

          {error && (
            <div className="p-4 bg-red-50">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <p className="text-sm text-red-800">{error}</p>
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
                {Object.entries(groupHolidaysByDate()).map(([month, monthHolidays]) => (
                  <div key={month} className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">{month}</h3>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {monthHolidays.map((holiday, index) => (
                        <div
                          key={`${holiday.name}-${index}`}
                          className="bg-white rounded-lg shadow-sm p-4 border border-gray-200"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <Building2 className="h-5 w-5 text-gray-400" />
                              <span className="text-sm font-medium text-gray-900">
                                {holiday.offices.map(office => office.name).join(', ')}
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
                            <div className="flex items-center text-sm text-gray-500">
                              <MapPin className="h-4 w-4 mr-2" />
                              {holiday.offices.map(office => office.location).join(', ')}
                            </div>
                            {holiday.description && (
                              <div className="flex items-start mt-2 text-sm text-gray-600">
                                <Info className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                                <p>{holiday.description}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}