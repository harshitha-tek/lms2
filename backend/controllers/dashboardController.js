const dayjs = require('dayjs');
const LeaveType = require('../models/leaveTypeModel');
const LeaveRequest = require('../models/leaveRequestModel');
const Ledger = require('../models/ledgerModel');
const Notification = require('../models/notificationModel');

function getDashboard(req, res) {
  const year = dayjs().year();
  const leaveTypes = LeaveType.selectable();
  const balances = leaveTypes.map(leaveType => ({ leaveType, ...Ledger.effectiveBalance(req.currentUser.user_id, leaveType.leave_type_id, year) }));
  const requests = LeaveRequest.forEmployee(req.currentUser.user_id);
  res.json({
    balances,
    leaveTypes,
    pending: requests.filter(r => ['PENDING_MANAGER', 'PENDING_HR'].includes(r.status)),
    upcoming: requests.filter(r => r.status === 'APPROVED' && r.start_date >= dayjs().format('YYYY-MM-DD')),
    minimumLeaveDate: dayjs().format('YYYY-MM-DD')
  });
}

module.exports = { getDashboard };
