import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { GlassCard } from '../../components/common/GlassCard';

export const HolidayCalendar = () => {
  const [data, setData] = useState({ holidays: [], years: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedType, setSelectedType] = useState('all');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (selectedYear !== 'all') params.set('year', selectedYear);
    if (selectedType !== 'all') params.set('type', selectedType);

    api(`/holidays?${params.toString()}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, selectedYear, selectedType]);

  return (
    <div className="container-fluid" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Public Holidays</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          Official organisational holidays for the current and next leave year.
        </p>
      </div>

      {/* Filter bar */}
      <div
        className="glass-panel"
        style={{
          padding: '16px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'center',
        }}
      >
        <div style={{ flex: '1 1 250px' }}>
          <input
            type="text"
            className="glass-input"
            placeholder="Search holiday name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="glass-select"
          style={{ width: 'auto', minWidth: '150px' }}
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
        >
          <option value="all">All Years</option>
          {data.years?.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <select
          className="glass-select"
          style={{ width: 'auto', minWidth: '160px' }}
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
        >
          <option value="all">All Types</option>
          <option value="NATIONAL">National</option>
          <option value="FESTIVAL">Festival</option>
          <option value="OPTIONAL">Optional</option>
        </select>
      </div>

      {/* Holidays List */}
      <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <i className="bi bi-arrow-repeat spin" style={{ fontSize: '28px', color: 'var(--primary)' }} />
            <p style={{ marginTop: '10px' }}>Loading holidays...</p>
          </div>
        ) : data.holidays.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <p>No holidays found matching your criteria.</p>
          </div>
        ) : (
          <table className="glass-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Holiday Name</th>
                <th>Category</th>
                <th>Day</th>
              </tr>
            </thead>
            <tbody>
              {data.holidays.map((h) => {
                const dateObj = new Date(h.holiday_date);
                const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                return (
                  <tr key={h.holiday_id}>
                    <td style={{ fontWeight: 600, color: '#93c5fd' }}>{h.holiday_date}</td>
                    <td style={{ fontWeight: 600 }}>{h.holiday_name}</td>
                    <td>
                      <span
                        style={{
                          fontSize: '11.5px',
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
                    <td style={{ color: 'var(--text-muted)' }}>{dayName}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </GlassCard>
    </div>
  );
};
