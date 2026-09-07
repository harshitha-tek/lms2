// Subsystem 3 (Configuration) + holiday calendar
const db = require('../../database/db');

const Config = {
  get(key, fallback = null) {
    const row = db.prepare(`SELECT configuration_value FROM configurations WHERE configuration_key = ?`).get(key);
    return row ? row.configuration_value : fallback;
  },
  all() {
    return db.prepare(`SELECT * FROM configurations ORDER BY configuration_key`).all();
  },
  set(key, value, updatedBy) {
    db.prepare(`
      UPDATE configurations SET configuration_value = ?, updated_by = ?, updated_at = datetime('now')
      WHERE configuration_key = ?
    `).run(value, updatedBy, key);
  },
  weekendDays() {
    return (this.get('weekend_days', '6,0')).split(',').map(Number);
  },
  countWeekends() { return this.get('count_weekends_within_leave', 'false') === 'true'; },
  countHolidays() { return this.get('count_holidays_within_leave', 'false') === 'true'; },
  backdatingWindowDays() { return parseInt(this.get('backdating_window_days', '30'), 10); },
  longLeaveThreshold() { return parseInt(this.get('long_leave_threshold_days', '10'), 10); },
  slaPeriodDays() { return parseInt(this.get('sla_period_days', '3'), 10); },
  advanceWithdrawalWindowDays() { return parseInt(this.get('advance_leave_withdrawal_window_days', '7'), 10); },
};

const Holiday = {
  all() { return db.prepare(`SELECT * FROM holidays ORDER BY holiday_date`).all(); },
  allDates() { return new Set(this.all().map(h => h.holiday_date)); },
  create(date, name) {
    return db.prepare(`INSERT INTO holidays (holiday_date, holiday_name) VALUES (?, ?)`).run(date, name).lastInsertRowid;
  },
  remove(id) { db.prepare(`DELETE FROM holidays WHERE holiday_id = ?`).run(id); },
};

module.exports = { Config, Holiday };
