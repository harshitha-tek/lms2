import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { GlassCard } from '../../components/common/GlassCard';
import { Modal } from '../../components/common/Modal';

export const HolidayAdmin = () => {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    holiday_date: '',
    holiday_name: '',
    holiday_type: 'NATIONAL',
  });

  const fetchHolidays = () => {
    setLoading(true);
    api('/holidays')
      .then((res) => setHolidays(res.holidays || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchHolidays();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api('/admin/holidays', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setModalOpen(false);
      setForm({ holiday_date: '', holiday_name: '', holiday_type: 'NATIONAL' });
      fetchHolidays();
    } catch (err) {
      alert(err.message || 'Failed to add holiday');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to remove this holiday?')) return;
    try {
      await api(`/admin/holidays/${id}`, { method: 'DELETE' });
      fetchHolidays();
    } catch (err) {
      alert(err.message || 'Failed to remove holiday');
    }
  };

  return (
    <div className="container-fluid" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Holiday Calendar Administration</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Maintain dated, named public holidays for the current and next leave year (LMS-028).
          </p>
        </div>

        <button onClick={() => setModalOpen(true)} className="btn-glass btn-primary-glass">
          <i className="bi bi-calendar-plus" />
          <span>Add Public Holiday</span>
        </button>
      </div>

      <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <i className="bi bi-arrow-repeat spin" style={{ fontSize: '28px', color: 'var(--primary)' }} />
            <p style={{ marginTop: '10px' }}>Loading holidays...</p>
          </div>
        ) : holidays.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <p>No holidays configured.</p>
          </div>
        ) : (
          <table className="glass-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Holiday Name</th>
                <th>Category</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {holidays.map((h) => (
                <tr key={h.holiday_id}>
                  <td style={{ fontWeight: 600, color: '#93c5fd' }}>{h.holiday_date}</td>
                  <td style={{ fontWeight: 600 }}>{h.holiday_name}</td>
                  <td>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '3px 8px',
                        borderRadius: '999px',
                        background: h.holiday_type === 'NATIONAL' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                        color: h.holiday_type === 'NATIONAL' ? '#93c5fd' : '#fbbf24',
                        fontWeight: 600,
                      }}
                    >
                      {h.holiday_type}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => handleDelete(h.holiday_id)}
                      className="btn-glass btn-danger-glass"
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </GlassCard>

      {/* Add Holiday Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Public Holiday"
      >
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Holiday Date *
            </label>
            <input
              type="date"
              className="glass-input"
              value={form.holiday_date}
              onChange={(e) => setForm({ ...form, holiday_date: e.target.value })}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Holiday Name *
            </label>
            <input
              type="text"
              className="glass-input"
              placeholder="e.g. Republic Day"
              value={form.holiday_name}
              onChange={(e) => setForm({ ...form, holiday_name: e.target.value })}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Category *
            </label>
            <select
              className="glass-select"
              value={form.holiday_type}
              onChange={(e) => setForm({ ...form, holiday_type: e.target.value })}
            >
              <option value="NATIONAL">National Holiday</option>
              <option value="FESTIVAL">Festival Holiday</option>
              <option value="OPTIONAL">Optional / Restricted</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button type="button" onClick={() => setModalOpen(false)} className="btn-glass">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-glass btn-primary-glass">
              {submitting ? 'Adding...' : 'Save Holiday'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
