import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { GlassCard } from '../../components/common/GlassCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';

export const MyRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [actionLoading, setActionLoading] = useState(null);

  // Detail Modal State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Cancellation Modal State
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [requestToCancel, setRequestToCancel] = useState(null);

  const fetchRequests = () => {
    setLoading(true);
    api('/leave/requests')
      .then(setRequests)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleOpenDetail = async (req) => {
    setSelectedRequest(req);
    setDetailModalOpen(true);
    setDetailLoading(true);
    try {
      const data = await api(`/leave/requests/${req.leave_request_id}`);
      setDetailData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleWithdraw = async (id) => {
    if (!window.confirm('Are you sure you want to withdraw this request?')) return;
    setActionLoading(id);
    try {
      await api(`/leave/requests/${id}/withdraw`, { method: 'POST' });
      fetchRequests();
    } catch (err) {
      alert(err.message || 'Withdrawal failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRequestCancellation = async () => {
    if (!requestToCancel) return;
    setActionLoading(requestToCancel.leave_request_id);
    try {
      await api(`/leave/requests/${requestToCancel.leave_request_id}/cancel`, { method: 'POST' });
      setCancelModalOpen(false);
      setRequestToCancel(null);
      fetchRequests();
    } catch (err) {
      alert(err.message || 'Failed to request cancellation');
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = requests.filter((r) => {
    const matchType = filterType === 'ALL' || String(r.leave_type_id) === filterType;
    const matchStatus = filterStatus === 'ALL' || r.status === filterStatus;
    return matchType && matchStatus;
  });

  const uniqueTypes = Array.from(new Set(requests.map((r) => r.leave_name))).filter(Boolean);

  return (
    <div className="container-fluid" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 800 }}>My Leave Requests</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          Track the real-time status, timeline, and manage withdrawals or cancellations of all your leaves.
        </p>
      </div>

      {/* Filters */}
      <div
        className="glass-panel"
        style={{
          padding: '16px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="bi bi-funnel" style={{ color: '#60a5fa' }} />
          <span style={{ fontSize: '13.5px', fontWeight: 600 }}>Filters:</span>
        </div>

        <select
          className="glass-select"
          style={{ width: 'auto', minWidth: '180px' }}
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="ALL">All Leave Types</option>
          {requests.reduce((acc, r) => {
            if (!acc.some(x => x.id === r.leave_type_id)) {
              acc.push({ id: r.leave_type_id, name: r.leave_name });
            }
            return acc;
          }, []).map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        <select
          className="glass-select"
          style={{ width: 'auto', minWidth: '200px' }}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="ALL">All Statuses</option>
          <option value="PENDING_MANAGER">Pending Manager</option>
          <option value="PENDING_HR">Pending HR</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="REJECTED_PENDING_WITHDRAWAL">Rejected (Withdrawal Open)</option>
          <option value="WITHDRAWN">Withdrawn</option>
          <option value="CANCELLATION_REQUESTED">Cancellation Requested</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="LOP_APPLIED">Loss of Pay Applied</option>
        </select>

        <div style={{ marginLeft: 'auto', fontSize: '13px', color: 'var(--text-muted)' }}>
          Showing <strong>{filtered.length}</strong> of <strong>{requests.length}</strong> requests
        </div>
      </div>

      {/* Requests Table */}
      <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <i className="bi bi-arrow-repeat spin" style={{ fontSize: '28px', color: 'var(--primary)' }} />
            <p style={{ marginTop: '12px' }}>Loading requests...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <i className="bi bi-inbox" style={{ fontSize: '36px', color: 'var(--text-subtle)', display: 'block', marginBottom: '10px' }} />
            <p style={{ fontSize: '15px', fontWeight: 600 }}>No requests match your filters.</p>
            <small style={{ color: 'var(--text-subtle)' }}>Try changing the leave type or status filter above.</small>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="glass-table">
              <thead>
                <tr>
                  <th>Request #</th>
                  <th>Leave Type</th>
                  <th>Dates & Duration</th>
                  <th>Deducted</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const canWithdraw = ['PENDING_MANAGER', 'PENDING_HR', 'REJECTED_PENDING_WITHDRAWAL', 'DRAFT'].includes(r.status);
                  const canCancel = r.status === 'APPROVED';

                  return (
                    <tr key={r.leave_request_id}>
                      <td style={{ fontWeight: 600, color: '#93c5fd' }}>
                        {r.request_number || `#${r.leave_request_id}`}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{r.leave_name}</div>
                        {r.is_half_day === 1 && (
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                            Half Day ({r.half_day_part === 'FIRST_HALF' ? '1st Half' : '2nd Half'})
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: '13.5px' }}>{r.start_date} → {r.end_date}</div>
                        {r.is_advance_leave === 1 && (
                          <span style={{ fontSize: '11px', color: '#f59e0b' }}>
                            <i className="bi bi-exclamation-triangle" style={{ marginRight: '4px' }} />
                            Advance Leave
                          </span>
                        )}
                      </td>
                      <td style={{ fontWeight: 700 }}>
                        {r.deducted_days} day(s)
                      </td>
                      <td>
                        <StatusBadge status={r.status} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            onClick={() => handleOpenDetail(r)}
                            className="btn-glass"
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                          >
                            <i className="bi bi-eye" />
                            <span>Details</span>
                          </button>

                          {canWithdraw && (
                            <button
                              onClick={() => handleWithdraw(r.leave_request_id)}
                              disabled={actionLoading === r.leave_request_id}
                              className="btn-glass btn-danger-glass"
                              style={{ padding: '6px 12px', fontSize: '12px' }}
                              title="Withdraw request without approval"
                            >
                              <i className="bi bi-x-circle" />
                              <span>Withdraw</span>
                            </button>
                          )}

                          {canCancel && (
                            <button
                              onClick={() => {
                                setRequestToCancel(r);
                                setCancelModalOpen(true);
                              }}
                              className="btn-glass"
                              style={{ padding: '6px 12px', fontSize: '12px', borderColor: '#f59e0b', color: '#fbbf24' }}
                              title="Request cancellation for approved leave (requires manager approval per BR-30)"
                            >
                              <i className="bi bi-arrow-counterclockwise" />
                              <span>Cancel Leave</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Request Detail Modal (LMS-065, BR-29) */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={`Request Details: ${selectedRequest?.request_number || ''}`}
        maxWidth="680px"
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            <i className="bi bi-arrow-repeat spin" style={{ fontSize: '24px' }} />
            <p style={{ marginTop: '10px' }}>Loading timeline and details...</p>
          </div>
        ) : detailData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Summary Box */}
            <div style={{ padding: '16px', borderRadius: 'var(--radius-sm)', background: 'rgba(255, 255, 255, 0.04)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '13px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Leave Type:</span>
                <div style={{ fontWeight: 600, fontSize: '14px', marginTop: '2px' }}>{detailData.request?.leave_name}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                <div style={{ marginTop: '2px' }}><StatusBadge status={detailData.request?.status} /></div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Dates:</span>
                <div style={{ fontWeight: 600, marginTop: '2px' }}>{detailData.request?.start_date} → {detailData.request?.end_date}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Deducted Working Days:</span>
                <div style={{ fontWeight: 700, fontSize: '15px', color: '#60a5fa', marginTop: '2px' }}>{detailData.request?.deducted_days} day(s)</div>
              </div>
            </div>

            {/* Reason */}
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Reason</span>
              <div style={{ marginTop: '6px', padding: '12px', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.2)', fontSize: '13.5px' }}>
                {detailData.request?.reason || 'No reason provided.'}
              </div>
            </div>

            {/* Watchers List (LMS-065: The watcher list is visible to the employee on their own request detail) */}
            {detailData.watchers && detailData.watchers.length > 0 && (
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Watchers with Visibility (LMS-065)
                </span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {detailData.watchers.map((w, idx) => (
                    <span key={idx} style={{ padding: '4px 10px', borderRadius: '999px', background: 'rgba(59, 130, 246, 0.15)', color: '#93c5fd', fontSize: '12px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                      <i className="bi bi-eye" style={{ marginRight: '6px' }} />
                      {w.full_name || `User #${w.watcher_user_id}`}
                      <span style={{ opacity: 0.7 }}>
                        {' · '}
                        {w.watcher_type === 'PROJECT_LEAD' ? 'Project Lead' : w.watcher_type === 'STANDING' ? 'Standing' : 'Manually Added'}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Approvals & Decisions Timeline (BR-29) */}
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Approval Timeline & Audit Trail
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.03)', borderLeft: '3px solid #3b82f6', fontSize: '12.5px' }}>
                  <div style={{ fontWeight: 600 }}>Request Created</div>
                  <div style={{ color: 'var(--text-subtle)', fontSize: '11.5px' }}>
                    Applied on {detailData.request?.created_at || 'Recorded'}
                  </div>
                </div>

                {detailData.approvals && detailData.approvals.map((appr) => (
                  <div
                    key={appr.approval_id}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(255,255,255,0.03)',
                      borderLeft: `3px solid ${appr.decision === 'APPROVED' ? '#10b981' : appr.decision === 'REJECTED' ? '#ef4444' : '#f59e0b'}`,
                      fontSize: '12.5px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>{appr.stage} Approval Stage</strong>
                      <span style={{ color: appr.decision === 'APPROVED' ? '#34d399' : appr.decision === 'REJECTED' ? '#f87171' : '#fbbf24' }}>
                        {appr.decision || 'Awaiting Decision'}
                      </span>
                    </div>
                    {appr.reason && (
                      <div style={{ color: '#fca5a5', marginTop: '4px', fontSize: '12px' }}>
                        Reason: {appr.reason}
                      </div>
                    )}
                    {appr.decided_at && (
                      <div style={{ color: 'var(--text-subtle)', fontSize: '11.5px', marginTop: '4px' }}>
                        Decided at: {appr.decided_at}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Cancellation Confirmation Modal (BR-30) */}
      <Modal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title="Request Leave Cancellation"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            Per LMS policy (BR-30), cancellation of an approved leave requires manager approval.
            The leave remains approved and deductions remain in force until your manager approves this request.
          </p>
          <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)', color: '#fbbf24', fontSize: '13px' }}>
            <i className="bi bi-info-circle" style={{ marginRight: '6px' }} />
            Request #{requestToCancel?.request_number}: {requestToCancel?.start_date} → {requestToCancel?.end_date} ({requestToCancel?.deducted_days} days)
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <button onClick={() => setCancelModalOpen(false)} className="btn-glass">
              Keep Leave
            </button>
            <button
              onClick={handleRequestCancellation}
              disabled={actionLoading === requestToCancel?.leave_request_id}
              className="btn-glass btn-danger-glass"
            >
              {actionLoading === requestToCancel?.leave_request_id ? (
                <span><i className="bi bi-arrow-repeat spin" /> Submitting...</span>
              ) : (
                <span><i className="bi bi-check2" /> Confirm Cancellation Request</span>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
