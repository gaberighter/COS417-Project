# CovClasses

CovClasses is a Nuxt 4 scheduling application for Covenant College. It combines:

- a faculty-facing preference intake workflow
- an admin-facing schedule generation and review workflow
- MongoDB-backed CRUD management for rooms, professors, and course catalog data
- an internal scheduling engine that produces assignments, conflicts, warnings, and placement traces
- audit logging for state-changing actions

This README is intentionally comprehensive. It is meant to help a new developer, project maintainer, or admin operator understand how to run the app, how the main workflows fit together, and where the important pieces live in the codebase.

## Table of Contents

- [What This Project Does](#what-this-project-does)
- [Tech Stack](#tech-stack)
- [Repository Layout](#repository-layout)
- [Core Domain Model](#core-domain-model)
- [Main User Flows](#main-user-flows)
- [Getting Started](#getting-started)
- [Environment Configuration](#environment-configuration)
- [Authentication Notes](#authentication-notes)
- [Seeding Data](#seeding-data)
- [Running the App](#running-the-app)
- [Available npm Scripts](#available-npm-scripts)
- [Page and Route Guide](#page-and-route-guide)
- [API Guide](#api-guide)
- [Scheduling Engine Guide](#scheduling-engine-guide)
- [Testing and Validation](#testing-and-validation)
- [Exports and Data Formats](#exports-and-data-formats)
- [Operational Notes](#operational-notes)
- [Troubleshooting](#troubleshooting)
- [Known Caveats](#known-caveats)

## What This Project Does

At a high level, the application supports the academic scheduling process in four stages:

1. Faculty submit course preferences for a term.
2. Admins maintain the room inventory, professor roster, and course catalog.
3. Admins run the scheduling engine to generate draft schedules for a term.
4. Admins review, edit, approve, and export a saved schedule version.

Important behavior to know:

- Preferences are stored inside professor documents as embedded submissions.
- Schedule runs are versioned by term and run number.
- Approved or exported schedules are locked until reopened.
- Exporting a schedule marks its status as `exported`.
- The scheduler returns both hard conflicts and "near-hard" warnings for operator review.
- The scheduler also stores placement traces so admins can inspect why a class was assigned or rejected.

## Tech Stack

- Frontend: Nuxt 4, Vue 3, PrimeVue, Pinia
- Backend: Nuxt server routes / Nitro
- Database: MongoDB via Mongoose
- Auth/session: `nuxt-auth-utils` plus custom SAML middleware
- File export: CSV and Excel via `xlsx`
- Validation: Zod is installed, but much of the current payload validation is handwritten in API utilities

## Repository Layout

This README is for `Project/COS417-Project`, which is the main app.

```text
COS417/
|- Project/
|  |- COS417-Project/           # Main Nuxt app
|  |  |- app/                   # Vue pages, components, composables, styles
|  |  |- server/                # API routes, middleware, models, scheduling services
|  |  |- scripts/               # Seed and utility scripts
|  |  |- shared/                # Shared config and academic term helpers
|  |  |- types/                 # Shared TS types
|  |  |- README.md              # This file
|  |
|  |- local-tests/              # Scheduler harnesses and generated reports
|
|- scheduling/                  # Standalone/legacy scheduler mirror and playground
```

Important directories inside the app:

- `app/pages/`: role-based admin and faculty pages
- `app/composables/`: client-side data loaders and page helpers
- `server/api/`: REST-style endpoints
- `server/models/index.ts`: primary Mongoose schemas and collection contracts
- `server/services/scheduling/`: scheduling engine, persistence helpers, export logic
- `server/middleware/saml.ts`: SAML login/assert/logout flow and API protection
- `scripts/seed-mongo.mjs`: local seed utility for MongoDB

## Core Domain Model

The application revolves around five main collections.

### Rooms

Stored in the `rooms` collection.

- `_id` and `abbreviation` are effectively the room code, like `SN 201`
- rooms include capacity, room type, availability, and equipment flags
- room type is either `classroom` or `lab`

### Course Catalog

Stored in `courseCatalog`.

- `_id` is derived from `deptCode + courseNumber`, like `COS 243`
- includes credit hours, historical defaults, equipment needs, and prerequisite/corequisite metadata

### Professors

Stored in `professors`.

- `_id` is the lowercased Covenant ID
- includes department, office info, active flag, and embedded `preferences`

### Preference Submissions

Embedded under professor documents.

- each submission belongs to a `term`
- status is `not_submitted` or `submitted`
- each submitted course row can include:
  - expected enrollment
  - preferred meeting days/times
  - avoided times
  - preferred building/room
  - instructor name
  - CRN
  - course fee
  - back-to-back and corequisite hints

One subtle but important behavior: the app treats faculty submissions as department-level planning data. In practice, a term/department submission may be stored on one professor record and then read back as the department's submission.

### Schedules

Stored in `schedules`.

- `_id` is `term-runNumber`
- status is one of:
  - `draft`
  - `under_review`
  - `approved`
  - `exported`
- contains:
  - `assignments`
  - `conflicts`
  - `warnings`
  - `nearHardFlags`
  - `traces`
  - approval metadata

### Audit Logs

Stored in `auditLogs`.

- append-only by design
- update/delete operations are blocked at the schema layer
- used for auth events and domain mutations like room upserts, preference updates, schedule approval, and export

## Main User Flows

### Faculty workflow

1. Sign in.
2. Open `Faculty Dashboard`.
3. Open `Faculty Preferences`.
4. Select a term such as `Fall-2026`.
5. Add or import rows.
6. Save as draft (`not_submitted`) or submit (`submitted`).

Notable faculty features:

- autocomplete against courses, professors, and rooms
- CSV upload
- duplicate/delete row controls
- validation before save
- "new information detected" confirmation when a submission references new courses, rooms, buildings, or instructors

### Admin workflow

1. Sign in.
2. Open `Admin Dashboard`.
3. Maintain rooms, professors, course catalog, and preference data as needed.
4. Open `Create New Schedule`.
5. Load a term.
6. Run the scheduler.
7. Save the result as a versioned run.
8. Open the saved run in the editor.
9. Review conflicts, near-hard flags, and traces.
10. Manually edit assignments if necessary.
11. Approve the schedule.
12. Export CSV or Excel.

### Schedule lifecycle

The current UI uses this practical lifecycle:

- run scheduler -> receive unsaved result
- save result -> stored as `draft` if clean, otherwise `under_review`
- manual review/edit -> remains editable while `draft` or `under_review`
- approve -> becomes locked
- export -> becomes `exported`
- reopen -> returns to `under_review` so edits can be made again

## Getting Started

### Prerequisites

- Node.js current LTS
- npm
- MongoDB instance reachable by the app

### Initial setup

```bash
npm install
```

Create a local `.env` file in `Project/COS417-Project/`.

Minimum working database config:

```env
MONGO_URI=mongodb://localhost:27017/cos417-project
```

If you want a predictable local dataset, seed one:

```bash
npm run seed:minimal
```

Then start the app:

```bash
npm run dev
```

## Environment Configuration

The committed `.env.example` currently only includes `MONGO_URI`. In reality, the app may also need SAML-related settings in environments that use real login.

### MongoDB variables

- `MONGO_URI`
  - required
  - must start with `mongodb://` or `mongodb+srv://`
- `MONGO_DB_NAME`
- `MONGODB_DB_NAME`
- `MONGO_DB`

Database name resolution works like this:

1. use the database name embedded in `MONGO_URI` if present
2. otherwise use `MONGO_DB_NAME`, `MONGODB_DB_NAME`, or `MONGO_DB`
3. otherwise fall back to `COS417`

### SAML variables

Used by `server/middleware/saml.ts`.

- `SAML_ASSERT_ENDPOINT`
- `SAML_LOGIN_URL`
- `SAML_LOGOUT_URL`
- `SAML_ENTITY_ID`
- `SAML_PRIVATE_KEY_PATH`
- `SAML_PUBLIC_CERT_PATH`
- `SAML_CERT`
- `SAML_REDIRECT_TO`
- `SAML_DEBUG_ATTRIBUTES`

Default file fallbacks expected by the middleware:

- SP private key: `wildcard_covenant_edu.key`
- SP public certificate: `wildcard_covenant_edu.pem`
- IdP certificate: `microsoft_saml.cer`

Only `microsoft_saml.cer` is present in the repository today. The wildcard key/cert pair is expected to be supplied separately.

## Authentication Notes

There are two important auth layers in the current codebase:

### 1. SAML + session flow

The real app path is:

- `/saml/login`
- `/saml/assert`
- session creation through `nuxt-auth-utils`
- protected API access through `server/middleware/saml.ts`

### 2. Route-level role guard helper

API handlers also call `requireAuth(...)`, which contains a dev fallback for:

- `x-dev-role`
- `x-dev-user`

However, this is not a full front-end bypass, because the SAML middleware still protects `/api/*` by requiring a session. In other words:

- the helper still contains a dev shim
- the app as a whole still expects real session auth for browser-based use

### UI auth caveat

`app/middleware/auth.global.ts` has its redirect logic commented out. That means unauthenticated users are not automatically redirected away from pages, but API requests are still protected server-side. The visible effect is that pages may load shell UI and then fail when data calls begin.

## Seeding Data

Two supported seed modes exist.

### Minimal local seed

```bash
npm run seed:minimal
```

This loads a very small dataset intended for basic local testing:

- a couple of rooms
- a couple of COS courses
- a couple of professors
- example preference submissions

### Large seed from JSON export

```bash
npm run seed:inmemory
```

This script runs:

```bash
node scripts/seed-mongo.mjs --inmemory-file ./inmemory-export.json --wipe
```

Notes:

- the referenced `inmemory-export.json` is not in this app folder by default
- the sibling `Project/local-tests/seed.json` is the obvious large local dataset in this workspace
- the seed script can load any compatible JSON file if you provide the path manually

Example manual invocation:

```bash
node scripts/seed-mongo.mjs --inmemory-file ../local-tests/seed.json --wipe
```

The seed script normalizes and upserts:

- rooms
- courses
- professors
- schedules
- audit logs

## Running the App

### Development server

```bash
npm run dev
```

### Production build

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

### Static generation

```bash
npm run generate
```

Because the app is server-backed and auth-dependent, static generation is not the normal deployment mode for the full application.

## Available npm Scripts

Current scripts from `package.json`:

- `npm run dev` - start Nuxt dev server
- `npm run build` - build for production
- `npm run preview` - preview production build
- `npm run generate` - static generate
- `npm run typecheck` - Nuxt typecheck
- `npm run lint` - Prettier check, not ESLint
- `npm run contrast:check` - validate the configured color palettes for contrast
- `npm run seed:minimal` - seed a minimal local dataset
- `npm run seed:inmemory` - seed from a provided JSON export path in the script
- `npm run migrate:department-code` - currently points to a script file that is not present

## Page and Route Guide

### Public/auth pages

- `/` -> immediate redirect to `/auth/login`
- `/auth/login` -> SAML login page

### Faculty pages

- `/faculty/faculty_dashboard`
- `/faculty/preferences`

### Admin pages

- `/admin/admin_dashboard`
- `/admin/schedule_run`
- `/admin/schedule_viewer`
- `/admin/room_viewer`
- `/admin/professor_viewer`
- `/admin/course_catalog_viewer`
- `/admin/preference_viewer`
- `/admin/audit_log_viewer`

### What each admin screen is for

- `schedule_run`: generate a schedule, inspect conflicts/flags/traces, save versions, approve, reopen, export
- `schedule_viewer`: browse saved runs by term, filter results, edit individual assignments, approve/reopen/export
- `room_viewer`: manage room inventory
- `professor_viewer`: manage professor records
- `course_catalog_viewer`: manage course catalog records
- `preference_viewer`: review submitted preference data
- `audit_log_viewer`: inspect audit history

## API Guide

The server API is file-based under `server/api/`.

Term strings are commonly validated against:

```text
/^[A-Za-z0-9_-]{1,32}$/
```

Examples that fit the current UI conventions:

- `Fall-2026`
- `Spring2027`
- `2026_Fall`

### Auth endpoints

- `GET /saml/login` - begin login
- `GET|POST /saml/assert` - ACS/assert endpoint
- `GET /saml/logout` - begin logout
- `GET /saml/manifest.xml` - service provider metadata

### Rooms

- `GET /api/rooms` - list rooms
- `POST /api/rooms` - create or upsert a room
- `PATCH /api/rooms/:id` - update room
- `DELETE /api/rooms/:id` - delete room

Room POST/PATCH supports equipment flags such as:

- `projector`
- `smartboard`
- `whiteboard`
- `piano`
- `labStations`
- `computers`
- `outlets`

### Professors

- `GET /api/professors` - list professors
- `POST /api/professors` - create or bulk upsert professors
- `PATCH /api/professors/:id` - update professor
- `DELETE /api/professors/:id` - delete professor

### Courses

- `GET /api/courses` - list courses
- `POST /api/courses` - create or bulk upsert courses
- `PATCH /api/courses/:id` - update course
- `DELETE /api/courses/:id` - delete course

### Preferences

- `POST /api/preferences` - create/replace a term submission
- `GET /api/preferences/:term` - read preferences for a term
- `PATCH /api/preferences/:term` - update mutable preference fields
- `DELETE /api/preferences/:term` - delete a term submission

Important preference behavior:

- faculty requests read back the department submission relevant to the logged-in faculty member
- admin requests can retrieve all submissions for the term
- saving preferences can auto-create missing course catalog entries via `ensurePreferenceCoursesExist`

### Schedules

- `GET /api/schedule` - list schedule summaries across terms
- `POST /api/schedule` - save one or more schedule records
- `POST /api/schedule/run` - run the scheduler without persisting
- `GET /api/schedule/terms` - combine known terms from preferences and saved runs
- `GET /api/schedule/:term` - get latest schedule for a term
- `PATCH /api/schedule/:term` - update a saved schedule
- `DELETE /api/schedule/:term` - delete a saved run, optionally by `runNumber`
- `GET /api/schedule/:term/all` - get all saved runs for one term
- `GET /api/schedule/:term/template` - get a PATCH-ready template/example payload
- `GET /api/schedule/:term/export?runNumber=...&format=csv|xlsx` - export approved schedule
- `PATCH /api/schedule/:term/assignment` - manually override a single assignment

Key schedule rules enforced by the API:

- only admins can mutate schedules
- approved/exported schedules are locked
- locked schedules must be reopened before edits
- export requires an approved or already-exported schedule
- exporting marks the run as `exported`
- manual assignment edits force the schedule back to `under_review`

### Audit logs

- `GET /api/audit-logs` - list recent audit logs
- `POST /api/audit-logs` - append audit log entries

`GET /api/audit-logs` defaults to 500 rows and caps at 2000.

## Scheduling Engine Guide

The active scheduling implementation lives under:

```text
server/services/scheduling/
```

### Main phases

- `phase1-collect.ts` - gather rooms, courses, professors, preferences, and history
- `phase2-generate.ts` - sort work items by difficulty
- `phase3-constrain.ts` - apply hard constraints and generate candidates
- `phase4-optimize.ts` - score/rank candidate placements
- `phase5-output.ts` - legacy standalone persistence path in the sibling scheduler copy

### What the runtime returns

A schedule run produces:

- `assignments`
- `conflicts`
- `nearHardFlags`
- `warnings`
- `traces`

### High-level scheduling behavior

The engine currently:

1. collects term-specific inputs
2. orders work items by difficulty
3. repeatedly assigns classes that have only one valid candidate
4. ranks remaining candidates for harder cases
5. records hard conflicts when no valid placement remains
6. records near-hard flags for risky-but-allowed outcomes
7. records trace output so the UI can explain what happened

### Important scoring/configuration source

`server/services/scheduling/config.ts` contains:

- department-typical rooms
- guarded rooms that should only be used with stronger evidence
- weight constants for historical and preference-based scoring
- typical start times by day pattern

### Trace output

Trace rows are one of the most useful operator tools in this codebase. Each trace can describe:

- whether the course was assigned or conflicted
- which stage produced the result
- what candidate rooms/slots were considered
- which fallback tier was selected
- the chosen placement
- a decision log of how the engine narrowed the options

### Standalone scheduler copy

There is also a sibling `../../scheduling/` directory that mirrors much of the scheduling logic. Treat the server-side copy as the main application implementation. The sibling copy looks like a standalone or legacy playground and may drift over time.

## Testing and Validation

### Built-in project checks

```bash
npm run typecheck
npm run contrast:check
npm run build
```

### Local scheduler harnesses

Sibling test utilities live in `Project/local-tests/`:

- `scheduling-algorithm.harness.ts`
- `scheduling-load-test.ts`
- `scheduling-spreadsheet-report.ts`

These are not wired into `package.json`, but they are valuable for manual validation. They appear intended to be run with a TypeScript runner such as `tsx`.

Examples:

```bash
npx tsx ../local-tests/scheduling-algorithm.harness.ts
npx tsx ../local-tests/scheduling-load-test.ts
npx tsx ../local-tests/scheduling-spreadsheet-report.ts
```

What they do:

- `scheduling-algorithm.harness.ts`
  - scenario-based correctness checks
  - validates expected conflict/assignment behavior
- `scheduling-load-test.ts`
  - synthetic throughput test using 20 rooms and 200 classes
- `scheduling-spreadsheet-report.ts`
  - generates an Excel workbook summarizing scenario coverage and outputs

Generated report output is written under:

```text
../local-tests/output/
```

## Exports and Data Formats

### Human-readable schedule export

The export endpoint generates CSV or XLSX with these columns:

- `Dept`
- `Course`
- `Section`
- `Title`
- `Instructor`
- `Time`
- `Building`
- `Room`
- `Enroll`
- `CRN`
- `Course Fee`

Export data is enriched using:

- the course catalog
- professor records
- room records
- matching preference submissions for enrollment, CRN, and course fee

### Schedule IDs and references

Several IDs are human-readable and worth knowing when debugging:

- room `_id`: `SN 201`
- course `_id`: `COS 243`
- professor `_id`: `zeyu.zhou`
- schedule `_id`: `Fall-2026-3`

Scheduled course IDs may also include a section suffix, such as:

- `COS 243-001`

The lookup helpers in `app/utils/schedule.ts` normalize these references for display and editing.

## Operational Notes

### Mongo startup behavior

On Nitro startup, the app:

- resolves Mongo config
- logs basic diagnostics
- opens the singleton Mongoose connection
- initializes indexes

This happens in `server/plugins/startup.server.ts`.

### Schedule concurrency protection

`POST /api/schedule/run` uses in-memory run-state tracking to prevent multiple schedule runs from executing at the same time in the same server process.

This protects against overlapping admin clicks, but note:

- it is process-local
- it is not a distributed lock

### Automatic course creation from preferences

When preference submissions reference courses not already in the catalog, the server can create placeholder catalog entries automatically using:

- course ID
- title
- credit hours

This is helpful for intake, but it also means submitted preference data can influence the catalog if admins are not reviewing carefully.

## Troubleshooting

### The app starts but API calls fail immediately

Likely causes:

- no MongoDB connection
- missing SAML session
- missing SAML config in an environment that expects login

Check:

- server startup logs
- `MONGO_URI`
- SAML env vars

### Login button redirects to an error

Check:

- `SAML_ASSERT_ENDPOINT`
- `SAML_LOGIN_URL`
- `SAML_LOGOUT_URL`
- certificate/key file paths
- whether the wildcard cert/key files actually exist locally

### Schedule export fails

Check:

- that the selected run is `approved` or already `exported`
- that the `runNumber` is valid
- that related course/professor/room lookups still resolve

### You cannot edit a schedule in the editor

Check the run status. `approved` and `exported` runs are intentionally locked. Reopen the run first.

### Faculty page loads but data is missing

Because page-level auth redirect logic is currently commented out, the browser can reach pages without a valid session, but protected API calls will still fail. This usually means auth is the real issue even if the page itself rendered.

## Known Caveats

- `README.md` was previously empty, so this document is the first full project guide and should be kept updated as workflows change.
- `.env.example` is incomplete for SAML-backed environments.
- `package.json` includes `migrate:department-code`, but `scripts/migrate-department-code.mjs` is not present.
- `npm run lint` is a Prettier check, not a full lint pipeline.
- Browser-based local development still depends on working session auth even though `requireAuth` contains a dev header fallback.
- Scheduling logic exists both in the main app and in the sibling `scheduling/` directory, which creates a risk of divergence.
- The schedule run lock is in-memory only and is not safe as a cross-instance coordination mechanism.

## Suggested First Reads

If you are onboarding to the codebase, start here:

1. `server/models/index.ts`
2. `server/middleware/saml.ts`
3. `app/pages/faculty/preferences.vue`
4. `app/pages/admin/schedule_run.vue`
5. `app/pages/admin/schedule_viewer.vue`
6. `server/services/scheduling/index.ts`
7. `server/services/scheduling/config.ts`

That sequence gives the fastest path to understanding the data model, auth model, operator workflow, and scheduler behavior.
