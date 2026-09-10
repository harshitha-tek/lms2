import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { GlassCard } from '../../components/common/GlassCard';

export const MyTeam = () => {
  const [teamData, setTeamData] = useState({ rows: [], scope: 'direct' });
  const [scope, setScope] = useState('direct'); // 'direct' | 'all'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api(`/manager/team?scope=${scope}`)
      .then(setTeamData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [scope]);

  return (
    <div className="container-fluid" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>My Team Balances</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Monitor leave utilization, days taken, pending requests, and negative balance alerts across your reporting hierarchy.
          </p>
        </div>

        {/* Scope selector */}
        <div className="glass-panel" style={{ display: 'flex', padding: '4px', gap: '4px' }}>
          <button
            onClick={() => setScope('direct')}
            className={`btn-glass ${scope === 'direct' ? 'btn-primary-glass' : ''}`}
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            Direct Reports Only
          </button>
          <button
            onClick={() => setScope('all')}
            className={`btn-glass ${scope === 'all' ? 'btn-primary-glass' : ''}`}
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            Full Reporting Hierarchy (All Depths)
          </button>
        </div>
      </div>

      <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <i className="bi bi-arrow-repeat spin" style={{ fontSize: '28px', color: 'var(--primary)' }} />
            <p style={{ marginTop: '10px' }}>Loading team members...</p>
          </div>
        ) : teamData.rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <p>No team members found for this scope.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="glass-table">
              <thead>
                <tr>
                  <th>Team Member</th>
                  <th>Leave Balances (Available)</th>
                  <th>Days Taken (This Year)</th>
                  <th>Days Pending</th>
                  <th>Status Warning</th>
                </tr>
              </thead>
              <tbody>
                {teamData.rows.map(({ person, balances, takenThisYear, pendingDays }) => {
                  const hasNegative = balances.some((b) => Number(b.effective) < 0);

                  return (
                    <tr key={person.user_id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '50%',
                              background: 'rgba(59, 130, 246, 0.25)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              color: '#93c5fd',
                              fontSize: '13px',
                            }}
                          >
                            {person.full_name?.charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '14px' }}>{person.full_name}</div>
                            <small style={{ color: 'var(--text-subtle)', fontSize: '11.5px' }}>{person.email}</small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {balances.map((b) => {
                            const val = Number(b.effective || 0);
                            const isNeg = val < 0;
                            return (
                              <span
                                key={b.leaveType.leave_type_id}
                                style={{
                                  fontSize: '12px',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  background: isNeg ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                  border: `1px solid ${isNeg ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
                                  color: isNeg ? '#fca5a5' : '#f8fafc',
                                }}
                              >
                                {b.leaveType.leave_code}: <strong>{val.toFixed(1)}</strong>
                              </span>
                            );
                          })}
                        </div>
                      </td>

                      <td style={{ fontWeight: 600 }}>
                        {takenThisYear} day(s)
                      </td>

                      <td>
                        <span style={{ fontWeight: 600, color: pendingDays > 0 ? '#f59e0b' : 'var(--text-muted)' }}>
                          {pendingDays} day(s)
                        </span>
                      </td>

                      <td>
                        {hasNegative ? (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '4px 8px',
                              borderRadius: '999px',
                              background: 'rgba(239, 68, 68, 0.2)',
                              color: '#f87171',
                              border: '1px solid rgba(239, 68, 68, 0.4)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <i className="bi bi-exclamation-diamond-fill" />
                            Advance Overdrawn
                          </span>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#34d399' }}>
                            <i className="bi bi-check-circle" style={{ marginRight: '4px' }} />
                            Normal
                          </span>
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
    </div>
  );
};
