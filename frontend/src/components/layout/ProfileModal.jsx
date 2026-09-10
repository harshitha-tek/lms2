import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

/**
 * ProfileModal – a two‑column modal opened from the Topbar user chip.
 * Left column: read‑only employee details (cannot be edited).
 * Right column: editable personal fields – full name, phone, etc.
 * Allows uploading a profile picture (max 2 MB) and removing the current picture.
 */
export const ProfileModal = ({ isOpen, onClose }) => {
  const { user, updateUser, signOut } = useAuth();
  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [error, setError] = useState('');

  const fileInputRef = useRef(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file && file.size > 2 * 1024 * 1024) {
      setError('Profile picture must be 2 MB or smaller');
      return;
    }
    setError('');
    setAvatarFile(file);
  };

  const handleRemovePhoto = () => {
    setAvatarFile(null);
    // In a real app you would also tell the backend to delete the stored picture.
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Here we would send `formData` and `avatarFile` to the backend.
    // For now we just update the auth context (mock).
    await updateUser({ ...formData, avatar: avatarFile ? URL.createObjectURL(avatarFile) : user.avatar });
    onClose();
  };

  // Close on outside click
  const modalRef = useRef(null);
  useEffect(() => {
    const listener = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose();
      }
    };
    if (isOpen) document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(13,148,136,0.18)' }}>
      <div ref={modalRef} className="glass-panel" style={{ width: '560px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', borderRadius: 'var(--radius-lg)' }}>
        <h2 style={{ marginBottom: '16px', fontSize: '20px', fontWeight: 700, color: 'var(--text-main)' }}>Profile</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '24px' }}>
          {/* Left – read‑only info */}
          <div style={{ flex: 1, borderRight: '1px solid rgba(13,148,136,0.12)', paddingRight: '16px' }}>
            <h3 style={{ marginBottom: '12px', fontSize: '15px', fontWeight: 600, color: 'var(--text-muted)' }}>Employee Details</h3>
            <p style={{ marginBottom: '6px' }}><strong>ID:</strong> {user?.employee_id || '—'}</p>
            <p style={{ marginBottom: '6px' }}><strong>Role:</strong> {user?.isHrAdmin ? 'HR / Admin' : user?.isManager ? 'Manager' : 'Employee'}</p>
            <p style={{ marginBottom: '6px' }}><strong>Email:</strong> {user?.email || '—'}</p>
          </div>

          {/* Right – editable fields */}
          <div style={{ flex: 1, paddingLeft: '16px' }}>
            <h3 style={{ marginBottom: '12px', fontSize: '15px', fontWeight: 600, color: 'var(--text-muted)' }}>Personal Details</h3>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>Full Name</label>
              <input
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                className="glass-input"
                style={{ width: '100%' }}
                required
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>Phone</label>
              <input
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="glass-input"
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>Profile Picture</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-glass btn-primary-glass"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Add / Change
                </button>
                {user?.avatar && (
                  <button
                    type="button"
                    className="btn-glass btn-danger-glass"
                    onClick={handleRemovePhoto}
                  >
                    Remove
                  </button>
                )}
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleAvatarChange}
                />
              </div>
              {error && <p style={{ color: '#dc2626', marginTop: '4px', fontSize: '12px' }}>{error}</p>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
              <button type="button" className="btn-glass btn-danger-glass" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-glass btn-primary-glass">Save</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
