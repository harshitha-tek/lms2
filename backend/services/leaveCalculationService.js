// Subsystem 4 — Leave Calculation Engine.
// BR-03 to BR-05: a "deducted working day" excludes weekends/holidays unless
// the org has explicitly configured them to count.
const dayjs = require('dayjs');
const { Config, Holiday } = require('../models/configModel');

function calculate(startDate, endDate, isHalfDay) {
  const weekendDays = new Set(Config.weekendDays());
  const countWeekends = Config.countWeekends();
  const countHolidays = Config.countHolidays();
  const holidaySet = Holiday.allDates();

  const start = dayjs(startDate);
  const end = dayjs(endDate);
  const days = [];
  let cursor = start;
  while (cursor.isBefore(end) || cursor.isSame(end, 'day')) {
    const iso = cursor.format('YYYY-MM-DD');
    const isWeekend = weekendDays.has(cursor.day());
    const isHoliday = holidaySet.has(iso);

    let excluded = false;
    let excludeReason = null;
    if (isWeekend && !countWeekends) { excluded = true; excludeReason = 'weekend'; }
    else if (isHoliday && !countHolidays) { excluded = true; excludeReason = 'holiday'; }

    days.push({ date: iso, isWeekend, isHoliday, excluded, excludeReason });
    cursor = cursor.add(1, 'day');
  }

  const calendarDays = days.length;
  let deductedDays = days.filter(d => !d.excluded).length;

  // Half-day only makes sense for a single-day request; deduct 0.5 instead of 1.
  if (isHalfDay && deductedDays > 0) {
    deductedDays = deductedDays - 0.5;
  }

  return {
    calendarDays,
    deductedDays,
    days,
    excludedWeekends: days.filter(d => d.excludeReason === 'weekend').length,
    excludedHolidays: days.filter(d => d.excludeReason === 'holiday').length,
  };
}

// BR-24/BR-44: contiguous requests (zero deducted working days apart) of the
// SAME leave type aggregate for threshold purposes.
function isBackdatingAllowed(startDate) {
  return !dayjs(startDate).isBefore(dayjs(), 'day');
}

module.exports = { calculate, isBackdatingAllowed };
