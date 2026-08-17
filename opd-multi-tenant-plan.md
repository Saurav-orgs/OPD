# OPD — Multi-Tenant Upgrade Plan

**Version:** 1.0 · **Date:** 2026-08-17
**Extends:** [opd-appointment-system-plan.md](opd-appointment-system-plan.md) (v1.1)
**Repos touched:** `backend-OPD` (major) · `admin-OPD` + `admin-app-OPD` (major) · `patient-OPD` + `patient-web-OPD` (minor)

---

## 1. Goal

Turn the single-practice OPD system into a **multi-tenant SaaS**:

- A **doctor self-registers** → that registration creates his **tenant (practice)**, with him as the **owner and only doctor**.
- The owner then creates his own **staff** (nurse, front-desk) inside his tenant.
- **Patient side keeps the same experience** — browse doctors, pick a slot, pay, upload screenshot — only now the directory is fed by doctors from many tenants.
- **Doctor side changes the most**: signup, onboarding, practice settings, team management, tenant-scoped everything.

### Confirmed decisions

1. **One doctor per tenant.** A tenant is that doctor's practice. No doctor picker anywhere in the UI; no `doctors` list screen for tenant users.
2. **No signup verification.** Doctor registers → completes the onboarding wizard → hits **Go live** → visible to patients. No email/SMS provider is introduced.
3. **No billing.** No plans, no limits, no payment integration. Tenants are unlimited.
4. **Dev database is throwaway.** The migration carries a minimal backfill so existing local DBs survive, but the seeder is reworked rather than preserved.
5. **Shared database, shared schema, `tenant_id` column** — not schema-per-tenant.
6. `users.email` stays **globally unique** — one email = one account = one tenant. No tenant picker at login, no subdomains.

### Current state (what we're changing from)

Single global namespace. `users`, `roles`, `doctors`, `opd_schedules`, `schedule_exceptions`, `appointments` have no owner. A seeded `SuperAdmin` creates doctors and users; a doctor user links to a doctor row via `users.doctor_id`; data scope is hard-coded as *"`type = doctor` ⇒ only own records"* ([appointments.service.ts:106](backend-OPD/src/appointments/appointments.service.ts:106), [dashboard.service.ts:24](backend-OPD/src/dashboard/dashboard.service.ts:24)).

---

## 2. What "one doctor per tenant" buys us

This is the single biggest simplifier, so it's worth stating what it removes:

- **No `data_scope` on roles.** Because a tenant holds exactly one doctor, *tenant scope* and *doctor scope* are the same set. Everything scopes on `tenant_id` alone. The existing hard-coded `type === doctor ⇒ own records` branches get **deleted**, not generalised.
- **No doctor selector** in schedules, appointments, or the dashboard.
- **`POST /doctors` disappears for tenant users** — the doctor row is created by registration and edited only through the existing `/doctors/me` self-service endpoints ([doctors.controller.ts:50](backend-OPD/src/doctors/doctors.controller.ts:50)).
- **The Doctors list page collapses** into the existing **Profile** page ([Profile.tsx](admin-OPD/src/pages/Profile.tsx)). Cross-tenant doctor listing survives only in the platform console.
- A **nurse** simply sees her practice's data — no special case, since there is only one doctor in it.

> If multi-doctor practices are ever needed, the re-entry point is a `roles.data_scope` column (`own | tenant`) plus a doctor filter on the scoped queries. The schema below does not block it; it just doesn't pay for it now.

---

## 3. Data model changes

### 3.1 New table — `tenants`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | string | Practice/clinic name. Defaults to `Dr. {name}'s Clinic` at signup, editable later. |
| `slug` | string unique | Public URL + QR: `/c/{slug}` |
| `owner_user_id` | uuid FK users, nullable | Set immediately after the owner user is created |
| `contact_email` / `contact_phone` | string | |
| `address` | text | |
| `logo_url` | string | S3 key |
| `timezone` | string, default `Asia/Kolkata` | Removes today's hard-coded TZ in the slot engine |
| `status` | enum `active` \| `suspended` | Platform admin can suspend; blocks login + public visibility |
| timestamps + `deleted_at` | | paranoid |

No `plan` / `max_*` columns — billing is out of scope.

### 3.2 `tenant_id` added to

`users` (nullable — NULL = platform admin), `roles`, `doctors`, `opd_schedules`, `schedule_exceptions`, `appointments`.

`permissions` stays **global** (a catalog, not data). `role_permissions` inherits tenancy through `role_id`.

> `opd_schedules` / `schedule_exceptions` / `appointments` are already reachable via `doctor_id`, but the denormalised `tenant_id` is what lets the isolation layer (§4) apply one uniform rule to every model with no joins in the guard path.

### 3.3 Constraint / index changes

| Existing | Change |
|---|---|
| `roles.name` UNIQUE | → composite UNIQUE `(tenant_id, name)`. Every tenant needs its own "Nurse" role. |
| `users.email` UNIQUE | **unchanged** (global). |
| `doctors.public_slug` UNIQUE | **unchanged** (global) — patient deep links must stay stable and unambiguous. Auto-suffix on collision (`dr-sharma-2`). |
| `schedule_exceptions (doctor_id, date)` UNIQUE | unchanged. |
| appointments partial unique `(doctor_id, date, start_time) WHERE status='confirmed'` | unchanged — the concurrency guard is still correct. |
| — | **New:** `(tenant_id, appointment_date)` on appointments, `(tenant_id)` on users/roles/doctors. |

### 3.4 Migration & backfill (one reversible migration)

1. Create `tenants`.
2. Add nullable `tenant_id` + FKs + indexes to the six tables.
3. Backfill: insert `Default Clinic` (status `active`); set `tenant_id` on all existing rows **except** `super_admin` users (stay NULL); point `owner_user_id` at the existing doctor user if one exists.
4. `SET NOT NULL` on all except `users.tenant_id`.
5. Swap `roles.name` unique → `(tenant_id, name)`.

Seeder is reworked: it seeds the **global permission catalog** and the **platform SuperAdmin** only. Tenant roles are no longer seeded — they are created per-tenant at registration (§5).

---

## 4. Isolation enforcement (the part that must not be sloppy)

Three layers; the middle one is the one that actually saves us.

1. **`TenantContext`** — an `AsyncLocalStorage` store populated by an interceptor right after `JwtAuthGuard`, holding `{ tenantId, isPlatform }`. Reachable from non-request-scoped services with no constructor plumbing.
2. **Sequelize hooks on tenant-owned models** — `beforeFind`, `beforeCreate`, `beforeBulkCreate`, `beforeBulkUpdate`, `beforeBulkDestroy` inject `tenant_id` from the context into the `where`/`values`. Escaping requires an **explicit** `{ crossTenant: true }` opt-out, used only by the public controller, the platform console and the seeder. This is the difference between "we remembered `tenant_id` at 47 query sites" and "it is structurally impossible to forget".
3. **`TenantGuard`** — runs after auth: 403 `TENANT_SUSPENDED` if the tenant isn't active; 401 if a non-platform token carries no tenant. Cross-tenant `:id` access needs no special handling — the hooks turn it into a plain 404.

**Tests (non-negotiable):** an isolation suite asserting that, for every tenant-owned resource, tenant A's token gets 404/403 against tenant B's `id` on read/update/delete/list — plus a static test that every tenant-owned model is registered with the hook.

### Auth changes

- JWT payload gains `tid`. `AuthUser` gains `tenantId` and `isPlatform`; the `doctorId` field stays (still how `/doctors/me` resolves).
- `JwtStrategy.validate` additionally re-hydrates tenant status and rejects suspended/deleted tenants.
- Platform-admin impersonation via an `X-Tenant-Id` header, honoured **only** for `super_admin` and logged.

### New error codes

`TENANT_SUSPENDED`, `TENANT_NOT_FOUND`, `EMAIL_TAKEN`, `SLUG_TAKEN`, `SIGNUP_DISABLED`, `ONBOARDING_INCOMPLETE`.

---

## 5. Registration & onboarding (new)

### `POST /auth/register` — public, throttled (3/hour/IP)

Body: `doctor_name, email, password, mobile, specialization?, clinic_name?`

One transaction:
1. `tenants` row — `status = active`, `name = clinic_name ?? "Dr. {doctor_name}'s Clinic"`, unique slug derived from the name.
2. **Seed this tenant's roles from code templates** — `Owner` (all modules CRUD, `is_system`) and `Nurse / Front desk` (appointments read+update, schedules read, dashboard read). Templates live in code so new tenants automatically pick up newly added modules.
3. `doctors` row — `is_enabled = false`, so the practice is invisible to patients until onboarding finishes.
4. `users` row — `type = doctor`, role `Owner`, `doctor_id` linked; set `tenants.owner_user_id`.
5. Issue a JWT — the doctor lands straight in the onboarding wizard.

Config flag `TENANT_SELF_SIGNUP_ENABLED` (default on) so signup can be closed without a deploy.

### Onboarding wizard (admin web + admin app)

Post-signup, shown until complete: **Profile & photo → Consultation fee → Payment QR → OPD schedule (split sessions) → Review & Go live** (flips `is_enabled = true`). A completion checklist sits on the dashboard until every step is done, and **Go live** refuses with `ONBOARDING_INCOMPLETE` if the QR or schedule is missing — that missing-QR state is exactly what produces broken bookings today.

`GET /tenant/onboarding` returns the checklist so both clients render the same gate.

---

## 6. Backend module changes

| Module | Change |
|---|---|
| `auth` | `POST /auth/register`, tenant in JWT, `TenantGuard`, suspended-tenant rejection. |
| **`tenants` (new)** | `GET/PATCH /tenant` (practice settings, logo upload), `GET /tenant/onboarding`, `POST /tenant/go-live`. |
| **`platform` (new)** | `@PlatformOnly()`: `GET /platform/tenants`, tenant detail, suspend/reactivate, cross-tenant metrics. |
| `users` | Scoped to tenant; a tenant user can never create `super_admin`; the assigned role must belong to the same tenant. |
| `roles` | Tenant-scoped; the per-tenant `Owner` template is read-only, `Nurse` is editable; permission catalog stays global. |
| `doctors` | **`POST /doctors`, `GET /doctors`, `DELETE /doctors/:id` become platform-only.** Tenant users keep only `/doctors/me` (+ `me/qr`, `me/photo`). `listEnabled`/`findEnabledBySlug` gain a **tenant `status = active`** filter. S3 keys become `HRMSMVP/opd/tenants/{tenantId}/…`. |
| `opd-schedules` | Scoped; the `/doctors/:id/schedules` routes resolve `:id` to the tenant's own doctor (or accept `me`). |
| `slots` | Reads timezone from the tenant instead of the hard-coded `Asia/Kolkata`. |
| `appointments` | Scoped on `tenant_id`; **delete** the `type === doctor` scope branch. |
| `dashboard` | Same — scope on `tenant_id`, drop the doctor branch and the now-meaningless `byDoctor` breakdown. |
| `public` | Tenant-active filter, `clinic { name, slug, logo, address }` on doctor payloads, new `GET /public/clinics/:slug`. |

---

## 7. Frontend changes

### `admin-OPD` (React) — the bulk of the UI work

- **New:** `/signup` (doctor name, email, password, mobile, optional practice name) and the **onboarding wizard**.
- **New:** **Practice Settings** page — name, logo, address, contacts, timezone, public link + QR to share with patients.
- **Doctors page removed** for tenant users; **Profile** ([Profile.tsx](admin-OPD/src/pages/Profile.tsx)) becomes the single doctor screen. Schedule page drops its doctor param and edits "my schedule".
- **Team** — the existing Users page, relabelled, restricted to tenant roles, with an "Add nurse / front-desk" preset.
- **Roles** — per-tenant matrix; `Owner` read-only.
- **Sidebar** ([nav.ts](admin-OPD/src/lib/nav.ts)) — drop Doctors, add Practice Settings; platform entries render only for `super_admin`.
- **Platform console** (super-admin only): tenants list, suspend/reactivate, drill-down. Separate route group in the same app.
- Login screen gains "Register your practice"; suspended-tenant error state.

### `admin-app-OPD` (Flutter) — parity

Signup, onboarding wizard, practice settings, team, profile-instead-of-doctors, schedule without the doctor picker. **Platform console stays web-only** — low usage, high screen cost.

### `patient-OPD` (Flutter) + `patient-web-OPD` (React) — small

- Doctor card/detail shows the **practice name** (logo + address on detail). No flow changes.
- Optional clinic landing route `/c/:slug` on the patient web, for practice-specific QR codes.
- No auth, no tenant selection — the directory stays one global list, exactly as today.

---

## 8. Phasing

| Phase | Scope | Rough size |
|---|---|---|
| **A** | `tenants` table, `tenant_id` migration + backfill, models, seeder rework | 1 d |
| **B** | TenantContext + hooks + guard + **isolation test suite**, tenant in JWT | 2–3 d |
| **C** | Refactor users/roles/doctors/schedules/appointments/dashboard to tenant scope; delete the `type === doctor` branches | 1–2 d |
| **D** | Registration + role templates + onboarding/go-live API | 1–2 d |
| **E** | Platform console API + super-admin screens | 1–2 d |
| **F** | `admin-OPD`: signup, wizard, practice settings, team, sidebar, Doctors→Profile collapse | 3 d |
| **G** | `admin-app-OPD` parity | 2–3 d |
| **H** | Public API tenant filter + practice display in patient app/web | 1 d |
| **I** | Hardening: rate limits, S3 prefixes, Swagger, README, docs | 1 d |

**A → B → C must land together.** Shipping the tenant-scoped refactor without the enforcement layer is how tenants leak into each other.

---

## 9. Remaining assumptions (flag if wrong)

1. **One email = one account.** The same person cannot own a practice and also be a nurse elsewhere. Changing this requires a tenant picker at login.
2. **A doctor belongs to exactly one practice.**
3. **Patient directory is global** — every active practice's doctor appears in one list, matching "patient side we will show same". The `/c/{slug}` route is an *additional* entry point, not a replacement.
4. **Suspension is manual**, done by the platform SuperAdmin. No automated inactivity or trial expiry.
5. **Password reset is out of scope** here — it doesn't exist today and needs the mailer we're deliberately not adding. Worth queuing as a follow-up, since self-serve signup makes "I forgot my password" a real support load.
