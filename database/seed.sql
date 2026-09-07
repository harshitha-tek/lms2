-- Organisation lookups
INSERT INTO departments (department_code, department_name) VALUES
 ('ENG','Engineering'), ('SALES','Sales'), ('HR','Human Resources');

INSERT INTO grades (grade_code, grade_name) VALUES
 ('G1','Associate'), ('G2','Senior'), ('G3','Lead / Manager'), ('G4','Director');

INSERT INTO management_levels (level_code, level_name, level_rank) VALUES
 ('IC','Individual Contributor',1), ('MGR','Manager',2), ('DIR','Director',3);

INSERT INTO roles (role_code, role_name) VALUES
 ('EMPLOYEE','Employee'), ('MANAGER','Manager'), ('HR_ADMIN','HR / Admin');

-- Demo users (entra_object_id is a stand-in GUID; real deployments get this from Entra ID claims)
INSERT INTO users (employee_code, entra_object_id, email, full_name, department_id, grade_id, management_level_id, manager_id, joined_date, is_active) VALUES
 ('EMP-1001','11111111-1111-1111-1111-111111111111','priya.admin@example.com','Priya Nair', 3, 4, 3, NULL, '2021-01-10', 1),
 ('EMP-1002','22222222-2222-2222-2222-222222222222','arjun.manager@example.com','Arjun Rao', 1, 3, 2, 1, '2021-06-01', 1),
 ('EMP-1003','33333333-3333-3333-3333-333333333333','sara.employee@example.com','Sara Kapoor', 1, 1, 1, 2, '2023-02-14', 1),
 ('EMP-1004','44444444-4444-4444-4444-444444444444','dev.employee@example.com','Dev Iyer', 1, 1, 1, 2, '2022-08-01', 1);

INSERT INTO user_roles (user_id, role_id) VALUES
 (1,3), (1,1),   -- Priya: HR/Admin (+ implicit Employee)
 (2,2), (2,1),   -- Arjun: Manager (+ Employee) - derived from having reports
 (3,1),          -- Sara: Employee
 (4,1);          -- Dev: Employee

-- Leave types
INSERT INTO leave_types (leave_code, leave_name, is_sick_leave, allows_attachment, allows_half_day, is_balance_affecting, is_employee_selectable, is_system_managed, carry_forward_allowed, carry_forward_cap) VALUES
 ('AL','Annual Leave', 0, 0, 1, 1, 1, 0, 1, 5),
 ('SL','Sick Leave', 1, 1, 1, 1, 1, 0, 0, NULL),
 ('LOP','Loss of Pay', 0, 0, 0, 0, 0, 1, 0, NULL);

INSERT INTO leave_policies (leave_type_id, grade_id, entitlement_days, accrual_frequency, accrual_posting_day, effective_from) VALUES
 (1,1,18,'MONTHLY',1,'2025-04-01'), (1,2,20,'MONTHLY',1,'2025-04-01'),
 (1,3,22,'MONTHLY',1,'2025-04-01'), (1,4,24,'MONTHLY',1,'2025-04-01'),
 (2,1,10,'ANNUAL',1,'2025-04-01'), (2,2,10,'ANNUAL',1,'2025-04-01'),
 (2,3,10,'ANNUAL',1,'2025-04-01'), (2,4,10,'ANNUAL',1,'2025-04-01');

-- Opening ledger balances for the current leave year (2026)
INSERT INTO leave_ledger_entries (user_id, leave_type_id, leave_year, transaction_type, quantity, source_reference) VALUES
 (2,1,2026,'OPENING',20,'seed'), (2,2,2026,'OPENING',10,'seed'),
 (3,1,2026,'OPENING',12,'seed'), (3,2,2026,'OPENING',10,'seed'),
 (4,1,2026,'OPENING',18,'seed'), (4,2,2026,'OPENING',10,'seed');

-- Holidays (current leave year)
INSERT INTO holidays (holiday_date, holiday_name) VALUES
 ('2026-01-26','Republic Day'), ('2026-08-15','Independence Day'),
 ('2026-10-02','Gandhi Jayanti'), ('2026-12-25','Christmas Day');

-- Core configuration values (LMS-020 to LMS-031)
INSERT INTO configurations (configuration_key, configuration_value, updated_by) VALUES
 ('leave_year_start','04-01', 1),
 ('weekend_days','6,0', 1),
 ('count_weekends_within_leave','false', 1),
 ('count_holidays_within_leave','false', 1),
 ('timezone','Asia/Kolkata', 1),
 ('sla_period_days','3', 1),
 ('backdating_window_days','30', 1),
 ('sick_alert_threshold_days','3', 1),
 ('sick_alert_supervisor_enabled','true', 1),
 ('sick_alert_hr_enabled','true', 1),
 ('long_leave_threshold_days','10', 1),
 ('advance_leave_withdrawal_window_days','7', 1);

-- Notification templates
INSERT INTO notification_templates (notification_type, channel, subject_template, body_template) VALUES
 ('REQUEST_SUBMITTED','IN_APP','Leave request submitted','Your request {{request_number}} for {{days}} day(s) has been submitted.'),
 ('REQUEST_APPROVED','IN_APP','Leave request approved','Your request {{request_number}} has been approved.'),
 ('REQUEST_REJECTED','IN_APP','Leave request rejected','Your request {{request_number}} was rejected: {{reason}}'),
 ('NEW_REQUEST_FOR_APPROVAL','IN_APP','New request awaiting your decision','{{employee_name}} submitted a request awaiting your approval.'),
 ('CANCELLATION_REQUESTED','IN_APP','Cancellation requested','{{employee_name}} requested cancellation of {{request_number}}.');
