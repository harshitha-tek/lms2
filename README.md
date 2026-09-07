# LMS 2.0 — Leave Management System

A reference MVC implementation of the LMS 2.0 FRD (v2.0). Node.js + Express +
EJS + SQLite, with a glass-UI, mobile-responsive front end and role-derived
navigation for Employee, Manager, and HR/Admin.

## Quick start

Requires **Node.js 22.5 or newer** (check with `node -v`). This app uses
Node's built-in `node:sqlite` driver specifically so there's **no native
module to compile** — no Visual Studio Build Tools, no Xcode Command Line
Tools, no node-gyp. `npm install` should be quick and clean on any OS.

```bash
npm install
cp .env.example .env
npm start
```

Open **http://localhost:3000**. On first run the app creates `database/lms.sqlite`
from `database/schema.sql` + `database/seed.sql` automatically — no manual DB
setup needed. You'll see one harmless line in the console:
`ExperimentalWarning: SQLite is an experimental feature` — that's Node telling
you `node:sqlite` is newer API, not an error; the app works fine.

If `node -v` shows anything below 22.5, upgrade Node first — see
[nodejs.org](https://nodejs.org).

You'll land on a **dev-mode sign-in screen** listing three seeded demo users:

| Name | Role | Notes |
|---|---|---|
| Priya Nair | HR/Admin | Also manages Arjun (so sees the Manager nav too) |
| Arjun Rao | Manager | Manages Sara and Dev |
| Sara Kapoor / Dev Iyer | Employee | Reports to Arjun |

Pick one and you're in. No password, because there isn't one — see **Auth modes** below.

## Why SQLite for the demo

The schema was originally designed for PostgreSQL/MySQL — `database/schema.postgres.sql`
and `database/schema.mysql.sql` are included for reference/production use.
This build ships `database/schema.sql` in SQLite dialect, read through Node's
**built-in** `node:sqlite` driver (`database/db.js`), specifically so the zip
runs standalone with zero external services and zero native compilation.
Swapping to Postgres/MySQL in production means: point `database/db.js` at a
real client (`pg` or `mysql2`) instead, and run the matching dialect schema
file. The application code above the DB layer (models/controllers) doesn't
change — every query goes through the model layer in `src/models/`, all
written against a small, deliberately better-sqlite3-shaped interface
(`db.prepare(sql).run/get/all`, `db.exec`, `db.transaction`) so `database/db.js`
is the only file that would need to change.

Sessions use express-session's in-memory store — fine for this single-process
demo, but it means sessions reset if you restart the server, and it won't
work correctly across multiple instances. Swap in a real store (Redis,
a database-backed one, etc.) for anything beyond local use.

## Auth modes (Entra ID)

This build supports two modes via `AUTH_MODE` in `.env`:

- **`dev`** (default) — a "pick a seeded user" screen, no Entra call at all.
  This mirrors FRD requirement **LMS-006**: a dev/test auth mode that must be
  off by default and impossible to enable in a deployed environment. The app
  **refuses to start** if `AUTH_MODE=dev` and `NODE_ENV=production` at the
  same time (see `src/config/env.js`).
- **`entra`** — real Microsoft Entra ID sign-in via OpenID Connect
  (`src/services/entraAuthService.js`, using `openid-client`). To use it:
  1. Register an app in Entra ID / Azure AD.
  2. Add a **Web** redirect URI: `{APP_BASE_URL}/auth/callback`.
  3. Set `AUTH_MODE=entra`, `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`,
     `ENTRA_CLIENT_SECRET`, and `APP_BASE_URL` in `.env`.
  4. Every employee who signs in needs a matching row in `users.entra_object_id`
     — per LMS-003/LMS-004, Entra supplies identity claims only; reporting
     hierarchy, department, and grade always live in this system's database,
     created by HR/Admin under **Employees**.

I don't have your tenant's real credentials, so this build ships in `dev`
mode. The Entra code path is real and wired, just untested against a live
tenant — swap the mode and fill in the four variables above to go live.

## Architecture (MVC)

```
src/
  app.js                 — Express bootstrap, session, cron scheduler
  config/env.js          — environment config + the LMS-006 production guard
  models/                — one file per subsystem's data access (raw SQL, no ORM)
  services/               — business logic that doesn't belong in a controller:
                              leaveCalculationService  (Subsystem 4)
                              approvalRoutingService   (Subsystems 6, self-approval rule)
                              schedulerService          (Subsystem 15)
                              entraAuthService           (Subsystem 1)
  controllers/            — one per screen group (auth, leave, approval, manager, admin…)
  routes/                 — thin route -> controller wiring, grouped by role
  views/                  — EJS templates: partials (header/sidebar/footer) + per-role folders
  public/css/main.css     — the ONE stylesheet every screen uses (glass UI, CSS variables)
  public/js/main.js       — mobile nav toggle + the Apply screen's live calculation panel
database/
  schema.sql, seed.sql, db.js
```

## What's implemented vs. scaffolded

**Fully working:** sign-in (dev + Entra code path), dashboard with real
ledger-derived balances, apply-for-leave with live day calculation
(weekend/holiday exclusion, half-days, overlap blocking, backdating window,
advance-leave warning), my requests, request detail with approval timeline,
manager approval queue (approve/reject, long-leave routing to HR, self-approval
blocking), cancellation request/approve/reject with partial restoration,
watchers (project-lead + standing, auto-added on submit), team/peer calendar
(with the Sick-leave masking and peer leave-type withholding actually enforced
at the query layer, not just hidden in the UI), holiday calendar (view +
admin CRUD), notifications centre, HR/Admin employee creation, leave type &
policy configuration, org configuration editor, manual balance adjustment
with full ledger view, LOP and leave-taken reports, audit log viewer, and a
scheduler (accrual / SLA escalation / LOP conversion) that runs nightly via
cron and idempotently — plus a manual "Run now" button for demos.

**Present in the schema, minimal/no UI (R2/R3 roadmap items per the FRD):**
working patterns, employee deactivation & final settlement position, manager
reassignment, bulk import, leave encashment, comp-off, blackout periods, team
capacity limits. The 36 tables are all there; building full screens for every
R2/R3 feature was out of scope for this pass — say the word if you want any
of them built out next.

**Not wired (would need real external services):** Exchange Online SMTP
(every notification is written to the in-app centre and logged to the
console instead — see `notificationModel.js`); this is per the FRD's own
rule that notification delivery must never block the business transaction.

## Roles & navigation

Navigation is role-derived, matching FRD §7.2: Employee sees Dashboard ·
Apply · My Requests · Team Calendar · Holidays · My Profile · Notifications.
A Manager (derived from having a direct report, never explicitly assigned)
additionally sees Approvals · My Team · Delegation. HR/Admin additionally
sees the Administration section. On screens under 900px the sidebar becomes
a slide-out drawer and a bottom tab bar takes over with the highest-frequency
destinations for the role, per the FRD's mobile-first requirement for the
approvals flow.
