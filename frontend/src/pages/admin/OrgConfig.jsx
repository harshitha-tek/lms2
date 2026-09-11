import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { GlassCard } from '../../components/common/GlassCard';

export const OrgConfig = () => {
  const [configs, setConfigs] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningScheduler, setRunningScheduler] = useState(false);
  const [schedulerNotice, setSchedulerNotice] = useState(null);

  const fetchConfig = () => {
    setLoading(true);
    api('/admin/configuration')
      .then((res) => {
        // The API returns configuration rows as an array; key them by
        // configuration_key so configs.sla_period_days etc. resolve to the
        // actual stored value instead of always falling through to the
        // hardcoded per-field defaults below.
        const map = {};
        (res.configs || []).forEach((c) => { map[c.configuration_key] = c.configuration_value; });
        setConfigs(map);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleChange = (key, val) => {
    setConfigs((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api('/admin/configuration', {
        method: 'POST',
        body: JSON.stringify(configs),
      });
      alert('Organisation configuration successfully updated.');
      fetchConfig();
    } catch (err) {
      alert(err.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleRunScheduler = async () => {
    setRunningScheduler(true);
    setSchedulerNotice(null);
    try {
      const res = await api('/admin/configuration/run-scheduler', { method: 'POST' });
      setSchedulerNotice(res.result || 'Scheduler completed successfully.');
    } catch (err) {
      alert(err.message || 'Failed to run scheduler');
    } finally {
      setRunningScheduler(false);
    }
  };

  return (
    <div className="container-fluid" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Organisation Configuration</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            System-wide leave rules, working days, backdating windows, SLA periods, and alerts.
          </p>
        </div>

        <button
          onClick={handleRunScheduler}
          disabled={runningScheduler}
          className="btn-glass btn-primary-glass"
          style={{ padding: '8px 18px', fontSize: '13px' }}
        >
          {runningScheduler ? (
            <span><i className="bi bi-arrow-repeat spin" /> Running Scheduler...</span>
          ) : (
            <span><i className="bi bi-play-circle" /> Run Background Jobs Now</span>
          )}
        </button>
      </div>

      {schedulerNotice && (
        <div className="glass-panel" style={{ padding: '14px 18px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#6ee7b7', fontSize: '13px' }}>
          <i className="bi bi-check-circle" style={{ marginRight: '8px' }} />
          Scheduler execution outcome: {JSON.stringify(schedulerNotice)}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <i className="bi bi-arrow-repeat spin" style={{ fontSize: '28px', color: 'var(--primary)' }} />
          <p style={{ marginTop: '10px' }}>Loading configuration...</p>
        </div>
      ) : (
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Working Days & Leave Year */}
          <GlassCard title="Working Days & Calendar Rules" icon="calendar-range">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Leave Year Start (MM-DD)
                </label>
                <input
                  type="text"
                  className="glass-input"
                  value={configs.leave_year_start || '04-01'}
                  onChange={(e) => handleChange('leave_year_start', e.target.value)}
                />
                <small style={{ color: '#fbbf24', fontSize: '11.5px', marginTop: '4px', display: 'block' }}>
                  Note: Changes take effect from the next leave year only.
                </small>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Organisational Timezone
                </label>
                <input
                  type="text"
                  className="glass-input"
                  value={configs.timezone || 'Asia/Kolkata'}
                  onChange={(e) => handleChange('timezone', e.target.value)}
                />
                <small style={{ color: 'var(--text-subtle)', fontSize: '11.5px', marginTop: '4px', display: 'block' }}>
                  Default: Asia/Kolkata.
                </small>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Default Weekend Days (0=Sun, 6=Sat)
                </label>
                <input
                  type="text"
                  className="glass-input"
                  value={configs.weekend_days || '6,0'}
                  onChange={(e) => handleChange('weekend_days', e.target.value)}
                />
                <small style={{ color: 'var(--text-subtle)', fontSize: '11.5px', marginTop: '4px', display: 'block' }}>
                  Comma-separated weekday numbers.
                </small>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={configs.count_weekends_within_leave === 'true'}
                  onChange={(e) => handleChange('count_weekends_within_leave', String(e.target.checked))}
                  style={{ accentColor: '#3b82f6', width: '16px', height: '16px' }}
                />
                <span>Count weekend days within requested leave spans as deducted days</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={configs.count_holidays_within_leave === 'true'}
                  onChange={(e) => handleChange('count_holidays_within_leave', String(e.target.checked))}
                  style={{ accentColor: '#3b82f6', width: '16px', height: '16px' }}
                />
                <span>Count public holidays within requested leave spans as deducted days</span>
              </label>
            </div>
          </GlassCard>

          {/* SLAs & Thresholds */}
          <GlassCard title="SLAs, Thresholds & Escalation" icon="stopwatch">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Approval SLA Period (Working Days)
                </label>
                <input
                  type="number"
                  className="glass-input"
                  value={configs.sla_period_days || 3}
                  onChange={(e) => handleChange('sla_period_days', e.target.value)}
                />
                <small style={{ color: 'var(--text-subtle)', fontSize: '11.5px', marginTop: '4px', display: 'block' }}>
                  Default: 1 days. Reminder at 75%, escalation on breach.
                </small>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Backdating Permitted Window (Calendar Days)
                </label>
                <input
                  type="number"
                  className="glass-input"
                  value={configs.backdating_window_days || 30}
                  onChange={(e) => handleChange('backdating_window_days', e.target.value)}
                />
                <small style={{ color: 'var(--text-subtle)', fontSize: '11.5px', marginTop: '4px', display: 'block' }}>
                  Default: 30 days. Capped at current leave year start.
                </small>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Sick Leave Alert Threshold (Days)
                </label>
                <input
                  type="number"
                  className="glass-input"
                  value={configs.sick_alert_threshold_days || 3}
                  onChange={(e) => handleChange('sick_alert_threshold_days', e.target.value)}
                />
                <small style={{ color: 'var(--text-subtle)', fontSize: '11.5px', marginTop: '4px', display: 'block' }}>
                  Alerts supervisor & HR if contiguous sick leave exceeds this.
                </small>
              </div>
            </div>
          </GlassCard>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={saving}
              className="btn-glass btn-primary-glass"
              style={{ padding: '12px 30px', fontSize: '15px' }}
            >
              {saving ? 'Saving...' : 'Save Configuration Changes'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
