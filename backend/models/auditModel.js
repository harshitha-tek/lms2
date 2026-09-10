// Subsystem 11 (Reporting, Calendars & Audit) — audit_logs is append-only.
const db = require('../database/db');

const Audit = {
  log(actorUserId, entityType, entityId, action, priorValue = null, newValue = null, isSystemActor = false) {
    db.prepare(`
      INSERT INTO audit_logs (actor_user_id, entity_type, entity_id, action, prior_value, new_value, is_system_actor)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(actorUserId, entityType, entityId, action,
      priorValue !== null ? JSON.stringify(priorValue) : null,
      newValue !== null ? JSON.stringify(newValue) : null,
      isSystemActor ? 1 : 0);
  },
  recent(limit = 200) {
    return db.prepare(`
      SELECT al.*, u.full_name AS actor_name FROM audit_logs al
      LEFT JOIN users u ON u.user_id = al.actor_user_id
      ORDER BY al.occurred_at DESC LIMIT ?
    `).all(limit);
  },
};

module.exports = Audit;
