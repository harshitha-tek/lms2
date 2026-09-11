import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { GlassCard } from '../../components/common/GlassCard';

export const BalanceAdjustment = () => {
  const [employees, setEmployees] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingLedger, setLoadingLedger] = useState(false);

  useEffect(() => {
    Promise.all([
      api('/admin/employees'),
      api('/admin/leave-types'),
    ]).then(([empRes, typeRes]) => {
      setEmployees(empRes.employees || []);
      setLeaveTypes(typeRes.leaveTypes || []);
      if (empRes.employees && empRes.employees.length > 0) {
        setSelectedUserId(empRes.employees[0].user_id);
      }
      if (typeRes.leaveTypes && typeRes.leaveTypes.length > 0) {
        setSelectedTypeId(typeRes.leaveTypes[0].leave_type_id);
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedUserId) return;
    setLoadingLedger(true);
    api(`/admin/adjustments/${selectedUserId}`)
      .then((res) => {
        setLedgerEntries(res.ledger || []);
      })
      .catch(console.error)
      .finally(() => setLoadingLedger(false));
  }, [selectedUserId]);

  const currentTypeBalance = ledgerEntries
    .filter((e) => e.leave_type_id === Number(selectedTypeId))
    .reduce((sum, e) => sum + Number(e.quantity), 0);

  const projectedBalance = currentTypeBalance + (parseFloat(quantity) || 0);

  const handlePost = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      alert('Mandatory adjustment reason is required.');
      return;
    }

    setSubmitting(true);
    try {
      await api('/admin/adjustments', {
        method: 'POST',
        body: JSON.stringify({
          user_id: selectedUserId,
          leave_type_id: selectedTypeId,
          quantity,
          reason,
        }),
      });
      alert('Adjustment posted successfully as an append-only compensating ledger entry.');
      setQuantity('');
      setReason('');
      // Reload ledger
      const res = await api(`/admin/adjustments/${selectedUserId}`);
      setLedgerEntries(res.ledger || []);
    } catch (err) {
      alert(err.message || 'Failed to post adjustment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container-fluid" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Balance Adjustment & Ledger Audit</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          Post signed compensating ledger entries and inspect full immutable append-only transaction logs.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.2fr) minmax(350px, 1.8fr)', gap: '24px' }}>
        {/* Adjustment Form */}
        <GlassCard title="Post Manual Adjustment" icon="sliders">
          <form onSubmit={handlePost} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Select Employee *
              </label>
              <select
                className="glass-select"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
              >
                {employees.map((u) => (
                  <option key={u.user_id} value={u.user_id}>
                    {u.full_name} ({u.employee_code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Leave Type *
              </label>
              <select
                className="glass-select"
                value={selectedTypeId}
                onChange={(e) => setSelectedTypeId(e.target.value)}
              >
                {leaveTypes.map((t) => (
                  <option key={t.leave_type_id} value={t.leave_type_id}>
                    {t.leave_name} ({t.leave_code})
                  </option>
                ))}
              </select>
            </div>

            {/* Current & Projected Balance Box */}
            <div style={{ padding: '14px', borderRadius: 'var(--radius-sm)', background: 'rgba(255, 255, 255, 0.04)', display: 'flex', justifyContent: 'space-between', fontSize: '13.5px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Current Ledger Balance:</span>
                <strong style={{ display: 'block', fontSize: '16px', color: '#93c5fd', marginTop: '2px' }}>
                  {currentTypeBalance.toFixed(1)} days
                </strong>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ color: 'var(--text-muted)' }}>Projected Balance:</span>
                <strong style={{ display: 'block', fontSize: '16px', color: projectedBalance < 0 ? '#f87171' : '#34d399', marginTop: '2px' }}>
                  {projectedBalance.toFixed(1)} days
                </strong>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Adjustment Quantity (Signed e.g. +2.0 or -1.5) *
              </label>
              <input
                type="number"
                step="0.5"
                className="glass-input"
                placeholder="+2.5 or -1.0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Mandatory Reason for Adjustment (Audited) *
              </label>
              <textarea
                className="glass-textarea"
                rows={3}
                placeholder="State the administrative or policy justification..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !quantity || !reason.trim()}
              className="btn-glass btn-primary-glass"
              style={{ marginTop: '6px', padding: '12px' }}
            >
              {submitting ? 'Posting to Ledger...' : 'Post Immutable Adjustment'}
            </button>
          </form>
        </GlassCard>

        {/* Append-Only Ledger Viewer */}
        <GlassCard title="Append-Only Ledger Transactions" icon="journal-text">
          {loadingLedger ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <i className="bi bi-arrow-repeat spin" style={{ fontSize: '24px' }} />
              <p style={{ marginTop: '10px' }}>Loading ledger...</p>
            </div>
          ) : ledgerEntries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              No ledger transactions recorded for this employee.
            </div>
          ) : (
            <div style={{ maxHeight: '460px', overflowY: 'auto' }}>
              <table className="glass-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Qty</th>
                    <th>Reference / Reason</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerEntries.map((e, idx) => {
                    const qty = Number(e.quantity);
                    const isCredit = qty > 0;
                    return (
                      <tr key={idx}>
                        <td>
                          <span
                            style={{
                              fontSize: '11px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: 'rgba(255,255,255,0.06)',
                              fontWeight: 600,
                            }}
                          >
                            {e.transaction_type}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700, color: isCredit ? '#34d399' : '#f87171' }}>
                          {isCredit ? `+${qty.toFixed(1)}` : qty.toFixed(1)}
                        </td>
                        <td style={{ fontSize: '13px' }}>
                          <div>{e.source_reference || 'System Transaction'}</div>
                          {e.reason && <small style={{ color: 'var(--text-muted)' }}>{e.reason}</small>}
                        </td>
                        <td style={{ color: 'var(--text-subtle)', fontSize: '12px' }}>
                          {e.created_at || 'Recorded'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
};
