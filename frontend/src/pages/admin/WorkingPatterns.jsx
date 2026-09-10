import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { GlassCard } from '../../components/common/GlassCard';
import { Modal } from '../../components/common/Modal';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const PRESETS = [
  { label: 'Standard 5-Day (Mon-Fri 8h)', schedule: [0, 8, 8, 8, 8, 8, 0] },
  { label: 'Condensed 4-Day (Mon-Thu 10h)', schedule: [0, 10, 10, 10, 10, 0, 0] },
  { label: 'Sun-Thu Shift (8h/day)', schedule: [8, 8, 8, 8, 8, 0, 0] },
  { label: 'Weekend Coverage (Tue-Sat 8h)', schedule: [0, 0, 8, 8, 8, 8, 8] },
];

export const WorkingPatterns = () => {
  const [activeTab, setActiveTab] = useState('patterns'); // 'patterns' | 'assignments'
  const [patterns, setPatterns] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pattern Modal
  const [patternModalOpen, setPatternModalOpen] = useState(false);
  const [editingPatternId, setEditingPatternId] = useState(null);
  const [patternForm, setPatternForm] = useState({
    pattern_code: '',
    pattern_name: '',
    days: [0, 8, 8, 8, 8, 8, 0].map((h, i) => ({ day_of_week: i, working_hours: h })),
  });

  // Assign Modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({
    user_id: '',
    working_pattern_id: '',
    effective_from: new Date().toISOString().slice(0, 10),
    effective_to: '',
  });

  // CSV Import Modal
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvFeedback, setCsvFeedback] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api('/admin/working-patterns');
      setPatterns(res.patterns || []);
      setAssignments(res.assignments || []);
      setUsers(res.users || []);
    } catch (err) {
      setError(err.message || 'Failed to load working patterns data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openNewPatternModal = () => {
    setEditingPatternId(null);
    setPatternForm({
      pattern_code: '',
      pattern_name: '',
      days: [0, 8, 8, 8, 8, 8, 0].map((h, i) => ({ day_of_week: i, working_hours: h })),
    });
    setPatternModalOpen(true);
  };

  const openEditPatternModal = (p) => {
    setEditingPatternId(p.working_pattern_id);
    const dayMap = {};
    (p.days || []).forEach((d) => {
      dayMap[d.day_of_week] = parseFloat(d.working_hours);
    });
    setPatternForm({
      pattern_code: p.pattern_code,
      pattern_name: p.pattern_name,
      days: [0, 1, 2, 3, 4, 5, 6].map((i) => ({
        day_of_week: i,
        working_hours: dayMap[i] !== undefined ? dayMap[i] : (i >= 1 && i <= 5 ? 8 : 0),
      })),
    });
    setPatternModalOpen(true);
  };

  const handleApplyPreset = (preset) => {
    setPatternForm((prev) => ({
      ...prev,
      days: preset.schedule.map((h, i) => ({ day_of_week: i, working_hours: h })),
    }));
  };

  const handleSavePattern = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingPatternId) {
        await api(`/admin/working-patterns/${editingPatternId}`, {
          method: 'PUT',
          body: JSON.stringify({
            pattern_name: patternForm.pattern_name,
            days: patternForm.days,
          }),
        });
      } else {
        await api('/admin/working-patterns', {
          method: 'POST',
          body: JSON.stringify(patternForm),
        });
      }
      setPatternModalOpen(false);
      fetchData();
    } catch (err) {
      alert(err.message || 'Error saving working pattern');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePattern = async (p) => {
    if (!window.confirm(`Are you sure you want to delete pattern "${p.pattern_name}" (${p.pattern_code})?`)) return;
    try {
      await api(`/admin/working-patterns/${p.working_pattern_id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      alert(err.message || 'Failed to delete pattern');
    }
  };

  const handleAssignPattern = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api('/admin/working-patterns/assign', {
        method: 'POST',
        body: JSON.stringify({
          user_id: assignForm.user_id,
          working_pattern_id: assignForm.working_pattern_id,
          effective_from: assignForm.effective_from,
          effective_to: assignForm.effective_to || null,
        }),
      });
      setAssignModalOpen(false);
      setAssignForm({ user_id: '', working_pattern_id: '', effective_from: new Date().toISOString().slice(0, 10), effective_to: '' });
      fetchData();
    } catch (err) {
      alert(err.message || 'Failed to assign pattern');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeAssignment = async (id) => {
    if (!window.confirm('Remove this working pattern assignment from the employee?')) return;
    try {
      await api(`/admin/working-patterns/assignments/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      alert(err.message || 'Failed to revoke assignment');
    }
  };

  // CSV Import handler
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
    try {
      const res = await api('/admin/working-patterns/import', {
        method: 'POST',
        body: JSON.stringify({ rows }),
      });
      setCsvFeedback(`Successfully imported ${res.count} working pattern(s).`);
      setTimeout(() => {
        setCsvModalOpen(false);
        setCsvFeedback(null);
        setCsvText('');
        fetchData();
      }, 1500);
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
    const sample = `pattern_code,pattern_name,sun,mon,tue,wed,thu,fri,sat
SHIFT_MID,Midday Shift (Mon-Fri 7.5h),0,7.5,7.5,7.5,7.5,7.5,0
FOUR_ON_THREE,4 Days 9 Hours (Mon-Thu),0,9,9,9,9,0,0
WEEKEND_ON,Weekend Coverage (Thu-Mon 8h),8,8,0,0,8,8,8`;
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'working_patterns_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const calculateWeeklyHours = (days) => {
    if (!days) return 0;
    return days.reduce((sum, d) => sum + parseFloat(d.working_hours || 0), 0);
  };

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
              <i className="bi bi-clock-history" />
            </span>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Working Patterns & Schedules
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', marginTop: '6px', maxWidth: '750px' }}>
            Define custom schedules and weekend days for round-the-clock teams. Exactly one active working pattern is enforced per employee on any given date (FRD BR-06 & LMS-015).
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setCsvModalOpen(true)}
            className="btn-glass"
            style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', color: '#0d9488', borderColor: 'rgba(13,148,136,0.3)' }}
          >
            <i className="bi bi-file-earmark-spreadsheet" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={() => {
              if (patterns.length > 0) {
                setAssignForm((prev) => ({
                  ...prev,
                  working_pattern_id: patterns[0].working_pattern_id,
                  user_id: users.length > 0 ? users[0].user_id : '',
                }));
              }
              setAssignModalOpen(true);
            }}
            className="btn-glass"
            style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <i className="bi bi-person-plus" />
            <span>Assign to Employee</span>
          </button>

          <button
            onClick={openNewPatternModal}
            className="btn-glass btn-primary-glass"
            style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <i className="bi bi-plus-lg" />
            <span>New Pattern</span>
          </button>
        </div>
      </div>

      {/* ── Sub-navigation Tabs ── */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(13,148,136,0.18)', paddingBottom: '2px' }}>
        <button
          onClick={() => setActiveTab('patterns')}
          style={{
            background: 'none',
            border: 'none',
            padding: '10px 18px',
            fontSize: '14px',
            fontWeight: activeTab === 'patterns' ? 700 : 500,
            color: activeTab === 'patterns' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'patterns' ? '3px solid var(--primary)' : '3px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <i className="bi bi-calendar4-week" />
          <span>Pattern Catalog ({patterns.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('assignments')}
          style={{
            background: 'none',
            border: 'none',
            padding: '10px 18px',
            fontSize: '14px',
            fontWeight: activeTab === 'assignments' ? 700 : 500,
            color: activeTab === 'assignments' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'assignments' ? '3px solid var(--primary)' : '3px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <i className="bi bi-people-fill" />
          <span>Employee Assignments ({assignments.length})</span>
        </button>
      </div>

      {/* ── Tab Content: Pattern Catalog ── */}
      {activeTab === 'patterns' && (
        <>
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
              {[1, 2, 3].map((n) => (
                <div key={n} className="skeleton" style={{ height: '170px', borderRadius: 'var(--radius-md)' }} />
              ))}
            </div>
          ) : patterns.length === 0 ? (
            <GlassCard>
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-subtle)' }}>
                <i className="bi bi-calendar-x" style={{ fontSize: '36px', display: 'block', marginBottom: '12px' }} />
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)' }}>No Working Patterns Defined</h3>
                <p style={{ fontSize: '13px', marginTop: '6px', maxWidth: '400px', margin: '6px auto 16px' }}>
                  Create your first schedule pattern or load default standards to support shift workers and alternate weekends.
                </p>
                <button onClick={openNewPatternModal} className="btn-glass btn-primary-glass" style={{ fontSize: '13px' }}>
                  <i className="bi bi-plus-lg" /> Create Pattern
                </button>
              </div>
            </GlassCard>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '18px' }}>
              {patterns.map((p) => {
                const weeklyHours = calculateWeeklyHours(p.days);
                const dayMap = {};
                (p.days || []).forEach((d) => {
                  dayMap[d.day_of_week] = parseFloat(d.working_hours);
                });

                return (
                  <GlassCard key={p.working_pattern_id}>
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '14px' }}>
                      {/* Top Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                fontSize: '11.5px',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '6px',
                                background: 'rgba(13,148,136,0.14)',
                                color: 'var(--primary)',
                                letterSpacing: '0.04em',
                              }}
                            >
                              {p.pattern_code}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>
                              ID #{p.working_pattern_id}
                            </span>
                          </div>
                          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
                            {p.pattern_name}
                          </h3>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span
                            style={{
                              fontSize: '12px',
                              fontWeight: 700,
                              color: 'var(--text-main)',
                              background: 'rgba(56,189,248,0.12)',
                              padding: '3px 9px',
                              borderRadius: '999px',
                              border: '1px solid rgba(56,189,248,0.3)',
                            }}
                          >
                            {weeklyHours}h / week
                          </span>
                        </div>
                      </div>

                      {/* 7-Day Visual Week Grid */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(7, 1fr)',
                          gap: '6px',
                          background: 'rgba(255,255,255,0.4)',
                          padding: '10px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid rgba(13,148,136,0.1)',
                        }}
                      >
                        {DAY_NAMES.map((name, i) => {
                          const hrs = dayMap[i] !== undefined ? dayMap[i] : 0;
                          const isWorking = hrs > 0;
                          return (
                            <div
                              key={i}
                              style={{
                                textAlign: 'center',
                                padding: '6px 2px',
                                borderRadius: '6px',
                                background: isWorking ? 'rgba(13,148,136,0.12)' : 'rgba(0,0,0,0.03)',
                                border: isWorking ? '1px solid rgba(13,148,136,0.25)' : '1px solid rgba(0,0,0,0.05)',
                              }}
                              title={`${FULL_DAY_NAMES[i]}: ${isWorking ? `${hrs} working hours` : 'Weekend / Off'}`}
                            >
                              <div style={{ fontSize: '10.5px', fontWeight: 700, color: isWorking ? 'var(--primary)' : 'var(--text-subtle)' }}>
                                {name}
                              </div>
                              <div
                                style={{
                                  fontSize: '12px',
                                  fontWeight: 800,
                                  color: isWorking ? 'var(--text-main)' : 'var(--text-subtle)',
                                  marginTop: '2px',
                                }}
                              >
                                {isWorking ? `${hrs}h` : 'OFF'}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Footer Info & Actions */}
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
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          <i className="bi bi-person-check" style={{ marginRight: '5px', color: 'var(--primary)' }} />
                          {p.assignment_count || 0} employee(s) assigned
                        </span>

                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => openEditPatternModal(p)}
                            className="btn-glass"
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            title="Edit schedule"
                          >
                            <i className="bi bi-pencil" style={{ color: 'var(--text-main)' }} />
                          </button>
                          <button
                            onClick={() => handleDeletePattern(p)}
                            className="btn-glass btn-danger-glass"
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            title="Delete pattern"
                          >
                            <i className="bi bi-trash3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Tab Content: Employee Assignments ── */}
      {activeTab === 'assignments' && (
        <GlassCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-main)' }}>Active Working Pattern Assignments</h2>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                Per-individual assignments override organizational defaults. Date ranges are strictly checked to prevent overlaps.
              </p>
            </div>
            <button
              onClick={() => {
                if (patterns.length > 0) {
                  setAssignForm((prev) => ({
                    ...prev,
                    working_pattern_id: patterns[0].working_pattern_id,
                    user_id: users.length > 0 ? users[0].user_id : '',
                  }));
                }
                setAssignModalOpen(true);
              }}
              className="btn-glass btn-primary-glass"
              style={{ fontSize: '13px' }}
            >
              <i className="bi bi-plus-lg" /> Assign Pattern
            </button>
          </div>

          {assignments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-subtle)' }}>
              <i className="bi bi-person-workspace" style={{ fontSize: '32px', display: 'block', marginBottom: '10px' }} />
              All employees are currently following the default organization weekend (Sat & Sun).
            </div>
          ) : (
            <div className="table-responsive">
              <table className="glass-table" style={{ width: '100%', fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Pattern Name</th>
                    <th>Code</th>
                    <th>Effective From</th>
                    <th>Effective To</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => {
                    const today = new Date().toISOString().slice(0, 10);
                    const isUpcoming = a.effective_from > today;
                    const isEnded = a.effective_to && a.effective_to < today;
                    const isActive = !isUpcoming && !isEnded;

                    return (
                      <tr key={a.assignment_id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                background: 'rgba(13,148,136,0.15)',
                                color: 'var(--primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '11px',
                              }}
                            >
                              {a.full_name?.charAt(0) || 'U'}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{a.full_name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>{a.employee_code} · {a.email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontWeight: 600 }}>{a.pattern_name}</td>
                        <td>
                          <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(13,148,136,0.1)', color: 'var(--primary)' }}>
                            {a.pattern_code}
                          </span>
                        </td>
                        <td>{a.effective_from}</td>
                        <td>{a.effective_to || 'Indefinite (Ongoing)'}</td>
                        <td>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '999px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: isActive ? 'rgba(5,150,105,0.15)' : isUpcoming ? 'rgba(56,189,248,0.15)' : 'rgba(0,0,0,0.06)',
                              color: isActive ? '#059669' : isUpcoming ? '#0284c7' : '#6b7280',
                            }}
                          >
                            {isActive ? 'Active' : isUpcoming ? 'Upcoming' : 'Ended'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={() => handleRevokeAssignment(a.assignment_id)}
                            className="btn-glass btn-danger-glass"
                            style={{ padding: '3px 8px', fontSize: '11.5px' }}
                            title="Revoke assignment"
                          >
                            <i className="bi bi-x-circle" style={{ marginRight: '4px' }} />
                            Revoke
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      )}

      {/* ── Modal: Create / Edit Pattern ── */}
      <Modal
        isOpen={patternModalOpen}
        onClose={() => setPatternModalOpen(false)}
        title={editingPatternId ? 'Edit Working Pattern' : 'Create Working Pattern'}
        maxWidth="640px"
      >
        <form onSubmit={handleSavePattern} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Preset Buttons */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              Quick Schedule Presets
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {PRESETS.map((pr, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(pr)}
                  className="btn-glass"
                  style={{ fontSize: '11.5px', padding: '4px 9px' }}
                >
                  {pr.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                Pattern Code *
              </label>
              <input
                type="text"
                className="input-glass"
                required
                disabled={!!editingPatternId}
                placeholder="e.g. SHIFT_A"
                value={patternForm.pattern_code}
                onChange={(e) => setPatternForm({ ...patternForm, pattern_code: e.target.value.toUpperCase() })}
                style={{ width: '100%', textTransform: 'uppercase' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                Pattern Name *
              </label>
              <input
                type="text"
                className="input-glass"
                required
                placeholder="e.g. Middle East Sunday-Thursday Shift"
                value={patternForm.pattern_name}
                onChange={(e) => setPatternForm({ ...patternForm, pattern_name: e.target.value })}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Daily Schedule Configuration */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                Weekly Daily Working Hours
              </label>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>
                Total: {patternForm.days.reduce((s, d) => s + parseFloat(d.working_hours || 0), 0)} hrs/week
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '8px' }}>
              {patternForm.days.map((d, index) => {
                const isWorking = parseFloat(d.working_hours) > 0;
                return (
                  <div
                    key={d.day_of_week}
                    style={{
                      background: isWorking ? 'rgba(13,148,136,0.09)' : 'rgba(0,0,0,0.03)',
                      border: isWorking ? '1px solid rgba(13,148,136,0.25)' : '1px solid rgba(0,0,0,0.08)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '8px 6px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 700, color: isWorking ? 'var(--primary)' : 'var(--text-subtle)' }}>
                      {DAY_NAMES[d.day_of_week]}
                    </div>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="24"
                      className="input-glass"
                      style={{
                        width: '100%',
                        textAlign: 'center',
                        padding: '4px 2px',
                        fontSize: '12px',
                        fontWeight: 700,
                        marginTop: '6px',
                      }}
                      value={d.working_hours}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        const newDays = [...patternForm.days];
                        newDays[index] = { ...newDays[index], working_hours: Math.max(0, Math.min(24, val)) };
                        setPatternForm({ ...patternForm, days: newDays });
                      }}
                    />
                    <div style={{ fontSize: '10px', color: 'var(--text-subtle)', marginTop: '4px' }}>
                      {isWorking ? 'Work' : 'Weekend'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button type="button" onClick={() => setPatternModalOpen(false)} className="btn-glass">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-glass btn-primary-glass">
              {submitting ? 'Saving...' : editingPatternId ? 'Update Pattern' : 'Create Pattern'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Assign Pattern to Employee ── */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title="Assign Working Pattern to Employee"
        maxWidth="520px"
      >
        <form onSubmit={handleAssignPattern} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
              Select Employee *
            </label>
            <select
              className="input-glass"
              required
              value={assignForm.user_id}
              onChange={(e) => setAssignForm({ ...assignForm, user_id: e.target.value })}
              style={{ width: '100%' }}
            >
              <option value="">-- Choose Employee --</option>
              {users.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.full_name} ({u.employee_code}) - {u.email}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
              Select Working Pattern *
            </label>
            <select
              className="input-glass"
              required
              value={assignForm.working_pattern_id}
              onChange={(e) => setAssignForm({ ...assignForm, working_pattern_id: e.target.value })}
              style={{ width: '100%' }}
            >
              <option value="">-- Choose Pattern --</option>
              {patterns.map((p) => (
                <option key={p.working_pattern_id} value={p.working_pattern_id}>
                  {p.pattern_name} ({p.pattern_code})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                Effective From *
              </label>
              <input
                type="date"
                className="input-glass"
                required
                value={assignForm.effective_from}
                onChange={(e) => setAssignForm({ ...assignForm, effective_from: e.target.value })}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                Effective To (Optional)
              </label>
              <input
                type="date"
                className="input-glass"
                value={assignForm.effective_to}
                onChange={(e) => setAssignForm({ ...assignForm, effective_to: e.target.value })}
                placeholder="Indefinite"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div
            style={{
              fontSize: '12px',
              padding: '10px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(13,148,136,0.1)',
              border: '1px solid rgba(13,148,136,0.2)',
              color: 'var(--text-muted)',
            }}
          >
            <i className="bi bi-info-circle-fill" style={{ color: 'var(--primary)', marginRight: '6px' }} />
            Per FRD BR-06, an employee may have exactly one active working pattern on any given date. If an overlapping assignment exists, submission will be rejected.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button type="button" onClick={() => setAssignModalOpen(false)} className="btn-glass">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-glass btn-primary-glass">
              {submitting ? 'Assigning...' : 'Confirm Assignment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: CSV Import ── */}
      <Modal
        isOpen={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        title="Import Working Patterns from CSV"
        maxWidth="600px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
            Upload a CSV file containing working patterns and their daily working hours (Sun-Sat).
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
              placeholder="pattern_code,pattern_name,sun,mon,tue,wed,thu,fri,sat&#10;NIGHT_SH,Night Shift (Mon-Fri),0,8,8,8,8,8,0"
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
