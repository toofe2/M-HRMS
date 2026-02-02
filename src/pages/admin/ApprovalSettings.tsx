import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Settings,
  Users,
  Clock,
  Shield,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  AlertTriangle,
  CheckCircle2,
  Search,
  Filter,
  Download,
  Upload,
  RefreshCw
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ApprovalPage {
  id: string;
  page_name: string;
  display_name: string;
  description: string;
  module_name: string;
  requires_approval: boolean;
  is_active: boolean;
}

interface Role {
  id: string;
  name: string;
  display_name: string;
  description: string;
  permissions: Record<string, any>;
  is_active: boolean;
}

interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  assigned_at: string;
  expires_at?: string;
  is_active: boolean;
  user?: {
    first_name: string;
    last_name: string;
    email: string;
  };
  role?: {
    display_name: string;
    name: string;
  };
}

export default function ApprovalSettings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'pages' | 'roles' | 'assignments'>('pages');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Pages state
  const [pages, setPages] = useState<ApprovalPage[]>([]);
  const [showPageModal, setShowPageModal] = useState(false);
  const [selectedPage, setSelectedPage] = useState<ApprovalPage | null>(null);
  const [pageForm, setPageForm] = useState({
    page_name: '',
    display_name: '',
    description: '',
    module_name: '',
    requires_approval: true,
    is_active: true
  });

  // Roles state
  const [roles, setRoles] = useState<Role[]>([]);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [roleForm, setRoleForm] = useState({
    name: '',
    display_name: '',
    description: '',
    permissions: {},
    is_active: true
  });

  // User roles state
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState({
    user_id: '',
    role_id: '',
    expires_at: ''
  });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (activeTab === 'pages') {
        await fetchPages();
      } else if (activeTab === 'roles') {
        await fetchRoles();
      } else if (activeTab === 'assignments') {
        await fetchUserRoles();
        await fetchEmployees();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPages = async () => {
    const { data, error } = await supabase
      .from('approval_pages')
      .select('*')
      .order('display_name');

    if (error) throw error;
    setPages(data || []);
  };

  const fetchRoles = async () => {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .order('display_name');

    if (error) throw error;
    setRoles(data || []);
  };

  const fetchUserRoles = async () => {
    const { data, error } = await supabase
      .from('user_roles')
      .select(`
        *,
        user:profiles!user_roles_user_id_fkey(first_name, last_name, email),
        role:roles!user_roles_role_id_fkey(display_name, name)
      `)
      .eq('is_active', true)
      .order('assigned_at', { ascending: false });

    if (error) throw error;
    setUserRoles(data || []);
  };

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .order('first_name');

    if (error) throw error;
    setEmployees(data || []);
  };

  const handleSavePage = async () => {
    try {
      setError(null);
      setSuccess(null);

      if (selectedPage) {
        // تحديث صفحة موجودة
        const { error } = await supabase
          .from('approval_pages')
          .update({
            ...pageForm,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedPage.id);

        if (error) throw error;
        setSuccess('تم تحديث الصفحة بنجاح');
      } else {
        // إنشاء صفحة جديدة
        const { error } = await supabase
          .from('approval_pages')
          .insert([pageForm]);

        if (error) throw error;
        setSuccess('تم إنشاء الصفحة بنجاح');
      }

      setShowPageModal(false);
      fetchPages();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSaveRole = async () => {
    try {
      setError(null);
      setSuccess(null);

      if (selectedRole) {
        // تحديث دور موجود
        const { error } = await supabase
          .from('roles')
          .update({
            ...roleForm,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedRole.id);

        if (error) throw error;
        setSuccess('تم تحديث الدور بنجاح');
      } else {
        // إنشاء دور جديد
        const { error } = await supabase
          .from('roles')
          .insert([roleForm]);

        if (error) throw error;
        setSuccess('تم إنشاء الدور بنجاح');
      }

      setShowRoleModal(false);
      fetchRoles();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAssignRole = async () => {
    try {
      setError(null);
      setSuccess(null);

      const { error } = await supabase
        .from('user_roles')
        .insert([{
          ...assignmentForm,
          expires_at: assignmentForm.expires_at || null
        }]);

      if (error) throw error;

      setSuccess('تم تعيين الدور بنجاح');
      setShowAssignmentModal(false);
      setAssignmentForm({ user_id: '', role_id: '', expires_at: '' });
      fetchUserRoles();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeletePage = async (pageId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الصفحة؟')) return;

    try {
      const { error } = await supabase
        .from('approval_pages')
        .delete()
        .eq('id', pageId);

      if (error) throw error;
      setSuccess('تم حذف الصفحة بنجاح');
      fetchPages();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الدور؟')) return;

    try {
      const { error } = await supabase
        .from('roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;
      setSuccess('تم حذف الدور بنجاح');
      fetchRoles();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRevokeRole = async (userRoleId: string) => {
    if (!confirm('هل أنت متأكد من إلغاء تعيين هذا الدور؟')) return;

    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ is_active: false })
        .eq('id', userRoleId);

      if (error) throw error;
      setSuccess('تم إلغاء تعيين الدور بنجاح');
      fetchUserRoles();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const TabButton = ({ 
    tab, 
    current, 
    icon: Icon, 
    label 
  }: { 
    tab: string; 
    current: string; 
    icon: React.ElementType; 
    label: string; 
  }) => (
    <button
      onClick={() => setActiveTab(tab as any)}
      className={`flex items-center px-6 py-3 rounded-lg font-medium transition-colors ${
        tab === current
          ? 'bg-blue-100 text-blue-800 border border-blue-200'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      <Icon className="h-5 w-5 ml-2 rtl:ml-0 rtl:mr-2" />
      <span>{label}</span>
    </button>
  );

  const renderPagesTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">إدارة الصفحات</h3>
        <button
          onClick={() => {
            setSelectedPage(null);
            setPageForm({
              page_name: '',
              display_name: '',
              description: '',
              module_name: '',
              requires_approval: true,
              is_active: true
            });
            setShowPageModal(true);
          }}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4 ml-2 rtl:ml-0 rtl:mr-2" />
          إضافة صفحة
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th className="px-6 py-3 bg-gray-50 text-right rtl:text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                اسم الصفحة
              </th>
              <th className="px-6 py-3 bg-gray-50 text-right rtl:text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                الوحدة
              </th>
              <th className="px-6 py-3 bg-gray-50 text-right rtl:text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                تتطلب موافقة
              </th>
              <th className="px-6 py-3 bg-gray-50 text-right rtl:text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                الحالة
              </th>
              <th className="px-6 py-3 bg-gray-50 text-right rtl:text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                الإجراءات
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {pages.map((page) => (
              <tr key={page.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {page.display_name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {page.page_name}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {page.module_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    page.requires_approval 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {page.requires_approval ? 'نعم' : 'لا'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    page.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {page.is_active ? 'نشط' : 'غير نشط'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right rtl:text-left text-sm font-medium">
                  <div className="flex items-center space-x-2 rtl:space-x-reverse">
                    <button
                      onClick={() => {
                        setSelectedPage(page);
                        setPageForm({
                          page_name: page.page_name,
                          display_name: page.display_name,
                          description: page.description || '',
                          module_name: page.module_name,
                          requires_approval: page.requires_approval,
                          is_active: page.is_active
                        });
                        setShowPageModal(true);
                      }}
                      className="text-blue-600 hover:text-blue-900 p-1"
                      title="تعديل"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeletePage(page.id)}
                      className="text-red-600 hover:text-red-900 p-1"
                      title="حذف"
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
    </div>
  );

  const renderRolesTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">إدارة الأدوار</h3>
        <button
          onClick={() => {
            setSelectedRole(null);
            setRoleForm({
              name: '',
              display_name: '',
              description: '',
              permissions: {},
              is_active: true
            });
            setShowRoleModal(true);
          }}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4 ml-2 rtl:ml-0 rtl:mr-2" />
          إضافة دور
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th className="px-6 py-3 bg-gray-50 text-right rtl:text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                اسم الدور
              </th>
              <th className="px-6 py-3 bg-gray-50 text-right rtl:text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                الوصف
              </th>
              <th className="px-6 py-3 bg-gray-50 text-right rtl:text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                الحالة
              </th>
              <th className="px-6 py-3 bg-gray-50 text-right rtl:text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                الإجراءات
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {roles.map((role) => (
              <tr key={role.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {role.display_name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {role.name}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900 max-w-xs truncate">
                    {role.description || '-'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    role.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {role.is_active ? 'نشط' : 'غير نشط'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right rtl:text-left text-sm font-medium">
                  <div className="flex items-center space-x-2 rtl:space-x-reverse">
                    <button
                      onClick={() => {
                        setSelectedRole(role);
                        setRoleForm({
                          name: role.name,
                          display_name: role.display_name,
                          description: role.description || '',
                          permissions: role.permissions || {},
                          is_active: role.is_active
                        });
                        setShowRoleModal(true);
                      }}
                      className="text-blue-600 hover:text-blue-900 p-1"
                      title="تعديل"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteRole(role.id)}
                      className="text-red-600 hover:text-red-900 p-1"
                      title="حذف"
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
    </div>
  );

  const renderAssignmentsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">تعيين الأدوار</h3>
        <button
          onClick={() => {
            setAssignmentForm({ user_id: '', role_id: '', expires_at: '' });
            setShowAssignmentModal(true);
          }}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4 ml-2 rtl:ml-0 rtl:mr-2" />
          تعيين دور
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th className="px-6 py-3 bg-gray-50 text-right rtl:text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                الموظف
              </th>
              <th className="px-6 py-3 bg-gray-50 text-right rtl:text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                الدور
              </th>
              <th className="px-6 py-3 bg-gray-50 text-right rtl:text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                تاريخ التعيين
              </th>
              <th className="px-6 py-3 bg-gray-50 text-right rtl:text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                تاريخ الانتهاء
              </th>
              <th className="px-6 py-3 bg-gray-50 text-right rtl:text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                الإجراءات
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {userRoles.map((userRole) => (
              <tr key={userRole.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {userRole.user ? 
                        `${userRole.user.first_name} ${userRole.user.last_name}` : 
                        'غير محدد'
                      }
                    </div>
                    <div className="text-sm text-gray-500">
                      {userRole.user?.email}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {userRole.role?.display_name || 'غير محدد'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(userRole.assigned_at).toLocaleDateString('ar-SA')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {userRole.expires_at ? 
                    new Date(userRole.expires_at).toLocaleDateString('ar-SA') : 
                    'دائم'
                  }
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right rtl:text-left text-sm font-medium">
                  <button
                    onClick={() => handleRevokeRole(userRole.id)}
                    className="text-red-600 hover:text-red-900 p-1"
                    title="إلغاء التعيين"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4 rtl:space-x-reverse">
            <button
              onClick={() => navigate('/admin/settings')}
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 ml-2 rtl:ml-0 rtl:mr-2" />
              العودة للإعدادات
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">إعدادات نظام الموافقات</h1>
              <p className="text-gray-600 mt-1">إدارة الصفحات والأدوار وسير العمل</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-400 ml-2 rtl:ml-0 rtl:mr-2" />
              <span className="text-red-700">{error}</span>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <CheckCircle2 className="h-5 w-5 text-green-400 ml-2 rtl:ml-0 rtl:mr-2" />
              <span className="text-green-700">{success}</span>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-4 mb-8">
          <TabButton
            tab="pages"
            current={activeTab}
            icon={Settings}
            label="الصفحات"
          />
          <TabButton
            tab="roles"
            current={activeTab}
            icon={Shield}
            label="الأدوار"
          />
          <TabButton
            tab="assignments"
            current={activeTab}
            icon={Users}
            label="تعيين الأدوار"
          />
        </div>

        {/* Tab Content */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <>
            {activeTab === 'pages' && renderPagesTab()}
            {activeTab === 'roles' && renderRolesTab()}
            {activeTab === 'assignments' && renderAssignmentsTab()}
          </>
        )}
      </div>

      {/* Page Modal */}
      {showPageModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedPage ? 'تعديل الصفحة' : 'إضافة صفحة جديدة'}
              </h3>
              <button
                onClick={() => setShowPageModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  اسم الصفحة (تقني) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={pageForm.page_name}
                  onChange={(e) => setPageForm(prev => ({ ...prev, page_name: e.target.value }))}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="مثال: leave_requests"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الاسم المعروض <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={pageForm.display_name}
                  onChange={(e) => setPageForm(prev => ({ ...prev, display_name: e.target.value }))}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="مثال: طلبات الإجازة"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الوصف
                </label>
                <textarea
                  value={pageForm.description}
                  onChange={(e) => setPageForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="وصف مختصر للصفحة..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  اسم الوحدة <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={pageForm.module_name}
                  onChange={(e) => setPageForm(prev => ({ ...prev, module_name: e.target.value }))}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="مثال: leave_management"
                  required
                />
              </div>

              <div className="flex items-center space-x-4 rtl:space-x-reverse">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={pageForm.requires_approval}
                    onChange={(e) => setPageForm(prev => ({ ...prev, requires_approval: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="mr-2 rtl:mr-0 rtl:ml-2 text-sm text-gray-700">
                    تتطلب موافقة
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={pageForm.is_active}
                    onChange={(e) => setPageForm(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="mr-2 rtl:mr-0 rtl:ml-2 text-sm text-gray-700">
                    نشط
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 rtl:space-x-reverse mt-6">
              <button
                onClick={() => setShowPageModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500"
              >
                إلغاء
              </button>
              <button
                onClick={handleSavePage}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save className="h-4 w-4 ml-2 rtl:ml-0 rtl:mr-2" />
                {selectedPage ? 'تحديث' : 'إنشاء'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedRole ? 'تعديل الدور' : 'إضافة دور جديد'}
              </h3>
              <button
                onClick={() => setShowRoleModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  اسم الدور (تقني) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="مثال: manager"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الاسم المعروض <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={roleForm.display_name}
                  onChange={(e) => setRoleForm(prev => ({ ...prev, display_name: e.target.value }))}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="مثال: مدير"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الوصف
                </label>
                <textarea
                  value={roleForm.description}
                  onChange={(e) => setRoleForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="وصف مختصر للدور..."
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={roleForm.is_active}
                  onChange={(e) => setRoleForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="mr-2 rtl:mr-0 rtl:ml-2 text-sm text-gray-700">
                  نشط
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 rtl:space-x-reverse mt-6">
              <button
                onClick={() => setShowRoleModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveRole}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save className="h-4 w-4 ml-2 rtl:ml-0 rtl:mr-2" />
                {selectedRole ? 'تحديث' : 'إنشاء'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      {showAssignmentModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">تعيين دور جديد</h3>
              <button
                onClick={() => setShowAssignmentModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الموظف <span className="text-red-500">*</span>
                </label>
                <select
                  value={assignmentForm.user_id}
                  onChange={(e) => setAssignmentForm(prev => ({ ...prev, user_id: e.target.value }))}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                >
                  <option value="">اختر الموظف</option>
                  {employees.map(employee => (
                    <option key={employee.id} value={employee.id}>
                      {employee.first_name} {employee.last_name} ({employee.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الدور <span className="text-red-500">*</span>
                </label>
                <select
                  value={assignmentForm.role_id}
                  onChange={(e) => setAssignmentForm(prev => ({ ...prev, role_id: e.target.value }))}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                >
                  <option value="">اختر الدور</option>
                  {roles.filter(role => role.is_active).map(role => (
                    <option key={role.id} value={role.id}>
                      {role.display_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  تاريخ الانتهاء (اختياري)
                </label>
                <input
                  type="datetime-local"
                  value={assignmentForm.expires_at}
                  onChange={(e) => setAssignmentForm(prev => ({ ...prev, expires_at: e.target.value }))}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  اتركه فارغاً للتعيين الدائم
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 rtl:space-x-reverse mt-6">
              <button
                onClick={() => setShowAssignmentModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500"
              >
                إلغاء
              </button>
              <button
                onClick={handleAssignRole}
                disabled={!assignmentForm.user_id || !assignmentForm.role_id}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Save className="h-4 w-4 ml-2 rtl:ml-0 rtl:mr-2" />
                تعيين الدور
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}