// Subsystem 10 (Notifications & Scheduler)
const db = require('../database/db');

const Notification = {
  create(recipientUserId, templateType, subject, body, leaveRequestId = null) {
    const tpl = db.prepare(`SELECT notification_template_id FROM notification_templates WHERE notification_type = ?`).get(templateType);
    db.prepare(`
      INSERT INTO notifications (recipient_user_id, leave_request_id, template_id, subject, body, delivery_status)
      VALUES (?, ?, ?, ?, ?, 'SENT')
    `).run(recipientUserId, leaveRequestId, tpl ? tpl.notification_template_id : null, subject, body);
    // Exchange Online SMTP is not wired in this reference build (LMS-066) —
    // failure here must never block the business transaction (LMS-070), so
    // this is a plain log line, not a thrown error.
    console.log(`[notify] -> user #${recipientUserId}: ${subject}`);
  },
  forUser(userId) {
    return db.prepare(`SELECT * FROM notifications WHERE recipient_user_id = ? ORDER BY created_at DESC`).all(userId);
  },
  unreadCount(userId) {
    return db.prepare(`SELECT COUNT(*) AS c FROM notifications WHERE recipient_user_id = ? AND is_read = 0`).get(userId).c;
  },
  markRead(id, userId) {
    db.prepare(`UPDATE notifications SET is_read = 1, read_at = datetime('now') WHERE notification_id = ? AND recipient_user_id = ?`).run(id, userId);
  },
};

module.exports = Notification;
