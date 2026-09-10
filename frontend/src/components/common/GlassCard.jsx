import React from 'react';

export const GlassCard = ({ title, icon, action, children, className = '', style = {} }) => {
  return (
    <div className={`glass-panel glass-card ${className}`} style={style}>
      {(title || icon || action) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {icon && <i className={`bi bi-${icon}`} style={{ fontSize: '18px', color: 'var(--primary)' }} />}
            {title && <h3 style={{ fontSize: '17px', fontWeight: 600 }}>{title}</h3>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
