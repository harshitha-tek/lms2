// Subsystem 3 (Configuration) + holiday calendar
const db = require('../database/db');

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
  filter({ query = '', year = 'all', type = 'all' } = {}) {
    const normalizedQuery = String(query).trim().toLowerCase();
    const normalizedYear = /^\d{4}$/.test(String(year)) ? String(year) : 'all';
    const normalizedType = ['NATIONAL', 'FESTIVAL', 'OPTIONAL'].includes(String(type)) ? String(type) : 'all';
    return this.all().filter(holiday =>
      (normalizedYear === 'all' || holiday.holiday_date.startsWith(normalizedYear)) &&
      (normalizedType === 'all' || holiday.holiday_type === normalizedType) &&
      (!normalizedQuery || holiday.holiday_name.toLowerCase().includes(normalizedQuery))
    );
  },
  years() { return [...new Set(this.all().map(holiday => holiday.holiday_date.slice(0, 4)))].sort().reverse(); },
  page(limit, offset) {
    return db.prepare(`SELECT * FROM holidays ORDER BY holiday_date LIMIT ? OFFSET ?`).all(limit, offset);
  },
  count() {
    return db.prepare(`SELECT COUNT(*) AS count FROM holidays`).get().count;
  },
  allDates() { return new Set(this.all().map(h => h.holiday_date)); },
  create(date, name, type = 'NATIONAL') {
    return db.prepare(`INSERT INTO holidays (holiday_date, holiday_name, holiday_type) VALUES (?, ?, ?)`).run(date, name, type).lastInsertRowid;
  },
  createMany(holidays) {
    const insert = db.prepare(`INSERT INTO holidays (holiday_date, holiday_name, holiday_type) VALUES (?, ?, ?)`);
    return db.transaction(() => {
      holidays.forEach(({ date, name, type }) => insert.run(date, name, type));
      return holidays.length;
    })();
  },
  remove(id) { db.prepare(`DELETE FROM holidays WHERE holiday_id = ?`).run(id); },
};

module.exports = { Config, Holiday };
