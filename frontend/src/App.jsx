import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AppShell } from './components/layout/AppShell';
import { SignIn } from './pages/auth/SignIn';

// Employee Pages
import { EmployeeDashboard } from './pages/employee/EmployeeDashboard';
import { ApplyLeave } from './pages/employee/ApplyLeave';
import { MyRequests } from './pages/employee/MyRequests';
import { TeamCalendar } from './pages/employee/TeamCalendar';
import { HolidayCalendar } from './pages/employee/HolidayCalendar';
import { NotificationsPage } from './pages/employee/NotificationsPage';

// Manager Pages
import { ApprovalsQueue } from './pages/manager/ApprovalsQueue';
import { MyTeam } from './pages/manager/MyTeam';
import { Delegation } from './pages/manager/Delegation';
import { Watchers } from './pages/manager/Watchers';

// HR / Admin Pages
import { EmployeeAdmin } from './pages/admin/EmployeeAdmin';
import { LeaveTypeConfig } from './pages/admin/LeaveTypeConfig';
import { HolidayAdmin } from './pages/admin/HolidayAdmin';
import { OrgConfig } from './pages/admin/OrgConfig';
import { BalanceAdjustment } from './pages/admin/BalanceAdjustment';
import { Reports } from './pages/admin/Reports';
import { WorkingPatterns } from './pages/admin/WorkingPatterns';
import { NotificationTemplates } from './pages/admin/NotificationTemplates';
import { AdminDelegations } from './pages/admin/AdminDelegations';
import { SelfApprovalConfig } from './pages/admin/SelfApprovalConfig';
import { Departments } from './pages/admin/Departments';
import { ProfilePage } from './pages/ProfilePage';

import { NotFound } from './pages/NotFound';

export const App = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-gradient)',
          color: '#f8fafc',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: '3px solid rgba(255,255,255,0.1)',
            borderTopColor: '#3b82f6',
            animation: 'spin 1s linear infinite',
          }}
        />
        <p style={{ marginTop: '16px', fontSize: '14.5px', color: 'var(--text-muted)' }}>
          Connecting to LMS 2.0...
        </p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!user) {
    return <SignIn />;
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Employee Panel */}
        <Route path="/dashboard" element={<EmployeeDashboard />} />
        <Route path="/apply" element={<ApplyLeave />} />
        <Route path="/my-requests" element={<MyRequests />} />
        <Route path="/team-calendar" element={<TeamCalendar />} />
        <Route path="/holidays" element={<HolidayCalendar />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/profile" element={<ProfilePage />} />

        {/* Manager Panel */}
        <Route path="/approvals" element={<ApprovalsQueue />} />
        <Route path="/manager/approvals" element={<ApprovalsQueue />} />
        <Route path="/my-team" element={<MyTeam />} />
        <Route path="/manager/my-team" element={<MyTeam />} />
        <Route path="/delegation" element={<Delegation />} />
        <Route path="/manager/delegation" element={<Delegation />} />
        <Route path="/watchers" element={<Watchers />} />
        <Route path="/manager/watchers" element={<Watchers />} />

        {/* HR / Admin Panel */}
        <Route path="/admin/employees" element={<EmployeeAdmin />} />
        <Route path="/admin/leave-types" element={<LeaveTypeConfig />} />
        <Route path="/admin/working-patterns" element={<WorkingPatterns />} />
        <Route path="/admin/notification-templates" element={<NotificationTemplates />} />
        <Route path="/admin/delegations" element={<AdminDelegations />} />
        <Route path="/admin/departments" element={<Departments />} />
        <Route path="/admin/self-approval" element={<SelfApprovalConfig />} />
        <Route path="/admin/holidays" element={<HolidayAdmin />} />
        <Route path="/admin/adjustments" element={<BalanceAdjustment />} />
        <Route path="/admin/configuration" element={<OrgConfig />} />
        <Route path="/admin/reports" element={<Reports />} />

        {/* 404 Fallback */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
};

export default App;
