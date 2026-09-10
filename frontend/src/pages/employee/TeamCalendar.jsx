import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { GlassCard } from '../../components/common/GlassCard';

export const TeamCalendar = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api('/leave/peer-calendar').catch(() => ({ events: [] })),
      api('/holidays').catch(() => ({ holidays: [] })),
    ])
      .then(([calendarRes, holidayRes]) => {
        setEvents(calendarRes.events || []);
        setHolidays(holidayRes.holidays || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const calendarDays = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayHolidays = holidays.filter((h) => h.holiday_date === dateStr);
    const dayLeaves = events.filter((e) => e.start <= dateStr && e.end >= dateStr);
    calendarDays.push({ day, dateStr, holidays: dayHolidays, leaves: dayLeaves });
  }

  return (
    <div className="container-fluid" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Team Coverage Calendar</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            {user.isManager
              ? 'View leave coverage for all team members in your reporting line.'
              : 'Privacy-safe peer calendar (name, dates, and status only per BR-41).'}
          </p>
        </div>

        {/* Month Navigation */}
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '6px 14px' }}>
          <button onClick={prevMonth} className="btn-glass" style={{ padding: '6px 10px' }} aria-label="Previous Month">
            <i className="bi bi-chevron-left" />
          </button>
          <strong style={{ fontSize: '16px', minWidth: '150px', textAlign: 'center' }}>
            {monthNames[month]} {year}
          </strong>
          <button onClick={nextMonth} className="btn-glass" style={{ padding: '6px 10px' }} aria-label="Next Month">
            <i className="bi bi-chevron-right" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <GlassCard style={{ padding: '20px' }}>
        {/* Day of Week Headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', marginBottom: '10px', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)', fontSize: '13px' }}>
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Days Cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
          {calendarDays.map((cell, index) => {
            if (!cell) {
              return (
                <div
                  key={`empty-${index}`}
                  style={{
                    minHeight: '105px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(255, 255, 255, 0.01)',
                  }}
                />
              );
            }

            const dayOfWeek = new Date(year, month, cell.day).getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            return (
              <div
                key={cell.dateStr}
                style={{
                  minHeight: '105px',
                  borderRadius: 'var(--radius-sm)',
                  background: isWeekend ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: isWeekend ? 'var(--text-subtle)' : 'var(--text-main)' }}>
                    {cell.day}
                  </span>
                  {cell.holidays.length > 0 && (
                    <i className="bi bi-star-fill" style={{ fontSize: '11px', color: '#f59e0b' }} title={cell.holidays[0].holiday_name} />
                  )}
                </div>

                {/* Holiday Pills */}
                {cell.holidays.map((h) => (
                  <div
                    key={h.holiday_id}
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(245, 158, 11, 0.2)',
                      color: '#fbbf24',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={h.holiday_name}
                  >
                    🎉 {h.holiday_name}
                  </div>
                ))}

                {/* Leaves Pills */}
                {cell.leaves.map((l) => (
                  <div
                    key={l.id}
                    style={{
                      fontSize: '11px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: l.status === 'APPROVED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                      color: l.status === 'APPROVED' ? '#6ee7b7' : '#93c5fd',
                      border: `1px solid ${l.status === 'APPROVED' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={`${l.employeeName} (${l.status})`}
                  >
                    👤 {l.employeeName}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
};
