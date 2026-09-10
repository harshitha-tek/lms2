import React, { useEffect } from 'react';

export const Modal = ({ isOpen, onClose, title, children, maxWidth = '600px' }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="glass-panel glass-card modal-content"
        style={{ maxWidth, background: 'rgba(255, 255, 255, 0.95)', color: 'var(--text-main)', border: '1px solid rgba(13, 148, 136, 0.22)', boxShadow: '0 20px 50px rgba(13, 148, 136, 0.18)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600 }}>{title}</h3>
          <button
            onClick={onClose}
            className="btn-glass"
            style={{ padding: '6px 10px', borderRadius: '50%' }}
            aria-label="Close"
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
};
