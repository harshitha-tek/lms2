// Mobile sidebar toggle
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.mobile-nav-toggle');
  const sidebar = document.querySelector('.sidebar');
  const scrim = document.querySelector('.sidebar-scrim');
  if (toggle && sidebar && scrim) {
    toggle.addEventListener('click', () => { sidebar.classList.add('open'); scrim.classList.add('open'); });
    scrim.addEventListener('click', () => { sidebar.classList.remove('open'); scrim.classList.remove('open'); });
  }

  initApplyFormCalculation();
});

// Subsystem 4 — live deduction calculation on the Apply screen (LMS-036 / NFR-02).
function initApplyFormCalculation() {
  const form = document.getElementById('apply-form');
  if (!form) return;

  const startEl = form.querySelector('[name="start_date"]');
  const endEl = form.querySelector('[name="end_date"]');
  const halfDayEl = form.querySelector('[name="is_half_day"]');
  const leaveTypeEl = form.querySelector('[name="leave_type_id"]');
  const panel = document.getElementById('calc-panel');
  const halfDayOptions = document.getElementById('half-day-options');

  let timer = null;
  function scheduleCalc() {
    clearTimeout(timer);
    timer = setTimeout(runCalc, 150);
  }

  async function runCalc() {
    if (!startEl.value || !endEl.value) { panel.innerHTML = ''; return; }
    const params = new URLSearchParams({
      start_date: startEl.value,
      end_date: endEl.value,
      is_half_day: halfDayEl.checked,
      leave_type_id: leaveTypeEl.value,
    });
    panel.innerHTML = '<p class="muted">Calculating…</p>';
    try {
      const res = await fetch(`/leave/calculate?${params.toString()}`);
      const data = await res.json();
      renderCalc(data);
    } catch (e) {
      panel.innerHTML = '<p class="muted">Could not calculate.</p>';
    }
  }

  function renderCalc(d) {
    if (d.error) { panel.innerHTML = ''; return; }
    const parts = [];
    parts.push(`<div class="grid grid-2">`);
    parts.push(statBlock('Calendar days selected', d.calendarDays));
    parts.push(statBlock('Deducted working days', d.deductedDays));
    parts.push(`</div>`);

    const notes = [];
    if (d.excludedWeekends) notes.push(`${d.excludedWeekends} weekend day(s) excluded`);
    if (d.excludedHolidays) notes.push(`${d.excludedHolidays} public holiday(s) excluded`);
    if (notes.length) parts.push(`<p class="muted" style="margin-top:10px;font-size:13px;">${notes.join(' · ')}</p>`);

    if (d.balance) {
      parts.push(`<div class="grid grid-3" style="margin-top:14px;">`);
      parts.push(statBlock('Current balance', d.balance.balance));
      parts.push(statBlock('Committed to open requests', d.balance.committed));
      parts.push(statBlock('Projected balance after this', (d.projectedBalance).toFixed(1)));
      parts.push(`</div>`);
    }

    if (!d.backdatingAllowed) {
      parts.push(`<div class="alert alert-danger" style="margin-top:14px;"><i class="bi bi-exclamation-octagon"></i> This start date is outside the permitted backdating window. Submission will be blocked.</div>`);
    } else if (d.isAdvanceLeave) {
      parts.push(`<div class="alert alert-warning" style="margin-top:14px;"><i class="bi bi-exclamation-triangle"></i> This exceeds your effective balance. Submission is still allowed — this becomes <strong>advance leave</strong>. If later rejected, you'll have a 7-day window to withdraw before it converts to Loss of Pay.</div>`);
    }

    panel.innerHTML = parts.join('');
  }

  function statBlock(label, value) {
    return `<div><div class="stat-label">${label}</div><div class="stat-value">${value}</div></div>`;
  }

  if (halfDayEl) {
    halfDayEl.addEventListener('change', () => {
      if (halfDayOptions) halfDayOptions.style.display = halfDayEl.checked ? 'block' : 'none';
      scheduleCalc();
    });
  }
  [startEl, endEl, leaveTypeEl].forEach(el => el && el.addEventListener('change', scheduleCalc));
  runCalc();
}
