import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { GlassCard } from '../../components/common/GlassCard';

export const NotificationsPage = () => {
  const { notifications, markNotificationRead } = useAuth();

  return (
    <div className="container-fluid" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Notification Centre</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          Chronological record of state transitions, approvals, SLAs, and administrative notices.
        </p>
      </div>

      <GlassCard>
        {notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <i className="bi bi-bell-slash" style={{ fontSize: '36px', color: 'var(--text-subtle)', display: 'block', marginBottom: '10px' }} />
            <p>You’re all caught up! No notifications.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {notifications.map((n) => (
              <div
                key={n.notification_id}
                onClick={() => markNotificationRead(n.notification_id)}
                className="glass-panel"
                style={{
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '16px',
                  background: n.is_read ? 'rgba(255, 255, 255, 0.03)' : 'rgba(59, 130, 246, 0.12)',
                  border: n.is_read ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(59, 130, 246, 0.35)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: n.is_read ? 'rgba(255,255,255,0.06)' : 'rgba(59, 130, 246, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: n.is_read ? 'var(--text-muted)' : '#60a5fa',
                      flexShrink: 0,
                    }}
                  >
                    <i className="bi bi-bell-fill" />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <strong style={{ fontSize: '15px' }}>{n.subject}</strong>
                      {!n.is_read && (
                        <span style={{ fontSize: '10.5px', padding: '2px 8px', borderRadius: '999px', background: '#3b82f6', color: '#fff', fontWeight: 700 }}>
                          NEW
                        </span>
                      )}
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', marginTop: '4px' }}>
                      {n.body}
                    </p>
                    <small style={{ color: 'var(--text-subtle)', fontSize: '11.5px', marginTop: '6px', display: 'block' }}>
                      {n.created_at || 'Recently received'}
                    </small>
                  </div>
                </div>

                {!n.is_read && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      markNotificationRead(n.notification_id);
                    }}
                    className="btn-glass"
                    style={{ fontSize: '11.5px', padding: '4px 10px' }}
                  >
                    Mark read
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
};
