// Subsystem 9 (Watchers & Privacy) — LMS-060 to LMS-065, BR-42.
//
// Two types of Watcher exist per the FRD glossary:
//   REQUEST  — an ad-hoc watcher added to one specific leave request (LMS-060).
//   STANDING — a subscription on an employee for a date range; it applies
//              automatically to every request that employee raises during
//              the window (LMS-061/062).
// A third stored watcher_type, PROJECT_LEAD, is not a distinct type from the
// FRD's point of view — it is the automatic trigger in LMS-014 that produces
// an ordinary request-scoped watcher row, tagged separately only so the UI
// can show provenance.
//
// A STANDING row is a template: watched_employee_id is set, leave_request_id
// is NULL. When an employee submits a request, any currently-active STANDING
// subscription (and any active project lead) is materialized into its own
// permanent REQUEST-scoped row (leave_request_id set, watched_employee_id
// NULL). Materializing at submission time — rather than resolving standing
// watchers live on every read — is what makes the watcher list on a given
// request an immutable historical record (LMS-065: "no hidden watchers"):
// a later revocation of the standing subscription does not retroactively
// remove access to requests already watched.
const db = require('../database/db');

const Watcher = {
  // Adds (or no-ops if already present) a watcher on one specific request.
  // type is 'REQUEST' for an ad-hoc add, or 'PROJECT_LEAD' / 'STANDING' when
  // materialized automatically at submission time.
  addRequestWatcher(watcherUserId, leaveRequestId, type = 'REQUEST') {
    const existing = db.prepare(`
      SELECT watcher_id FROM watchers WHERE watcher_user_id = ? AND leave_request_id = ?
    `).get(watcherUserId, leaveRequestId);
    if (existing) return existing.watcher_id;
    return db.prepare(`
      INSERT INTO watchers (watcher_user_id, leave_request_id, watcher_type)
      VALUES (?, ?, ?)
    `).run(watcherUserId, leaveRequestId, type).lastInsertRowid;
  },

  forRequest(leaveRequestId) {
    return db.prepare(`
      SELECT w.*, u.full_name FROM watchers w JOIN users u ON u.user_id = w.watcher_user_id
      WHERE w.leave_request_id = ?
      ORDER BY w.watcher_id
    `).all(leaveRequestId);
  },

  isWatcher(userId, leaveRequestId) {
    return !!db.prepare(`
      SELECT 1 FROM watchers WHERE watcher_user_id = ? AND leave_request_id = ?
    `).get(userId, leaveRequestId);
  },

  // Project leads assigned to the employee become auto-watchers on every request they raise (LMS-014).
  projectLeadsFor(employeeId) {
    return db.prepare(`
      SELECT DISTINCT p.project_lead_id FROM project_assignments pa
      JOIN projects p ON p.project_id = pa.project_id
      WHERE pa.user_id = ? AND p.project_lead_id IS NOT NULL
      AND pa.assigned_from <= date('now') AND (pa.assigned_to IS NULL OR pa.assigned_to >= date('now'))
    `).all(employeeId).map(r => r.project_lead_id);
  },

  // Active STANDING subscription templates targeting this employee right now (LMS-061).
  standingWatchersFor(employeeId) {
    return db.prepare(`
      SELECT watcher_user_id FROM watchers
      WHERE watched_employee_id = ? AND watcher_type = 'STANDING'
      AND effective_from <= date('now') AND (effective_to IS NULL OR effective_to >= date('now'))
    `).all(employeeId).map(r => r.watcher_user_id);
  },

  // Called once, at submission time: materializes every currently-active
  // project-lead and standing-watcher subscription onto the new request.
  attachAutoWatchers(employeeId, leaveRequestId) {
    for (const watcherId of Watcher.projectLeadsFor(employeeId)) {
      if (watcherId !== employeeId) Watcher.addRequestWatcher(watcherId, leaveRequestId, 'PROJECT_LEAD');
    }
    for (const watcherId of Watcher.standingWatchersFor(employeeId)) {
      if (watcherId !== employeeId) Watcher.addRequestWatcher(watcherId, leaveRequestId, 'STANDING');
    }
  },

  // Creates a STANDING subscription template (LMS-061).
  createStandingWatcher(watcherUserId, watchedEmployeeId, effectiveFrom, effectiveTo) {
    return db.prepare(`
      INSERT INTO watchers (watcher_user_id, watched_employee_id, watcher_type, effective_from, effective_to)
      VALUES (?, ?, 'STANDING', ?, ?)
    `).run(watcherUserId, watchedEmployeeId, effectiveFrom, effectiveTo || null).lastInsertRowid;
  },

  // STANDING subscription templates targeting any of the given employees.
  standingWatchersOn(employeeIds) {
    if (!employeeIds.length) return [];
    const placeholders = employeeIds.map(() => '?').join(',');
    return db.prepare(`
      SELECT w.*, watcher.full_name AS watcher_name, emp.full_name AS employee_name
      FROM watchers w
      JOIN users watcher ON watcher.user_id = w.watcher_user_id
      JOIN users emp ON emp.user_id = w.watched_employee_id
      WHERE w.watcher_type = 'STANDING' AND w.watched_employee_id IN (${placeholders})
      ORDER BY w.effective_from DESC
    `).all(...employeeIds);
  },

  allStandingWatchers() {
    return db.prepare(`
      SELECT w.*, watcher.full_name AS watcher_name, emp.full_name AS employee_name
      FROM watchers w
      JOIN users watcher ON watcher.user_id = w.watcher_user_id
      JOIN users emp ON emp.user_id = w.watched_employee_id
      WHERE w.watcher_type = 'STANDING'
      ORDER BY w.effective_from DESC
    `).all();
  },

  findStandingWatcher(watcherId) {
    return db.prepare(`SELECT * FROM watchers WHERE watcher_id = ? AND watcher_type = 'STANDING'`).get(watcherId);
  },

  revokeStandingWatcher(watcherId) {
    db.prepare(`DELETE FROM watchers WHERE watcher_id = ? AND watcher_type = 'STANDING'`).run(watcherId);
  },
};

module.exports = Watcher;
