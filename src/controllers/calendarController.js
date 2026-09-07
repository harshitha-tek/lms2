// Subsystems 9 & 11 — Team/Peer calendar and Holiday calendar (BR-41, BR-42)
const User = require('../models/userModel');
const LeaveRequest = require('../models/leaveRequestModel');
const { Holiday } = require('../models/configModel');
const db = require('../../database/db');

function holidayCalendar(req, res) {
  res.render('employee/holidays', { holidays: Holiday.all() });
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
      WHERE lr.employee_id IN (${ids.map(() => '?').join(',')}) AND lr.status IN ('APPROVED','CANCELLATION_REQUESTED')
      ORDER BY lr.start_date
    `).all(...ids) : [];
  } else {
    people = User.peers(req.currentUser.user_id);
    const ids = people.map(p => p.user_id);
    // Peer calendar: dates + status ONLY. leave type is never selected/sent (BR-41).
    events = ids.length ? db.prepare(`
      SELECT lr.leave_request_id, lr.employee_id, lr.start_date, lr.end_date, lr.status, u.full_name
      FROM leave_requests lr JOIN users u ON u.user_id = lr.employee_id
      WHERE lr.employee_id IN (${ids.map(() => '?').join(',')}) AND lr.status IN ('APPROVED','CANCELLATION_REQUESTED')
      ORDER BY lr.start_date
    `).all(...ids) : [];
  }

  res.render('employee/team-calendar', { people, events, isManagerView, holidays: Holiday.all() });
}

module.exports = { holidayCalendar, teamCalendar };
