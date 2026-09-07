const express = require('express');
const router = express.Router();
const { ensureAuthenticated, requireManager } = require('../middleware/auth');
const approvalController = require('../controllers/approvalController');
const managerController = require('../controllers/managerController');

router.use(ensureAuthenticated, requireManager);

router.get('/approvals', approvalController.queue);
router.post('/approvals/:id/decide', approvalController.decide);
router.post('/approvals/:id/decide-cancellation', approvalController.decideCancellation);

router.get('/manager/my-team', managerController.myTeam);
router.get('/manager/delegation', managerController.showDelegation);
router.post('/manager/delegation', managerController.createDelegation);

module.exports = router;
