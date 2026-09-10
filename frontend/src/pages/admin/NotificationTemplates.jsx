import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { GlassCard } from '../../components/common/GlassCard';
import { Modal } from '../../components/common/Modal';

const AVAILABLE_TOKENS = [
  { token: '{{employee_name}}', desc: "Full name of the requesting employee" },
  { token: '{{request_number}}', desc: "Unique reference code (e.g. LR-2026-001)" },
  { token: '{{leave_type}}', desc: "Leave type name (e.g. Annual Leave, Sick)" },
  { token: '{{start_date}}', desc: "Leave commencement date" },
  { token: '{{end_date}}', desc: "Leave conclusion date" },
  { token: '{{days}}', desc: "Deducted working days" },
  { token: '{{approver_name}}', desc: "Name of deciding manager or HR administrator" },
  { token: '{{reason}}', desc: "Applicant's reason or approver's remarks" },
  { token: '{{remaining_balance}}', desc: "Current leave ledger remaining balance" },
  { token: '{{deadline}}', desc: "Withdrawal window expiry timestamp" },
];

export const NotificationTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Edit / Create Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [form, setForm] = useState({
    notification_type: '',
    subject_template: '',
    body_template: '',
  });

  // Preview Modal
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);

  const [submitting, setSubmitting] = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await api('/admin/notification-templates');
      setTemplates(res.templates || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const openNewModal = () => {
    setEditingTemplate(null);
    setForm({
      notification_type: '',
      subject_template: '',
      body_template: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (tpl) => {
    setEditingTemplate(tpl);
    setForm({
      notification_type: tpl.notification_type,
      subject_template: tpl.subject_template,
      body_template: tpl.body_template,
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingTemplate) {
        await api(`/admin/notification-templates/${editingTemplate.notification_template_id}`, {
          method: 'PUT',
          body: JSON.stringify({
            subject_template: form.subject_template,
            body_template: form.body_template,
          }),
        });
      } else {
        await api('/admin/notification-templates', {
          method: 'POST',
          body: JSON.stringify(form),
        });
      }
      setModalOpen(false);
      fetchTemplates();
    } catch (err) {
      alert(err.message || 'Failed to save email notification template');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (tpl) => {
    if (!window.confirm(`Are you sure you want to delete template "${tpl.notification_type}"?`)) return;
    try {
      await api(`/admin/notification-templates/${tpl.notification_template_id}`, { method: 'DELETE' });
      fetchTemplates();
    } catch (err) {
      alert(err.message || 'Failed to delete template');
    }
  };

  const insertToken = (token) => {
    setForm((prev) => ({
      ...prev,
      body_template: prev.body_template + ' ' + token,
    }));
  };

  const renderSimulatedText = (text) => {
    if (!text) return '';
    return text
      .replace(/\{\{employee_name\}\}/g, 'Sarah Jenkins')
      .replace(/\{\{request_number\}\}/g, 'LR-2026-084')
      .replace(/\{\{leave_type\}\}/g, 'Annual Leave')
      .replace(/\{\{start_date\}\}/g, '2026-10-15')
      .replace(/\{\{end_date\}\}/g, '2026-10-20')
      .replace(/\{\{days\}\}/g, '4')
      .replace(/\{\{approver_name\}\}/g, 'Marcus Vance')
      .replace(/\{\{reason\}\}/g, 'Family gathering and travel abroad')
      .replace(/\{\{remaining_balance\}\}/g, '14.5')
      .replace(/\{\{deadline\}\}/g, '2026-10-22 18:00 IST')
      .replace(/\{\{manager_name\}\}/g, 'Marcus Vance')
      .replace(/\{\{delegate_name\}\}/g, 'Devin Patel')
      .replace(/\{\{effective_from\}\}/g, '2026-10-14')
      .replace(/\{\{effective_to\}\}/g, '2026-10-25')
      .replace(/\{\{decision_status\}\}/g, 'APPROVED')
      .replace(/\{\{restored_days\}\}/g, '4')
      .replace(/\{\{lapse_risk_days\}\}/g, '3.5')
      .replace(/\{\{cap\}\}/g, '5');
  };

  const filteredTemplates = templates.filter((t) => {
    const q = searchQuery.toLowerCase();
    const matchesQuery = t.notification_type.toLowerCase().includes(q) || t.subject_template.toLowerCase().includes(q);
    if (!matchesQuery) return false;
    if (selectedCategory === 'ALL') return true;
    if (selectedCategory === 'APPROVALS') return t.notification_type.includes('REQUEST') || t.notification_type.includes('APPROVAL');
    if (selectedCategory === 'CANCELLATION') return t.notification_type.includes('CANCEL');
    if (selectedCategory === 'SLA') return t.notification_type.includes('SLA') || t.notification_type.includes('ESCALAT');
    if (selectedCategory === 'ALERTS') return t.notification_type.includes('ALERT') || t.notification_type.includes('WARNING');
    return true;
  });

  return (
    <div className="container-fluid" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(13,148,136,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
                fontSize: '18px',
              }}
            >
              <i className="bi bi-envelope-paper-heart" />
            </span>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Email Notification Templates
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', marginTop: '6px', maxWidth: '750px' }}>
            Manage transactional email templates sent to employees, managers, and administrators (FRD Section 6 Notification Matrix). Notification channel is strictly configured for Email.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={openNewModal}
            className="btn-glass btn-primary-glass"
            style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <i className="bi bi-plus-lg" />
            <span>New Email Template</span>
          </button>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: 'All Templates' },
            { id: 'APPROVALS', label: 'Leave & Approvals' },
            { id: 'CANCELLATION', label: 'Cancellations' },
            { id: 'SLA', label: 'SLA & Escalation' },
            { id: 'ALERTS', label: 'HR & Sick Alerts' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className="btn-glass"
              style={{
                fontSize: '12px',
                padding: '5px 12px',
                fontWeight: selectedCategory === cat.id ? 700 : 500,
                background: selectedCategory === cat.id ? 'rgba(13,148,136,0.18)' : 'transparent',
                borderColor: selectedCategory === cat.id ? 'var(--primary)' : 'var(--glass-border)',
                color: selectedCategory === cat.id ? 'var(--primary)' : 'var(--text-muted)',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', width: '260px' }}>
          <i
            className="bi bi-search"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)', fontSize: '13px' }}
          />
          <input
            type="text"
            className="input-glass"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', paddingLeft: '34px', fontSize: '13px' }}
          />
        </div>
      </div>

      {/* ── Templates Grid ── */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '18px' }}>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="skeleton" style={{ height: '220px', borderRadius: 'var(--radius-md)' }} />
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <GlassCard>
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-subtle)' }}>
            <i className="bi bi-envelope-open" style={{ fontSize: '36px', display: 'block', marginBottom: '10px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)' }}>No matching templates</h3>
            <p style={{ fontSize: '13px', marginTop: '4px' }}>Try adjusting your search criteria or create a new template.</p>
          </div>
        </GlassCard>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '18px' }}>
          {filteredTemplates.map((tpl) => (
            <GlassCard key={tpl.notification_template_id}>
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '12px' }}>
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                  <div>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: 'rgba(13,148,136,0.12)',
                        color: 'var(--primary)',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {tpl.notification_type}
                    </span>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', marginTop: '6px' }}>
                      {tpl.subject_template}
                    </h3>
                  </div>

                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '999px',
                      background: 'rgba(56,189,248,0.12)',
                      color: '#0284c7',
                      border: '1px solid rgba(56,189,248,0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <i className="bi bi-envelope-at" />
                    EMAIL
                  </span>
                </div>

                {/* Email Body Excerpt */}
                <div
                  style={{
                    fontSize: '12.5px',
                    color: 'var(--text-muted)',
                    background: 'rgba(255,255,255,0.45)',
                    padding: '10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(13,148,136,0.1)',
                    whiteSpace: 'pre-wrap',
                    maxHeight: '100px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: 1.45,
                  }}
                >
                  {tpl.body_template}
                </div>

                {/* Card Actions */}
                <div
                  style={{
                    marginTop: 'auto',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '10px',
                    borderTop: '1px solid rgba(13,148,136,0.12)',
                  }}
                >
                  <button
                    onClick={() => {
                      setPreviewTemplate(tpl);
                      setPreviewModalOpen(true);
                    }}
                    className="btn-glass"
                    style={{ fontSize: '12px', padding: '4px 10px', color: 'var(--primary)', gap: '6px' }}
                  >
                    <i className="bi bi-eye" />
                    Preview Email
                  </button>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => openEditModal(tpl)}
                      className="btn-glass"
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                      title="Edit email template"
                    >
                      <i className="bi bi-pencil" />
                    </button>
                    <button
                      onClick={() => handleDelete(tpl)}
                      className="btn-glass btn-danger-glass"
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                      title="Delete template"
                    >
                      <i className="bi bi-trash3" />
                    </button>
                  </div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* ── Modal: Edit / Create Template ── */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTemplate ? `Edit Template: ${editingTemplate.notification_type}` : 'Create Email Notification Template'}
        maxWidth="680px"
      >
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
              Notification Event Type *
            </label>
            <input
              type="text"
              className="input-glass"
              required
              disabled={!!editingTemplate}
              placeholder="e.g. SPECIAL_LEAVE_ALERT"
              value={form.notification_type}
              onChange={(e) => setForm({ ...form, notification_type: e.target.value.toUpperCase() })}
              style={{ width: '100%', textTransform: 'uppercase' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
              Email Subject Template *
            </label>
            <input
              type="text"
              className="input-glass"
              required
              placeholder="e.g. Action Required: Leave Request for {{employee_name}}"
              value={form.subject_template}
              onChange={(e) => setForm({ ...form, subject_template: e.target.value })}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
                Email Message Body *
              </label>
              <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>Plain text / Markdown format</span>
            </div>
            <textarea
              rows={8}
              className="input-glass"
              required
              placeholder="Dear {{employee_name}},&#10;&#10;Your leave request {{request_number}} has been submitted..."
              value={form.body_template}
              onChange={(e) => setForm({ ...form, body_template: e.target.value })}
              style={{ width: '100%', fontSize: '13px', lineHeight: 1.5 }}
            />
          </div>

          {/* Tokens Helper Bar */}
          <div
            style={{
              padding: '10px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(13,148,136,0.08)',
              border: '1px solid rgba(13,148,136,0.18)',
            }}
          >
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>
              Click to insert dynamic variable token:
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {AVAILABLE_TOKENS.map((t) => (
                <button
                  key={t.token}
                  type="button"
                  onClick={() => insertToken(t.token)}
                  className="btn-glass"
                  title={t.desc}
                  style={{ fontSize: '11px', padding: '3px 8px', background: 'rgba(255,255,255,0.7)', color: 'var(--primary)' }}
                >
                  + {t.token}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <button type="button" onClick={() => setModalOpen(false)} className="btn-glass">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-glass btn-primary-glass">
              {submitting ? 'Saving...' : editingTemplate ? 'Save Changes' : 'Create Template'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Email Live Simulation Preview ── */}
      <Modal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        title="Email Notification Client Preview"
        maxWidth="640px"
      >
        {previewTemplate && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Mock Email Header Bar */}
            <div
              style={{
                background: 'rgba(255,255,255,0.75)',
                border: '1px solid rgba(13,148,136,0.2)',
                borderRadius: 'var(--radius-sm)',
                padding: '14px',
                fontSize: '13px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', gap: '8px' }}>
                <strong style={{ width: '65px', color: 'var(--text-subtle)' }}>From:</strong>
                <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>LMS Notification Service &lt;noreply@company.com&gt;</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <strong style={{ width: '65px', color: 'var(--text-subtle)' }}>To:</strong>
                <span style={{ color: 'var(--text-main)' }}>Sarah Jenkins &lt;sarah.jenkins@company.com&gt;</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <strong style={{ width: '65px', color: 'var(--text-subtle)' }}>Subject:</strong>
                <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>
                  {renderSimulatedText(previewTemplate.subject_template)}
                </span>
              </div>
            </div>

            {/* Mock Email Body Card */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 'var(--radius-sm)',
                padding: '24px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ borderBottom: '2px solid var(--primary)', paddingBottom: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--primary)' }}>LMS 2.0 Notification</span>
                <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>{new Date().toLocaleString()}</span>
              </div>

              <div
                style={{
                  fontSize: '13.5px',
                  color: '#1e293b',
                  lineHeight: 1.65,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {renderSimulatedText(previewTemplate.body_template)}
              </div>

              <div style={{ marginTop: '24px', paddingTop: '14px', borderTop: '1px solid #e2e8f0', fontSize: '11px', color: '#64748b' }}>
                This is an automated operational notification generated per system policies. Please do not reply directly to this email.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => {
                  setPreviewModalOpen(false);
                  openEditModal(previewTemplate);
                }}
                className="btn-glass"
                style={{ fontSize: '12.5px' }}
              >
                <i className="bi bi-pencil" style={{ marginRight: '6px' }} />
                Edit Template
              </button>
              <button onClick={() => setPreviewModalOpen(false)} className="btn-glass btn-primary-glass" style={{ fontSize: '12.5px' }}>
                Close Preview
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
