// Mobile sidebar toggle
const loadingDots = () => '<span class="loading-dots" aria-hidden="true"><span></span><span></span><span></span></span>';

document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.mobile-nav-toggle');
  const sidebar = document.querySelector('.sidebar');
  const scrim = document.querySelector('.sidebar-scrim');
  if (toggle && sidebar && scrim) {
    const closeSidebar = () => { sidebar.classList.remove('open'); scrim.classList.remove('open'); };
    toggle.addEventListener('click', () => { sidebar.classList.add('open'); scrim.classList.add('open'); });
    scrim.addEventListener('click', closeSidebar);
    sidebar.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', closeSidebar));
  }

  const notificationToggle = document.querySelector('.notification-toggle');
  const notificationPanel = document.querySelector('.notification-panel');
  if (notificationToggle && notificationPanel) {
    notificationToggle.addEventListener('click', event => {
      event.stopPropagation();
      const open = !notificationPanel.hidden;
      notificationPanel.hidden = open;
      notificationToggle.setAttribute('aria-expanded', String(!open));
    });
    document.addEventListener('click', event => {
      if (!event.target.closest('.notification-menu')) {
        notificationPanel.hidden = true;
        notificationToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  const signoutModal = document.getElementById('signout-modal');
  if (signoutModal) {
    document.querySelectorAll('[data-signout]').forEach(link => link.addEventListener('click', event => {
      event.preventDefault();
      signoutModal.showModal();
    }));
    document.querySelectorAll('[data-close-signout]').forEach(button => button.addEventListener('click', () => signoutModal.close()));
    document.querySelector('[data-signout-confirm]')?.addEventListener('click', event => {
      const link = event.currentTarget;
      link.classList.add('is-loading');
      link.setAttribute('aria-busy', 'true');
      link.innerHTML = `${loadingDots()} Signing out...`;
    });
    signoutModal.addEventListener('click', event => { if (event.target === signoutModal) signoutModal.close(); });
  }

  const holidayModal = document.getElementById('holiday-modal');
  if (holidayModal) {
    document.querySelectorAll('[data-open-holiday-modal]').forEach(button => {
      button.addEventListener('click', () => holidayModal.showModal());
    });
    document.querySelectorAll('[data-close-holiday-modal]').forEach(button => {
      button.addEventListener('click', () => holidayModal.close());
    });
    holidayModal.addEventListener('click', event => {
      if (event.target === holidayModal) holidayModal.close();
    });
  }

  const applyModal = document.getElementById('apply-modal');
  if (applyModal) {
    document.querySelectorAll('[data-open-apply-modal]').forEach(button => button.addEventListener('click', () => applyModal.showModal()));
    document.querySelectorAll('[data-close-apply-modal]').forEach(button => button.addEventListener('click', () => applyModal.close()));
    applyModal.addEventListener('click', event => {
      if (event.target === applyModal) applyModal.close();
    });
    if (applyModal.dataset.autoOpen === 'true') applyModal.showModal();
  }

  const themeToggle = document.querySelector('[data-theme-toggle]');
  const savedTheme = localStorage.getItem('lms-theme');
  if (savedTheme === 'dark') document.documentElement.dataset.theme = 'dark';
  if (themeToggle) {
    const updateThemeToggle = () => {
      const dark = document.documentElement.dataset.theme === 'dark';
      themeToggle.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      const icon = themeToggle.querySelector('i');
      const label = themeToggle.querySelector('.theme-menu-label');
      if (icon) icon.className = `bi bi-${dark ? 'sun' : 'moon-stars'}`;
      if (label) label.textContent = dark ? 'Light mode' : 'Dark mode';
    };
    updateThemeToggle();
    themeToggle.addEventListener('click', () => {
      const dark = document.documentElement.dataset.theme !== 'dark';
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      localStorage.setItem('lms-theme', dark ? 'dark' : 'light');
      updateThemeToggle();
    });
  }
  document.querySelectorAll('.profile-menu [data-theme-toggle]').forEach(toggle => {
    const updateMenuLabel = () => {
      const dark = document.documentElement.dataset.theme === 'dark';
      toggle.querySelector('span').textContent = dark ? 'Light mode' : 'Dark mode';
      toggle.querySelector('i').className = `bi bi-${dark ? 'sun' : 'moon-stars'}`;
    };
    updateMenuLabel();
    toggle.addEventListener('click', () => setTimeout(updateMenuLabel, 0));
  });

  const profileInput = document.getElementById('profile_image');
  const cropModal = document.getElementById('crop-modal');
  const cropImage = document.getElementById('crop-image');
  const cropStage = document.getElementById('crop-stage');
  const cropZoom = document.getElementById('crop-zoom');
  const profilePreview = document.getElementById('profile-preview');
  let selectedProfileFile = null;
  let cropScale = 1;
  let cropOffsetX = 0;
  let cropOffsetY = 0;
  let cropDragging = false;
  let cropStartX = 0;
  let cropStartY = 0;
  if (profileInput && cropModal && cropImage) {
    profileInput.addEventListener('change', () => {
      const file = profileInput.files[0];
      if (!file || file.size > 2 * 1024 * 1024) {
        if (file) alert('Profile picture must be 2 MB or smaller.');
        profileInput.value = '';
        return;
      }
      selectedProfileFile = file;
      cropScale = 1;
      cropOffsetX = 0;
      cropOffsetY = 0;
      if (cropZoom) cropZoom.value = '1';
      cropImage.src = URL.createObjectURL(file);
      cropModal.showModal();
    });
    const renderCrop = () => {
      if (!cropStage) return;
      const baseScale = Math.max(cropStage.clientWidth / cropImage.naturalWidth, cropStage.clientHeight / cropImage.naturalHeight);
      const scale = baseScale * cropScale;
      cropImage.style.width = `${cropImage.naturalWidth * scale}px`;
      cropImage.style.height = `${cropImage.naturalHeight * scale}px`;
      cropImage.style.transform = `translate(${cropOffsetX}px, ${cropOffsetY}px)`;
    };
    cropImage.addEventListener('load', renderCrop);
    cropZoom?.addEventListener('input', () => { cropScale = Number(cropZoom.value); renderCrop(); });
    cropStage?.addEventListener('pointerdown', event => {
      cropDragging = true; cropStartX = event.clientX - cropOffsetX; cropStartY = event.clientY - cropOffsetY; cropStage.setPointerCapture(event.pointerId);
    });
    cropStage?.addEventListener('pointermove', event => {
      if (!cropDragging) return;
      cropOffsetX = event.clientX - cropStartX; cropOffsetY = event.clientY - cropStartY; renderCrop();
    });
    cropStage?.addEventListener('pointerup', () => { cropDragging = false; });
    cropStage?.addEventListener('pointercancel', () => { cropDragging = false; });
    document.querySelectorAll('[data-close-crop]').forEach(button => button.addEventListener('click', () => cropModal.close()));
    document.querySelector('[data-remove-profile]')?.addEventListener('click', () => {
      document.getElementById('remove-profile-image').value = 'true';
      profileInput.value = '';
      profilePreview.innerHTML = '<i class="bi bi-person"></i>';
    });
    document.querySelector('[data-apply-crop]')?.addEventListener('click', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512; canvas.height = 512;
      const baseScale = Math.max(cropStage.clientWidth / cropImage.naturalWidth, cropStage.clientHeight / cropImage.naturalHeight);
      const renderedScale = baseScale * cropScale;
      const sourceSize = cropStage.clientWidth / renderedScale;
      const sourceX = (cropStage.clientWidth / 2 - cropOffsetX) / renderedScale - sourceSize / 2;
      const sourceY = (cropStage.clientHeight / 2 - cropOffsetY) / renderedScale - sourceSize / 2;
      canvas.getContext('2d').drawImage(cropImage, sourceX, sourceY, sourceSize, sourceSize, 0, 0, 512, 512);
      canvas.toBlob(blob => {
        const croppedFile = new File([blob], selectedProfileFile.name, { type: 'image/jpeg' });
        const transfer = new DataTransfer();
        transfer.items.add(croppedFile);
        profileInput.files = transfer.files;
        profilePreview.innerHTML = `<img src="${URL.createObjectURL(blob)}" alt="">`;
        cropModal.close();
      }, 'image/jpeg', .88);
    });
    cropModal.addEventListener('click', event => { if (event.target === cropModal) cropModal.close(); });
  }

  const leaveTypeSelect = document.getElementById('apply-leave-type');
  const attachmentInput = document.getElementById('leave-attachment');
  const attachmentNote = document.getElementById('attachment-note');
  if (leaveTypeSelect && attachmentInput) {
    const updateAttachmentRequirement = () => {
      const sick = leaveTypeSelect.selectedOptions[0]?.dataset.sick === 'true';
      attachmentInput.required = sick;
      if (attachmentNote) attachmentNote.textContent = sick ? '(required for sick leave)' : '(optional)';
    };
    leaveTypeSelect.addEventListener('change', updateAttachmentRequirement);
    updateAttachmentRequirement();
  }

  document.querySelectorAll('form[method="POST"], form:not([method])').forEach(form => {
    form.addEventListener('submit', event => {
      const submitButton = event.submitter || form.querySelector('button[type="submit"]');
      if (!submitButton || submitButton.dataset.loadingBound === 'true') return;
      submitButton.dataset.loadingBound = 'true';
      submitButton.disabled = true;
      submitButton.classList.add('is-loading');
      submitButton.setAttribute('aria-busy', 'true');
      submitButton.innerHTML = `${loadingDots()} Saving...`;
    });
  });

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
    panel.setAttribute('aria-busy', 'true');
    panel.innerHTML = `<p class="muted" role="status">${loadingDots()} Calculating...</p>`;
    try {
      const res = await fetch(`/leave/calculate?${params.toString()}`);
      const data = await res.json();
      renderCalc(data);
    } catch (e) {
      panel.innerHTML = '<p class="muted">Could not calculate.</p>';
    } finally {
      panel.removeAttribute('aria-busy');
    }
  }

  function renderCalc(d) {
    panel.removeAttribute('aria-busy');
    if (d.error) { panel.innerHTML = ''; return; }
    const parts = [];
    parts.push(`<div class="grid grid-2">`);
    parts.push(statBlock('Deducted working days', d.deductedDays));
    parts.push(`</div>`);

    if (d.balance) {
      parts.push(`<div class="grid grid-2" style="margin-top:14px;">`);
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
