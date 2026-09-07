// Subsystem 2/6 — My Team view, Delegation
const dayjs = require('dayjs');
const User = require('../models/userModel');
const Ledger = require('../models/ledgerModel');
const LeaveType = require('../models/leaveTypeModel');
const db = require('../../database/db');
const Audit = require('../models/auditModel');
const Notification = require('../models/notificationModel');
const CURRENT_LEAVE_YEAR = dayjs().year();

function myTeam(req, res) {
  const scope = req.query.scope === 'direct' ? 'direct' : 'all';
  const people = scope === 'direct'
    ? User.directReports(req.currentUser.user_id)
    : User.allReportsRecursive(req.currentUser.user_id);

  const leaveTypes = LeaveType.selectable();
  const rows = people.map(p => {
    const balances = leaveTypes.map(lt => ({ leaveType: lt, ...Ledger.effectiveBalance(p.user_id, lt.leave_type_id, CURRENT_LEAVE_YEAR) }));
    const takenThisYear = db.prepare(`
      SELECT COALESCE(SUM(-quantity),0) AS taken FROM leave_ledger_entries
      WHERE user_id=? AND leave_year=? AND transaction_type='DEBIT'
    `).get(p.user_id, CURRENT_LEAVE_YEAR).taken;
    const pendingDays = db.prepare(`
      SELECT COALESCE(SUM(deducted_days),0) AS d FROM leave_requests
      WHERE employee_id=? AND status IN ('PENDING_MANAGER','PENDING_HR')
    `).get(p.user_id).d;
    return { person: p, balances, takenThisYear, pendingDays };
  });

  res.render('manager/my-team', { rows, scope });
}

function showDelegation(req, res) {
  const current = db.prepare(`
    SELECT d.*, u.full_name AS delegate_name FROM delegations d JOIN users u ON u.user_id=d.delegate_id
    WHERE d.manager_id=? ORDER BY d.effective_from DESC
  `).all(req.currentUser.user_id);
  const peers = User.peers(req.currentUser.user_id).filter(p => p.manager_id); // peer managers only
  const eligibleDelegates = peers.length ? peers : (req.currentUser.manager_id ? [User.findById(req.currentUser.manager_id)] : []);
  res.render('manager/delegation', { current, eligibleDelegates });
}

function createDelegation(req, res) {
  const { delegate_id, effective_from, effective_to } = req.body;
  db.prepare(`INSERT INTO delegations (manager_id, delegate_id, effective_from, effective_to) VALUES (?,?,?,?)`)
    .run(req.currentUser.user_id, delegate_id, effective_from, effective_to || null);
  Audit.log(req.currentUser.user_id, 'delegations', 0, 'DELEGATION_CREATED', null, { delegate_id, effective_from, effective_to });
  Notification.create(parseInt(delegate_id, 10), 'NEW_REQUEST_FOR_APPROVAL', 'Nominated as delegate',
    `${req.currentUser.full_name} nominated you as their delegate from ${effective_from}.`);
  res.redirect('/manager/delegation');
}

module.exports = { myTeam, showDelegation, createDelegation };
