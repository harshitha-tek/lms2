-- =============================================================================
-- LMS 2.0 — Full Database Schema
-- 36 tables: 27 R1 tables (Part D of the master design doc) + 9 R2/R3 tables.
-- Dialect: PostgreSQL. \c is a psql meta-command — swap for your client's
-- "use database" equivalent if you're not running this through psql.
-- =============================================================================

CREATE DATABASE lms;
\c lms


-- =============================================================================
-- DOMAIN 1 — Organisation & Identity
-- =============================================================================

CREATE TABLE departments (
    department_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    department_code   VARCHAR(20)  NOT NULL UNIQUE,
    department_name   VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE grades (
    grade_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    grade_code   VARCHAR(20)  NOT NULL UNIQUE,
    grade_name   VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE management_levels (
    management_level_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    level_code             VARCHAR(20)  NOT NULL UNIQUE,
    level_name               VARCHAR(100) NOT NULL UNIQUE,
    level_rank                  SMALLINT     NOT NULL UNIQUE
);

CREATE TABLE roles (
    role_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_code   VARCHAR(30)  NOT NULL UNIQUE,
    role_name   VARCHAR(100) NOT NULL UNIQUE
);

-- Central employee master. Self-referencing manager hierarchy; circularity is
-- application-enforced (LMS-011), not something a CHECK constraint can express.
CREATE TABLE users (
    user_id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    employee_code             VARCHAR(30)  NOT NULL UNIQUE,
    entra_object_id              VARCHAR(100) NOT NULL UNIQUE,
    email                           VARCHAR(255) NOT NULL UNIQUE,
    department_id                      BIGINT NULL REFERENCES departments (department_id),
    grade_id                              BIGINT NULL REFERENCES grades (grade_id),
    management_level_id                      BIGINT NULL REFERENCES management_levels (management_level_id),
    manager_id                                  BIGINT NULL REFERENCES users (user_id),
    joined_date                                    DATE    NOT NULL,
    profile_image                                  VARCHAR(255) NULL,
    phone_number                                   VARCHAR(40) NULL,
    personal_email                                 VARCHAR(255) NULL,
    employee_type                                  VARCHAR(20) NOT NULL DEFAULT 'EMPLOYEE',
    is_active                                         BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_users_manager ON users (manager_id);
CREATE INDEX idx_users_department ON users (department_id);

CREATE TABLE user_roles (
    user_id       BIGINT NOT NULL REFERENCES users (user_id),
    role_id          BIGINT NOT NULL REFERENCES roles (role_id),
    assigned_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role_id)
);


-- =============================================================================
-- DOMAIN 2 — Working Patterns & Holidays
-- =============================================================================

CREATE TABLE working_patterns (
    working_pattern_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pattern_code           VARCHAR(30)  NOT NULL UNIQUE,
    pattern_name              VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE working_pattern_days (
    working_pattern_day_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    working_pattern_id          BIGINT NOT NULL REFERENCES working_patterns (working_pattern_id),
    day_of_week                    SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    working_hours                     NUMERIC(4,2) NOT NULL,
    UNIQUE (working_pattern_id, day_of_week)
);

CREATE TABLE working_pattern_assignments (
    assignment_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id                  BIGINT NOT NULL REFERENCES users (user_id),
    working_pattern_id          BIGINT NOT NULL REFERENCES working_patterns (working_pattern_id),
    effective_from                  DATE NOT NULL,
    effective_to                       DATE NULL
);

CREATE INDEX idx_working_pattern_assignments_user ON working_pattern_assignments (user_id);

-- Standalone public holiday calendar (no FKs).
CREATE TABLE holidays (
    holiday_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    holiday_date   DATE         NOT NULL UNIQUE,
    holiday_name   VARCHAR(150) NOT NULL UNIQUE,
    holiday_type   VARCHAR(20) NOT NULL DEFAULT 'NATIONAL' CHECK (holiday_type IN ('NATIONAL', 'FESTIVAL', 'OPTIONAL'))
);


-- =============================================================================
-- DOMAIN 3 — Projects, Delegations & Watchers
-- =============================================================================

CREATE TABLE projects (
    project_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_code           VARCHAR(30)  NOT NULL UNIQUE,
    project_name              VARCHAR(150) NOT NULL UNIQUE,
    project_lead_id              BIGINT NULL REFERENCES users (user_id)
);

CREATE TABLE project_assignments (
    project_assignment_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id                  BIGINT NOT NULL REFERENCES projects (project_id),
    user_id                        BIGINT NOT NULL REFERENCES users (user_id),
    assigned_from                     DATE NOT NULL,
    assigned_to                          DATE NULL
);

CREATE INDEX idx_project_assignments_user ON project_assignments (user_id);

CREATE TABLE delegations (
    delegation_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    manager_id            BIGINT NOT NULL REFERENCES users (user_id),
    delegate_id               BIGINT NOT NULL REFERENCES users (user_id),
    effective_from                DATE NOT NULL,
    effective_to                     DATE NULL
);

CREATE INDEX idx_delegations_manager ON delegations (manager_id);


-- =============================================================================
-- DOMAIN 4 — Leave Policy & Ledger
-- =============================================================================

-- LOP is system-managed and non-deletable — enforced at the application layer
-- (LMS-025), since a CHECK constraint can't distinguish "this specific row".
CREATE TABLE leave_types (
    leave_type_id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    leave_code                   VARCHAR(20)  NOT NULL UNIQUE,
    leave_name                      VARCHAR(100) NOT NULL UNIQUE,
    is_sick_leave                      BOOLEAN NOT NULL DEFAULT FALSE,
    allows_attachment                     BOOLEAN NOT NULL DEFAULT FALSE,
    is_balance_affecting                     BOOLEAN NOT NULL DEFAULT TRUE,
    is_employee_selectable                      BOOLEAN NOT NULL DEFAULT TRUE,
    is_system_managed                              BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE leave_policies (
    leave_policy_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    leave_type_id             BIGINT NOT NULL REFERENCES leave_types (leave_type_id),
    grade_id                     BIGINT NOT NULL REFERENCES grades (grade_id),
    entitlement_days                NUMERIC(6,2) NOT NULL,
    accrual_frequency                  VARCHAR(10) NOT NULL
                              CHECK (accrual_frequency IN ('MONTHLY', 'QUARTERLY', 'ANNUAL')),
    accrual_posting_day                   SMALLINT NOT NULL,
    effective_from                           DATE NOT NULL,
    effective_to                                DATE NULL
);

CREATE INDEX idx_leave_policies_type_grade ON leave_policies (leave_type_id, grade_id);


-- =============================================================================
-- DOMAIN 5 — Leave Requests & Approvals
-- (created before the ledger domain below since watchers/ledger reference
-- leave_requests)
-- =============================================================================

-- Status is controlled exclusively by the state machine (Section 5.11 of the
-- FRD) — the application, not a CHECK constraint, enforces valid transitions.
CREATE TABLE leave_requests (
    leave_request_id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    request_number                 VARCHAR(30) NOT NULL UNIQUE,
    employee_id                       BIGINT NOT NULL REFERENCES users (user_id),
    leave_type_id                        BIGINT NOT NULL REFERENCES leave_types (leave_type_id),
    original_leave_type_id                  BIGINT NULL REFERENCES leave_types (leave_type_id),
    status                                     VARCHAR(30) NOT NULL
        CHECK (status IN ('DRAFT', 'PENDING_MANAGER', 'PENDING_HR', 'APPROVED', 'REJECTED',
                           'REJECTED_PENDING_WITHDRAWAL', 'WITHDRAWN',
                           'CANCELLATION_REQUESTED', 'CANCELLED', 'LOP_APPLIED')),
    is_advance_leave                              BOOLEAN NOT NULL DEFAULT FALSE,
    withdrawal_deadline                              TIMESTAMPTZ NULL,
    lock_version                                        INTEGER NOT NULL DEFAULT 0,
    created_at                                             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_leave_requests_employee ON leave_requests (employee_id);
CREATE INDEX idx_leave_requests_status ON leave_requests (status);

CREATE TABLE leave_request_dates (
    leave_request_date_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    leave_request_id            BIGINT NOT NULL REFERENCES leave_requests (leave_request_id),
    leave_date                     DATE NOT NULL,
    day_fraction                      NUMERIC(3,1) NOT NULL CHECK (day_fraction IN (0.5, 1.0)),
    UNIQUE (leave_request_id, leave_date)
);

CREATE TABLE leave_approvals (
    approval_id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    leave_request_id                   BIGINT NOT NULL REFERENCES leave_requests (leave_request_id),
    approval_level                        VARCHAR(10) NOT NULL CHECK (approval_level IN ('MANAGER', 'HR')),
    reassignment_seq                         SMALLINT NOT NULL DEFAULT 0,
    approver_id                                 BIGINT NOT NULL REFERENCES users (user_id),
    is_current                                     BOOLEAN NOT NULL DEFAULT TRUE,
    escalated_from_approval_id                        BIGINT NULL REFERENCES leave_approvals (approval_id),
    status                                               VARCHAR(10) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    decided_at                                              TIMESTAMPTZ NULL
);

CREATE INDEX idx_leave_approvals_request ON leave_approvals (leave_request_id);
CREATE INDEX idx_leave_approvals_approver ON leave_approvals (approver_id);

CREATE TABLE leave_attachments (
    attachment_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    leave_request_id        BIGINT NOT NULL REFERENCES leave_requests (leave_request_id),
    file_name                   VARCHAR(255) NOT NULL,
    uploaded_by                    BIGINT NOT NULL REFERENCES users (user_id),
    uploaded_at                       TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =============================================================================
-- back to DOMAIN 3 — Watchers (needs leave_requests, so created after Domain 5)
-- =============================================================================

CREATE TABLE watchers (
    watcher_id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    watcher_user_id            BIGINT NOT NULL REFERENCES users (user_id),
    leave_request_id              BIGINT NULL REFERENCES leave_requests (leave_request_id),
    watched_employee_id              BIGINT NULL REFERENCES users (user_id),
    watcher_type                        VARCHAR(15) NOT NULL
        CHECK (watcher_type IN ('REQUEST', 'STANDING', 'PROJECT_LEAD'))
);

CREATE INDEX idx_watchers_request ON watchers (leave_request_id);
CREATE INDEX idx_watchers_watched_employee ON watchers (watched_employee_id);


-- =============================================================================
-- back to DOMAIN 4 — Ledger (needs leave_types, users; created here so the
-- ordering above is dependency-safe)
-- =============================================================================

-- APPEND-ONLY. Single source of truth. No application path may UPDATE/DELETE
-- an existing row (NFR-12-equivalent) — a correction is a new compensating
-- entry (BR-07).
CREATE TABLE leave_ledger_entries (
    ledger_entry_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id                 BIGINT NOT NULL REFERENCES users (user_id),
    leave_type_id               BIGINT NOT NULL REFERENCES leave_types (leave_type_id),
    leave_year                     SMALLINT NOT NULL,
    transaction_type                  VARCHAR(15) NOT NULL
        CHECK (transaction_type IN ('OPENING', 'ACCRUAL', 'CARRY_FORWARD', 'ADJUSTMENT',
                                     'DEBIT', 'RESTORE', 'LAPSE')),
    quantity                             NUMERIC(6,2) NOT NULL,
    source_reference                        VARCHAR(100) NULL,
    created_at                                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ledger_user_type_year ON leave_ledger_entries (user_id, leave_type_id, leave_year);

CREATE TABLE leave_balance_snapshots (
    snapshot_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id             BIGINT NOT NULL REFERENCES users (user_id),
    leave_type_id          BIGINT NOT NULL REFERENCES leave_types (leave_type_id),
    leave_year                 SMALLINT NOT NULL,
    balance                       NUMERIC(6,2) NOT NULL,
    UNIQUE (user_id, leave_type_id, leave_year)
);


-- =============================================================================
-- DOMAIN 6 — Notifications, Audit, Configuration & Scheduler
-- =============================================================================

CREATE TABLE notification_templates (
    notification_template_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    notification_type               VARCHAR(50) NOT NULL UNIQUE,
    channel                            VARCHAR(10) NOT NULL CHECK (channel IN ('IN_APP', 'EMAIL')),
    subject_template                       VARCHAR(255) NOT NULL,
    body_template                             TEXT NOT NULL,
    updated_by                                   BIGINT NULL REFERENCES users (user_id)
);

CREATE TABLE notifications (
    notification_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    recipient_user_id       BIGINT NOT NULL REFERENCES users (user_id),
    leave_request_id           BIGINT NULL REFERENCES leave_requests (leave_request_id),
    template_id                    BIGINT NOT NULL REFERENCES notification_templates (notification_template_id),
    delivery_status                    VARCHAR(10) NOT NULL DEFAULT 'PENDING'
        CHECK (delivery_status IN ('PENDING', 'SENT', 'FAILED')),
    is_read                               BOOLEAN NOT NULL DEFAULT FALSE,
    read_at                                  TIMESTAMPTZ NULL,
    created_at                                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_recipient ON notifications (recipient_user_id, is_read);

CREATE TABLE configurations (
    configuration_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    configuration_key          VARCHAR(100) NOT NULL UNIQUE,
    configuration_value            TEXT NOT NULL,
    updated_by                        BIGINT NULL REFERENCES users (user_id),
    updated_at                           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- IMMUTABLE. Append-only. No application path may update or delete a row
-- (NFR-12). Enforce with a REVOKE UPDATE/DELETE grant, or a trigger, in
-- production — not expressible as a table constraint alone.
CREATE TABLE audit_logs (
    audit_log_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_user_id          BIGINT NULL REFERENCES users (user_id),
    entity_type                VARCHAR(50) NOT NULL,
    entity_id                     BIGINT NOT NULL,
    action                            VARCHAR(50) NOT NULL,
    prior_value                          JSONB NULL,
    new_value                               JSONB NULL,
    occurred_at                                TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_system_actor                               BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_actor ON audit_logs (actor_user_id);

CREATE TABLE scheduler_executions (
    execution_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    job_name              VARCHAR(30) NOT NULL,
    execution_key            VARCHAR(150) NOT NULL UNIQUE,
    status                      VARCHAR(10) NOT NULL DEFAULT 'RUNNING'
        CHECK (status IN ('RUNNING', 'SUCCESS', 'FAILED', 'SKIPPED')),
    started_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at                      TIMESTAMPTZ NULL
);


-- =============================================================================
-- R2/R3 ADDITIONS (9 tables, on top of the 27 above = 36 total)
-- =============================================================================

-- Deactivation (LMS-016) and digest opt-in (LMS-072) as columns on users,
-- rather than their own tables — both are single-value, per-user state.
ALTER TABLE users
    ADD COLUMN last_working_day   DATE        NULL,
    ADD COLUMN deactivated_by     BIGINT      NULL REFERENCES users (user_id),
    ADD COLUMN deactivated_at     TIMESTAMPTZ NULL,
    ADD COLUMN digest_opt_in      BOOLEAN     NOT NULL DEFAULT FALSE;

-- self_approvals — audit trail of blocked self-approval / circular-authority
-- attempts, per the standing rule in Section 3.4 of the FRD.
CREATE TABLE self_approvals (
    self_approval_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    leave_request_id           BIGINT NOT NULL REFERENCES leave_requests (leave_request_id),
    approval_id                    BIGINT NULL REFERENCES leave_approvals (approval_id),
    approval_level                     SMALLINT NOT NULL,
    attempted_by_user_id                  BIGINT NOT NULL REFERENCES users (user_id),
    violation_type                            VARCHAR(30) NOT NULL
        CHECK (violation_type IN ('SELF_APPROVAL', 'CIRCULAR_AUTHORITY')),
    routed_to_user_id                                BIGINT NULL REFERENCES users (user_id),
    attempted_at                                        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_self_approvals_leave_request ON self_approvals (leave_request_id);
CREATE INDEX idx_self_approvals_user ON self_approvals (attempted_by_user_id);

-- employee_final_settlements — R2, LMS-017. A computed BALANCE POSITION only,
-- prorated to last_working_day. The FRD is explicit: "It performs no payment
-- calculation." Monetary conversion is the separate R3 leave_encashments table.
CREATE TABLE employee_final_settlements (
    settlement_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id                  BIGINT NOT NULL REFERENCES users (user_id),
    last_working_day            DATE NOT NULL,
    computed_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
    computed_by_actor                  VARCHAR(20) NOT NULL DEFAULT 'SYSTEM'
        CHECK (computed_by_actor IN ('SYSTEM', 'HR_ADMIN'))
);

CREATE INDEX idx_final_settlements_user ON employee_final_settlements (user_id);

CREATE TABLE employee_final_settlement_lines (
    settlement_line_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    settlement_id             BIGINT NOT NULL
        REFERENCES employee_final_settlements (settlement_id) ON DELETE CASCADE,
    leave_type_id                 BIGINT NOT NULL REFERENCES leave_types (leave_type_id),
    prorated_balance                  NUMERIC(6,2) NOT NULL
);

-- manager_reassignments — R2, LMS-018. transferred_request_ids is an array
-- rather than a child table since it's written once, at reassignment time.
CREATE TABLE manager_reassignments (
    reassignment_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id                          BIGINT NOT NULL REFERENCES users (user_id),
    previous_manager_id                 BIGINT NULL REFERENCES users (user_id),
    new_manager_id                          BIGINT NOT NULL REFERENCES users (user_id),
    pending_requests_transferred               BOOLEAN NOT NULL DEFAULT FALSE,
    transferred_request_ids                       BIGINT[] NULL,
    reassigned_by_user_id                                BIGINT NOT NULL REFERENCES users (user_id),
    reassigned_at                                           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- employee_import_batches — R2, LMS-019. All-or-nothing import; per-row
-- errors live in error_report JSONB rather than a child table.
CREATE TABLE employee_import_batches (
    import_batch_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    file_name                  VARCHAR(255) NOT NULL,
    row_count                      INTEGER NOT NULL,
    status                            VARCHAR(20) NOT NULL DEFAULT 'PROCESSING'
        CHECK (status IN ('PROCESSING', 'COMMITTED', 'REJECTED')),
    error_report                          JSONB NULL,
    initiated_by_user_id                      BIGINT NOT NULL REFERENCES users (user_id),
    started_at                                    TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at                                     TIMESTAMPTZ NULL
);

-- leave_encashments — R3, LMS-084. HR-initiated conversion of balance to a
-- payable record for downstream payroll. Still no salary calculation here.
CREATE TABLE leave_encashments (
    encashment_id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id                     BIGINT NOT NULL REFERENCES users (user_id),
    leave_type_id                   BIGINT NOT NULL REFERENCES leave_types (leave_type_id),
    encashed_days                       NUMERIC(6,2) NOT NULL,
    rate_per_day                            NUMERIC(10,2) NULL,
    ledger_entry_id                             BIGINT NOT NULL REFERENCES leave_ledger_entries (ledger_entry_id),
    status                                          VARCHAR(20) NOT NULL DEFAULT 'INITIATED'
        CHECK (status IN ('INITIATED', 'SENT_TO_PAYROLL')),
    initiated_by_user_id                                   BIGINT NOT NULL REFERENCES users (user_id),
    initiated_at                                               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- comp_off_requests — R3, LMS-083. Earned leave credited against approved
-- out-of-hours work; references the ledger entry it produces on approval.
CREATE TABLE comp_off_requests (
    comp_off_request_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id                     BIGINT NOT NULL REFERENCES users (user_id),
    work_date                       DATE NOT NULL,
    hours_worked                        NUMERIC(4,2) NOT NULL,
    reason                                  VARCHAR(500) NULL,
    status                                     VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    credited_days                                 NUMERIC(4,2) NULL,
    ledger_entry_id                                   BIGINT NULL REFERENCES leave_ledger_entries (ledger_entry_id),
    approved_by_user_id                                      BIGINT NULL REFERENCES users (user_id),
    approved_at                                                  TIMESTAMPTZ NULL,
    created_at                                                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comp_off_user ON comp_off_requests (user_id);

-- blackout_periods — R3, LMS-085. leave_type_ids NULL = applies to all types.
CREATE TABLE blackout_periods (
    blackout_id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    start_date                DATE NOT NULL,
    end_date                     DATE NOT NULL CHECK (end_date >= start_date),
    leave_type_ids                  BIGINT[] NULL,
    description                        VARCHAR(255) NOT NULL,
    created_by_user_id                     BIGINT NOT NULL REFERENCES users (user_id),
    created_at                                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- team_capacity_limits — R3, LMS-086.
CREATE TABLE team_capacity_limits (
    capacity_limit_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    manager_id                BIGINT NOT NULL REFERENCES users (user_id),
    max_concurrent_leave          SMALLINT NOT NULL,
    effective_from                    DATE NOT NULL,
    effective_to                         DATE NULL,
    created_by_user_id                      BIGINT NOT NULL REFERENCES users (user_id),
    created_at                                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_capacity_limits_manager ON team_capacity_limits (manager_id);


-- =============================================================================
-- Table count check
-- =============================================================================
-- Run after executing the script above:
-- SELECT count(*) FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
-- Expected: 36
