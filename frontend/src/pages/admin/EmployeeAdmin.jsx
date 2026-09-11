import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { GlassCard } from '../../components/common/GlassCard';
import { Modal } from '../../components/common/Modal';

export const EmployeeAdmin = () => {
  const [data, setData] = useState({ employees: [], departments: [], grades: [], managementLevels: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New Employee Form State
  const [form, setForm] = useState({
    employee_code: '',
    full_name: '',
    email: '',
    department_id: '',
    grade_id: '',
    management_level_id: '',
    manager_id: '',
    joined_date: new Date().toISOString().split('T')[0],
    employee_type: 'EMPLOYEE',
  });

  // Edit Employee State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editForm, setEditForm] = useState({
    full_name: '',
    email: '',
    department_id: '',
    grade_id: '',
    management_level_id: '',
    manager_id: '',
  });

  const fetchEmployees = () => {
    setLoading(true);
    api('/admin/employees')
      .then((res) => {
        setData(res);
        if (res.departments && res.departments.length > 0) {
          setForm((prev) => ({
            ...prev,
            department_id: res.departments[0].department_id,
            grade_id: res.grades[0]?.grade_id || '',
            management_level_id: res.managementLevels[0]?.level_id || '',
          }));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api('/admin/employees', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setModalOpen(false);
      fetchEmployees();
    } catch (err) {
      alert(err.message || 'Failed to create employee');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (emp) => {
    setEditingEmployee(emp);
    setEditForm({
      full_name: emp.full_name,
      email: emp.email,
      department_id: emp.department_id,
      grade_id: emp.grade_id,
      management_level_id: emp.management_level_id,
      manager_id: emp.manager_id || '',
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api(`/admin/employees/${editingEmployee.user_id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm),
      });
      setEditModalOpen(false);
      setEditingEmployee(null);
      fetchEmployees();
    } catch (err) {
      alert(err.message || 'Failed to update employee');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = data.employees.filter((emp) => {
    const matchSearch = !search ||
      `${emp.full_name} ${emp.employee_code} ${emp.email}`.toLowerCase().includes(search.toLowerCase());
    const matchDept = selectedDept === 'ALL' || String(emp.department_id) === selectedDept;
    return matchSearch && matchDept;
  });

  return (
    <div className="container-fluid" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Employee Directory & Hierarchy</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Manage employee master data, reporting lines, departments, and roles.
          </p>
        </div>

        <button onClick={() => setModalOpen(true)} className="btn-glass btn-primary-glass">
          <i className="bi bi-person-plus-fill" />
          <span>Add New Employee</span>
        </button>
      </div>

      {/* Filter bar */}
      <div
        className="glass-panel"
        style={{
          padding: '16px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'center',
        }}
      >
        <div style={{ flex: '1 1 250px' }}>
          <input
            type="text"
            className="glass-input"
            placeholder="Search by name, employee code, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="glass-select"
          style={{ width: 'auto', minWidth: '180px' }}
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
        >
          <option value="ALL">All Departments</option>
          {data.departments.map((d) => (
            <option key={d.department_id} value={d.department_id}>
              {d.department_name}
            </option>
          ))}
        </select>
      </div>

      {/* Employees Table */}
      <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <i className="bi bi-arrow-repeat spin" style={{ fontSize: '28px', color: 'var(--primary)' }} />
            <p style={{ marginTop: '10px' }}>Loading employees...</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="glass-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Employee Name</th>
                  <th>Email</th>
                  <th>Department</th>
                  <th>Role</th>
                  <th>Joined Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp) => (
                  <tr key={emp.user_id}>
                    <td style={{ fontWeight: 600, color: '#93c5fd' }}>{emp.employee_code}</td>
                    <td style={{ fontWeight: 600 }}>{emp.full_name}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{emp.email}</td>
                    <td>
                      {data.departments.find((d) => d.department_id === emp.department_id)?.department_name || 'General'}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: '999px',
                          background: emp.isHrAdmin ? 'rgba(168, 85, 247, 0.2)' : emp.isManager ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                          color: emp.isHrAdmin ? '#d8b4fe' : emp.isManager ? '#93c5fd' : '#e2e8f0',
                          fontWeight: 600,
                        }}
                      >
                        {emp.isHrAdmin ? 'HR / Admin' : emp.isManager ? 'Manager' : 'Employee'}
                      </span>
                    </td>
                    <td>{emp.joined_date}</td>
                    <td>
                      <span style={{ color: emp.is_active ? '#34d399' : '#f87171', fontSize: '12px', fontWeight: 600 }}>
                        {emp.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => handleEditClick(emp)}
                        className="btn-glass"
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                        title="Edit employee details"
                      >
                        <i className="bi bi-pencil-square" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Add Employee Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add New Employee Record"
        maxWidth="650px"
      >
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Employee Code *
              </label>
              <input
                type="text"
                className="glass-input"
                placeholder="e.g. EMP-1005"
                value={form.employee_code}
                onChange={(e) => setForm({ ...form, employee_code: e.target.value })}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Full Name *
              </label>
              <input
                type="text"
                className="glass-input"
                placeholder="e.g. Ananya Sen"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Work Email *
              </label>
              <input
                type="email"
                className="glass-input"
                placeholder="e.g. ananya.sen@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Assigned Role *
              </label>
              <select
                className="glass-select"
                value={form.employee_type}
                onChange={(e) => setForm({ ...form, employee_type: e.target.value })}
              >
                <option value="EMPLOYEE">Employee</option>
                <option value="MANAGER">Manager</option>
                <option value="HR_ADMIN">HR / Admin</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Department *
              </label>
              <select
                className="glass-select"
                value={form.department_id}
                onChange={(e) => setForm({ ...form, department_id: e.target.value })}
              >
                {data.departments.map((d) => (
                  <option key={d.department_id} value={d.department_id}>
                    {d.department_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Reporting Manager
              </label>
              <select
                className="glass-select"
                value={form.manager_id}
                onChange={(e) => setForm({ ...form, manager_id: e.target.value })}
              >
                <option value="">None (Top-level)</option>
                {data.employees.filter((u) => u.isManager).map((u) => (
                  <option key={u.user_id} value={u.user_id}>
                    {u.full_name} ({u.employee_code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Date of Joining *
              </label>
              <input
                type="date"
                className="glass-input"
                value={form.joined_date}
                onChange={(e) => setForm({ ...form, joined_date: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.3)', fontSize: '12px', color: '#93c5fd' }}>
            <i className="bi bi-info-circle" style={{ marginRight: '6px' }} />
            Opening pro-rata entitlement will be automatically computed and credited to the append-only ledger upon creation.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button type="button" onClick={() => setModalOpen(false)} className="btn-glass">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-glass btn-primary-glass">
              {submitting ? 'Creating...' : 'Create Employee Record'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Employee Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Edit Employee: ${editingEmployee?.full_name}`}
        maxWidth="650px"
      >
        <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Full Name *
              </label>
              <input
                type="text"
                className="glass-input"
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Work Email *
              </label>
              <input
                type="email"
                className="glass-input"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Department *
              </label>
              <select
                className="glass-select"
                value={editForm.department_id}
                onChange={(e) => setEditForm({ ...editForm, department_id: e.target.value })}
              >
                {data.departments.map((d) => (
                  <option key={d.department_id} value={d.department_id}>
                    {d.department_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Grade
              </label>
              <select
                className="glass-select"
                value={editForm.grade_id}
                onChange={(e) => setEditForm({ ...editForm, grade_id: e.target.value })}
              >
                <option value="">None</option>
                {data.grades.map((g) => (
                  <option key={g.grade_id} value={g.grade_id}>
                    {g.grade_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Management Level
              </label>
              <select
                className="glass-select"
                value={editForm.management_level_id}
                onChange={(e) => setEditForm({ ...editForm, management_level_id: e.target.value })}
              >
                <option value="">None</option>
                {data.managementLevels.map((m) => (
                  <option key={m.level_id} value={m.level_id}>
                    {m.level_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Reporting Manager
              </label>
              <select
                className="glass-select"
                value={editForm.manager_id}
                onChange={(e) => setEditForm({ ...editForm, manager_id: e.target.value })}
              >
                <option value="">None (Top-level)</option>
                {data.employees.filter((u) => u.isManager).map((u) => (
                  <option key={u.user_id} value={u.user_id}>
                    {u.full_name} ({u.employee_code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button type="button" onClick={() => setEditModalOpen(false)} className="btn-glass">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-glass btn-primary-glass">
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
