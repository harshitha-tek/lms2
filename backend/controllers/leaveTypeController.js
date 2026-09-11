const LeaveType = require('../models/leaveTypeModel');
const Audit = require('../models/auditModel');

function getLeaveTypes(req, res) {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  res.json({ leaveTypes: LeaveType.all(), policies: LeaveType.allPolicies() });
}

function createLeaveType(req, res) {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  const { leave_code, leave_name, is_sick_leave, allows_attachment, allows_half_day, carry_forward_allowed, carry_forward_cap } = req.body;
  const id = LeaveType.create({
    leave_code, leave_name,
    is_sick_leave: !!is_sick_leave, allows_attachment: !!allows_attachment, allows_half_day: !!allows_half_day,
    carry_forward_allowed: !!carry_forward_allowed, carry_forward_cap: carry_forward_cap || null,
  });
  Audit.log(req.currentUser.user_id, 'leave_types', id, 'LEAVE_TYPE_CREATED');
  res.status(201).json({ success: true, id });
}

module.exports = { getLeaveTypes, createLeaveType };
