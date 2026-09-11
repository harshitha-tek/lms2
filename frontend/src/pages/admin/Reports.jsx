import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { GlassCard } from '../../components/common/GlassCard';

export const Reports = () => {
  const [data, setData] = useState({ lopReport: [], summary: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api('/admin/reports')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container-fluid" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Reports & Analytics</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          Leave utilization statistics and a dedicated downstream Loss of Pay (LOP) payroll integration report.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid-cols-4">
        {data.summary.map((s, idx) => (
          <div key={idx} className="glass-panel glass-card">
            <span style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontWeight: 600 }}>{s.leave_name}</span>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#60a5fa', margin: '8px 0 4px' }}>
              {Number(s.total_days || 0).toFixed(1)} <small style={{ fontSize: '13px', color: 'var(--text-muted)' }}>days</small>
            </div>
            <small style={{ color: 'var(--text-subtle)' }}>{s.request_count} approved request(s)</small>
          </div>
        ))}
      </div>

      {/* Loss of Pay (LOP) Downstream Payroll Report */}
      <GlassCard title="Loss of Pay (LOP) Payroll Report" icon="receipt-cutoff">
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '16px' }}>
          Listing of all unapproved advance absences converted to Loss of Pay for salary computation and payroll deductions.
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            <i className="bi bi-arrow-repeat spin" style={{ fontSize: '24px' }} />
            <p style={{ marginTop: '8px' }}>Loading report...</p>
          </div>
        ) : data.lopReport.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            <i className="bi bi-check-circle" style={{ fontSize: '32px', color: '#10b981', display: 'block', marginBottom: '8px' }} />
            No Loss of Pay (LOP) entries recorded.
          </div>
        ) : (
          <table className="glass-table">
            <thead>
              <tr>
                <th>Request #</th>
                <th>Employee Name</th>
                <th>Absence Start Date</th>
                <th>Absence End Date</th>
                <th>LOP Days Deducted</th>
              </tr>
            </thead>
            <tbody>
              {data.lopReport.map((r, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 600, color: '#f87171' }}>{r.request_number}</td>
                  <td style={{ fontWeight: 600 }}>{r.full_name}</td>
                  <td>{r.start_date}</td>
                  <td>{r.end_date}</td>
                  <td style={{ fontWeight: 700, color: '#ef4444' }}>{r.deducted_days} day(s)</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </GlassCard>
    </div>
  );
};
