import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { GlassCard } from '../../components/common/GlassCard';
import { Modal } from '../../components/common/Modal';

export const Delegation = () => {
  const [data, setData] = useState({ current: [], eligibleDelegates: [] });
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [delegateId, setDelegateId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchDelegations = () => {
    setLoading(true);
    api('/manager/delegations')
      .then((res) => {
        setData(res);
        if (res.eligibleDelegates && res.eligibleDelegates.length > 0) {
          setDelegateId(res.eligibleDelegates[0].user_id);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDelegations();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api('/manager/delegations', {
        method: 'POST',
        body: JSON.stringify({
          delegate_id: delegateId,
          effective_from: effectiveFrom,
          effective_to: effectiveTo || null,
        }),
      });
      setModalOpen(false);
      fetchDelegations();
    } catch (err) {
      alert(err.message || 'Failed to assign delegate');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (id) => {
    if (!window.confirm('Are you sure you want to revoke this approval delegation?')) return;
    try {
      await api(`/manager/delegations/${id}`, { method: 'DELETE' });
      fetchDelegations();
    } catch (err) {
      alert(err.message || 'Failed to revoke delegation');
    }
  };

  return (
    <div className="container-fluid" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Approval Delegation</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Nominate peer managers or supervisor to act on your approval queue during temporary absence (LMS-041).
          </p>
        </div>

        <button onClick={() => setModalOpen(true)} className="btn-glass btn-primary-glass">
          <i className="bi bi-person-plus" />
          <span>Nominate Delegate</span>
        </button>
      </div>

      <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <i className="bi bi-arrow-repeat spin" style={{ fontSize: '28px', color: 'var(--primary)' }} />
            <p style={{ marginTop: '10px' }}>Loading delegations...</p>
          </div>
        ) : data.current.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <i className="bi bi-person-check" style={{ fontSize: '36px', color: 'var(--text-subtle)', display: 'block', marginBottom: '10px' }} />
            <p>No active or scheduled approval delegations.</p>
          </div>
        ) : (
          <table className="glass-table">
            <thead>
              <tr>
                <th>Nominated Delegate</th>
                <th>Effective From</th>
                <th>Effective To</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.current.map((d) => (
                <tr key={d.delegation_id}>
                  <td style={{ fontWeight: 600 }}>{d.delegate_name}</td>
                  <td>{d.effective_from}</td>
                  <td>{d.effective_to || 'Indefinite / Until Revoked'}</td>
                  <td>
                    <span
                      style={{
                        fontSize: '11.5px',
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: '999px',
                        background: 'rgba(16, 185, 129, 0.2)',
                        color: '#34d399',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                      }}
                    >
                      Active
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => handleRevoke(d.delegation_id)}
                      className="btn-glass btn-danger-glass"
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </GlassCard>

      {/* Nominate Delegate Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nominate an Approval Delegate"
      >
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Per LMS-041, only peer managers under the same supervisor or your direct supervisor may act as delegates.
          </p>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Select Eligible Delegate *
            </label>
            {data.eligibleDelegates.length === 0 ? (
              <div style={{ color: '#f87171', fontSize: '13px' }}>No eligible peers found.</div>
            ) : (
              <select
                className="glass-select"
                value={delegateId}
                onChange={(e) => setDelegateId(e.target.value)}
                required
              >
                {data.eligibleDelegates.map((u) => (
                  <option key={u.user_id} value={u.user_id}>
                    {u.full_name} ({u.email})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Effective From *
              </label>
              <input
                type="date"
                className="glass-input"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Effective To (Optional)
              </label>
              <input
                type="date"
                className="glass-input"
                value={effectiveTo}
                min={effectiveFrom}
                onChange={(e) => setEffectiveTo(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button type="button" onClick={() => setModalOpen(false)} className="btn-glass">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !effectiveFrom || data.eligibleDelegates.length === 0}
              className="btn-glass btn-primary-glass"
            >
              {submitting ? 'Assigning...' : 'Confirm Delegation'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
