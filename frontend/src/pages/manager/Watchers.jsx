import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { GlassCard } from '../../components/common/GlassCard';
import { Modal } from '../../components/common/Modal';

const today = () => new Date().toISOString().slice(0, 10);

export const Watchers = () => {
  const [data, setData] = useState({ current: [], watchableEmployees: [], eligibleWatchers: [] });
  const [loading, setLoading] = useState(true);

  // Standing watcher (LMS-061/062) creation modal
  const [standingModalOpen, setStandingModalOpen] = useState(false);
  const [standingEmployeeId, setStandingEmployeeId] = useState('');
  const [standingWatcherId, setStandingWatcherId] = useState('');
  const [standingFrom, setStandingFrom] = useState(today());
  const [standingTo, setStandingTo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Ad-hoc, per-request watcher (LMS-060)
  const [adhocEmployeeId, setAdhocEmployeeId] = useState('');
  const [employeeRequests, setEmployeeRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [adhocRequestId, setAdhocRequestId] = useState('');
  const [adhocWatcherId, setAdhocWatcherId] = useState('');
  const [requestWatchers, setRequestWatchers] = useState([]);
  const [addingWatcher, setAddingWatcher] = useState(false);

  const fetchData = () => {
    setLoading(true);
    api('/manager/standing-watchers')
      .then((res) => {
        setData(res);
        if (res.watchableEmployees?.length) {
          setStandingEmployeeId(res.watchableEmployees[0].user_id);
          setAdhocEmployeeId(res.watchableEmployees[0].user_id);
        }
        if (res.eligibleWatchers?.length) {
          setStandingWatcherId(res.eligibleWatchers[0].user_id);
          setAdhocWatcherId(res.eligibleWatchers[0].user_id);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!adhocEmployeeId) return;
    setLoadingRequests(true);
    setAdhocRequestId('');
    setRequestWatchers([]);
    api(`/manager/employees/${adhocEmployeeId}/requests`)
      .then((res) => setEmployeeRequests(res || []))
      .catch(console.error)
      .finally(() => setLoadingRequests(false));
  }, [adhocEmployeeId]);

  const loadRequestWatchers = (id) => {
    if (!id) { setRequestWatchers([]); return; }
    api(`/leave/requests/${id}`)
      .then((res) => setRequestWatchers(res.watchers || []))
      .catch(console.error);
  };

  const handleSelectRequest = (id) => {
    setAdhocRequestId(id);
    loadRequestWatchers(id);
  };

  const handleAddAdhocWatcher = async () => {
    if (!adhocRequestId || !adhocWatcherId) return;
    setAddingWatcher(true);
    try {
      const res = await api(`/leave/requests/${adhocRequestId}/watchers`, {
        method: 'POST',
        body: JSON.stringify({ watcher_user_id: adhocWatcherId }),
      });
      setRequestWatchers(res.watchers || []);
    } catch (err) {
      alert(err.message || 'Failed to add watcher');
    } finally {
      setAddingWatcher(false);
    }
  };

  const handleCreateStanding = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api('/manager/standing-watchers', {
        method: 'POST',
        body: JSON.stringify({
          watcher_user_id: standingWatcherId,
          watched_employee_id: standingEmployeeId,
          effective_from: standingFrom,
          effective_to: standingTo || null,
        }),
      });
      setStandingModalOpen(false);
      fetchData();
    } catch (err) {
      alert(err.message || 'Failed to set standing watcher');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeStanding = async (id) => {
    if (!window.confirm('Revoke this standing watcher? They will no longer be watched on any future requests from this employee.')) return;
    try {
      await api(`/manager/standing-watchers/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      alert(err.message || 'Failed to revoke standing watcher');
    }
  };

  const selectedRequest = employeeRequests.find((r) => String(r.leave_request_id) === String(adhocRequestId));

  return (
    <div className="container-fluid" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Watchers</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          Grant read-only, masked visibility of leave requests to another Manager or HR/Admin.
          Watchers never see reason text or attachments, and Sick leave is always shown as "Unavailable".
        </p>
      </div>

      {/* ── Type 1: Standing Watchers ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>Standing Watchers</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '2px 0 0' }}>
            Applies automatically to every request the watched employee raises during the date range.
          </p>
        </div>
        <button onClick={() => setStandingModalOpen(true)} className="btn-glass btn-primary-glass">
          <i className="bi bi-eye-fill" />
          <span>New Standing Watcher</span>
        </button>
      </div>

      <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--text-muted)' }}>
            <i className="bi bi-arrow-repeat spin" style={{ fontSize: '26px', color: 'var(--primary)' }} />
            <p style={{ marginTop: '10px' }}>Loading standing watchers...</p>
          </div>
        ) : data.current.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--text-muted)' }}>
            <p>No standing watchers configured.</p>
          </div>
        ) : (
          <table className="glass-table">
            <thead>
              <tr>
                <th>Watched Employee</th>
                <th>Watcher</th>
                <th>Effective From</th>
                <th>Effective To</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.current.map((w) => (
                <tr key={w.watcher_id}>
                  <td style={{ fontWeight: 600 }}>{w.employee_name}</td>
                  <td>{w.watcher_name}</td>
                  <td>{w.effective_from}</td>
                  <td>{w.effective_to || 'Indefinite / Until Revoked'}</td>
                  <td>
                    <button
                      onClick={() => handleRevokeStanding(w.watcher_id)}
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

      {/* ── Type 2: Ad-hoc, per-request Watcher ── */}
      <div>
        <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>Add a Watcher to One Request</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '2px 0 0' }}>
          Attaches a watcher to a single, specific leave request only.
        </p>
      </div>

      <GlassCard style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Employee</label>
            <select
              className="glass-select"
              value={adhocEmployeeId}
              onChange={(e) => setAdhocEmployeeId(e.target.value)}
            >
              {data.watchableEmployees.map((u) => (
                <option key={u.user_id} value={u.user_id}>{u.full_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Request</label>
            <select
              className="glass-select"
              value={adhocRequestId}
              onChange={(e) => handleSelectRequest(e.target.value)}
              disabled={loadingRequests || employeeRequests.length === 0}
            >
              <option value="">
                {loadingRequests ? 'Loading requests...' : employeeRequests.length === 0 ? 'No requests found' : 'Select a request'}
              </option>
              {employeeRequests.map((r) => (
                <option key={r.leave_request_id} value={r.leave_request_id}>
                  #{r.request_number} · {r.leave_name} · {r.start_date?.slice(0, 10)} → {r.end_date?.slice(0, 10)} · {r.status}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Watcher</label>
            <select
              className="glass-select"
              value={adhocWatcherId}
              onChange={(e) => setAdhocWatcherId(e.target.value)}
            >
              {data.eligibleWatchers.map((u) => (
                <option key={u.user_id} value={u.user_id}>{u.full_name} ({u.isHrAdmin ? 'HR/Admin' : 'Manager'})</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <button
            onClick={handleAddAdhocWatcher}
            disabled={!adhocRequestId || !adhocWatcherId || addingWatcher}
            className="btn-glass btn-primary-glass"
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            <i className="bi bi-eye-fill" />
            <span>{addingWatcher ? 'Adding...' : 'Add Watcher to This Request'}</span>
          </button>
        </div>

        {selectedRequest && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
              Current watchers on #{selectedRequest.request_number}
            </div>
            {requestWatchers.length === 0 ? (
              <small style={{ color: 'var(--text-subtle)' }}>No watchers yet.</small>
            ) : (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {requestWatchers.map((w) => (
                  <span
                    key={w.watcher_id}
                    style={{
                      fontSize: '11.5px', fontWeight: 600, padding: '4px 10px', borderRadius: '999px',
                      background: 'rgba(59, 130, 246, 0.15)', color: '#93c5fd', border: '1px solid rgba(59, 130, 246, 0.3)',
                    }}
                  >
                    {w.full_name} · {w.watcher_type === 'PROJECT_LEAD' ? 'Project Lead' : w.watcher_type === 'STANDING' ? 'Standing' : 'Manually Added'}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </GlassCard>

      {/* New Standing Watcher Modal */}
      <Modal
        isOpen={standingModalOpen}
        onClose={() => setStandingModalOpen(false)}
        title="Set a Standing Watcher"
      >
        <form onSubmit={handleCreateStanding} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Only users holding the Manager or HR/Admin role may be a Watcher.
          </p>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Employee to Watch *</label>
            {data.watchableEmployees.length === 0 ? (
              <div style={{ color: '#f87171', fontSize: '13px' }}>No eligible employees found.</div>
            ) : (
              <select className="glass-select" value={standingEmployeeId} onChange={(e) => setStandingEmployeeId(e.target.value)} required>
                {data.watchableEmployees.map((u) => (
                  <option key={u.user_id} value={u.user_id}>{u.full_name}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Watcher *</label>
            {data.eligibleWatchers.length === 0 ? (
              <div style={{ color: '#f87171', fontSize: '13px' }}>No eligible Managers/HR-Admin found.</div>
            ) : (
              <select className="glass-select" value={standingWatcherId} onChange={(e) => setStandingWatcherId(e.target.value)} required>
                {data.eligibleWatchers.map((u) => (
                  <option key={u.user_id} value={u.user_id}>{u.full_name} ({u.isHrAdmin ? 'HR/Admin' : 'Manager'})</option>
                ))}
              </select>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Effective From *</label>
              <input type="date" className="glass-input" value={standingFrom} onChange={(e) => setStandingFrom(e.target.value)} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Effective To (Optional)</label>
              <input type="date" className="glass-input" value={standingTo} min={standingFrom} onChange={(e) => setStandingTo(e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button type="button" onClick={() => setStandingModalOpen(false)} className="btn-glass">Cancel</button>
            <button
              type="submit"
              disabled={submitting || data.watchableEmployees.length === 0 || data.eligibleWatchers.length === 0}
              className="btn-glass btn-primary-glass"
            >
              {submitting ? 'Saving...' : 'Confirm Standing Watcher'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
