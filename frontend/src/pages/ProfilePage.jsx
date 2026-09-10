import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { GlassCard } from '../components/common/GlassCard';

export const ProfilePage = () => {
  const { user, updateUser } = useAuth();

  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Editable Form Fields
  const [formData, setFormData] = useState({
    full_name: '',
    phone_number: '',
    personal_email: '',
  });

  // Avatar Management
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const fileInputRef = useRef(null);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await api('/profile');
      const u = res.user || user;
      setProfileData(u);
      setFormData({
        full_name: u.full_name || '',
        phone_number: u.phone_number || '',
        personal_email: u.personal_email || '',
      });
      if (u.profile_image) {
        setAvatarPreview(u.profile_image);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to load profile details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleAvatarSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('Profile picture exceeds 2 MB limit. Please select a smaller image file.');
      return;
    }

    setErrorMsg(null);
    setAvatarFile(file);
    setRemovePhoto(false);
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);
  };

  const handleRemovePhoto = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    setRemovePhoto(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const formPayload = new FormData();
      formPayload.append('phone_number', formData.phone_number || '');
      formPayload.append('personal_email', formData.personal_email || '');
      formPayload.append('remove_photo', removePhoto ? 'true' : 'false');
      if (avatarFile) {
        formPayload.append('avatar', avatarFile);
      }

      const res = await api('/profile', {
        method: 'PUT',
        body: formPayload,
      });

      if (res.user) {
        setProfileData((prev) => ({ ...prev, ...res.user }));
        updateUser(res.user);
      }

      setSuccessMsg('Your personal details and profile picture were saved successfully!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container-fluid" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="skeleton" style={{ height: '80px', borderRadius: 'var(--radius-md)' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="skeleton" style={{ height: '400px', borderRadius: 'var(--radius-md)' }} />
          <div className="skeleton" style={{ height: '400px', borderRadius: 'var(--radius-md)' }} />
        </div>
      </div>
    );
  }

  const u = profileData || user;
  const roleLabel = u?.isHrAdmin ? 'HR / Admin' : u?.isManager ? 'Manager' : 'Employee';
  const roleBadgeBg = u?.isHrAdmin ? 'rgba(168,85,247,0.15)' : u?.isManager ? 'rgba(59,130,246,0.15)' : 'rgba(13,148,136,0.15)';
  const roleColor = u?.isHrAdmin ? '#a855f7' : u?.isManager ? '#2563eb' : '#0d9488';

  return (
    <div className="container-fluid" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '11px',
                background: 'rgba(13,148,136,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
                fontSize: '18px',
              }}
            >
              <i className="bi bi-person-lines-fill" />
            </span>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              My Profile &amp; Settings
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', marginTop: '6px' }}>
            View official organizational records on the left and update your personal contact info and avatar on the right.
          </p>
        </div>

        {successMsg && (
          <div
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(5,150,105,0.15)',
              border: '1px solid rgba(5,150,105,0.3)',
              color: '#059669',
              fontWeight: 700,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <i className="bi bi-check2-circle" style={{ fontSize: '16px' }} />
            {successMsg}
          </div>
        )}

        {errorMsg && (
          <div
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(220,38,38,0.12)',
              border: '1px solid rgba(220,38,38,0.3)',
              color: '#dc2626',
              fontWeight: 600,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <i className="bi bi-exclamation-triangle" />
            {errorMsg}
          </div>
        )}
      </div>

      {/* ── Two-Column Split Layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '22px', alignItems: 'start' }}>
        {/* ══════════════════════════════════════════════════════════
            LEFT COLUMN: OFFICIAL EMPLOYEE DETAILS (READ-ONLY)
        ══════════════════════════════════════════════════════════ */}
        <GlassCard>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Column Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(13,148,136,0.15)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="bi bi-lock-fill" style={{ color: 'var(--primary)', fontSize: '15px' }} />
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  Official Employment Information
                </h2>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: 'rgba(0,0,0,0.06)',
                  color: 'var(--text-muted)',
                }}
              >
                Read-Only
              </span>
            </div>

            {/* Read-Only Fields Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div style={{ background: 'rgba(255,255,255,0.5)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(13,148,136,0.1)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-subtle)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Employee ID / Code
                </span>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', marginTop: '3px' }}>
                  {u.employee_code || 'EMP-1001'}
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.5)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(13,148,136,0.1)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-subtle)', fontWeight: 600, textTransform: 'uppercase' }}>
                  System Role
                </span>
                <div style={{ marginTop: '3px' }}>
                  <span
                    style={{
                      fontSize: '11.5px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '999px',
                      background: roleBadgeBg,
                      color: roleColor,
                    }}
                  >
                    {roleLabel}
                  </span>
                </div>
              </div>

              <div style={{ gridColumn: 'span 2', background: 'rgba(255,255,255,0.5)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(13,148,136,0.1)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-subtle)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Official Work Email
                </span>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)', marginTop: '3px' }}>
                  {u.email}
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.5)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(13,148,136,0.1)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-subtle)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Department
                </span>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)', marginTop: '3px' }}>
                  {u.department_name ? `${u.department_name} (${u.department_code})` : 'Engineering'}
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.5)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(13,148,136,0.1)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-subtle)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Grade &amp; Level
                </span>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)', marginTop: '3px' }}>
                  {u.grade_name || 'Senior Level'} {u.grade_code ? `(${u.grade_code})` : ''}
                </div>
              </div>

              <div style={{ gridColumn: 'span 2', background: 'rgba(255,255,255,0.5)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(13,148,136,0.1)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-subtle)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Reporting Manager
                </span>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="bi bi-person-badge" style={{ color: 'var(--primary)' }} />
                  {u.manager_name ? `${u.manager_name} (${u.manager_email})` : 'Executive / Direct Head of Org'}
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.5)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(13,148,136,0.1)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-subtle)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Date of Joining
                </span>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)', marginTop: '3px' }}>
                  {u.joined_date ? new Date(u.joined_date).toLocaleDateString() : '2022-01-10'}
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.5)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(13,148,136,0.1)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-subtle)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Employment Status
                </span>
                <div style={{ marginTop: '3px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: 'rgba(5,150,105,0.15)', color: '#059669' }}>
                    Active
                  </span>
                </div>
              </div>
            </div>

            {/* Note Notice */}
            <div
              style={{
                fontSize: '12px',
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(13,148,136,0.08)',
                border: '1px solid rgba(13,148,136,0.18)',
                color: 'var(--text-muted)',
                lineHeight: 1.5,
              }}
            >
              <i className="bi bi-info-circle-fill" style={{ color: 'var(--primary)', marginRight: '6px' }} />
              These official details are provisioned through Microsoft Entra ID and managed by HR/Admin. Contact HR if your title or hierarchy needs updating.
            </div>
          </div>
        </GlassCard>

        {/* ══════════════════════════════════════════════════════════
            RIGHT COLUMN: PERSONAL DETAILS & AVATAR (EDITABLE)
        ══════════════════════════════════════════════════════════ */}
        <GlassCard>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Column Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(13,148,136,0.15)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="bi bi-pencil-square" style={{ color: 'var(--primary)', fontSize: '15px' }} />
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  Personal Details &amp; Picture
                </h2>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: 'rgba(13,148,136,0.15)',
                  color: 'var(--primary)',
                }}
              >
                Editable
              </span>
            </div>

            {/* Avatar Section */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '18px',
                padding: '14px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(255,255,255,0.5)',
                border: '1px solid rgba(13,148,136,0.12)',
              }}
            >
              {/* Avatar Circle */}
              <div
                style={{
                  width: '76px',
                  height: '76px',
                  borderRadius: '50%',
                  background: avatarPreview
                    ? `url(${avatarPreview}) center/cover no-repeat`
                    : 'linear-gradient(135deg, #0d9488, #38bdf8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '28px',
                  color: '#fff',
                  border: '3px solid rgba(13,148,136,0.3)',
                  boxShadow: '0 4px 14px rgba(13,148,136,0.2)',
                  flexShrink: 0,
                }}
              >
                {!avatarPreview && (u.full_name?.charAt(0) || 'U')}
              </div>

              {/* Avatar Controls */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                  Profile Picture
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-subtle)', margin: '2px 0 10px' }}>
                  PNG, JPG or WebP (Maximum size: 2 MB)
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-glass"
                    style={{ fontSize: '12px', padding: '5px 12px', color: 'var(--primary)', borderColor: 'rgba(13,148,136,0.3)' }}
                  >
                    <i className="bi bi-camera" style={{ marginRight: '6px' }} />
                    {avatarPreview ? 'Change Photo' : 'Upload Photo'}
                  </button>

                  {avatarPreview && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="btn-glass btn-danger-glass"
                      style={{ fontSize: '12px', padding: '5px 12px' }}
                    >
                      <i className="bi bi-trash3" style={{ marginRight: '4px' }} />
                      Remove
                    </button>
                  )}

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleAvatarSelect}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>
            </div>

            {/* Editable Form Inputs */}
            <div>
              <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                Full Name *
              </label>
              <input
                type="text"
                className="input-glass"
                required
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                Contact Phone Number
              </label>
              <input
                type="tel"
                className="input-glass"
                placeholder="e.g. +91 98765 43210"
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                Personal Email Address
              </label>
              <input
                type="email"
                className="input-glass"
                placeholder="e.g. user.personal@gmail.com"
                value={formData.personal_email}
                onChange={(e) => setFormData({ ...formData, personal_email: e.target.value })}
                style={{ width: '100%' }}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: '2px', display: 'block' }}>
                Used for backup HR communications and personal receipts.
              </span>
            </div>

            {/* Submit Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button
                type="submit"
                disabled={saving}
                className="btn-glass btn-primary-glass"
                style={{ padding: '9px 24px', fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {saving ? (
                  <>
                    <i className="bi bi-arrow-repeat spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <i className="bi bi-check2" />
                    <span>Save Profile Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </GlassCard>
      </div>
    </div>
  );
};
