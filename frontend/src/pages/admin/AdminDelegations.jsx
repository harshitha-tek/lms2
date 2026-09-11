import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { GlassCard } from '../../components/common/GlassCard';
import { Modal } from '../../components/common/Modal';

export const AdminDelegations = () => {
  const [delegations, setDelegations] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'SCHEDULED' | 'PAST'

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    manager_id: '',
    delegate_id: '',
    effective_from: new Date().toISOString().slice(0, 10),
    effective_to: '',
  });

  // Eligible delegates for the currently-selected Nominating Manager: peer
  // Managers reporting to the same supervisor, or — where none exist — that
  // manager's own supervisor (LMS-041). Refetched whenever manager_id changes.
  const [eligibleDelegates, setEligibleDelegates] = useState([]);
  const [loadingDelegates, setLoadingDelegates] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const fetchDelegations = async () => {
    setLoading(true);
    try {
      const res = await api('/admin/delegations');
      setDelegations(res.delegations || []);
      setManagers(res.managers || []);
      if (res.managers && res.managers.length > 0) {
        setForm((prev) => ({ ...prev, manager_id: res.managers[0].user_id }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDelegations();
  }, []);

  useEffect(() => {
    if (!form.manager_id) { setEligibleDelegates([]); return; }
    setLoadingDelegates(true);
    setForm((prev) => ({ ...prev, delegate_id: '' }));
    api(`/admin/delegations/eligible-delegates?manager_id=${form.manager_id}`)
      .then((res) => {
        const eligible = res.eligibleDelegates || [];
        setEligibleDelegates(eligible);
        if (eligible.length) setForm((prev) => ({ ...prev, delegate_id: eligible[0].user_id }));
      })
      .catch(console.error)
      .finally(() => setLoadingDelegates(false));
  }, [form.manager_id]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (Number(form.manager_id) === Number(form.delegate_id)) {
      alert('A manager cannot delegate authority to themselves (self-approval prohibited).');
      return;
    }
    setSubmitting(true);
    try {
      await api('/admin/delegations', {
        method: 'POST',
        body: JSON.stringify({
          manager_id: form.manager_id,
          delegate_id: form.delegate_id,
          effective_from: form.effective_from,
          effective_to: form.effective_to || null,
        }),
      });
      setModalOpen(false);
      fetchDelegations();
    } catch (err) {
      alert(err.message || 'Failed to create approval delegation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (id) => {
    if (!window.confirm('Are you sure you want to revoke this approval delegation immediately?')) return;
    try {
      await api(`/admin/delegations/${id}`, { method: 'DELETE' });
      fetchDelegations();
    } catch (err) {
      alert(err.message || 'Failed to revoke delegation');
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  const getDelegationStatus = (d) => {
    if (d.effective_from > today) return { label: 'Scheduled', color: '#0284c7', bg: 'rgba(56,189,248,0.15)' };
    if (d.effective_to && d.effective_to < today) return { label: 'Expired', color: '#6b7280', bg: 'rgba(0,0,0,0.06)' };
    return { label: 'Active Now', color: '#059669', bg: 'rgba(5,150,105,0.15)' };
  };

  const filtered = delegations.filter((d) => {
    const st = getDelegationStatus(d).label;
    if (filterTab === 'ACTIVE') return st === 'Active Now';
    if (filterTab === 'SCHEDULED') return st === 'Scheduled';
    if (filterTab === 'PAST') return st === 'Expired';
    return true;
  });

  const activeCount = delegations.filter((d) => getDelegationStatus(d).label === 'Active Now').length;

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
              <i className="bi bi-person-gear" />
            </span>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Approval Delegations Oversight
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', marginTop: '6px', maxWidth: '750px' }}>
            Manage organization-wide approval delegations. Set emergency delegation coverage on behalf of managers or revoke delegations.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="btn-glass btn-primary-glass"
          style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <i className="bi bi-plus-lg" />
          <span>New Delegation</span>
        </button>
      </div>

      {/* ── Metric Highlights ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
        <GlassCard>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'rgba(5,150,105,0.14)',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
              }}
            >
              <i className="bi bi-check2-circle" />
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)' }}>{activeCount}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>Active Delegations</div>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'rgba(56,189,248,0.14)',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
              }}
            >
              <i className="bi bi-calendar-event" />
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)' }}>{delegations.length}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>Total Historical Records</div>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'rgba(124,58,237,0.14)',
                color: '#7c3aed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
              }}
            >
              <i className="bi bi-people" />
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)' }}>{managers.length}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>Supervising Managers</div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* ── Main Delegations Table Card ── */}
      <GlassCard>
        {/* Table Filter Tabs */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { id: 'ALL', label: 'All' },
              { id: 'ACTIVE', label: 'Active Now' },
              { id: 'SCHEDULED', label: 'Scheduled' },
              { id: 'PAST', label: 'Past / Expired' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setFilterTab(t.id)}
                className="btn-glass"
                style={{
                  fontSize: '12px',
                  padding: '4px 12px',
                  fontWeight: filterTab === t.id ? 700 : 500,
                  background: filterTab === t.id ? 'rgba(13,148,136,0.18)' : 'transparent',
                  borderColor: filterTab === t.id ? 'var(--primary)' : 'var(--glass-border)',
                  color: filterTab === t.id ? 'var(--primary)' : 'var(--text-muted)',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>
            Showing {filtered.length} delegation record(s)
          </span>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[1, 2, 3].map((n) => (
              <div key={n} className="skeleton" style={{ height: '48px', borderRadius: 'var(--radius-sm)' }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-subtle)' }}>
            <i className="bi bi-person-slash" style={{ fontSize: '36px', display: 'block', marginBottom: '8px' }} />
            <p style={{ fontSize: '14px', margin: 0 }}>No delegations found for this filter.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="glass-table" style={{ width: '100%', fontSize: '13px' }}>
              <thead>
                <tr>
                  <th>Nominating Manager</th>
                  <th style={{ textAlign: 'center' }}></th>
                  <th>Appointed Delegate</th>
                  <th>Effective From</th>
                  <th>Effective To</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const st = getDelegationStatus(d);
                  return (
                    <tr key={d.delegation_id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: 'rgba(59,130,246,0.15)',
                              color: '#2563eb',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '11px',
                            }}
                          >
                            {d.manager_name?.charAt(0) || 'M'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{d.manager_name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>{d.manager_email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--primary)' }}>
                        <i className="bi bi-arrow-right" style={{ fontSize: '14px' }} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: 'rgba(13,148,136,0.15)',
                              color: 'var(--primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '11px',
                            }}
                          >
                            {d.delegate_name?.charAt(0) || 'D'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{d.delegate_name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>{d.delegate_email}</div>
                          </div>
                        </div>
                      </td>
                      <td>{d.effective_from}</td>
                      <td>{d.effective_to || 'Indefinite'}</td>
                      <td>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '999px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: st.bg,
                            color: st.color,
                          }}
                        >
                          {st.label}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => handleRevoke(d.delegation_id)}
                          className="btn-glass btn-danger-glass"
                          style={{ padding: '3px 9px', fontSize: '11.5px' }}
                          title="Revoke delegation immediately"
                        >
                          <i className="bi bi-x-circle" style={{ marginRight: '4px' }} />
                          Revoke
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* ── Modal: Create Delegation on Behalf ── */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create Approval Delegation (HR / Admin)"
        maxWidth="520px"
      >
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
              Nominating Manager *
            </label>
            <select
              className="input-glass"
              required
              value={form.manager_id}
              onChange={(e) => setForm({ ...form, manager_id: e.target.value })}
              style={{ width: '100%' }}
            >
              <option value="">-- Choose Manager --</option>
              {managers.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.full_name} ({m.employee_code}) - {m.email}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
              Appointed Delegate *
            </label>
            {loadingDelegates ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading eligible delegates...</div>
            ) : eligibleDelegates.length === 0 ? (
              <div style={{ color: '#f87171', fontSize: '13px' }}>
                No eligible peer manager or supervisor found for this manager.
              </div>
            ) : (
              <select
                className="input-glass"
                required
                value={form.delegate_id}
                onChange={(e) => setForm({ ...form, delegate_id: e.target.value })}
                style={{ width: '100%' }}
              >
                {eligibleDelegates.map((u) => (
                  <option key={u.user_id} value={u.user_id}>
                    {u.full_name} ({u.isHrAdmin ? 'HR/Admin' : 'Manager'}) - {u.email}
                  </option>
                ))}
              </select>
            )}
            <small style={{ color: 'var(--text-subtle)', fontSize: '11px', display: 'block', marginTop: '4px' }}>
              Only a peer Manager reporting to the same supervisor is eligible; where none
              exists, the manager's own supervisor is offered instead.
            </small>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                Effective From *
              </label>
              <input
                type="date"
                className="input-glass"
                required
                value={form.effective_from}
                onChange={(e) => setForm({ ...form, effective_from: e.target.value })}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                Effective To (Optional)
              </label>
              <input
                type="date"
                className="input-glass"
                value={form.effective_to}
                onChange={(e) => setForm({ ...form, effective_to: e.target.value })}
                placeholder="Indefinite"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div
            style={{
              fontSize: '12px',
              padding: '10px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(13,148,136,0.1)',
              border: '1px solid rgba(13,148,136,0.2)',
              color: 'var(--text-muted)',
            }}
          >
            <i className="bi bi-shield-check" style={{ color: 'var(--primary)', marginRight: '6px' }} />
            When an administrator sets an emergency delegation, both the manager and the delegate are notified via automated email, and the audit log records the HR actor.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <button type="button" onClick={() => setModalOpen(false)} className="btn-glass">
              Cancel
            </button>
            <button type="submit" disabled={submitting || eligibleDelegates.length === 0} className="btn-glass btn-primary-glass">
              {submitting ? 'Creating...' : 'Confirm Delegation'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
