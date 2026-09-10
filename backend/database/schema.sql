-- =============================================================================
-- LMS 2.0 — Full Database Schema (SQLite dialect, for the runnable demo app)
-- 36 tables: 27 R1 + 9 R2/R3. See /database/schema.mysql.sql and
-- /database/schema.postgres.sql for production-dialect versions.
-- =============================================================================

PRAGMA foreign_keys = ON;

-- DOMAIN 1 — Organisation & Identity
CREATE TABLE departments (
    department_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    department_code   TEXT NOT NULL UNIQUE,
    department_name   TEXT NOT NULL UNIQUE
);

CREATE TABLE grades (
    grade_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    grade_code   TEXT NOT NULL UNIQUE,
    grade_name   TEXT NOT NULL UNIQUE
);

CREATE TABLE management_levels (
    management_level_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    level_code             TEXT NOT NULL UNIQUE,
    level_name               TEXT NOT NULL UNIQUE,
    level_rank                  INTEGER NOT NULL UNIQUE
);

CREATE TABLE roles (
    role_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    role_code   TEXT NOT NULL UNIQUE,
    role_name   TEXT NOT NULL UNIQUE
);

CREATE TABLE users (
    user_id                INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_code             TEXT NOT NULL UNIQUE,
    entra_object_id              TEXT NOT NULL UNIQUE,
    email                           TEXT NOT NULL UNIQUE,
    full_name                         TEXT NOT NULL,
    department_id                        INTEGER NULL REFERENCES departments(department_id),
    grade_id                                INTEGER NULL REFERENCES grades(grade_id),
    management_level_id                        INTEGER NULL REFERENCES management_levels(management_level_id),
    manager_id                                    INTEGER NULL REFERENCES users(user_id),
    joined_date                                      TEXT NOT NULL,
    is_active                                           INTEGER NOT NULL DEFAULT 1,
    last_working_day                                       TEXT NULL,
    deactivated_by                                            INTEGER NULL REFERENCES users(user_id),
    deactivated_at                                               TEXT NULL,
    digest_opt_in                                                   INTEGER NOT NULL DEFAULT 0
    ,profile_image                                                   TEXT NULL
    ,phone_number                                                     TEXT NULL
    ,personal_email                                                   TEXT NULL
    ,employee_type                                                    TEXT NOT NULL DEFAULT 'EMPLOYEE' CHECK (employee_type IN ('EMPLOYEE', 'MANAGER', 'HR_ADMIN'))
);

CREATE TABLE user_roles (
    user_id     INTEGER NOT NULL REFERENCES users(user_id),
    role_id        INTEGER NOT NULL REFERENCES roles(role_id),
    assigned_at       TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, role_id)
);

-- DOMAIN 2 — Working Patterns & Holidays
CREATE TABLE working_patterns (
    working_pattern_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_code           TEXT NOT NULL UNIQUE,
    pattern_name              TEXT NOT NULL UNIQUE
);

CREATE TABLE working_pattern_days (
    working_pattern_day_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    working_pattern_id          INTEGER NOT NULL REFERENCES working_patterns(working_pattern_id),
    day_of_week                    INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    working_hours                     REAL NOT NULL,
    UNIQUE (working_pattern_id, day_of_week)
);

CREATE TABLE working_pattern_assignments (
    assignment_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id                  INTEGER NOT NULL REFERENCES users(user_id),
    working_pattern_id          INTEGER NOT NULL REFERENCES working_patterns(working_pattern_id),
    effective_from                  TEXT NOT NULL,
    effective_to                       TEXT NULL
);

CREATE TABLE holidays (
    holiday_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    holiday_date   TEXT NOT NULL UNIQUE,
    holiday_name   TEXT NOT NULL,
    holiday_type   TEXT NOT NULL DEFAULT 'NATIONAL' CHECK (holiday_type IN ('NATIONAL', 'FESTIVAL', 'OPTIONAL'))
);

-- DOMAIN 3 — Projects, Delegations & Watchers
CREATE TABLE projects (
    project_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    project_code           TEXT NOT NULL UNIQUE,
    project_name              TEXT NOT NULL UNIQUE,
    project_lead_id              INTEGER NULL REFERENCES users(user_id)
);

CREATE TABLE project_assignments (
    project_assignment_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id                  INTEGER NOT NULL REFERENCES projects(project_id),
    user_id                        INTEGER NOT NULL REFERENCES users(user_id),
    assigned_from                     TEXT NOT NULL,
    assigned_to                          TEXT NULL
);

CREATE TABLE delegations (
    delegation_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    manager_id            INTEGER NOT NULL REFERENCES users(user_id),
    delegate_id               INTEGER NOT NULL REFERENCES users(user_id),
    effective_from                TEXT NOT NULL,
    effective_to                     TEXT NULL
);

-- DOMAIN 4 — Leave Policy & Ledger
CREATE TABLE leave_types (
    leave_type_id             INTEGER PRIMARY KEY AUTOINCREMENT,
    leave_code                   TEXT NOT NULL UNIQUE,
    leave_name                      TEXT NOT NULL UNIQUE,
    is_sick_leave                      INTEGER NOT NULL DEFAULT 0,
    allows_attachment                     INTEGER NOT NULL DEFAULT 0,
    allows_half_day                          INTEGER NOT NULL DEFAULT 1,
    is_balance_affecting                        INTEGER NOT NULL DEFAULT 1,
    is_employee_selectable                         INTEGER NOT NULL DEFAULT 1,
    is_system_managed                                 INTEGER NOT NULL DEFAULT 0,
    carry_forward_allowed                                INTEGER NOT NULL DEFAULT 0,
    carry_forward_cap                                       REAL NULL
);

CREATE TABLE leave_policies (
    leave_policy_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    leave_type_id             INTEGER NOT NULL REFERENCES leave_types(leave_type_id),
    grade_id                     INTEGER NOT NULL REFERENCES grades(grade_id),
    entitlement_days                REAL NOT NULL,
    accrual_frequency                  TEXT NOT NULL CHECK (accrual_frequency IN ('MONTHLY','QUARTERLY','ANNUAL')),
    accrual_posting_day                   INTEGER NOT NULL,
    effective_from                           TEXT NOT NULL,
    effective_to                                TEXT NULL
);

-- DOMAIN 5 — Leave Requests & Approvals
CREATE TABLE leave_requests (
    leave_request_id           INTEGER PRIMARY KEY AUTOINCREMENT,
    request_number                 TEXT NOT NULL UNIQUE,
    employee_id                       INTEGER NOT NULL REFERENCES users(user_id),
    leave_type_id                        INTEGER NOT NULL REFERENCES leave_types(leave_type_id),
    original_leave_type_id                  INTEGER NULL REFERENCES leave_types(leave_type_id),
    start_date                                 TEXT NOT NULL,
    end_date                                      TEXT NOT NULL,
    is_half_day                                      INTEGER NOT NULL DEFAULT 0,
    half_day_part                                       TEXT NULL CHECK (half_day_part IN ('FIRST_HALF','SECOND_HALF')),
    deducted_days                                          REAL NOT NULL DEFAULT 0,
    reason                                                    TEXT NULL,
    status                                                       TEXT NOT NULL CHECK (status IN (
        'DRAFT','PENDING_MANAGER','PENDING_HR','APPROVED','REJECTED',
        'REJECTED_PENDING_WITHDRAWAL','WITHDRAWN','CANCELLATION_REQUESTED',
        'CANCELLED','LOP_APPLIED')),
    is_advance_leave      INTEGER NOT NULL DEFAULT 0,
    withdrawal_deadline      TEXT NULL,
    lock_version                INTEGER NOT NULL DEFAULT 0,
    submitted_at                   TEXT NULL,
    created_at                        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE leave_request_dates (
    leave_request_date_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    leave_request_id            INTEGER NOT NULL REFERENCES leave_requests(leave_request_id),
    leave_date                     TEXT NOT NULL,
    day_fraction                      REAL NOT NULL CHECK (day_fraction IN (0.5, 1.0)),
    UNIQUE (leave_request_id, leave_date)
);

CREATE TABLE leave_approvals (
    approval_id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    leave_request_id                   INTEGER NOT NULL REFERENCES leave_requests(leave_request_id),
    approval_level                        TEXT NOT NULL CHECK (approval_level IN ('MANAGER','HR')),
    reassignment_seq                         INTEGER NOT NULL DEFAULT 0,
    approver_id                                 INTEGER NOT NULL REFERENCES users(user_id),
    is_current                                     INTEGER NOT NULL DEFAULT 1,
    escalated_from_approval_id                        INTEGER NULL REFERENCES leave_approvals(approval_id),
    status                                               TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
    decision_reason                                          TEXT NULL,
    decided_at                                                  TEXT NULL,
    created_at                                                     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE leave_attachments (
    attachment_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    leave_request_id        INTEGER NOT NULL REFERENCES leave_requests(leave_request_id),
    file_name                   TEXT NOT NULL,
    uploaded_by                    INTEGER NOT NULL REFERENCES users(user_id),
    uploaded_at                       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- DOMAIN 3 cont. — Watchers (depends on leave_requests)
CREATE TABLE watchers (
    watcher_id             INTEGER PRIMARY KEY AUTOINCREMENT,
    watcher_user_id            INTEGER NOT NULL REFERENCES users(user_id),
    leave_request_id              INTEGER NULL REFERENCES leave_requests(leave_request_id),
    watched_employee_id              INTEGER NULL REFERENCES users(user_id),
    watcher_type                        TEXT NOT NULL CHECK (watcher_type IN ('REQUEST','STANDING','PROJECT_LEAD')),
    effective_from                          TEXT NULL,
    effective_to                               TEXT NULL
);

-- DOMAIN 4 cont. — Ledger
CREATE TABLE leave_ledger_entries (
    ledger_entry_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id                 INTEGER NOT NULL REFERENCES users(user_id),
    leave_type_id               INTEGER NOT NULL REFERENCES leave_types(leave_type_id),
    leave_year                     INTEGER NOT NULL,
    transaction_type                  TEXT NOT NULL CHECK (transaction_type IN (
        'OPENING','ACCRUAL','CARRY_FORWARD','ADJUSTMENT','DEBIT','RESTORE','LAPSE')),
    quantity                             REAL NOT NULL,
    source_reference                        TEXT NULL,
    created_at                                 TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE leave_balance_snapshots (
    snapshot_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id             INTEGER NOT NULL REFERENCES users(user_id),
    leave_type_id          INTEGER NOT NULL REFERENCES leave_types(leave_type_id),
    leave_year                 INTEGER NOT NULL,
    balance                       REAL NOT NULL,
    UNIQUE (user_id, leave_type_id, leave_year)
);

-- DOMAIN 6 — Notifications, Audit, Configuration & Scheduler
CREATE TABLE notification_templates (
    notification_template_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    notification_type               TEXT NOT NULL UNIQUE,
    channel                            TEXT NOT NULL CHECK (channel IN ('IN_APP','EMAIL')),
    subject_template                       TEXT NOT NULL,
    body_template                             TEXT NOT NULL,
    updated_by                                   INTEGER NULL REFERENCES users(user_id)
);

CREATE TABLE notifications (
    notification_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient_user_id       INTEGER NOT NULL REFERENCES users(user_id),
    leave_request_id           INTEGER NULL REFERENCES leave_requests(leave_request_id),
    template_id                    INTEGER NULL REFERENCES notification_templates(notification_template_id),
    subject                            TEXT NOT NULL,
    body                                  TEXT NOT NULL,
    delivery_status                         TEXT NOT NULL DEFAULT 'SENT' CHECK (delivery_status IN ('PENDING','SENT','FAILED')),
    is_read                                    INTEGER NOT NULL DEFAULT 0,
    read_at                                       TEXT NULL,
    created_at                                       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE configurations (
    configuration_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    configuration_key          TEXT NOT NULL UNIQUE,
    configuration_value           TEXT NOT NULL,
    updated_by                       INTEGER NULL REFERENCES users(user_id),
    updated_at                          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE audit_logs (
    audit_log_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_user_id          INTEGER NULL REFERENCES users(user_id),
    entity_type                TEXT NOT NULL,
    entity_id                     INTEGER NOT NULL,
    action                            TEXT NOT NULL,
    prior_value                          TEXT NULL,
    new_value                               TEXT NULL,
    occurred_at                                TEXT NOT NULL DEFAULT (datetime('now')),
    is_system_actor                               INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE scheduler_executions (
    execution_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    job_name              TEXT NOT NULL,
    execution_key            TEXT NOT NULL UNIQUE,
    status                      TEXT NOT NULL DEFAULT 'RUNNING' CHECK (status IN ('RUNNING','SUCCESS','FAILED','SKIPPED')),
    started_at                     TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at                      TEXT NULL,
    detail                               TEXT NULL
);

-- R2/R3 ADDITIONS (9 tables => 36 total)
CREATE TABLE self_approvals (
    self_approval_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    leave_request_id           INTEGER NOT NULL REFERENCES leave_requests(leave_request_id),
    approval_id                    INTEGER NULL REFERENCES leave_approvals(approval_id),
    approval_level                     INTEGER NOT NULL,
    attempted_by_user_id                  INTEGER NOT NULL REFERENCES users(user_id),
    violation_type                            TEXT NOT NULL CHECK (violation_type IN ('SELF_APPROVAL','CIRCULAR_AUTHORITY')),
    routed_to_user_id                                INTEGER NULL REFERENCES users(user_id),
    attempted_at                                        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE employee_final_settlements (
    settlement_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id                  INTEGER NOT NULL REFERENCES users(user_id),
    last_working_day            TEXT NOT NULL,
    computed_at                     TEXT NOT NULL DEFAULT (datetime('now')),
    computed_by_actor                  TEXT NOT NULL DEFAULT 'SYSTEM' CHECK (computed_by_actor IN ('SYSTEM','HR_ADMIN'))
);

CREATE TABLE employee_final_settlement_lines (
    settlement_line_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    settlement_id             INTEGER NOT NULL REFERENCES employee_final_settlements(settlement_id),
    leave_type_id                 INTEGER NOT NULL REFERENCES leave_types(leave_type_id),
    prorated_balance                  REAL NOT NULL
);

CREATE TABLE manager_reassignments (
    reassignment_id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id                          INTEGER NOT NULL REFERENCES users(user_id),
    previous_manager_id                 INTEGER NULL REFERENCES users(user_id),
    new_manager_id                          INTEGER NOT NULL REFERENCES users(user_id),
    pending_requests_transferred               INTEGER NOT NULL DEFAULT 0,
    transferred_request_ids                       TEXT NULL,
    reassigned_by_user_id                                INTEGER NOT NULL REFERENCES users(user_id),
    reassigned_at                                           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE employee_import_batches (
    import_batch_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    file_name                  TEXT NOT NULL,
    row_count                      INTEGER NOT NULL,
    status                            TEXT NOT NULL DEFAULT 'PROCESSING' CHECK (status IN ('PROCESSING','COMMITTED','REJECTED')),
    error_report                          TEXT NULL,
    initiated_by_user_id                      INTEGER NOT NULL REFERENCES users(user_id),
    started_at                                    TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at                                     TEXT NULL
);

CREATE TABLE leave_encashments (
    encashment_id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id                     INTEGER NOT NULL REFERENCES users(user_id),
    leave_type_id                   INTEGER NOT NULL REFERENCES leave_types(leave_type_id),
    encashed_days                       REAL NOT NULL,
    rate_per_day                            REAL NULL,
    ledger_entry_id                             INTEGER NOT NULL REFERENCES leave_ledger_entries(ledger_entry_id),
    status                                          TEXT NOT NULL DEFAULT 'INITIATED' CHECK (status IN ('INITIATED','SENT_TO_PAYROLL')),
    initiated_by_user_id                                   INTEGER NOT NULL REFERENCES users(user_id),
    initiated_at                                               TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE comp_off_requests (
    comp_off_request_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id                     INTEGER NOT NULL REFERENCES users(user_id),
    work_date                       TEXT NOT NULL,
    hours_worked                        REAL NOT NULL,
    reason                                  TEXT NULL,
    status                                     TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
    credited_days                                 REAL NULL,
    ledger_entry_id                                   INTEGER NULL REFERENCES leave_ledger_entries(ledger_entry_id),
    approved_by_user_id                                      INTEGER NULL REFERENCES users(user_id),
    approved_at                                                  TEXT NULL,
    created_at                                                      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE blackout_periods (
    blackout_id           INTEGER PRIMARY KEY AUTOINCREMENT,
    start_date                TEXT NOT NULL,
    end_date                     TEXT NOT NULL,
    leave_type_ids                  TEXT NULL,
    description                        TEXT NOT NULL,
    created_by_user_id                     INTEGER NOT NULL REFERENCES users(user_id),
    created_at                                TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE team_capacity_limits (
    capacity_limit_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    manager_id                INTEGER NOT NULL REFERENCES users(user_id),
    max_concurrent_leave          INTEGER NOT NULL,
    effective_from                    TEXT NOT NULL,
    effective_to                         TEXT NULL,
    created_by_user_id                      INTEGER NOT NULL REFERENCES users(user_id),
    created_at                                 TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX idx_users_manager ON users (manager_id);
CREATE INDEX idx_leave_requests_employee ON leave_requests (employee_id);
CREATE INDEX idx_leave_requests_status ON leave_requests (status);
CREATE INDEX idx_leave_approvals_request ON leave_approvals (leave_request_id);
CREATE INDEX idx_ledger_user_type_year ON leave_ledger_entries (user_id, leave_type_id, leave_year);
CREATE INDEX idx_notifications_recipient ON notifications (recipient_user_id, is_read);
CREATE INDEX idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_watchers_request ON watchers (leave_request_id);
CREATE INDEX idx_watchers_watched ON watchers (watched_employee_id);
