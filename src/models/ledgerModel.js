const db = require('../../database/db');

const Ledger = {
  // BR-07: balance is never stored/mutated — it's the sum of the append-only ledger.
  currentBalance(userId, leaveTypeId, leaveYear) {
    const row = db.prepare(`
      SELECT COALESCE(SUM(quantity), 0) AS bal FROM leave_ledger_entries
      WHERE user_id = ? AND leave_type_id = ? AND leave_year = ?
    `).get(userId, leaveTypeId, leaveYear);
    return row.bal;
  },

  // BR-10: effective balance = ledger balance minus days committed to open requests.
  committedDays(userId, leaveTypeId) {
    const row = db.prepare(`
      SELECT COALESCE(SUM(deducted_days), 0) AS d FROM leave_requests
      WHERE employee_id = ? AND leave_type_id = ?
      AND status IN ('PENDING_MANAGER','PENDING_HR','CANCELLATION_REQUESTED')
    `).get(userId, leaveTypeId);
    return row.d;
  },

  effectiveBalance(userId, leaveTypeId, leaveYear) {
    const bal = this.currentBalance(userId, leaveTypeId, leaveYear);
    const committed = this.committedDays(userId, leaveTypeId);
    return { balance: bal, committed, effective: bal - committed };
  },

  entriesFor(userId, leaveTypeId = null) {
    if (leaveTypeId) {
      return db.prepare(`
        SELECT le.*, lt.leave_name FROM leave_ledger_entries le
        JOIN leave_types lt ON lt.leave_type_id = le.leave_type_id
        WHERE le.user_id = ? AND le.leave_type_id = ? ORDER BY le.created_at DESC
      `).all(userId, leaveTypeId);
    }
    return db.prepare(`
      SELECT le.*, lt.leave_name FROM leave_ledger_entries le
      JOIN leave_types lt ON lt.leave_type_id = le.leave_type_id
      WHERE le.user_id = ? ORDER BY le.created_at DESC
    `).all(userId);
  },

  // A correction is a new compensating entry — never UPDATE/DELETE (BR-07, LMS-059).
  post(userId, leaveTypeId, leaveYear, transactionType, quantity, sourceReference) {
    return db.prepare(`
      INSERT INTO leave_ledger_entries (user_id, leave_type_id, leave_year, transaction_type, quantity, source_reference)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, leaveTypeId, leaveYear, transactionType, quantity, sourceReference || null).lastInsertRowid;
  },
};

module.exports = Ledger;
