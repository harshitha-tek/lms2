import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { GlassCard } from '../../components/common/GlassCard';

export const AuditLog = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    api('/admin/audit-log')
      .then((res) => setEntries(res.entries || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = entries.filter((e) => {
    return (
      !search ||
      `${e.action || ''} ${e.entity_type || ''} ${e.actor_name || ''} ${e.user_id || ''}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  });

  return (
    <div className="container-fluid" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>System Audit Trail</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Immutable, append-only audit trail capturing all state transitions, approvals, configuration modifications, and administrative actions.
          </p>
        </div>

        <input
          type="text"
          className="glass-input"
          style={{ width: '280px' }}
          placeholder="Filter audit actions or entities..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <i className="bi bi-arrow-repeat spin" style={{ fontSize: '28px', color: 'var(--primary)' }} />
            <p style={{ marginTop: '10px' }}>Loading audit logs...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <p>No audit entries match your search.</p>
          </div>
        ) : (
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <table className="glass-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Details / Changes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ color: 'var(--text-subtle)', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                      {item.created_at || 'Just now'}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{item.actor_name || `User #${item.actor_user_id || item.user_id}`}</span>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: 'rgba(59, 130, 246, 0.15)',
                          color: '#93c5fd',
                          fontWeight: 600,
                        }}
                      >
                        {item.action}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                      {item.entity_type} #{item.entity_id}
                    </td>
                    <td style={{ fontSize: '12px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <code style={{ color: '#cbd5e1' }}>
                        {typeof item.new_value === 'string' ? item.new_value : JSON.stringify(item.new_value || item.details || {})}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
};
