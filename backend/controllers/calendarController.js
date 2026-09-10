// Subsystems 9 & 11 — Team/Peer calendar and Holiday calendar (BR-41, BR-42)
const dayjs = require('dayjs');
const User = require('../models/userModel');
const LeaveRequest = require('../models/leaveRequestModel');
const { Holiday } = require('../models/configModel');
const db = require('../database/db');

function holidayCalendar(req, res) {
  const filters = {
    query: typeof req.query.q === 'string' ? req.query.q : '',
    year: typeof req.query.year === 'string' ? req.query.year : 'all',
    type: typeof req.query.type === 'string' ? req.query.type : 'all',
  };
  res.render('employee/holidays', { holidays: Holiday.filter(filters), filters, holidayYears: Holiday.years() });
}

// Manager: full hierarchy with leave type visible. Employee: peers only,
// leave type withheld entirely at the query layer (BR-41 / LMS-064 note).
function teamCalendar(req, res) {
  const isManagerView = req.currentUser.isManager;
  let people, events;

  if (isManagerView) {
    people = User.allReportsRecursive(req.currentUser.user_id);
    const ids = people.map(p => p.user_id);
    events = ids.length ? db.prepare(`
      SELECT lr.leave_request_id, lr.employee_id, lr.start_date, lr.end_date, lr.status, lt.leave_name, u.full_name,
             CASE WHEN lt.is_sick_leave = 1 THEN 'Unavailable' ELSE lt.leave_name END AS display_type
      FROM leave_requests lr
      JOIN leave_types lt ON lt.leave_type_id = lr.leave_type_id
      JOIN users u ON u.user_id = lr.employee_id
      WHERE lr.employee_id IN (${ids.map(() => '?').join(',')}) AND lr.status = 'APPROVED'
      ORDER BY lr.start_date
    `).all(...ids) : [];
  } else {
    people = User.peers(req.currentUser.user_id);
    const ids = people.map(p => p.user_id);
    // Peer calendar: dates + status ONLY. leave type is never selected/sent (BR-41).
    events = ids.length ? db.prepare(`
      SELECT lr.leave_request_id, lr.employee_id, lr.start_date, lr.end_date, lr.status, u.full_name
      FROM leave_requests lr JOIN users u ON u.user_id = lr.employee_id
      WHERE lr.employee_id IN (${ids.map(() => '?').join(',')}) AND lr.status = 'APPROVED'
      ORDER BY lr.start_date
    `).all(...ids) : [];
  }

  const requestedMonth = typeof req.query.month === 'string' && /^\d{4}-\d{2}$/.test(req.query.month)
    ? dayjs(`${req.query.month}-01`)
    : dayjs();
  const monthStart = requestedMonth.isValid() ? requestedMonth.startOf('month') : dayjs().startOf('month');
  const monthEnd = monthStart.endOf('month');
  const previousMonth = monthStart.subtract(1, 'month').format('YYYY-MM');
  const nextMonth = monthStart.add(1, 'month').format('YYYY-MM');
  const monthEvents = events.filter(event => event.start_date <= monthEnd.format('YYYY-MM-DD') && event.end_date >= monthStart.format('YYYY-MM-DD'));
  const membersOnLeave = new Set(monthEvents.map(event => event.employee_id)).size;
  const calendarStart = monthStart.startOf('week');
  const calendarEnd = monthEnd.endOf('week');
  const calendarDays = [];
  let cursor = calendarStart;
  while (cursor.isBefore(calendarEnd) || cursor.isSame(calendarEnd, 'day')) {
    const date = cursor.format('YYYY-MM-DD');
    calendarDays.push({
      date,
      day: cursor.date(),
      inMonth: cursor.month() === monthStart.month(),
      events: monthEvents.filter(event => event.start_date <= date && event.end_date >= date),
    });
    cursor = cursor.add(1, 'day');
  }
  res.render('employee/team-calendar', {
    people, events, isManagerView, holidays: Holiday.all(),
    calendarDays, calendarMonth: monthStart.format('MMMM YYYY'), monthEvents, previousMonth, nextMonth,
    teamOverview: { totalMembers: people.length, membersOnLeave },
  });
}

module.exports = { holidayCalendar, teamCalendar };
