const db = require('../database/db');

const LeaveType = {
  all() {
    return db.prepare(`SELECT * FROM leave_types ORDER BY leave_type_id`).all();
  },
  selectable() {
    return db.prepare(`SELECT * FROM leave_types WHERE is_employee_selectable = 1 ORDER BY leave_type_id`).all();
  },
  findById(id) {
    return db.prepare(`SELECT * FROM leave_types WHERE leave_type_id = ?`).get(id);
  },
  create({ leave_code, leave_name, is_sick_leave, allows_attachment, allows_half_day, carry_forward_allowed, carry_forward_cap }) {
    return db.prepare(`
      INSERT INTO leave_types (leave_code, leave_name, is_sick_leave, allows_attachment, allows_half_day, is_balance_affecting, is_employee_selectable, is_system_managed, carry_forward_allowed, carry_forward_cap)
      VALUES (?, ?, ?, ?, ?, 1, 1, 0, ?, ?)
    `).run(leave_code, leave_name, is_sick_leave ? 1 : 0, allows_attachment ? 1 : 0, allows_half_day ? 1 : 0, carry_forward_allowed ? 1 : 0, carry_forward_cap || null).lastInsertRowid;
  },
  policyFor(leaveTypeId, gradeId) {
    return db.prepare(`
      SELECT * FROM leave_policies WHERE leave_type_id = ? AND grade_id = ?
      AND (effective_to IS NULL OR effective_to >= date('now'))
      ORDER BY effective_from DESC LIMIT 1
    `).get(leaveTypeId, gradeId);
  },
  allPolicies() {
    return db.prepare(`
      SELECT lp.*, lt.leave_name, g.grade_name FROM leave_policies lp
      JOIN leave_types lt ON lt.leave_type_id = lp.leave_type_id
      JOIN grades g ON g.grade_id = lp.grade_id
      ORDER BY lt.leave_name, g.grade_name
    `).all();
  },
};

module.exports = LeaveType;
