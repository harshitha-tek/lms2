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

  // CSV Import Modal
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvFeedback, setCsvFeedback] = useState(null);

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

  const handleCsvImport = async () => {
    if (!csvText.trim()) {
      alert('Please paste or upload CSV data first.');
      return;
    }
    const lines = csvText.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length <= 1) {
      alert('CSV must contain a header row and at least one data row.');
      return;
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim());
      if (parts.length < 2) continue;
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = parts[idx];
      });
      rows.push(row);
    }

    setSubmitting(true);
    setCsvFeedback(null);
    try {
      const res = await api('/admin/holidays/import', {
        method: 'POST',
        body: JSON.stringify({ rows }),
      });
      const skipped = res.skipped
        ? ` ${res.skipped} row(s) skipped: ${(res.errors || []).slice(0, 3).join('; ')}`
        : '';
      setCsvFeedback(`Imported ${res.imported} holiday(s).${skipped}`);
      fetchHolidays();
      if (!res.skipped) {
        setTimeout(() => {
          setCsvModalOpen(false);
          setCsvFeedback(null);
          setCsvText('');
        }, 1500);
      }
    } catch (err) {
      alert(err.message || 'Failed to import CSV');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvText(event.target.result);
    };
    reader.readAsText(file);
  };

  const downloadSampleCsv = () => {
    const sample = `holiday_date,holiday_name,holiday_type
2026-01-01,New Year's Day,NATIONAL
2026-01-26,Republic Day,NATIONAL
2026-03-06,Holi,FESTIVAL
2026-10-20,Optional Regional Holiday,OPTIONAL`;
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'holiday_calendar_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            Maintain dated, named public holidays for the current and next leave year.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={() => setCsvModalOpen(true)} className="btn-glass">
            <i className="bi bi-filetype-csv" />
            <span>Import CSV</span>
          </button>
          <button onClick={() => setModalOpen(true)} className="btn-glass btn-primary-glass">
            <i className="bi bi-calendar-plus" />
            <span>Add Public Holiday</span>
          </button>
        </div>
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

      {/* Import Holidays from CSV */}
      <Modal
        isOpen={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        title="Import Holiday Calendar from CSV"
        maxWidth="600px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
            Columns: <code>holiday_date</code> (YYYY-MM-DD), <code>holiday_name</code>, <code>holiday_type</code>
            (NATIONAL, FESTIVAL or OPTIONAL). Rows with a date that already exists are skipped.
          </p>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="btn-glass" style={{ cursor: 'pointer', fontSize: '12.5px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <i className="bi bi-upload" />
              <span>Choose CSV File</span>
              <input type="file" accept=".csv" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>

            <button onClick={downloadSampleCsv} className="btn-glass" style={{ fontSize: '12px', color: 'var(--primary)' }}>
              <i className="bi bi-download" style={{ marginRight: '5px' }} /> Download Template
            </button>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
              Or Paste CSV Data Directly:
            </label>
            <textarea
              rows={7}
              className="input-glass"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={'holiday_date,holiday_name,holiday_type\n2026-01-26,Republic Day,NATIONAL'}
              style={{ width: '100%', fontFamily: 'monospace', fontSize: '12px' }}
            />
          </div>

          {csvFeedback && (
            <div style={{ padding: '10px', borderRadius: 'var(--radius-sm)', background: 'rgba(5,150,105,0.15)', color: '#059669', fontSize: '13px', fontWeight: 600 }}>
              <i className="bi bi-check-circle-fill" style={{ marginRight: '6px' }} />
              {csvFeedback}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <button type="button" onClick={() => setCsvModalOpen(false)} className="btn-glass">
              Close
            </button>
            <button type="button" onClick={handleCsvImport} disabled={submitting} className="btn-glass btn-primary-glass">
              {submitting ? 'Importing...' : 'Run CSV Import'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
