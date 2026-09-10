import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

export const WithdrawalBanner = () => {
  const { withdrawalRequests, refreshSession } = useAuth();
  const [withdrawingId, setWithdrawingId] = useState(null);

  if (!withdrawalRequests || withdrawalRequests.length === 0) return null;

  const handleWithdraw = async (requestId) => {
    setWithdrawingId(requestId);
    try {
      await api(`/leave/requests/${requestId}/withdraw`, { method: 'POST' });
      await refreshSession();
    } catch (err) {
      alert(err.message || 'Failed to withdraw request');
    } finally {
      setWithdrawingId(null);
    }
  };

  return (
    <div className="container-fluid" style={{ paddingBottom: 0 }}>
      {withdrawalRequests.map((req) => (
        <div key={req.leave_request_id} className="withdrawal-banner">
          <div className="withdrawal-banner-info">
            <i className="bi bi-exclamation-triangle-fill withdrawal-banner-icon" />
            <div>
              <strong style={{ color: '#fdba74', display: 'block', fontSize: '15px' }}>
                Advance Leave Rejected: Action Required for {req.request_number}
              </strong>
              <span style={{ fontSize: '13.5px', color: '#fed7aa' }}>
                This request was rejected. You have an open withdrawal window. If you do not withdraw, it will automatically convert to <strong>Loss of Pay (LOP)</strong>.
              </span>
            </div>
          </div>
          <button
            onClick={() => handleWithdraw(req.leave_request_id)}
            disabled={withdrawingId === req.leave_request_id}
            className="btn-glass btn-danger-glass"
            style={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}
          >
            {withdrawingId === req.leave_request_id ? (
              <span><i className="bi bi-arrow-repeat spin" /> Withdrawing...</span>
            ) : (
              <span><i className="bi bi-x-circle" /> Withdraw Request Now</span>
            )}
          </button>
        </div>
      ))}
    </div>
  );
};
