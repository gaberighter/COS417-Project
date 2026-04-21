#!/usr/bin/env bash
set -euo pipefail

# API route smoke tester for all server routes.
# This script does not start the app; run it against an already running Nuxt server.
#
# Usage:
#   BASE_URL=http://localhost:3000 ./scripts/test-api-routes.sh
#
# Optional environment variables:
#   ADMIN_USER=admin-user-001
#   FACULTY_USER=faculty-user-001
#   TERM=2026FA
#   COURSE_ID=CS 101
#   PROFESSOR_ID=faculty-user-001
#   ROOM_ID=SCI 101
#   RUN_MUTATIONS=1      # 0 = only GET routes, 1 = all routes
#   VERBOSE=1            # print response body for every request

BASE_URL="${BASE_URL:-http://localhost:3000}"
ADMIN_USER="${ADMIN_USER:-admin-user-001}"
FACULTY_USER="${FACULTY_USER:-faculty-user-001}"
TERM="${TERM:-2026FA}"
COURSE_ID="${COURSE_ID:-CS 101}"
PROFESSOR_ID="${PROFESSOR_ID:-${FACULTY_USER}}"
ROOM_ID="${ROOM_ID:-SCI 101}"
RUN_MUTATIONS="${RUN_MUTATIONS:-1}"
VERBOSE="${VERBOSE:-0}"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

PASS_COUNT=0
FAIL_COUNT=0
CONNECTION_FAIL_COUNT=0

contains_connection_error() {
  local body="$1"

  if grep -Eqi \
    'MONGO_URI is required|Mongo(Network|ServerSelection)?Error|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|failed to connect|topology was destroyed|connect ECONN|buffering timed out|connection .* closed|server selection timed out' \
    <<<"$body"; then
    return 0
  fi

  return 1
}

run_case() {
  local name="$1"
  local method="$2"
  local path="$3"
  local role="$4"
  local user="$5"
  local body="$6"

  local url="${BASE_URL}${path}"
  local response_file="${TMP_DIR}/response_$(date +%s%N).txt"

  local curl_args=(
    --silent
    --show-error
    --location
    --request "$method"
    --url "$url"
    --header "accept: application/json"
    --header "x-dev-role: ${role}"
    --header "x-dev-user: ${user}"
    --output "$response_file"
    --write-out '%{http_code}'
  )

  if [[ -n "$body" ]]; then
    curl_args+=(
      --header 'content-type: application/json'
      --data "$body"
    )
  fi

  local status
  status="$(curl "${curl_args[@]}")"
  local response_body
  response_body="$(cat "$response_file")"

  local result="PASS"
  if [[ "$status" -ge 500 ]]; then
    result="FAIL"
  fi

  local connection_marker=""
  if contains_connection_error "$response_body"; then
    connection_marker=" CONNECTION_ISSUE"
    CONNECTION_FAIL_COUNT=$((CONNECTION_FAIL_COUNT + 1))
  fi

  if [[ "$result" == "PASS" ]]; then
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi

  printf '%-34s %-5s %-35s -> HTTP %s [%s]%s\n' \
    "$name" "$method" "$path" "$status" "$result" "$connection_marker"

  if [[ "$VERBOSE" == "1" ]]; then
    echo "----- RESPONSE START: ${name} -----"
    cat "$response_file"
    echo
    echo "----- RESPONSE END: ${name} -----"
  fi
}

echo "Testing API routes against: ${BASE_URL}"
echo "Mutation routes enabled: ${RUN_MUTATIONS}"
echo

echo "== Read routes =="
run_case "courses.list" "GET" "/api/courses" "Admin" "$ADMIN_USER" ""
run_case "professors.list" "GET" "/api/professors" "Admin" "$ADMIN_USER" ""
run_case "rooms.list" "GET" "/api/rooms" "Admin" "$ADMIN_USER" ""
run_case "preferences.byTerm" "GET" "/api/preferences/${TERM}" "Admin" "$ADMIN_USER" ""
run_case "schedule.byTerm" "GET" "/api/schedule/${TERM}" "Admin" "$ADMIN_USER" ""
run_case "schedule.exportCsv" "GET" "/api/schedule/${TERM}/export" "Admin" "$ADMIN_USER" ""

if [[ "$RUN_MUTATIONS" == "1" ]]; then
  echo
  echo "== Mutation routes =="

  run_case "courses.upsert" "POST" "/api/courses" "Admin" "$ADMIN_USER" "{\"courses\":[{\"deptCode\":\"CS\",\"courseNumber\":\"101\",\"title\":\"Intro to CS\",\"creditHours\":3,\"requiredEquipment\":[],\"labComponent\":false,\"active\":true,\"prerequisites\":[],\"corequisites\":[]}]}"

  run_case "professors.upsert" "POST" "/api/professors" "Admin" "$ADMIN_USER" "{\"professors\":[{\"covenantId\":\"${FACULTY_USER}\",\"displayName\":\"Faculty Test\",\"departmentCode\":\"CS\",\"active\":true,\"preferences\":[]}]}"

  run_case "rooms.upsert" "POST" "/api/rooms" "Admin" "$ADMIN_USER" "{\"buildingCode\":\"SCI\",\"roomNumber\":\"101\",\"capacity\":24,\"roomType\":\"classroom\",\"available\":true}"

  run_case "preferences.submit" "POST" "/api/preferences" "Faculty" "$FACULTY_USER" "{\"term\":\"${TERM}\",\"department\":\"CS\",\"status\":\"submitted\",\"courses\":[{\"courseId\":\"${COURSE_ID}\",\"title\":\"Intro to CS\",\"expectedEnrollment\":20,\"creditHours\":3}]}"

  run_case "auditLogs.insert" "POST" "/api/audit-logs" "Admin" "$ADMIN_USER" "{\"logs\":[{\"action\":\"AUDIT_IMPORT\",\"detail\":\"smoke test entry\",\"collection\":\"auditLogs\"}]}"

  run_case "schedule.upsert" "POST" "/api/schedule" "Admin" "$ADMIN_USER" "{\"schedules\":[{\"term\":\"${TERM}\",\"status\":\"draft\",\"createdBy\":\"${ADMIN_USER}\",\"assignments\":[{\"courseId\":\"${COURSE_ID}\",\"professorId\":\"${PROFESSOR_ID}\",\"roomId\":\"${ROOM_ID}\",\"days\":\"MWF\",\"startTime\":\"09:00\",\"endTime\":\"09:50\"}],\"conflicts\":[]}]}"

  run_case "schedule.run" "POST" "/api/schedule/run" "Admin" "$ADMIN_USER" "{\"term\":\"${TERM}\"}"

  run_case "schedule.patch" "PATCH" "/api/schedule/${TERM}" "Admin" "$ADMIN_USER" "{\"status\":\"under_review\"}"

  run_case "schedule.assignment.patch" "PATCH" "/api/schedule/${TERM}/assignment" "Admin" "$ADMIN_USER" "{\"courseId\":\"${COURSE_ID}\",\"days\":\"TR\",\"startTime\":\"11:00\",\"endTime\":\"12:15\"}"
fi

echo
echo "== Summary =="
echo "PASS: ${PASS_COUNT}"
echo "FAIL: ${FAIL_COUNT}"
echo "Connection-signature failures: ${CONNECTION_FAIL_COUNT}"

echo
echo "Interpretation notes:"
echo "- HTTP 500 + CONNECTION_ISSUE usually means DB URI/network/auth to Mongo is failing."
echo "- HTTP 400/403/404 may be valid business/auth/data errors and not connection failures."
echo "- If every route fails with CONNECTION_ISSUE, check MONGO_URI and database reachability first."
