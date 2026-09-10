import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { GlassCard } from '../../components/common/GlassCard';
import { StatusBadge } from '../../components/common/StatusBadge';

export const EmployeeDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/dashboard')
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="container-fluid" style={{ textAlign: 'center', padding: '60px 0' }}>
        <i className="bi bi-arrow-repeat spin" style={{ fontSize: '32px', color: 'var(--primary)' }} />
        <p style={{ marginTop: '12px', color: 'var(--text-muted)' }}>Loading your dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-fluid">
        <GlassCard style={{ borderColor: 'rgba(239, 68, 68, 0.4)' }}>
          <div style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="bi bi-exclamation-circle" style={{ fontSize: '20px' }} />
            <span>{error}</span>
          </div>
        </GlassCard>
      </div>
    );
  }

  const { balances = [], pending = [], upcoming = [] } = data || {};

  return (
    <div className="container-fluid" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Top Banner with Welcome & Quick Action */}
      <div
        className="glass-panel"
        style={{
          padding: '28px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '20px',
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        }}
      >
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '6px' }}>Welcome back!</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14.5px' }}>
            Check your current leave balances, upcoming holidays, and manage your time-off requests.
          </p>
        </div>
        <Link to="/apply" className="btn-glass btn-primary-glass" style={{ padding: '12px 24px', fontSize: '15px' }}>
          <i className="bi bi-plus-circle-fill" />
          <span>Apply for Leave</span>
        </Link>
      </div>

      {/* Balance Cards Grid */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <i className="bi bi-wallet2" style={{ color: '#60a5fa' }} />
          <h2 style={{ fontSize: '18px' }}>Your Leave Balances</h2>
        </div>

        <div className="grid-cols-4">
          {balances.map((b) => {
            const effective = Number(b.effective || 0);
            const isNegative = effective < 0;
            return (
              <div
                key={b.leaveType.leave_type_id}
                className="glass-panel glass-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderTop: `4px solid ${isNegative ? '#ef4444' : b.leaveType.is_sick_leave ? '#06b6d4' : '#3b82f6'}`,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {b.leaveType.leave_name}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {b.leaveType.leave_code}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '14px' }}>
                    <span style={{ fontSize: '36px', fontWeight: 800, color: isNegative ? '#f87171' : '#ffffff' }}>
                      {effective.toFixed(1)}
                    </span>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>days available</span>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '12px', fontSize: '12px', color: 'var(--text-subtle)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Ledger: <strong>{Number(b.balance || 0).toFixed(1)}</strong></span>
                  <span>Committed: <strong>{Number(b.committed || 0).toFixed(1)}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending & Upcoming Sections */}
      <div className="grid-cols-2">
        {/* Pending Requests Strip */}
        <GlassCard
          title="Pending Requests"
          icon="hourglass-split"
          action={
            <Link to="/my-requests" style={{ fontSize: '12.5px', color: '#60a5fa' }}>
              View All
            </Link>
          }
        >
          {pending.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
              <i className="bi bi-check-circle" style={{ fontSize: '24px', color: '#10b981', display: 'block', marginBottom: '8px' }} />
              No pending requests awaiting approval.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {pending.map((req) => (
                <div
                  key={req.leave_request_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>
                      {req.leave_name}
                      {req.is_advance_leave === 1 && (
                        <span style={{ marginLeft: '8px', fontSize: '11px', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                          Advance Leave
                        </span>
                      )}
                    </div>
                    <small style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                      {req.start_date} → {req.end_date} • {req.deducted_days} day(s)
                    </small>
                  </div>
                  <StatusBadge status={req.status} />
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Upcoming Approved Leave Strip */}
        <GlassCard
          title="Upcoming Approved Leave"
          icon="calendar-check"
          action={
            <Link to="/team-calendar" style={{ fontSize: '12.5px', color: '#60a5fa' }}>
              Team Calendar
            </Link>
          }
        >
          {upcoming.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
              <i className="bi bi-calendar-event" style={{ fontSize: '24px', color: 'var(--text-subtle)', display: 'block', marginBottom: '8px' }} />
              No upcoming scheduled leave.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {upcoming.map((req) => (
                <div
                  key={req.leave_request_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(16, 185, 129, 0.05)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{req.leave_name}</div>
                    <small style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                      {req.start_date} → {req.end_date} • {req.deducted_days} day(s)
                    </small>
                  </div>
                  <StatusBadge status={req.status} />
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
};
