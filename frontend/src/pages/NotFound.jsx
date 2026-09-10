import React from 'react';
import { Link } from 'react-router-dom';
import { GlassCard } from '../components/common/GlassCard';

export const NotFound = () => {
  return (
    <div className="container-fluid" style={{ textAlign: 'center', padding: '80px 20px' }}>
      <GlassCard style={{ maxWidth: '500px', margin: '0 auto', padding: '40px' }}>
        <h1 style={{ fontSize: '64px', fontWeight: 900, color: 'var(--primary)', marginBottom: '10px' }}>
          404
        </h1>
        <h2 style={{ fontSize: '20px', marginBottom: '12px' }}>Page Not Found</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>
          The screen you are looking for does not exist or has been moved.
        </p>
        <Link to="/dashboard" className="btn-glass btn-primary-glass">
          <i className="bi bi-house-door" />
          <span>Return to Dashboard</span>
        </Link>
      </GlassCard>
    </div>
  );
};
