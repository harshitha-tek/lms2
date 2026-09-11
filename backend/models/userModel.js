const db = require('../database/db');

const roleForUser = (userId) =>
  db.prepare(`SELECT r.role_code FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id WHERE ur.user_id = ?`)
    .all(userId).map(r => r.role_code);

const isManager = (userId) => {
  const user = db.prepare(`SELECT employee_type FROM users WHERE user_id = ?`).get(userId);
  if (user?.employee_type === 'MANAGER') return true;
  return db.prepare(`SELECT COUNT(*) AS c FROM users WHERE manager_id = ? AND is_active = 1`).get(userId).c > 0;
};

const User = {
  findById(id) {
    const u = db.prepare(`SELECT * FROM users WHERE user_id = ?`).get(id);
    if (!u) return null;
    return this.hydrate(u);
  },

  findByEntraObjectId(oid) {
    const u = db.prepare(`SELECT * FROM users WHERE entra_object_id = ?`).get(oid);
    return u ? this.hydrate(u) : null;
  },

  hydrate(u) {
    const roles = new Set(roleForUser(u.user_id));
    if (isManager(u.user_id)) roles.add('MANAGER');
    return {
      ...u,
      roles: Array.from(roles),
      isHrAdmin: roles.has('HR_ADMIN'),
      isManager: roles.has('MANAGER'),
    };
  },

  all() {
    return db.prepare(`SELECT * FROM users ORDER BY full_name`).all().map(this.hydrate.bind(this));
  },

  allActive() {
    return this.all().filter(u => u.is_active);
  },

  directReports(managerId) {
    return db.prepare(`SELECT * FROM users WHERE manager_id = ? AND is_active = 1 ORDER BY full_name`).all(managerId);
  },

  // Every employee at any depth beneath managerId (BR-39).
  allReportsRecursive(managerId) {
    const result = [];
    const queue = [managerId];
    while (queue.length) {
      const current = queue.shift();
      const directs = this.directReports(current);
      for (const d of directs) {
        result.push(d);
        queue.push(d.user_id);
      }
    }
    return result;
  },

  peers(userId) {
    const u = db.prepare(`SELECT manager_id FROM users WHERE user_id = ?`).get(userId);
    if (!u || !u.manager_id) return [];
    return db.prepare(`SELECT * FROM users WHERE manager_id = ? AND user_id != ? AND is_active = 1`)
      .all(u.manager_id, userId);
  },

  create({ employee_code, entra_object_id, email, full_name, department_id, grade_id, management_level_id, manager_id, joined_date, employee_type = 'EMPLOYEE' }) {
    const info = db.prepare(`
      INSERT INTO users (employee_code, entra_object_id, email, full_name, department_id, grade_id, management_level_id, manager_id, joined_date, employee_type, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(employee_code, entra_object_id, email, full_name, department_id || null, grade_id || null, management_level_id || null, manager_id || null, joined_date, employee_type);
    db.prepare(`INSERT INTO user_roles (user_id, role_id) VALUES (?, (SELECT role_id FROM roles WHERE role_code='EMPLOYEE'))`)
      .run(info.lastInsertRowid);
    if (employee_type === 'HR_ADMIN') db.prepare(`INSERT INTO user_roles (user_id, role_id) VALUES (?, (SELECT role_id FROM roles WHERE role_code='HR_ADMIN'))`).run(info.lastInsertRowid);
    return info.lastInsertRowid;
  },

  updateProfile(userId, { full_name, phone_number, personal_email, profile_image, remove_profile_image }) {
    if (remove_profile_image || profile_image) {
      db.prepare(`UPDATE users SET full_name = ?, phone_number = ?, personal_email = ?, profile_image = ? WHERE user_id = ?`)
        .run(full_name, phone_number || null, personal_email || null, remove_profile_image ? null : profile_image, userId);
      return;
    }
    db.prepare(`UPDATE users SET full_name = ?, phone_number = ?, personal_email = ? WHERE user_id = ?`)
      .run(full_name, phone_number || null, personal_email || null, userId);
  },

  wouldCreateCycle(userId, proposedManagerId) {
    let current = proposedManagerId;
    const seen = new Set();
    while (current) {
      if (current === userId) return true;
      if (seen.has(current)) break;
      seen.add(current);
      const row = db.prepare(`SELECT manager_id FROM users WHERE user_id = ?`).get(current);
      current = row ? row.manager_id : null;
    }
    return false;
  },
};

module.exports = User;
