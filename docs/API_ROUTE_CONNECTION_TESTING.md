# API Route Connection Testing (No DB Access Required Here)

This project has 15 API routes under server/api. Every route calls connectDB(), so database connectivity is a hard prerequisite for all endpoint success.

Use this script to test every route from an environment where MongoDB is reachable:

- scripts/test-api-routes.sh

## Quick Start

1. Start Nuxt in your target environment.
2. Export a reachable Mongo URI.
3. Run:

```bash
chmod +x ./scripts/test-api-routes.sh
BASE_URL=http://localhost:3000/COS170 ./scripts/test-api-routes.sh
```

Read-only check only:

```bash
RUN_MUTATIONS=0 BASE_URL=http://localhost:3000/COS170 ./scripts/test-api-routes.sh
```

Verbose responses:

```bash
VERBOSE=1 BASE_URL=http://localhost:3000/COS170 ./scripts/test-api-routes.sh
```

## Routes Covered

Read routes:
- GET /api/courses
- GET /api/professors
- GET /api/rooms
- GET /api/preferences/:term
- GET /api/schedule/:term
- GET /api/schedule/:term/export

Mutation routes:
- POST /api/courses
- POST /api/professors
- POST /api/rooms
- POST /api/preferences
- POST /api/audit-logs
- POST /api/schedule
- POST /api/schedule/run
- PATCH /api/schedule/:term
- PATCH /api/schedule/:term/assignment

## Connection Issues To Watch For

The script labels a response with CONNECTION_ISSUE when response text matches common Mongo connection failures:

- Missing URI: "MONGO_URI is required"
- DNS/network issues: ENOTFOUND, ECONNREFUSED, ETIMEDOUT
- Driver/selection issues: MongoNetworkError, server selection timed out
- Other transport issues: failed to connect, buffering timed out

## Environment Examples

Local with database name in the URI:

```bash
export MONGO_URI=mongodb://127.0.0.1:27017/cos417_dev
```

Local or production with an explicit fallback name:

```bash
export MONGO_URI=mongodb://user:pass@mongo.example.edu:27017/?authSource=admin
export MONGO_DB_NAME=cos417_prod
```

The app does not silently fall back to Mongo's `test` database. If the URI has no database name, the runtime uses the hardcoded `COS417` database name unless `MONGO_DB_NAME` overrides it.

## Code-Level Connection Risks Found

These are static findings from route/util inspection (without running):

1. No route-level DB error normalization:
   - All handlers await connectDB() directly and allow raw DB errors to bubble to generic 500 responses.
   - Effect: less actionable API errors unless server logs are checked.

2. Cold-start index initialization is in the request path:
   - connectDB() runs initializeModelIndexes() before returning.
   - Effect: if index creation fails (for example due to conflicting existing data), every route can fail until resolved.

3. No explicit server selection timeout configured:
   - mongoose.connect() uses defaults with bufferCommands: false.
   - Effect: connection failures may feel slow/hang depending on driver defaults and network conditions.

## Suggested Next Hardening Steps

- Wrap connectDB() failures in a shared helper that throws a normalized 503 error payload.
- Add serverSelectionTimeoutMS and connectTimeoutMS in mongoose.connect options.
- Log one structured error event for connect failures (without leaking secrets).
- Optionally add a dedicated health endpoint (for example GET /api/health/db) that checks DB readiness explicitly.
