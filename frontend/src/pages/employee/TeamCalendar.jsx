import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { GlassCard } from '../../components/common/GlassCard';

const todayStr = () => new Date().toISOString().slice(0, 10);

export const TeamCalendar = () => {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [events, setEvents] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(todayStr());

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api('/leave/team-calendar').catch(() => ({ events: [], members: [] })),
      api('/holidays').catch(() => ({ holidays: [] })),
    ])
      .then(([calendarRes, holidayRes]) => {
        setEvents(calendarRes.events || []);
        setMembers(calendarRes.members || []);
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

  const onLeaveForSelected = events.filter((e) => e.start <= selectedDate && e.end >= selectedDate);
  const onLeaveIds = new Set(onLeaveForSelected.map((e) => e.employeeId ?? e.employeeName));
  const availableForSelected = members.filter((m) => !onLeaveIds.has(m.user_id));
  const selectedDateObj = selectedDate ? new Date(`${selectedDate}T00:00:00`) : null;

  return (
    <div className="container-fluid" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Team Coverage Calendar</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            {user.isManager || user.isHrAdmin
              ? 'View approved leave coverage for everyone in your reporting line.'
              : 'Privacy-safe peer calendar — name, dates, and status only (BR-41).'}
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', alignItems: 'start' }}>
        {/* Calendar Grid */}
        <GlassCard style={{ padding: '20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
              <i className="bi bi-arrow-repeat spin" style={{ fontSize: '28px', color: 'var(--primary)' }} />
              <p style={{ marginTop: '10px' }}>Loading calendar...</p>
            </div>
          ) : (
            <>
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
                        style={{ minHeight: '84px', borderRadius: 'var(--radius-sm)', background: 'rgba(255, 255, 255, 0.01)' }}
                      />
                    );
                  }

                  const dayOfWeek = new Date(year, month, cell.day).getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                  const isSelected = cell.dateStr === selectedDate;
                  const isToday = cell.dateStr === todayStr();
                  const maxDots = 8;
                  const visibleLeaves = cell.leaves.slice(0, maxDots);
                  const overflowCount = cell.leaves.length - visibleLeaves.length;

                  return (
                    <button
                      key={cell.dateStr}
                      onClick={() => setSelectedDate(cell.dateStr)}
                      style={{
                        minHeight: '84px',
                        borderRadius: 'var(--radius-sm)',
                        background: isSelected ? 'rgba(59, 130, 246, 0.18)' : isWeekend ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.04)',
                        border: isSelected ? '1px solid #3b82f6' : isToday ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid rgba(255, 255, 255, 0.07)',
                        padding: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        font: 'inherit',
                        color: 'inherit',
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

                      {/* Leave dots — approved only, name on hover, no reason/type ever shown */}
                      {cell.leaves.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                          {visibleLeaves.map((l) => (
                            <span
                              key={l.id}
                              title={l.employeeName}
                              style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: '#10b981',
                                display: 'inline-block',
                                boxShadow: '0 0 0 1px rgba(16, 185, 129, 0.4)',
                              }}
                            />
                          ))}
                          {overflowCount > 0 && (
                            <span style={{ fontSize: '10px', color: 'var(--text-subtle)', fontWeight: 600 }}>+{overflowCount}</span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                <span>On approved leave — hover a dot for the name</span>
              </div>
            </>
          )}
        </GlassCard>

        {/* Availability Side Panel */}
        <GlassCard style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
              {selectedDateObj
                ? selectedDateObj.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })
                : 'Select a day'}
            </h3>
            <small style={{ color: 'var(--text-subtle)' }}>
              {members.length} {user.isManager || user.isHrAdmin ? 'team member(s)' : 'peer(s)'} total
            </small>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 700, color: '#34d399', marginBottom: '8px' }}>
              <i className="bi bi-check-circle-fill" />
              <span>Available ({availableForSelected.length})</span>
            </div>
            {availableForSelected.length === 0 ? (
              <small style={{ color: 'var(--text-subtle)' }}>No one available this day.</small>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {availableForSelected.map((m) => (
                  <div key={m.user_id} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399', flexShrink: 0 }} />
                    {m.full_name}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 700, color: '#fbbf24', marginBottom: '8px' }}>
              <i className="bi bi-airplane-fill" />
              <span>On Leave ({onLeaveForSelected.length})</span>
            </div>
            {onLeaveForSelected.length === 0 ? (
              <small style={{ color: 'var(--text-subtle)' }}>No one on leave this day.</small>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {onLeaveForSelected.map((e) => (
                  <div key={e.id} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
                    {e.employeeName}
                  </div>
                ))}
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
};
