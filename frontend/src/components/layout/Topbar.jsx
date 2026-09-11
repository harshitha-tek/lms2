import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';

/* Close dropdown when clicking outside */
const useClickOutside = (ref, handler) => {
  useEffect(() => {
    const listener = (e) => { if (ref.current && !ref.current.contains(e.target)) handler(); };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler]);
};

export const Topbar = ({ toggleMobile }) => {
  const { user, availableUsers, signIn, notifications, unreadCount, markNotificationRead } = useAuth();
  const [showNotifs, setShowNotifs] = useState(false);
  const [showUserSwitcher, setShowUserSwitcher] = useState(false);

  const notifRef = useRef(null);
  const switcherRef = useRef(null);
  useClickOutside(notifRef, () => setShowNotifs(false));
  useClickOutside(switcherRef, () => setShowUserSwitcher(false));

  if (!user) return null;

  const roleColor    = user.isHrAdmin ? '#c084fc'  : user.isManager ? '#60a5fa'  : '#2dd4bf';
  const roleBg       = user.isHrAdmin ? 'rgba(168,85,247,0.18)'  : user.isManager ? 'rgba(59,130,246,0.18)'  : 'rgba(14,165,160,0.18)';
  const roleBorder   = user.isHrAdmin ? 'rgba(168,85,247,0.4)'   : user.isManager ? 'rgba(59,130,246,0.4)'   : 'rgba(14,165,160,0.4)';
  const roleLabel    = user.isHrAdmin ? 'HR / Admin' : user.isManager ? 'Manager' : 'Employee';
  const avatarBg     = user.isHrAdmin
    ? 'linear-gradient(135deg,#a855f7,#7c3aed)'
    : user.isManager
    ? 'linear-gradient(135deg,#3b82f6,#2563eb)'
    : 'linear-gradient(135deg,#0ea5a0,#0891b2)';

  return (
    <header
      className="glass-panel"
      style={{
        height: '64px',
        borderRadius: 0,
        borderBottom: '1px solid var(--glass-border)',
        borderTop: 0,
        borderLeft: 0,
        borderRight: 0,
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        background: 'rgba(255, 255, 255, 0.72)',
        backdropFilter: 'blur(20px)',
        gap: '16px',
      }}
    >
      {/* ── Left: mobile toggle + role badge ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <button
          onClick={toggleMobile}
          className="btn-glass"
          style={{ padding: '7px 11px' }}
          aria-label="Toggle sidebar"
        >
          <i className="bi bi-list" style={{ fontSize: '20px' }} />
        </button>

        <span
          style={{
            padding: '4px 12px',
            borderRadius: 'var(--radius-full)',
            fontSize: '12px',
            fontWeight: 700,
            background: roleBg,
            color: roleColor,
            border: `1px solid ${roleBorder}`,
            letterSpacing: '0.03em',
          }}
        >
          {roleLabel} Mode
        </span>
      </div>

      {/* ── Right: switcher · notifications · user pill ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>

        {/* ── Role Switcher ── */}
        <div style={{ position: 'relative' }} ref={switcherRef}>
          <button
            onClick={() => { setShowUserSwitcher(!showUserSwitcher); setShowNotifs(false); }}
            className="btn-glass"
            style={{ fontSize: '12.5px', padding: '6px 12px', gap: '6px' }}
            title="Switch persona for testing"
          >
            <i className="bi bi-arrow-left-right" style={{ color: '#c084fc', fontSize: '13px' }} />
            <span>Switch Role</span>
            <i className="bi bi-chevron-down" style={{ fontSize: '10px', color: 'var(--text-muted)' }} />
          </button>

          {showUserSwitcher && (
            <div
              className="glass-panel"
              style={{
                position: 'absolute',
                right: 0,
                top: '46px',
                width: '270px',
                background: 'rgba(255,255,255,0.97)',
                border: '1px solid rgba(13,148,136,0.18)',
                borderRadius: 'var(--radius-md)',
                padding: '10px',
                boxShadow: '0 8px 32px rgba(13,148,136,0.12), 0 2px 8px rgba(0,0,0,0.06)',
                zIndex: 120,
              }}
            >
              <div style={{ fontSize: '11px', color: 'var(--text-subtle)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 4px' }}>
                Test Personas (Dev Mode)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {availableUsers.map((u) => {
                  const uColor = u.isHrAdmin ? '#c084fc' : u.isManager ? '#60a5fa' : '#2dd4bf';
                  const uBg = u.isHrAdmin ? 'rgba(168,85,247,0.15)' : u.isManager ? 'rgba(59,130,246,0.15)' : 'rgba(14,165,160,0.15)';
                  const isActive = u.user_id === user.user_id;
                  return (
                    <button
                      key={u.user_id}
                      onClick={() => { signIn(u.user_id); setShowUserSwitcher(false); }}
                      className="btn-glass"
                      style={{
                        justifyContent: 'flex-start',
                        textAlign: 'left',
                        padding: '8px 10px',
                        gap: '10px',
                        background: isActive ? uBg : 'transparent',
                        border: isActive ? `1px solid ${uColor}55` : '1px solid transparent',
                      }}
                    >
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: uBg,
                          border: `1px solid ${uColor}44`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: uColor,
                          flexShrink: 0,
                        }}
                      >
                        {u.full_name?.charAt(0)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-main)' }}>{u.full_name}</div>
                        <div style={{ fontSize: '11px', color: uColor }}>{u.isHrAdmin ? 'HR / Admin' : u.isManager ? 'Manager' : 'Employee'}</div>
                      </div>
                      {isActive && <i className="bi bi-check-circle-fill" style={{ color: uColor, fontSize: '14px' }} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Notification Bell ── */}
        <div style={{ position: 'relative' }} ref={notifRef}>
          <button
            onClick={() => { setShowNotifs(!showNotifs); setShowUserSwitcher(false); }}
            className="btn-glass"
            style={{ padding: '7px 12px', position: 'relative' }}
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
          >
            <i className="bi bi-bell" style={{ fontSize: '17px', color: unreadCount > 0 ? '#0ea5a0' : 'var(--text-muted)' }} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-3px',
                  right: '-3px',
                  background: '#0ea5a0',
                  color: '#fff',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  fontSize: '10px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1.5px solid #fff',
                }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <div
              className="glass-panel"
              style={{
                position: 'absolute',
                right: 0,
                top: '48px',
                width: '340px',
                maxHeight: '420px',
                overflowY: 'auto',
                background: 'rgba(255,255,255,0.97)',
                border: '1px solid rgba(13,148,136,0.18)',
                borderRadius: 'var(--radius-md)',
                padding: '14px',
                boxShadow: '0 8px 40px rgba(13,148,136,0.12), 0 2px 8px rgba(0,0,0,0.06)',
                zIndex: 120,
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="bi bi-bell-fill" style={{ color: '#0ea5a0', fontSize: '14px' }} />
                  <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>Notifications</strong>
                  {unreadCount > 0 && (
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '1px 7px',
                        borderRadius: '999px',
                        background: 'rgba(14,165,160,0.2)',
                        color: '#2dd4bf',
                        border: '1px solid rgba(14,165,160,0.4)',
                        fontWeight: 700,
                      }}
                    >
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <Link
                  to="/notifications"
                  onClick={() => setShowNotifs(false)}
                  style={{ fontSize: '12px', color: '#0ea5a0', textDecoration: 'none', fontWeight: 600 }}
                >
                  View All →
                </Link>
              </div>

              {notifications.length === 0 ? (
                <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--text-subtle)', fontSize: '13px' }}>
                  <i className="bi bi-bell-slash" style={{ fontSize: '26px', display: 'block', marginBottom: '8px', color: 'var(--text-subtle)' }} />
                  No notifications yet
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {notifications.slice(0, 6).map((n) => (
                    <div
                      key={n.notification_id}
                      className={`notif-item${n.is_read ? '' : ' unread'}`}
                      onClick={() => markNotificationRead(n.notification_id)}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '9px' }}>
                        {!n.is_read && <div className="notif-dot" style={{ marginTop: '5px' }} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '12.5px', fontWeight: 600, color: n.is_read ? 'var(--text-muted)' : 'var(--text-main)', lineHeight: 1.3 }}>
                            {n.subject}
                          </div>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-subtle)', marginTop: '3px', lineHeight: 1.4 }}>
                            {n.body}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── User Pill ── */}
        <Link
          to="/profile"
          className="glass-panel"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '9px',
            padding: '5px 12px 5px 6px',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(255,255,255,0.06)',
            cursor: 'pointer',
            textDecoration: 'none',
            color: 'inherit',
          }}
          title="View your profile & settings"
        >
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              background: avatarBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '12px',
              color: '#fff',
              flexShrink: 0,
            }}
          >
            {user.full_name?.charAt(0) || 'U'}
          </div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: '12.5px', fontWeight: 600 }}>{user.full_name}</div>
            <div style={{ fontSize: '10.5px', color: 'var(--text-subtle)' }}>{user.email}</div>
          </div>
        </Link>
      </div>
    </header>
  );
};
