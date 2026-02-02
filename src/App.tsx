// src/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NotFound from './pages/NotFound';
import PersonalInfo from './pages/PersonalInfo';
import Vacation from './pages/Vacation';
import Attendance from './pages/Attendance';
import OfficeHolidays from './pages/OfficeHolidays';

import Timesheet from './pages/Timesheet';
import Payroll from './pages/Payroll';
import SalaryAdvance from './pages/SalaryAdvance';
import RequestApproval from './pages/RequestApproval';
import TravelRequest from './pages/TravelRequest';

import EmailNotificationService from './components/EmailNotificationService';


// Admin
import AdminSettings from './pages/AdminSettings';
import AdminEmployees from './pages/admin/AdminEmployees';
import AdminLeave from './pages/admin/AdminLeave';
import AdminSystem from './pages/admin/AdminSystem';
import AdminAttendance from './pages/admin/AdminAttendance';
import LeaveReports from './pages/admin/LeaveReports';
import LeaveSettings from './pages/admin/LeaveSettings';
import EmployeeLeave from './pages/admin/EmployeeLeave';
import DepartmentsPositions from './pages/admin/DepartmentsPositions';
import AdminOfficeHolidays from './pages/admin/AdminOfficeHolidays';
import NotificationMonitoring from './pages/admin/NotificationMonitoring';
import BulkOperations from './pages/admin/BulkOperations';
import ApprovalManagement from './pages/admin/ApprovalManagement';
import ApprovalSettings from './pages/admin/ApprovalSettings';
import AdminProgramsSettings from './pages/admin/AdminProgramsSettings';
import AdminPayroll from './pages/admin/AdminPayroll';
import AdminProcurementMasters from './pages/admin/AdminProcurementMasters';

// Procurement – NEW
// ProcurementDashboard route is hidden; keep sub-pages accessible
import ProcurementApprovals from './pages/procurement/ProcurementApprovals';


import ActivityPlans from './pages/procurement/activity-plans/ActivityPlans';
import ActivityPlanForm from './pages/procurement/activity-plans/ActivityPlanForm';
import ActivityPlanDetails from './pages/procurement/activity-plans/ActivityPlanDetails';

import ProcurementSummaryRequests from './pages/procurement/summary-requests/ProcurementSummaryRequests';
import SummaryDetail from './pages/procurement/summary-requests/SummaryDetail';


import PRList from './pages/procurement/pr/PRList';
import PRDetail from './pages/procurement/pr/PRDetail';

import POList from './pages/procurement/po/POList';
import PODetail from './pages/procurement/po/PODetail';

import GRNList from './pages/procurement/grn/GRNList';
import GRNDetail from './pages/procurement/grn/GRNDetail';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuthStore();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading…
      </div>
    );
  }
  return user ? <>{children}</> : <Navigate to="/login" replace />;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAdmin, loading } = useAuthStore();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading…
      </div>
    );
  }
  return isAdmin ? <>{children}</> : <Navigate to="/" replace />;
};

export default function App() {
  const { initialize } = useAuthStore();

  React.useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <BrowserRouter>
      <EmailNotificationService>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Core */}
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/personal-info"
            element={
              <PrivateRoute>
                <PersonalInfo />
              </PrivateRoute>
            }
          />
          <Route
            path="/vacation"
            element={
              <PrivateRoute>
                <Vacation />
              </PrivateRoute>
            }
          />
          <Route
            path="/attendance"
            element={
              <PrivateRoute>
                <Attendance />
              </PrivateRoute>
            }
          />
          <Route
            path="/office-holidays"
            element={
              <PrivateRoute>
                <OfficeHolidays />
              </PrivateRoute>
            }
          />
          <Route
            path="/timesheet"
            element={
              <PrivateRoute>
                <Timesheet />
              </PrivateRoute>
            }
          />
          <Route
            path="/payroll"
            element={
              <PrivateRoute>
                <Payroll />
              </PrivateRoute>
            }
          />
          <Route
            path="/salary-advance"
            element={
              <PrivateRoute>
                <SalaryAdvance />
              </PrivateRoute>
            }
          />
          {/* Approvals Inbox removed */}
          <Route path="/approvals/inbox" element={<NotFound />} />
          <Route
            path="/request-approval"
            element={
              <PrivateRoute>
                <RequestApproval />
              </PrivateRoute>
            }
          />
          <Route
            path="/procurement/travel"
            element={
              <PrivateRoute>
                <TravelRequest />
              </PrivateRoute>
            }
          />

          {/* PROCUREMENT – NEW SYSTEM */}
          {/* Hide Procurement landing page: redirect to Summary Requests */}
          <Route path="/procurement" element={<Navigate to="/procurement/summary" replace />} />
<Route
  path="/procurement/approvals"
  element={
    <PrivateRoute>
      <ProcurementApprovals />
    </PrivateRoute>
  }
/>

          {/* Activity Plans */}
          <Route
            path="/procurement/activity-plans"
            element={
              <PrivateRoute>
                <ActivityPlans />
              </PrivateRoute>
            }
          />

          <Route
            path="/procurement/activity-plans/new"
            element={
              <PrivateRoute>
                <ActivityPlanForm />
              </PrivateRoute>
            }
          />
          {/* ✅ Details (Open) */}
          <Route
            path="/procurement/activity-plans/:id"
            element={
              <PrivateRoute>
                <ActivityPlanDetails />
              </PrivateRoute>
            }
          />

          {/* Summary Requests (SR snapshot) */}
          <Route
            path="/procurement/summary"
            element={
              <PrivateRoute>
                <ProcurementSummaryRequests />
              </PrivateRoute>
            }
          />
          <Route
            path="/procurement/summary/:id"
            element={
              <PrivateRoute>
                <SummaryDetail />
              </PrivateRoute>
            }
          />
          {/* ✅ Edit form */}
          <Route
            path="/procurement/activity-plans/:id/edit"
            element={
              <PrivateRoute>
                <ActivityPlanForm />
              </PrivateRoute>
            }
          />

          {/* PR */}
          <Route
            path="/procurement/pr"
            element={
              <PrivateRoute>
                <PRList />
              </PrivateRoute>
            }
          />
          <Route
            path="/procurement/pr/:id"
            element={
              <PrivateRoute>
                <PRDetail />
              </PrivateRoute>
            }
          />

          {/* PO */}
          <Route
            path="/procurement/po"
            element={
              <PrivateRoute>
                <POList />
              </PrivateRoute>
            }
          />
          <Route
            path="/procurement/po/:id"
            element={
              <PrivateRoute>
                <PODetail />
              </PrivateRoute>
            }
          />

          {/* GRN */}
          <Route
            path="/procurement/grn"
            element={
              <PrivateRoute>
                <GRNList />
              </PrivateRoute>
            }
          />
          <Route
            path="/procurement/grn/:id"
            element={
              <PrivateRoute>
                <GRNDetail />
              </PrivateRoute>
            }
          />

          {/* ADMIN */}
          <Route
            path="/admin/settings"
            element={
              <PrivateRoute>
                <AdminRoute>
                  <AdminSettings />
                </AdminRoute>
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/employees"
            element={
              <PrivateRoute>
                <AdminRoute>
                  <AdminEmployees />
                </AdminRoute>
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/leave"
            element={
              <PrivateRoute>
                <AdminRoute>
                  <AdminLeave />
                </AdminRoute>
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/leave/reports"
            element={
              <PrivateRoute>
                <AdminRoute>
                  <LeaveReports />
                </AdminRoute>
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/leave/settings"
            element={
              <PrivateRoute>
                <AdminRoute>
                  <LeaveSettings />
                </AdminRoute>
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/leave/employee-leave"
            element={
              <PrivateRoute>
                <AdminRoute>
                  <EmployeeLeave />
                </AdminRoute>
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/leave/bulk-operations"
            element={
              <PrivateRoute>
                <AdminRoute>
                  <BulkOperations />
                </AdminRoute>
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/system"
            element={
              <PrivateRoute>
                <AdminRoute>
                  <AdminSystem />
                </AdminRoute>
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/attendance"
            element={
              <PrivateRoute>
                <AdminRoute>
                  <AdminAttendance />
                </AdminRoute>
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/departments"
            element={
              <PrivateRoute>
                <AdminRoute>
                  <DepartmentsPositions />
                </AdminRoute>
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/office-holidays"
            element={
              <PrivateRoute>
                <AdminRoute>
                  <AdminOfficeHolidays />
                </AdminRoute>
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/notifications"
            element={
              <PrivateRoute>
                <AdminRoute>
                  <NotificationMonitoring />
                </AdminRoute>
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/programs-settings"
            element={
              <PrivateRoute>
                <AdminRoute>
                  <AdminProgramsSettings />
                </AdminRoute>
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/approvals"
            element={
              <PrivateRoute>
                <AdminRoute>
                  <ApprovalManagement />
                </AdminRoute>
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/approval-settings"
            element={
              <PrivateRoute>
                <AdminRoute>
                  <ApprovalSettings />
                </AdminRoute>
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/payroll"
            element={
              <PrivateRoute>
                <AdminRoute>
                  <AdminPayroll />
                </AdminRoute>
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/procurement"
            element={
              <PrivateRoute>
                <AdminRoute>
                  <AdminProcurementMasters />
                </AdminRoute>
              </PrivateRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </EmailNotificationService>
    </BrowserRouter>
  );
}
