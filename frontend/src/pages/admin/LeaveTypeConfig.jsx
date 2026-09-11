import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { GlassCard } from '../../components/common/GlassCard';
import { Modal } from '../../components/common/Modal';

export const LeaveTypeConfig = () => {
  const [data, setData] = useState({ leaveTypes: [], policies: [] });
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    leave_code: '',
    leave_name: '',
    is_sick_leave: false,
    allows_half_day: true,
    allows_attachment: false,
    carry_forward_allowed: false,
    carry_forward_cap: '',
  });

  const fetchLeaveTypes = () => {
    setLoading(true);
    api('/admin/leave-types')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLeaveTypes();
  }, []);

  const [togglingId, setTogglingId] = useState(null);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api('/admin/leave-types', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setModalOpen(false);
      fetchLeaveTypes();
    } catch (err) {
      alert(err.message || 'Failed to create leave type');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (leaveType) => {
    const nextEnabled = !leaveType.is_employee_selectable;
    if (!window.confirm(
      nextEnabled
        ? `Enable "${leaveType.leave_name}"? Employees will be able to select it when applying for leave.`
        : `Disable "${leaveType.leave_name}"? Employees will no longer be able to select it for new requests. Existing requests are unaffected.`
    )) return;
    setTogglingId(leaveType.leave_type_id);
    try {
      await api(`/admin/leave-types/${leaveType.leave_type_id}/toggle`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      fetchLeaveTypes();
    } catch (err) {
      alert(err.message || 'Failed to update leave type');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="container-fluid" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Leave Types & Policy Configuration</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Configure entitlement, accrual rules, carry-forward caps, and half-day permissions.
          </p>
        </div>

        <button onClick={() => setModalOpen(true)} className="btn-glass btn-primary-glass">
          <i className="bi bi-plus-lg" />
          <span>New Leave Type</span>
        </button>
      </div>

      <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <i className="bi bi-arrow-repeat spin" style={{ fontSize: '28px', color: 'var(--primary)' }} />
            <p style={{ marginTop: '10px' }}>Loading policies...</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="glass-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Leave Type Name</th>
                  <th>Half-Days Allowed</th>
                  <th>Requires Attachment</th>
                  <th>Carry Forward</th>
                  <th>Balance Impact</th>
                  <th>Managed By</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.leaveTypes.map((lt) => {
                  const isLOP = lt.leave_code === 'LOP' || lt.is_system_managed === 1;

                  return (
                    <tr key={lt.leave_type_id}>
                      <td style={{ fontWeight: 700, color: '#93c5fd' }}>{lt.leave_code}</td>
                      <td style={{ fontWeight: 600 }}>{lt.leave_name}</td>
                      <td>
                        {lt.allows_half_day ? (
                          <span style={{ color: '#34d399', fontSize: '13px' }}>✓ Allowed</span>
                        ) : (
                          <span style={{ color: 'var(--text-subtle)', fontSize: '13px' }}>✕ No</span>
                        )}
                      </td>
                      <td>
                        {lt.allows_attachment ? (
                          <span style={{ color: '#60a5fa', fontSize: '13px' }}>✓ Optional/Req</span>
                        ) : (
                          <span style={{ color: 'var(--text-subtle)', fontSize: '13px' }}>✕ No</span>
                        )}
                      </td>
                      <td>
                        {lt.carry_forward_allowed ? (
                          <span style={{ color: '#fbbf24', fontSize: '13px' }}>
                            Cap: {lt.carry_forward_cap || 'Unlimited'} days
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-subtle)', fontSize: '13px' }}>None</span>
                        )}
                      </td>
                      <td>
                        {lt.is_balance_affecting ? (
                          <span style={{ fontSize: '12px', color: '#10b981' }}>Deducts Balance</span>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#f59e0b' }}>Zero-Balance (LOP)</span>
                        )}
                      </td>
                      <td>
                        {isLOP ? (
                          <span
                            style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: '#f87171',
                              fontWeight: 600,
                            }}
                          >
                            Protected System
                          </span>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Configured</span>
                        )}
                      </td>
                      <td>
                        {isLOP ? (
                          <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>N/A</span>
                        ) : lt.is_employee_selectable ? (
                          <span
                            style={{
                              fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: '999px',
                              background: 'rgba(16, 185, 129, 0.15)', color: '#059669', border: '1px solid rgba(16, 185, 129, 0.3)',
                            }}
                          >
                            Enabled
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: '999px',
                              background: 'rgba(239, 68, 68, 0.12)', color: '#dc2626', border: '1px solid rgba(239, 68, 68, 0.25)',
                            }}
                          >
                            Disabled
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {isLOP ? (
                          <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>—</span>
                        ) : (
                          <button
                            onClick={() => handleToggle(lt)}
                            disabled={togglingId === lt.leave_type_id}
                            className={`btn-glass ${lt.is_employee_selectable ? 'btn-danger-glass' : 'btn-success-glass'}`}
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            title={lt.is_employee_selectable ? 'Disable for new applications' : 'Enable for new applications'}
                          >
                            <i className={`bi bi-toggle-${lt.is_employee_selectable ? 'on' : 'off'}`} />
                            <span>{lt.is_employee_selectable ? 'Disable' : 'Enable'}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* New Leave Type Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create New Leave Type"
      >
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Code *</label>
              <input
                type="text"
                className="glass-input"
                placeholder="e.g. ML"
                value={form.leave_code}
                onChange={(e) => setForm({ ...form, leave_code: e.target.value.toUpperCase() })}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Name *</label>
              <input
                type="text"
                className="glass-input"
                placeholder="e.g. Maternity / Paternity Leave"
                value={form.leave_name}
                onChange={(e) => setForm({ ...form, leave_name: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: 'var(--radius-sm)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.is_sick_leave}
                onChange={(e) => setForm({ ...form, is_sick_leave: e.target.checked })}
                style={{ accentColor: '#3b82f6', width: '16px', height: '16px' }}
              />
              <span>Is Medical / Sick Leave (applies the extended-absence alert threshold)</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.allows_half_day}
                onChange={(e) => setForm({ ...form, allows_half_day: e.target.checked })}
                style={{ accentColor: '#3b82f6', width: '16px', height: '16px' }}
              />
              <span>Allow Half-Day Applications</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.allows_attachment}
                onChange={(e) => setForm({ ...form, allows_attachment: e.target.checked })}
                style={{ accentColor: '#3b82f6', width: '16px', height: '16px' }}
              />
              <span>Allow Supporting Document Attachments</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.carry_forward_allowed}
                onChange={(e) => setForm({ ...form, carry_forward_allowed: e.target.checked })}
                style={{ accentColor: '#3b82f6', width: '16px', height: '16px' }}
              />
              <span>Permit Carry-Forward to Next Leave Year</span>
            </label>

            {form.carry_forward_allowed && (
              <div style={{ paddingLeft: '26px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Carry-Forward Cap (Max days carried over)
                </label>
                <input
                  type="number"
                  className="glass-input"
                  style={{ width: '150px' }}
                  placeholder="e.g. 5"
                  value={form.carry_forward_cap}
                  onChange={(e) => setForm({ ...form, carry_forward_cap: e.target.value })}
                />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button type="button" onClick={() => setModalOpen(false)} className="btn-glass">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-glass btn-primary-glass">
              {submitting ? 'Creating...' : 'Save Leave Type'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
