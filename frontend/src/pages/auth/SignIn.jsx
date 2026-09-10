import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { GlassCard } from '../../components/common/GlassCard';

export const SignIn = () => {
  const { authMode, availableUsers, signIn, loading } = useAuth();
  const [signingInId, setSigningInId] = useState(null);

  const handleDevSignIn = async (userId) => {
    setSigningInId(userId);
    try {
      await signIn(userId);
    } catch (err) {
      alert(err.message || 'Sign in failed');
    } finally {
      setSigningInId(null);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background ambient glowing orbs */}
      <div
        style={{
          position: 'absolute',
          width: '450px',
          height: '450px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.25) 0%, transparent 70%)',
          top: '10%',
          left: '15%',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.2) 0%, transparent 70%)',
          bottom: '10%',
          right: '15%',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ maxWidth: '480px', width: '100%', position: 'relative', zIndex: 10 }}>
        <GlassCard style={{ padding: '36px', textAlign: 'center' }}>
          {/* Logo & Branding */}
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '18px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 8px 24px rgba(59, 130, 246, 0.4)',
            }}
          >
            <i className="bi bi-calendar-check" style={{ fontSize: '32px', color: '#fff' }} />
          </div>

          <h1 style={{ fontSize: '26px', fontWeight: 800, marginBottom: '6px' }}>LMS 2.0</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '28px' }}>
            Enterprise Leave Management System
          </p>

          {/* Microsoft Entra SSO Button (LMS-001) */}
          <a
            href="/auth/login"
            className="btn-glass btn-primary-glass"
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '15px',
              borderRadius: 'var(--radius-md)',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
            }}
          >
            <i className="bi bi-microsoft" style={{ fontSize: '18px' }} />
            <span>Sign in with Microsoft Entra</span>
          </a>

          {/* Development and Test Mode (LMS-006) */}
          {authMode === 'dev' && (
            <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '22px', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <i className="bi bi-cpu" style={{ color: '#60a5fa' }} />
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Dev Quick Sign-in (Select Persona)
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {availableUsers.map((u) => (
                  <button
                    key={u.user_id}
                    onClick={() => handleDevSignIn(u.user_id)}
                    disabled={signingInId === u.user_id}
                    className="btn-glass"
                    style={{
                      padding: '12px 14px',
                      justifyContent: 'space-between',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: u.isHrAdmin ? 'rgba(168, 85, 247, 0.3)' : u.isManager ? 'rgba(59, 130, 246, 0.3)' : 'rgba(16, 185, 129, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '12px',
                          color: '#fff',
                        }}
                      >
                        {u.full_name?.charAt(0)}
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: '13.5px', fontWeight: 600 }}>{u.full_name}</div>
                        <small style={{ color: 'var(--text-subtle)', fontSize: '11px' }}>{u.email}</small>
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: '11px',
                        padding: '3px 8px',
                        borderRadius: '999px',
                        fontWeight: 600,
                        background: u.isHrAdmin ? 'rgba(168, 85, 247, 0.2)' : u.isManager ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                        color: u.isHrAdmin ? '#d8b4fe' : u.isManager ? '#93c5fd' : '#6ee7b7',
                      }}
                    >
                      {u.isHrAdmin ? 'HR / Admin' : u.isManager ? 'Manager' : 'Employee'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: '24px', fontSize: '12px', color: 'var(--text-subtle)' }}>
            LMS 2.0 • ISO 27001 Secure Access • Single Tenant
          </div>
        </GlassCard>
      </div>
    </div>
  );
};
