import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { GlassCard } from '../../components/common/GlassCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';

export const ApprovalsQueue = () => {
  const [data, setData] = useState({ pending: [], cancellations: [], slaDays: 3, longLeaveThreshold: 10 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'cancellations'
  const [selectedIds, setSelectedIds] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);

  // Decision Modal
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [currentRequest, setCurrentRequest] = useState(null);
  const [decisionType, setDecisionType] = useState('approve'); // 'approve' | 'reject'
  const [rejectReason, setRejectReason] = useState('');

  // Bulk Decision Modal
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState('approve');
  const [bulkReason, setBulkReason] = useState('');

  const fetchQueue = () => {
    setLoading(true);
    api('/manager/approvals')
      .then((res) => {
        setData(res);
        setSelectedIds([]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const openDecision = (req, type) => {
    setCurrentRequest(req);
    setDecisionType(type);
    setRejectReason('');
    setDecisionModalOpen(true);
  };

  const submitDecision = async () => {
    if (!currentRequest) return;
    if (decisionType === 'reject' && !rejectReason.trim()) {
      alert('A rejection reason is mandatory.');
      return;
    }

    setActionLoading(currentRequest.leave_request_id);
    try {
      if (activeTab === 'cancellations') {
        await api(`/manager/approvals/${currentRequest.leave_request_id}/decide-cancellation`, {
          method: 'POST',
          body: JSON.stringify({ decision: decisionType }),
        });
      } else {
        await api(`/manager/approvals/${currentRequest.leave_request_id}/decide`, {
          method: 'POST',
          body: JSON.stringify({
            approvalId: currentRequest.approval_id,
            decision: decisionType,
            reason: rejectReason,
          }),
        });
      }
      setDecisionModalOpen(false);
      fetchQueue();
    } catch (err) {
      alert(err.message || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(data.pending.map((r) => r.leave_request_id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const submitBulk = async () => {
    if (bulkAction === 'reject' && !bulkReason.trim()) {
      alert('A rejection reason is mandatory for bulk rejection.');
      return;
    }

    setActionLoading('bulk');
    try {
      for (const id of selectedIds) {
        const req = data.pending.find((r) => r.leave_request_id === id);
        if (req) {
          await api(`/manager/approvals/${id}/decide`, {
            method: 'POST',
            body: JSON.stringify({
              approvalId: req.approval_id,
              decision: bulkAction,
              reason: bulkReason,
            }),
          });
        }
      }
      setBulkModalOpen(false);
      fetchQueue();
    } catch (err) {
      alert(err.message || 'Bulk decision failed');
    } finally {
      setActionLoading(null);
    }
  };

  const items = activeTab === 'pending' ? data.pending : data.cancellations;

  return (
    <div className="container-fluid" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Approvals Queue</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Mobile-first approvals workspace with SLA countdowns and multi-select actions.
          </p>
        </div>

        {/* Tab switcher: Pending vs Cancellations */}
        <div className="glass-panel" style={{ display: 'flex', padding: '4px', gap: '4px' }}>
          <button
            onClick={() => setActiveTab('pending')}
            className={`btn-glass ${activeTab === 'pending' ? 'btn-primary-glass' : ''}`}
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            <i className="bi bi-clock-history" />
            <span>Leave Requests ({data.pending.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('cancellations')}
            className={`btn-glass ${activeTab === 'cancellations' ? 'btn-primary-glass' : ''}`}
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            <i className="bi bi-x-circle" />
            <span>Cancellations ({data.cancellations.length})</span>
          </button>
        </div>
      </div>

      {/* Bulk Action Toolbar */}
      {activeTab === 'pending' && selectedIds.length > 0 && (
        <div
          className="glass-panel"
          style={{
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.2) 0%, rgba(99, 102, 241, 0.2) 100%)',
            border: '1px solid #3b82f6',
          }}
        >
          <span style={{ fontWeight: 600, fontSize: '14px' }}>
            {selectedIds.length} request(s) selected
          </span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => {
                setBulkAction('approve');
                setBulkReason('');
                setBulkModalOpen(true);
              }}
              className="btn-glass btn-success-glass"
              style={{ padding: '6px 14px', fontSize: '13px' }}
            >
              <i className="bi bi-check-all" />
              <span>Bulk Approve</span>
            </button>
            <button
              onClick={() => {
                setBulkAction('reject');
                setBulkReason('');
                setBulkModalOpen(true);
              }}
              className="btn-glass btn-danger-glass"
              style={{ padding: '6px 14px', fontSize: '13px' }}
            >
              <i className="bi bi-x-lg" />
              <span>Bulk Reject</span>
            </button>
          </div>
        </div>
      )}

      {/* Queue Table */}
      <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <i className="bi bi-arrow-repeat spin" style={{ fontSize: '28px', color: 'var(--primary)' }} />
            <p style={{ marginTop: '10px' }}>Loading approvals queue...</p>
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <i className="bi bi-check2-circle" style={{ fontSize: '40px', color: '#10b981', display: 'block', marginBottom: '10px' }} />
            <p style={{ fontSize: '16px', fontWeight: 600 }}>Queue Clear!</p>
            <small style={{ color: 'var(--text-subtle)' }}>No requests pending your decision at this time.</small>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="glass-table">
              <thead>
                <tr>
                  {activeTab === 'pending' && (
                    <th style={{ width: '40px' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.length === data.pending.length && data.pending.length > 0}
                        onChange={handleSelectAll}
                        style={{ accentColor: '#3b82f6', width: '16px', height: '16px' }}
                      />
                    </th>
                  )}
                  <th>Employee</th>
                  <th>Dates & Leave Type</th>
                  <th>Deducted</th>
                  <th>SLA Urgency</th>
                  <th>Compliance Flags</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((req) => {
                  const isLongLeave = req.deducted_days > data.longLeaveThreshold;
                  const isAdvance = req.is_advance_leave === 1;

                  return (
                    <tr key={req.leave_request_id}>
                      {activeTab === 'pending' && (
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(req.leave_request_id)}
                            onChange={() => toggleSelect(req.leave_request_id)}
                            style={{ accentColor: '#3b82f6', width: '16px', height: '16px' }}
                          />
                        </td>
                      )}
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{req.full_name}</div>
                        <small style={{ color: 'var(--text-subtle)', fontSize: '11.5px' }}>
                          #{req.request_number || req.leave_request_id}
                        </small>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{req.leave_name}</div>
                        <small style={{ color: 'var(--text-muted)' }}>
                          {req.start_date} → {req.end_date}
                        </small>
                      </td>
                      <td style={{ fontWeight: 700, fontSize: '14.5px' }}>
                        {req.deducted_days} d
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '11.5px',
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: '999px',
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#34d399',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                          }}
                        >
                          <i className="bi bi-shield-check" style={{ marginRight: '4px' }} />
                          Within {data.slaDays}d SLA
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {isAdvance && (
                            <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
                              Advance Leave
                            </span>
                          )}
                          {isLongLeave && (
                            <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(139, 92, 246, 0.2)', color: '#c084fc', border: '1px solid rgba(139, 92, 246, 0.4)' }}>
                              Long Leave (Routes to HR)
                            </span>
                          )}
                          {!isAdvance && !isLongLeave && (
                            <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>Standard</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => openDecision(req, 'approve')}
                            disabled={actionLoading === req.leave_request_id}
                            className="btn-glass btn-success-glass"
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                          >
                            <i className="bi bi-check-lg" />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => openDecision(req, 'reject')}
                            disabled={actionLoading === req.leave_request_id}
                            className="btn-glass btn-danger-glass"
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                          >
                            <i className="bi bi-x-lg" />
                            <span>Reject</span>
                          </button>
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

      {/* Decision Modal */}
      <Modal
        isOpen={decisionModalOpen}
        onClose={() => setDecisionModalOpen(false)}
        title={`${decisionType === 'approve' ? 'Approve' : 'Reject'} Request: #${currentRequest?.request_number}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ padding: '14px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.04)', fontSize: '13px' }}>
            <div>Employee: <strong>{currentRequest?.full_name}</strong></div>
            <div>Leave Type: <strong>{currentRequest?.leave_name}</strong></div>
            <div>Dates: <strong>{currentRequest?.start_date} → {currentRequest?.end_date}</strong> ({currentRequest?.deducted_days} working days)</div>
            {currentRequest?.reason && <div style={{ marginTop: '6px', color: 'var(--text-muted)' }}>Reason: {currentRequest.reason}</div>}
          </div>

          {decisionType === 'reject' && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#fca5a5' }}>
                Rejection Reason * (Mandatory)
              </label>
              <textarea
                className="glass-textarea"
                rows={3}
                placeholder="Explain why this leave cannot be approved at this time..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                required
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <button onClick={() => setDecisionModalOpen(false)} className="btn-glass">
              Cancel
            </button>
            <button
              onClick={submitDecision}
              disabled={actionLoading}
              className={`btn-glass ${decisionType === 'approve' ? 'btn-success-glass' : 'btn-danger-glass'}`}
            >
              {actionLoading ? 'Processing...' : `Confirm ${decisionType === 'approve' ? 'Approval' : 'Rejection'}`}
            </button>
          </div>
        </div>
      </Modal>

      {/* Bulk Decision Modal (LMS-050) */}
      <Modal
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        title={`Bulk ${bulkAction === 'approve' ? 'Approve' : 'Reject'} (${selectedIds.length} Requests)`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            You are about to bulk {bulkAction} {selectedIds.length} leave requests.
          </p>

          {bulkAction === 'reject' && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#fca5a5' }}>
                Single Mandatory Rejection Reason Applied to All *
              </label>
              <textarea
                className="glass-textarea"
                rows={3}
                placeholder="Provide a reason applied to all selected items..."
                value={bulkReason}
                onChange={(e) => setBulkReason(e.target.value)}
                required
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <button onClick={() => setBulkModalOpen(false)} className="btn-glass">
              Cancel
            </button>
            <button
              onClick={submitBulk}
              disabled={actionLoading}
              className={`btn-glass ${bulkAction === 'approve' ? 'btn-success-glass' : 'btn-danger-glass'}`}
            >
              {actionLoading ? 'Processing Bulk Action...' : `Confirm Bulk ${bulkAction}`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
