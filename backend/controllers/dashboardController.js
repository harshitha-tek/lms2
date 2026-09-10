// Subsystem 4/8 — employee dashboard: balance, pending, upcoming (Screen 7.3.2)
const dayjs = require('dayjs');
const LeaveType = require('../models/leaveTypeModel');
const LeaveRequest = require('../models/leaveRequestModel');
const Ledger = require('../models/ledgerModel');
const CURRENT_LEAVE_YEAR = dayjs().year();

function dashboard(req, res) {
  const userId = req.currentUser.user_id;
  const leaveTypes = LeaveType.selectable();
  const balances = leaveTypes.map(lt => ({
    leaveType: lt,
    ...Ledger.effectiveBalance(userId, lt.leave_type_id, CURRENT_LEAVE_YEAR),
  }));

  const allRequests = LeaveRequest.forEmployee(userId);
  const pending = allRequests.filter(r => ['PENDING_MANAGER', 'PENDING_HR'].includes(r.status));
  const upcoming = allRequests.filter(r => r.status === 'APPROVED' && r.start_date >= dayjs().format('YYYY-MM-DD'));
  const withdrawalBanner = allRequests.find(r => r.status === 'REJECTED_PENDING_WITHDRAWAL');

  res.render('employee/dashboard', { balances, pending, upcoming, withdrawalBanner, leaveTypes, error: null, form: {}, minimumLeaveDate: dayjs().format('YYYY-MM-DD') });
}

module.exports = { dashboard };
