import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { GlassCard } from '../../components/common/GlassCard';

export const ApplyLeave = () => {
  const navigate = useNavigate();
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [balances, setBalances] = useState([]);
  const [minimumLeaveDate, setMinimumLeaveDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedType, setSelectedType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayPart, setHalfDayPart] = useState('FIRST_HALF');
  const [reason, setReason] = useState('');
  const [attachment, setAttachment] = useState(null);

  // Live calculation & advisory state
  const [calculation, setCalculation] = useState(null);
  const [peerConflicts, setPeerConflicts] = useState([]);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api('/dashboard')
      .then((data) => {
        setLeaveTypes(data.leaveTypes || []);
        setBalances(data.balances || []);
        if (data.minimumLeaveDate) setMinimumLeaveDate(data.minimumLeaveDate);
        if (data.leaveTypes && data.leaveTypes.length > 0) {
          setSelectedType(data.leaveTypes[0].leave_type_id);
        }
      })
      .catch((err) => setError(err.message));
  }, []);

  // Live Calculation when dates or half-day toggle change
  useEffect(() => {
    if (!startDate || !endDate || !selectedType) {
      setCalculation(null);
      return;
    }

    setCalculating(true);
    setError('');

    const query = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      is_half_day: String(isHalfDay),
      leave_type_id: String(selectedType),
    });

    Promise.all([
      api(`/leave/calculate?${query.toString()}`),
      api('/leave/peer-calendar').catch(() => ({ events: [] })),
    ])
      .then(([calcRes, peerRes]) => {
        setCalculation(calcRes);

        // Filter peer conflicts that overlap with selected range
        const overlapping = (peerRes.events || []).filter((p) => {
          return !(p.end < startDate || p.start > endDate);
        });
        setPeerConflicts(overlapping);
      })
      .catch((err) => {
        setError(err.message);
        setCalculation(null);
      })
      .finally(() => setCalculating(false));
  }, [startDate, endDate, isHalfDay, selectedType]);

  const activeLeaveType = leaveTypes.find((t) => t.leave_type_id === Number(selectedType));
  const activeBalance = balances.find((b) => b.leaveType?.leave_type_id === Number(selectedType));

  const handleSubmit = async (actionType) => {
    setError('');
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('leave_type_id', selectedType);
      formData.append('start_date', startDate);
      formData.append('end_date', endDate);
      formData.append('is_half_day', String(isHalfDay));
      if (isHalfDay) formData.append('half_day_part', halfDayPart);
      formData.append('reason', reason);
      formData.append('action', actionType);
      if (attachment) formData.append('attachment', attachment);

      await api('/leave/requests', {
        method: 'POST',
        body: formData,
      });

      navigate('/my-requests');
    } catch (err) {
      setError(err.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container-fluid">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Apply for Leave</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          Choose your leave type, dates, and preview the exact calculated working days deducted.
        </p>
      </div>

      {error && (
        <div className="glass-panel" style={{ padding: '14px 18px', marginBottom: '20px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5' }}>
          <i className="bi bi-exclamation-octagon" style={{ marginRight: '8px' }} />
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1.4fr) minmax(280px, 1fr)', gap: '28px' }}>
        {/* Main Application Form */}
        <GlassCard title="Leave Details" icon="pencil-square">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Leave Type Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted)' }}>
                Leave Type
              </label>
              <select
                className="glass-select"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
              >
                {leaveTypes.map((t) => {
                  const bal = balances.find((b) => b.leaveType?.leave_type_id === t.leave_type_id);
                  const eff = bal ? Number(bal.effective).toFixed(1) : '0.0';
                  return (
                    <option key={t.leave_type_id} value={t.leave_type_id}>
                      {t.leave_name} ({eff} days available)
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Date Pickers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted)' }}>
                  Start Date
                </label>
                <input
                  type="date"
                  className="glass-input"
                  value={startDate}
                  min={minimumLeaveDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (!endDate || endDate < e.target.value) setEndDate(e.target.value);
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted)' }}>
                  End Date
                </label>
                <input
                  type="date"
                  className="glass-input"
                  value={endDate}
                  min={startDate || minimumLeaveDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Half-day selector (LMS-034) */}
            {activeLeaveType?.allows_half_day === 1 && (
              <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid var(--glass-border)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={isHalfDay}
                    onChange={(e) => setIsHalfDay(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#3b82f6' }}
                  />
                  <span>Apply as Half Day (0.5 deducted days)</span>
                </label>

                {isHalfDay && (
                  <div style={{ display: 'flex', gap: '16px', marginTop: '10px', paddingLeft: '26px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="halfDayPart"
                        value="FIRST_HALF"
                        checked={halfDayPart === 'FIRST_HALF'}
                        onChange={(e) => setHalfDayPart(e.target.value)}
                      />
                      <span>First Half (Morning)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="halfDayPart"
                        value="SECOND_HALF"
                        checked={halfDayPart === 'SECOND_HALF'}
                        onChange={(e) => setHalfDayPart(e.target.value)}
                      />
                      <span>Second Half (Afternoon)</span>
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* Reason Field */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted)' }}>
                Reason for Leave
              </label>
              <textarea
                className="glass-textarea"
                rows={3}
                placeholder="Please state the business reason for this absence..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>

            {/* Attachment Control (LMS-035) */}
            {activeLeaveType?.allows_attachment === 1 && (
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-muted)' }}>
                  Supporting Document {activeLeaveType.is_sick_leave === 1 && <span style={{ color: '#ef4444' }}>* (Required for Sick Leave)</span>}
                </label>
                <small style={{ display: 'block', color: 'var(--text-subtle)', marginBottom: '8px', fontSize: '11.5px' }}>
                  Permitted formats: PDF, PNG, JPG (Max 5MB).
                </small>
                <input
                  type="file"
                  className="glass-input"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => setAttachment(e.target.files[0] || null)}
                />
              </div>
            )}

            {/* Actions: Save as Draft & Submit */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => handleSubmit('draft')}
                disabled={submitting || !startDate || !endDate}
                className="btn-glass"
                style={{ flex: 1 }}
              >
                <i className="bi bi-save" />
                <span>Save as Draft</span>
              </button>
              <button
                type="button"
                onClick={() => handleSubmit('submit')}
                disabled={submitting || !startDate || !endDate || !reason.trim()}
                className="btn-glass btn-primary-glass"
                style={{ flex: 1.5 }}
              >
                {submitting ? (
                  <span><i className="bi bi-arrow-repeat spin" /> Submitting...</span>
                ) : (
                  <span><i className="bi bi-send-check" /> Submit Request</span>
                )}
              </button>
            </div>
          </div>
        </GlassCard>

        {/* Live Calculation Panel & Conflict Advisory (LMS-036) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <GlassCard title="Live Cost Calculation" icon="calculator">
            {calculating ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                <i className="bi bi-arrow-repeat spin" style={{ fontSize: '20px' }} />
                <p style={{ marginTop: '8px', fontSize: '13px' }}>Calculating working days...</p>
              </div>
            ) : calculation ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="breakdown-card">
                  <div className="breakdown-row">
                    <span>Calendar Days Selected:</span>
                    <strong>{calculation.calendarDays} day(s)</strong>
                  </div>
                  <div className="breakdown-row">
                    <span>Weekends Excluded:</span>
                    <strong style={{ color: '#94a3b8' }}>-{calculation.weekendDays}</strong>
                  </div>
                  <div className="breakdown-row">
                    <span>Public Holidays Excluded:</span>
                    <strong style={{ color: '#94a3b8' }}>-{calculation.holidayDays}</strong>
                  </div>
                  <div className="breakdown-row highlight">
                    <span>Net Deducted Days:</span>
                    <span>{calculation.deductedDays} day(s)</span>
                  </div>
                </div>

                {/* Balance Impact */}
                <div style={{ padding: '14px', borderRadius: 'var(--radius-sm)', background: 'rgba(255, 255, 255, 0.04)', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Effective Balance:</span>
                    <strong>{Number(calculation.balance?.effective || 0).toFixed(1)} days</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Projected Remaining:</span>
                    <strong style={{ color: calculation.projectedBalance < 0 ? '#ef4444' : '#10b981' }}>
                      {Number(calculation.projectedBalance || 0).toFixed(1)} days
                    </strong>
                  </div>
                </div>

                {/* Advance Leave Warning (LMS-038) */}
                {calculation.isAdvanceLeave && (
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(234, 88, 12, 0.2)',
                      border: '1px solid rgba(234, 88, 12, 0.5)',
                      color: '#fdba74',
                      fontSize: '12.5px',
                    }}
                  >
                    <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <i className="bi bi-exclamation-triangle" />
                      <span>Advance Leave Warning</span>
                    </div>
                    <span>
                      Requested days exceed your effective balance. If approved, your balance will go negative. If rejected, you will have 7 days to withdraw before it converts to <strong>Loss of Pay (LOP)</strong>.
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)', fontSize: '13.5px' }}>
                <i className="bi bi-calendar-range" style={{ fontSize: '28px', color: 'var(--text-subtle)', display: 'block', marginBottom: '8px' }} />
                Select a start and end date to preview the exact breakdown of deducted working days.
              </div>
            )}
          </GlassCard>

          {/* Conflict Advisory (LMS-036) */}
          <GlassCard title="Team Conflict Advisory" icon="people">
            {peerConflicts.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                <i className="bi bi-check2-circle" style={{ color: '#10b981', marginRight: '6px' }} />
                No team members are currently on leave during this date span.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '12px', color: '#f59e0b', marginBottom: '4px' }}>
                  <i className="bi bi-info-circle" style={{ marginRight: '6px' }} />
                  {peerConflicts.length} peer(s) already scheduled off during this window:
                </div>
                {peerConflicts.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(255, 255, 255, 0.04)',
                      fontSize: '12.5px',
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{c.employeeName}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{c.start} → {c.end}</span>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
};
