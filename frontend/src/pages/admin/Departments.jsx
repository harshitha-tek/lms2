import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import Modal from '../../components/common/Modal';
import { GlassCard } from '../../components/common/GlassCard';

const PAGE_SIZE = 8;

export const Departments = () => {
  const [departments, setDepartments] = useState([]);
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ department_code: '', department_name: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchDepartments = async () => {
    try {
      const data = await api('/admin/departments');
      setDepartments(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleCreate = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api('/admin/departments', {
        method: 'POST',
        body: JSON.stringify(form),
        headers: { 'Content-Type': 'application/json' },
      });
      setShowModal(false);
      setForm({ department_code: '', department_name: '' });
      fetchDepartments();
    } catch (err) {
      setError(err.message || 'Failed to create department');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async id => {
    if (!window.confirm('Are you sure you want to delete this department?')) return;
    try {
      await api(`/admin/departments/${id}`, { method: 'DELETE' });
      fetchDepartments();
    } catch (e) {
      console.error(e);
    }
  };

  const totalPages = Math.ceil(departments.length / PAGE_SIZE);
  const displayed = departments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ marginBottom: '16px' }}>Departments</h2>
      <button className="btn-glass" onClick={() => setShowModal(true)} style={{ marginBottom: '12px' }}>
        + Add Department
      </button>
      <GlassCard>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px' }}>Code</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>Name</th>
              <th style={{ textAlign: 'right', padding: '8px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map(dep => (
              <tr key={dep.department_id}>
                <td style={{ padding: '8px' }}>{dep.department_code}</td>
                <td style={{ padding: '8px' }}>{dep.department_name}</td>
                <td style={{ padding: '8px', textAlign: 'right' }}>
                  <button className="btn-danger-glass" onClick={() => handleDelete(dep.department_id)}>
                    <i className="bi bi-trash" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'center', gap: '8px' }}>
            <button className="btn-glass" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              ‹ Prev
            </button>
            <span style={{ alignSelf: 'center' }}>Page {page} of {totalPages}</span>
            <button className="btn-glass" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
              Next ›
            </button>
          </div>
        )}
      </GlassCard>
      {showModal && (
        <Modal title="Create Department" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate}>
            <div className="form-group" style={{ marginBottom: '8px' }}>
              <label>Code</label>
              <input type="text" className="form-control" value={form.department_code} onChange={e => setForm({ ...form, department_code: e.target.value })} required />
            </div>
            <div className="form-group" style={{ marginBottom: '8px' }}>
              <label>Name</label>
              <input type="text" className="form-control" value={form.department_name} onChange={e => setForm({ ...form, department_name: e.target.value })} required />
            </div>
            {error && <div style={{ color: 'red', marginBottom: '8px' }}>{error}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="btn-glass" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary-glass" disabled={loading}>
                {loading ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
