import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { GlassCard } from '../../components/common/GlassCard';

export const SelfApprovalConfig = () => {
  const [settings, setSettings] = useState({
    self_approval_manager_enabled: false,
    self_approval_hr_enabled: false,
    self_approval_max_days: 2,
    self_approval_notify_supervisor: true,
    self_approval_allow_sick_leave: false,
    self_approval_policy_notes: '',
  });

  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  // Policy Simulator State
  const [simRole, setSimRole] = useState('MANAGER');
  const [simDays, setSimDays] = useState(2);
  const [simLeaveType, setSimLeaveType] = useState('ANNUAL');

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api('/admin/self-approval');
      if (res.settings) setSettings(res.settings);
      if (res.violations) setViolations(res.violations);
    } catch (err) {
      console.error('Failed to fetch self approval settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSavedFeedback(false);
    try {
      await api('/admin/self-approval', {
        method: 'POST',
        body: JSON.stringify({ settings }),
      });
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 3000);
    } catch (err) {
      alert(err.message || 'Failed to update self-approval settings');
    } finally {
      setSaving(false);
    }
  };

  // Evaluate Simulation
  const evaluateSimulation = () => {
    if (simLeaveType === 'SICK' && !settings.self_approval_allow_sick_leave) {
      return {
        allowed: false,
        badge: 'Rerouted',
        color: '#d97706',
        bg: 'rgba(217,119,6,0.14)',
        message: 'Sick leave self-approval is prohibited by policy. The request will route to your supervisor or HR.',
      };
    }

    if (simRole === 'MANAGER') {
      if (!settings.self_approval_manager_enabled) {
        return {
          allowed: false,
          badge: 'Blocked & Escalated',
          color: '#dc2626',
          bg: 'rgba(220,38,38,0.14)',
          message: 'Level 1 Manager self-approval is disabled. Per FRD Section 3.4, the request routes to the manager’s supervisor.',
        };
      }
      if (simDays > settings.self_approval_max_days) {
        return {
          allowed: false,
          badge: 'Threshold Exceeded',
          color: '#d97706',
          bg: 'rgba(217,119,6,0.14)',
          message: `Request exceeds max self-approval limit of ${settings.self_approval_max_days} day(s). It will escalate to the manager’s supervisor.`,
        };
      }
      return {
        allowed: true,
        badge: 'Permitted',
        color: '#059669',
        bg: 'rgba(5,150,105,0.14)',
        message: `Self-approval permitted for up to ${settings.self_approval_max_days} days.${settings.self_approval_notify_supervisor ? ' An automated audit notice will be emailed to your supervisor.' : ''}`,
      };
    }

    if (simRole === 'HR_ADMIN') {
      if (!settings.self_approval_hr_enabled) {
        return {
          allowed: false,
          badge: 'Blocked & Escalated',
          color: '#dc2626',
          bg: 'rgba(220,38,38,0.14)',
          message: 'Level 2 HR Admin self-approval is disabled. Request routes to senior executive authority.',
        };
      }
      if (simDays > settings.self_approval_max_days) {
        return {
          allowed: false,
          badge: 'Threshold Exceeded',
          color: '#d97706',
          bg: 'rgba(217,119,6,0.14)',
          message: `Exceeds max allowed self-approval limit of ${settings.self_approval_max_days} day(s).`,
        };
      }
      return {
        allowed: true,
        badge: 'Permitted',
        color: '#059669',
        bg: 'rgba(5,150,105,0.14)',
        message: 'HR Admin self-approval granted per current configuration settings.',
      };
    }

    return {
      allowed: false,
      badge: 'Not Applicable',
      color: '#6b7280',
      bg: 'rgba(0,0,0,0.06)',
      message: 'Standard employees cannot self-approve; requests always route to reporting manager.',
    };
  };

  const simResult = evaluateSimulation();

  return (
    <div className="container-fluid" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(13,148,136,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
                fontSize: '18px',
              }}
            >
              <i className="bi bi-shield-lock" />
            </span>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Self-Approval Policy Configuration
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', marginTop: '6px', maxWidth: '750px' }}>
            Configure approval authority levels and restrictions for supervisory roles. Self-approval is restricted by default to maintain corporate governance.
          </p>
        </div>

        {savedFeedback && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(5,150,105,0.15)',
              border: '1px solid rgba(5,150,105,0.3)',
              color: '#059669',
              fontWeight: 700,
              fontSize: '13px',
            }}
          >
            <i className="bi bi-check2-circle" style={{ fontSize: '16px' }} />
            Settings saved successfully!
          </div>
        )}
      </div>

      {/* ── Two Column Layout: Configuration on Left, Simulator & Audit on Right ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
        {/* ── Left Column: Config Toggles & Parameters ── */}
        <GlassCard>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ borderBottom: '1px solid rgba(13,148,136,0.15)', paddingBottom: '10px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>
                Approval Authority Levels
              </h2>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Enable or restrict self-approval rights across organisational tiers.
              </p>
            </div>

            {/* Level 1: Manager Self-Approval */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(255,255,255,0.45)',
                border: '1px solid rgba(13,148,136,0.12)',
              }}
            >
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)' }}>
                  Level 1: Manager Self-Approval
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-subtle)', marginTop: '2px' }}>
                  Allow reporting managers to approve their own leave requests up to the configured day limit.
                </div>
              </div>
              <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={settings.self_approval_manager_enabled}
                  onChange={(e) => setSettings({ ...settings, self_approval_manager_enabled: e.target.checked })}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span
                  style={{
                    position: 'absolute',
                    cursor: 'pointer',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: settings.self_approval_manager_enabled ? 'var(--primary)' : '#cbd5e1',
                    borderRadius: '24px',
                    transition: '0.2s',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      height: '18px',
                      width: '18px',
                      left: settings.self_approval_manager_enabled ? '23px' : '3px',
                      bottom: '3px',
                      backgroundColor: 'white',
                      borderRadius: '50%',
                      transition: '0.2s',
                    }}
                  />
                </span>
              </label>
            </div>

            {/* Level 2: HR Administrator Self-Approval */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(255,255,255,0.45)',
                border: '1px solid rgba(13,148,136,0.12)',
              }}
            >
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)' }}>
                  Level 2: HR Admin / Executive Self-Approval
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-subtle)', marginTop: '2px' }}>
                  Allow HR Admin personnel to finalize their own requests without second-stage HR escalation.
                </div>
              </div>
              <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={settings.self_approval_hr_enabled}
                  onChange={(e) => setSettings({ ...settings, self_approval_hr_enabled: e.target.checked })}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span
                  style={{
                    position: 'absolute',
                    cursor: 'pointer',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: settings.self_approval_hr_enabled ? 'var(--primary)' : '#cbd5e1',
                    borderRadius: '24px',
                    transition: '0.2s',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      height: '18px',
                      width: '18px',
                      left: settings.self_approval_hr_enabled ? '23px' : '3px',
                      bottom: '3px',
                      backgroundColor: 'white',
                      borderRadius: '50%',
                      transition: '0.2s',
                    }}
                  />
                </span>
              </label>
            </div>

            {/* Max Consecutive Days Limit */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                  Max Days Permitted *
                </label>
                <select
                  className="input-glass"
                  value={settings.self_approval_max_days}
                  onChange={(e) => setSettings({ ...settings, self_approval_max_days: parseInt(e.target.value, 10) })}
                  style={{ width: '100%' }}
                >
                  <option value={1}>1 Day Max</option>
                  <option value={2}>2 Days Max</option>
                  <option value={3}>3 Days Max</option>
                  <option value={5}>5 Days Max</option>
                  <option value={10}>10 Days Max</option>
                </select>
                <span style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: '2px', display: 'block' }}>
                  Longer leaves route automatically upward.
                </span>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                  Supervisor Email Notification
                </label>
                <select
                  className="input-glass"
                  value={settings.self_approval_notify_supervisor ? 'true' : 'false'}
                  onChange={(e) => setSettings({ ...settings, self_approval_notify_supervisor: e.target.value === 'true' })}
                  style={{ width: '100%' }}
                >
                  <option value="true">Always Notify Supervisor</option>
                  <option value="false">Suppress Notification</option>
                </select>
                <span style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: '2px', display: 'block' }}>
                  Dispatches audit notification email.
                </span>
              </div>
            </div>

            {/* Sick Leave Exception Toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(255,255,255,0.45)',
                border: '1px solid rgba(13,148,136,0.12)',
              }}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                  Allow Self-Approval for Sick Leave
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-subtle)' }}>
                  When disabled, medical leave requests must always be reviewed by supervisor or HR.
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.self_approval_allow_sick_leave}
                onChange={(e) => setSettings({ ...settings, self_approval_allow_sick_leave: e.target.checked })}
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
            </div>

            {/* Policy Notes */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                Corporate Policy Notes &amp; Audit Rationale
              </label>
              <textarea
                rows={3}
                className="input-glass"
                placeholder="Explain the organization's governance rules regarding self-approval..."
                value={settings.self_approval_policy_notes}
                onChange={(e) => setSettings({ ...settings, self_approval_policy_notes: e.target.value })}
                style={{ width: '100%', fontSize: '12.5px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button type="submit" disabled={saving} className="btn-glass btn-primary-glass" style={{ padding: '8px 20px' }}>
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </form>
        </GlassCard>

        {/* ── Right Column: Interactive Policy Simulator & Audit Log ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Policy Simulator */}
          <GlassCard>
            <div style={{ borderBottom: '1px solid rgba(13,148,136,0.15)', paddingBottom: '10px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="bi bi-cpu" style={{ color: 'var(--primary)', fontSize: '16px' }} />
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  Live Policy Routing Simulator
                </h3>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Test how the current configuration responds to a sample self-approval request.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-subtle)', display: 'block', marginBottom: '3px' }}>
                  Applicant Role
                </label>
                <select
                  className="input-glass"
                  value={simRole}
                  onChange={(e) => setSimRole(e.target.value)}
                  style={{ width: '100%', fontSize: '12px' }}
                >
                  <option value="MANAGER">Manager</option>
                  <option value="HR_ADMIN">HR / Admin</option>
                  <option value="EMPLOYEE">Employee</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-subtle)', display: 'block', marginBottom: '3px' }}>
                  Leave Type
                </label>
                <select
                  className="input-glass"
                  value={simLeaveType}
                  onChange={(e) => setSimLeaveType(e.target.value)}
                  style={{ width: '100%', fontSize: '12px' }}
                >
                  <option value="ANNUAL">Annual Leave</option>
                  <option value="SICK">Sick Leave</option>
                  <option value="CASUAL">Casual Leave</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-subtle)', display: 'block', marginBottom: '3px' }}>
                  Deducted Days
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  className="input-glass"
                  value={simDays}
                  onChange={(e) => setSimDays(parseInt(e.target.value, 10) || 1)}
                  style={{ width: '100%', fontSize: '12px' }}
                />
              </div>
            </div>

            {/* Simulation Result Card */}
            <div
              style={{
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                background: simResult.bg,
                border: `1px solid ${simResult.color}44`,
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: simResult.color }}>
                  System Outcome:
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: 'white',
                    color: simResult.color,
                    border: `1px solid ${simResult.color}55`,
                  }}
                >
                  {simResult.badge}
                </span>
              </div>
              <div style={{ fontSize: '12.5px', color: '#1e293b', lineHeight: 1.4 }}>
                {simResult.message}
              </div>
            </div>
          </GlassCard>

          {/* Violations & Routing Log */}
          <GlassCard>
            <div style={{ borderBottom: '1px solid rgba(13,148,136,0.15)', paddingBottom: '10px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="bi bi-shield-exclamation" style={{ color: 'var(--primary)', fontSize: '16px' }} />
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  Self-Approval Enforcement &amp; Audit Log
                </h3>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Audited records from MySQL self_approvals table.
              </p>
            </div>

            {violations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 10px', color: 'var(--text-subtle)', fontSize: '13px' }}>
                <i className="bi bi-shield-check" style={{ fontSize: '28px', display: 'block', marginBottom: '6px', color: '#059669' }} />
                No self-approval violations or attempts recorded yet.
              </div>
            ) : (
              <div className="table-responsive" style={{ maxHeight: '260px', overflowY: 'auto' }}>
                <table className="glass-table" style={{ width: '100%', fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th>Applicant</th>
                      <th>Request #</th>
                      <th>Level</th>
                      <th>Violation Type</th>
                      <th>Rerouted To</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {violations.map((v) => (
                      <tr key={v.self_approval_id}>
                        <td>
                          <span style={{ fontWeight: 600 }}>{v.attempted_by_name}</span>
                        </td>
                        <td>{v.request_number || 'N/A'}</td>
                        <td>Level {v.approval_level}</td>
                        <td>
                          <span style={{ color: '#dc2626', fontWeight: 700, fontSize: '11px' }}>
                            {v.violation_type}
                          </span>
                        </td>
                        <td>{v.routed_to_name || 'HR Admin'}</td>
                        <td>{new Date(v.attempted_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
};
