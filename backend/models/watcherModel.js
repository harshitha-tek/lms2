// Subsystem 9 (Watchers & Privacy)
const db = require('../database/db');

const Watcher = {
  addRequestWatcher(watcherUserId, leaveRequestId, type = 'REQUEST') {
    db.prepare(`INSERT INTO watchers (watcher_user_id, leave_request_id, watcher_type) VALUES (?, ?, ?)`)
      .run(watcherUserId, leaveRequestId, type);
  },
  forRequest(leaveRequestId) {
    return db.prepare(`
      SELECT w.*, u.full_name FROM watchers w JOIN users u ON u.user_id = w.watcher_user_id
      WHERE w.leave_request_id = ?
    `).all(leaveRequestId);
  },
  // Project leads assigned to the employee become auto-watchers on every request they raise (LMS-014).
  projectLeadsFor(employeeId) {
    return db.prepare(`
      SELECT DISTINCT p.project_lead_id FROM project_assignments pa
      JOIN projects p ON p.project_id = pa.project_id
      WHERE pa.user_id = ? AND p.project_lead_id IS NOT NULL
      AND (pa.assigned_to IS NULL OR pa.assigned_to >= date('now'))
    `).all(employeeId).map(r => r.project_lead_id);
  },
  standingWatchersFor(employeeId) {
    return db.prepare(`
      SELECT watcher_user_id FROM watchers
      WHERE watched_employee_id = ? AND watcher_type = 'STANDING'
      AND (effective_to IS NULL OR effective_to >= date('now'))
    `).all(employeeId).map(r => r.watcher_user_id);
  },
};

module.exports = Watcher;
