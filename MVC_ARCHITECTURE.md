# LMS 2.0 MVC Architecture

## Overview

The LMS backend has been refactored from a monolithic routing file (822 lines of `apiRoutes.js`) into a clean Model-View-Controller (MVC) architecture with:

- **Models**: Database access and business logic (`/backend/models/`)
- **Controllers**: Request handlers organized by feature (`/backend/controllers/`)
- **Routes**: Clean route definitions delegating to controllers (`/backend/routes/apiRoutes.js`)
- **Services**: Specialized utilities like SLA scheduling (`/backend/services/`)
- **Middleware**: Cross-cutting concerns like authentication (`/backend/middleware/`)

---

## Directory Structure

```
backend/
├── app.js                           # Express app entry point
├── controllers/                     # Request handlers by domain
│   ├── dashboardController.js       # Dashboard metrics
│   ├── leaveController.js           # Leave request operations
│   ├── approvalController.js        # Manager/HR approvals
│   ├── managerController.js         # Manager team & delegations
│   ├── employeeController.js        # Employee CRUD & adjustments
│   ├── departmentController.js      # Department CRUD
│   └── leaveTypeController.js       # Leave type management
├── models/                          # Data access layer
│   ├── userModel.js
│   ├── leaveTypeModel.js
│   ├── leaveRequestModel.js
│   ├── approvalModel.js
│   ├── departmentModel.js
│   ├── ledgerModel.js
│   ├── notificationModel.js
│   ├── auditModel.js
│   └── delegationModel.js
├── routes/
│   ├── apiRoutes.js                 # Main API route definitions (refactored)
│   ├── authRoutes.js                # Auth endpoints (dev/Entra)
│   └── apiRoutes.monolith.js        # Backup of original 822-line file
├── services/
│   └── schedulerService.js          # SLA escalation (runs every 2 min)
├── middleware/
│   └── auth.js                      # ensureAuthenticated() guard
├── database/
│   ├── db.js                        # SQLite instance
│   ├── schema.sql                   # Database schema
│   └── seed-mysql.js                # Development data seeding
└── config/
    └── env.js                       # Config from environment variables
```

---

## Controller Files

### 1. **dashboardController.js**
- `getDashboard()` - Dashboard metrics (leave balances, pending approvals, team stats)

### 2. **leaveController.js**
- `calculateLeave()` - Compute leave days for a date range
- `getLeaveRequests()` - List all leave requests (filtered by role)
- `getLeaveRequest()` - Get single request with full details
- `createLeaveRequest()` - Submit new leave request with attachment support
- `withdrawLeaveRequest()` - Employee withdraws own pending request
- `cancelLeaveRequest()` - Request cancellation (approval chain)
- `getPeerCalendar()` - View team member calendars

### 3. **approvalController.js**
- `getManagerApprovals()` - List pending approvals for current manager
- `decideApproval()` - Manager/HR approves or rejects leave request
- `decideCancellation()` - Manager/HR approves or rejects cancellation request

### 4. **managerController.js**
- `getMyTeam()` - View team members with leave balances
- `getMyDelegations()` - List active delegations
- `createDelegation()` - Delegate approvals to peer/senior
- `deleteDelegation()` - Revoke delegation

### 5. **employeeController.js**
- `listEmployees()` - Get all employees (admin only)
- `createEmployee()` - Create new employee record
- `updateEmployee()` - Edit employee details (name, email, department, etc.)
- `viewLedger()` - View leave balance history for an employee
- `adjustBalance()` - Credit/debit leave days (admin only)

### 6. **departmentController.js**
- `getDepartments()` - List all departments
- `createDepartment()` - Add new department with duplicate checking
- `deleteDepartment()` - Delete only if no employees assigned

### 7. **leaveTypeController.js**
- `getLeaveTypes()` - List all leave types and policies
- `createLeaveType()` - Create new leave type

---

## Route Definitions (apiRoutes.js)

Routes are now cleanly organized by feature with clear delegation to controllers:

### Auth (Unprotected)
```javascript
GET  /api/auth/session          → returns current user or null
POST /api/auth/dev-login        → dev mode only
POST /api/auth/logout           → destroy session
GET  /api/auth/users            → list all active users
```

### Dashboard (Protected)
```javascript
GET  /api/dashboard             → dashboardController.getDashboard()
```

### Leave Management (Protected)
```javascript
GET  /api/leave/calculate       → leaveController.calculateLeave()
GET  /api/leave/requests        → leaveController.getLeaveRequests()
GET  /api/leave/requests/:id    → leaveController.getLeaveRequest()
POST /api/leave/requests        → leaveController.createLeaveRequest()
POST /api/leave/requests/:id/withdraw   → leaveController.withdrawLeaveRequest()
POST /api/leave/requests/:id/cancel     → leaveController.cancelLeaveRequest()
GET  /api/leave/peer-calendar   → leaveController.getPeerCalendar()
```

### Manager Operations (Protected, Manager+ required)
```javascript
GET  /api/manager/approvals     → approvalController.getManagerApprovals()
POST /api/manager/approvals/:id/decide  → approvalController.decideApproval()
POST /api/manager/approvals/:id/decide-cancellation  → approvalController.decideCancellation()
GET  /api/manager/team          → managerController.getMyTeam()
GET  /api/manager/delegations   → managerController.getMyDelegations()
POST /api/manager/delegations   → managerController.createDelegation()
DELETE /api/manager/delegations/:id  → managerController.deleteDelegation()
```

### Admin: Employees (Protected, HR/Admin required)
```javascript
GET  /api/admin/employees       → employeeController.listEmployees()
POST /api/admin/employees       → employeeController.createEmployee()
PUT  /api/admin/employees/:id   → employeeController.updateEmployee()
```

### Admin: Departments (Protected, HR/Admin required)
```javascript
GET  /api/admin/departments     → departmentController.getDepartments()
POST /api/admin/departments     → departmentController.createDepartment()
DELETE /api/admin/departments/:id  → departmentController.deleteDepartment()
```

### Admin: Leave Types (Protected, HR/Admin required)
```javascript
GET  /api/admin/leave-types     → leaveTypeController.getLeaveTypes()
POST /api/admin/leave-types     → leaveTypeController.createLeaveType()
```

### Admin: Balance Adjustments (Protected, HR/Admin required)
```javascript
GET  /api/admin/adjustments/:userId  → employeeController.viewLedger()
POST /api/admin/adjustments          → employeeController.adjustBalance()
```

### Profile (Protected)
```javascript
GET  /api/profile              → Get current user's profile
PUT  /api/profile              → Update current user's profile (avatar, phone, email)
```

---

## Key Features

### 1. **Consistent Controller Pattern**
Every controller follows a simple pattern:
```javascript
function handlerName(req, res) {
  // Check authorization if needed
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: '...' });
  
  // Process request
  // Audit log changes
  // Return response
}

module.exports = { handlerName, ... };
```

### 2. **Authentication Middleware**
- `ensureAuthenticated` guard applied to all protected routes
- Populates `req.currentUser` with full user object
- No role-based middleware (roles checked inline in controllers)

### 3. **Audit Logging**
All data mutations logged via `Audit.log()`:
```javascript
Audit.log(userId, tableName, recordId, action, beforeSnapshot, afterSnapshot);
```

### 4. **Error Handling**
- Status 400: Validation errors
- Status 403: Authorization denied
- Status 409: Conflict (duplicate, in-use, etc.)
- Status 201: Created successfully
- Status 204: No content (delete/logout)

### 5. **SLA Escalation**
Runs every 2 minutes via `schedulerService.js`:
- Escalates manager approvals older than 2 minutes to HR level
- Marks original approval as non-current
- Creates new HR-level approval
- Sends notifications and audits

---

## Testing the Refactoring

### Start Backend
```bash
npm run dev:server
```

### Test Auth Endpoint
```bash
curl http://localhost:3000/api/auth/session
```

Expected response:
```json
{"user":null,"authMode":"dev"}
```

### Test Protected Endpoint (Requires Session)
```bash
# Dev login first
curl -X POST http://localhost:3000/api/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"user_id": 1}'

# Then access protected route
curl http://localhost:3000/api/dashboard
```

---

## Migration from Monolith

The original `apiRoutes.monolith.js` (822 lines) has been backed up. All functionality is preserved:

1. ✅ All 7 controllers created with identical logic
2. ✅ Routes reorganized by feature domain
3. ✅ All imports updated
4. ✅ No functional changes - same business logic
5. ✅ Backend tested and running

---

## Future Controller Additions

To add new functionality:

1. **Create controller** in `/backend/controllers/newController.js`
2. **Define handlers** following the pattern above
3. **Export handlers** as named exports
4. **Import in apiRoutes.js** at the top
5. **Define routes** in the appropriate section

Example:
```javascript
// controllers/reportController.js
function getReport(req, res) {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  // logic here
}
module.exports = { getReport };

// routes/apiRoutes.js
const reportController = require('../controllers/reportController');
// ... later in file
router.get('/admin/reports/:type', reportController.getReport);
```

---

## Summary

| Metric | Before | After |
|--------|--------|-------|
| Routes file size | 822 lines | 135 lines |
| Controller files | 0 | 7 |
| Code organization | Monolithic | Feature-based |
| Request flow | Routes → inline logic | Routes → Controllers → Models |
| Maintainability | Hard to locate features | Clear separation by domain |
| Testing | Difficult | Controller-level unit testable |

The refactored architecture maintains 100% backward compatibility while dramatically improving code organization and maintainability.
