const dayjs = require('dayjs');
const db = require('../database/db');
const User = require('../models/userModel');
const Ledger = require('../models/ledgerModel');
const Audit = require('../models/auditModel');
const Notification = require('../models/notificationModel');

function getMyTeam(req, res) {
  if (!req.currentUser.isManager) return res.status(403).json({ error: 'Manager access required.' });
  const scope = req.query.scope || 'direct';
  const rows = User.all()
    .filter(u => scope === 'all' ? (u.manager_id === req.currentUser.user_id || User.reportsTo(u.user_id, req.currentUser.user_id)) : u.manager_id === req.currentUser.user_id)
    .map(p => {
      const balances = db.prepare(`SELECT leave_type_id, effective FROM ledgers WHERE user_id = ? AND leave_year = ?`).all(p.user_id, dayjs().year());
      const takenThisYear = db.prepare(`SELECT COALESCE(SUM(deducted_days),0) AS d FROM leave_requests WHERE employee_id=? AND leave_year = ?`).get(p.user_id, dayjs().year()).d;
      const pendingDays = db.prepare(`SELECT COALESCE(SUM(deducted_days),0) AS d FROM leave_requests WHERE employee_id=? AND status IN ('PENDING_MANAGER','PENDING_HR')`).get(p.user_id).d;
      return { person: p, balances, takenThisYear, pendingDays };
    });
  res.json({ rows, scope });
}

function getMyDelegations(req, res) {
  if (!req.currentUser.isManager) return res.status(403).json({ error: 'Manager access required.' });
  const current = db.prepare(`
    SELECT d.*, u.full_name AS delegate_name FROM delegations d JOIN users u ON u.user_id=d.delegate_id
    WHERE d.manager_id=? ORDER BY d.effective_from DESC
  `).all(req.currentUser.user_id);
  const peers = User.peers(req.currentUser.user_id).filter(p => p.manager_id);
  const eligibleDelegates = peers.length ? peers : (req.currentUser.manager_id ? [User.findById(req.currentUser.manager_id)] : []);
  res.json({ current, eligibleDelegates });
}

function createDelegation(req, res) {
  if (!req.currentUser.isManager) return res.status(403).json({ error: 'Manager access required.' });
  const { delegate_id, effective_from, effective_to } = req.body;
  db.prepare(`INSERT INTO delegations (manager_id, delegate_id, effective_from, effective_to) VALUES (?,?,?,?)`)
    .run(req.currentUser.user_id, delegate_id, effective_from, effective_to || null);
  Audit.log(req.currentUser.user_id, 'delegations', 0, 'DELEGATION_CREATED', null, { delegate_id, effective_from, effective_to });
  Notification.create(parseInt(delegate_id, 10), 'NEW_REQUEST_FOR_APPROVAL', 'Nominated as delegate',
    `${req.currentUser.full_name} nominated you as delegate from ${effective_from}.`);
  res.status(201).json({ success: true });
}

function deleteDelegation(req, res) {
  if (!req.currentUser.isManager) return res.status(403).json({ error: 'Manager access required.' });
  db.prepare(`DELETE FROM delegations WHERE delegation_id = ? AND manager_id = ?`).run(req.params.id, req.currentUser.user_id);
  Audit.log(req.currentUser.user_id, 'delegations', req.params.id, 'DELEGATION_REVOKED');
  res.json({ success: true });
}

module.exports = { getMyTeam, getMyDelegations, createDelegation, deleteDelegation };
