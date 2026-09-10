import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/* ─── Collapsible nav group (like reference image) ─── */
const NavGroup = ({ label, icon, color = 'var(--text-muted)', defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {/* Group header row */}
      <div
        className="nav-group-header"
        onClick={() => setOpen(!open)}
        role="button"
        aria-expanded={open}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
          <i
            className={`bi bi-${icon}`}
            style={{ fontSize: '15px', color, width: '18px', textAlign: 'center' }}
          />
          <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color }}>
            {label}
          </span>
        </div>
        <i className={`bi bi-chevron-down nav-group-chevron${open ? ' open' : ''}`} />
      </div>

      {/* Animated body */}
      <div
        className="nav-group-body"
        style={{
          maxHeight: open ? '800px' : '0px',
          opacity: open ? 1 : 0,
          paddingLeft: '8px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingTop: '4px', paddingBottom: '4px' }}>
          {children}
        </div>
      </div>
    </div>
  );
};

/* ─── Individual nav link item ─── */
const NavItem = ({ to, icon, label, onClick, badge }) => (
  <NavLink
    to={to}
    onClick={onClick}
    style={({ isActive }) => ({
      display: 'flex',
      alignItems: 'center',
      gap: '11px',
      padding: '9px 12px',
      borderRadius: 'var(--radius-sm)',
      color: isActive ? '#ffffff' : 'var(--text-muted)',
      background: isActive ? 'var(--nav-active-bg)' : 'transparent',
      borderLeft: isActive ? '3px solid var(--nav-active-border)' : '3px solid transparent',
      textDecoration: 'none',
      fontSize: '13.5px',
      fontWeight: isActive ? 600 : 500,
      transition: 'all 0.15s ease',
    })}
  >
    <i className={`bi bi-${icon}`} style={{ fontSize: '15px', width: '16px', textAlign: 'center' }} />
    <span style={{ flex: 1 }}>{label}</span>
    {badge && (
      <span
        style={{
          fontSize: '10px',
          padding: '2px 7px',
          borderRadius: '999px',
          background: 'rgba(14,165,160,0.2)',
          color: '#2dd4bf',
          border: '1px solid rgba(14,165,160,0.4)',
          fontWeight: 700,
        }}
      >
        {badge}
      </span>
    )}
  </NavLink>
);

/* ─── Main Sidebar ─── */
export const Sidebar = ({ isMobileOpen, closeMobile }) => {
  const { user, signOut } = useAuth();
  if (!user) return null;

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          onClick={closeMobile}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(4px)',
            zIndex: 90,
          }}
        />
      )}

      <aside
        className={`glass-panel ${isMobileOpen ? 'mobile-open' : ''}`}
        style={{
          width: 'var(--sidebar-w)',
          height: '100vh',
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 0,
          borderTop: 0,
          borderBottom: 0,
          borderLeft: 0,
          borderRight: '1px solid var(--glass-border)',
          padding: '20px 12px 16px',
          background: 'var(--sidebar-bg)',
          overflowY: 'auto',
          overflowX: 'hidden',
          transform: isMobileOpen ? 'translateX(0)' : undefined,
          transition: 'transform 0.3s ease',
        }}
      >
        {/* ── Brand ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '4px 10px 20px',
            borderBottom: '1px solid rgba(13,148,136,0.15)',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '11px',
              background: 'linear-gradient(135deg, #0d9488 0%, #38bdf8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(13,148,136,0.35)',
              flexShrink: 0,
            }}
          >
            <i className="bi bi-calendar-check" style={{ fontSize: '20px', color: '#fff' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 800, lineHeight: 1.1, color: '#0f2b2b' }}>LMS 2.0</h2>
            <small style={{ color: 'var(--text-subtle)', fontSize: '11px' }}>Leave Management</small>
          </div>
        </div>

        {/* ── Navigation Groups ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Employee Workspace — always visible */}
          <NavGroup label="Employee Workspace" icon="person-workspace" color="#0d9488" defaultOpen>
            <NavItem to="/dashboard"      icon="grid-1x2"      label="Dashboard"       onClick={closeMobile} />
            <NavItem to="/apply"          icon="plus-circle"   label="Apply for Leave" onClick={closeMobile} />
            <NavItem to="/my-requests"    icon="card-checklist"label="My Requests"     onClick={closeMobile} />
            <NavItem to="/team-calendar"  icon="calendar3"     label="Team Calendar"   onClick={closeMobile} />
            <NavItem to="/holidays"       icon="flag"          label="Holidays"        onClick={closeMobile} />
          </NavGroup>

          {/* Manager Panel — visible to managers & HR admins */}
          {(user.isManager || user.isHrAdmin) && (
            <>
              <div style={{ borderTop: '1px solid rgba(13,148,136,0.12)' }} />
              <NavGroup label="Manager Panel" icon="diagram-3" color="#2563eb" defaultOpen>
                <NavItem to="/approvals"   icon="check2-square" label="Approvals Queue" onClick={closeMobile} badge="Action" />
                <NavItem to="/my-team"     icon="people"        label="Team Balances"   onClick={closeMobile} />
                <NavItem to="/delegation"  icon="person-gear"   label="Delegations"     onClick={closeMobile} />
              </NavGroup>
            </>
          )}

          {/* Administration — HR/Admin only */}
          {user.isHrAdmin && (
            <>
              <div style={{ borderTop: '1px solid rgba(13,148,136,0.12)' }} />
              <NavGroup label="HR & Governance" icon="shield-lock" color="#7c3aed" defaultOpen>
                <NavItem to="/admin/employees"            icon="person-badge"        label="Employees"             onClick={closeMobile} />
                <NavItem to="/admin/working-patterns"     icon="clock-history"       label="Working Patterns"      onClick={closeMobile} />
                <NavItem to="/admin/delegations"          icon="person-gear"         label="Delegations"           onClick={closeMobile} />
                <NavItem to="/admin/self-approval"        icon="shield-check"        label="Self-Approval Policy"  onClick={closeMobile} />
              </NavGroup>

              <div style={{ borderTop: '1px solid rgba(13,148,136,0.12)' }} />
              <NavGroup label="System & Policies" icon="sliders" color="#0284c7" defaultOpen>
                <NavItem to="/admin/leave-types"          icon="tags"                label="Leave Types & Policy"  onClick={closeMobile} />
                <NavItem to="/admin/notification-templates" icon="envelope-paper-heart" label="Email Notification Templates" onClick={closeMobile} />
                <NavItem to="/admin/holidays"             icon="calendar-plus"       label="Holiday Calendar"      onClick={closeMobile} />
                <NavItem to="/admin/adjustments"          icon="sliders"             label="Balance Adjustments"   onClick={closeMobile} />
                <NavItem to="/admin/configuration"        icon="gear"                label="Org Configuration"     onClick={closeMobile} />
                <NavItem to="/admin/reports"              icon="file-earmark-bar-graph" label="Reports & LOP"     onClick={closeMobile} />
              </NavGroup>
            </>
          )}
        </div>

        {/* ── Footer: user chip + sign-out ── */}
        <div style={{ borderTop: '1px solid rgba(13,148,136,0.15)', paddingTop: '14px', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* User chip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 10px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--glass-border)',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: user.isHrAdmin
                  ? 'linear-gradient(135deg, #a855f7, #7c3aed)'
                  : user.isManager
                  ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
                  : 'linear-gradient(135deg, #0ea5a0, #0891b2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '13px',
                color: '#fff',
                flexShrink: 0,
              }}
            >
              {user.full_name?.charAt(0) || 'U'}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '12.5px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.full_name}
              </div>
              <div style={{ fontSize: '10.5px', color: 'var(--text-subtle)' }}>
                {user.isHrAdmin ? 'HR / Admin' : user.isManager ? 'Manager' : 'Employee'}
              </div>
            </div>
          </div>

          {/* Sign-out button */}
          <button
            onClick={signOut}
            className="btn-glass btn-danger-glass"
            style={{ width: '100%', justifyContent: 'flex-start', fontSize: '13px' }}
          >
            <i className="bi bi-box-arrow-right" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
