const Notification = require('../models/notificationModel');

function centre(req, res) {
  const notifications = Notification.forUser(req.currentUser.user_id);
  res.render('employee/notifications', { notifications });
}

function markRead(req, res) {
  Notification.markRead(req.params.id, req.currentUser.user_id);
  res.redirect('/notifications');
}

module.exports = { centre, markRead };
