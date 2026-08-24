#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_ENV="$BACKEND_DIR/.env"
FRONTEND_ENV="$FRONTEND_DIR/.env.local"

fail() {
  printf '\nrun-demo: %s\n' "$*" >&2
  exit 1
}

need_command() {
  command -v "$1" >/dev/null 2>&1 || fail "missing command: $1"
}

env_value() {
  local file="$1"
  local key="$2"
  local line=""

  [[ -f "$file" ]] || return 0
  line="$(grep -E "^${key}=" "$file" | tail -n 1 || true)"
  printf '%s' "${line#*=}"
}

is_missing_value() {
  case "${1:-}" in
    ""|"****"|replace_*|your_*|\<*|*\>) return 0 ;;
    *) return 1 ;;
  esac
}

set_env_value() {
  local file="$1"
  local key="$2"
  local value="$3"
  local temp_file="${file}.tmp.$$"

  touch "$file"
  awk -v key="$key" -v value="$value" '
    BEGIN { found = 0 }
    index($0, key "=") == 1 {
      print key "=" value
      found = 1
      next
    }
    { print }
    END {
      if (!found) print key "=" value
    }
  ' "$file" > "$temp_file"
  mv "$temp_file" "$file"
}

generate_secret() {
  node -e 'console.log(require("node:crypto").randomBytes(32).toString("hex"))'
}

wait_for_url() {
  local url="$1"
  local name="$2"
  local attempt

  for attempt in $(seq 1 30); do
    if curl -fsS --max-time 2 "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  fail "$name did not become ready: $url"
}

need_command node
need_command npm
need_command pnpm
need_command docker
need_command curl

node_major="$(node -p 'process.versions.node.split(".")[0]')"
(( node_major >= 20 )) || fail "Node 20+ required; found Node $node_major"
if docker compose version >/dev/null 2>&1; then
  compose_cmd=(docker compose)
elif docker-compose version >/dev/null 2>&1; then
  compose_cmd=(docker-compose)
else
  fail "Docker Compose is unavailable. Install Docker Desktop first."
fi
cd "$ROOT_DIR"

touch "$BACKEND_ENV" "$FRONTEND_ENV"

openrouter_key="${OPENROUTER_API_KEY:-}"
if is_missing_value "$openrouter_key"; then
  openrouter_key="$(env_value "$BACKEND_ENV" OPENROUTER_API_KEY)"
fi
if is_missing_value "$openrouter_key"; then
  openrouter_key="$(env_value "$FRONTEND_ENV" OPENROUTER_API_KEY)"
fi
is_missing_value "$openrouter_key" && fail "set OPENROUTER_API_KEY in backend/.env before running this script"

auth_secret="${AUTH_SECRET:-}"
if is_missing_value "$auth_secret"; then
  auth_secret="$(env_value "$FRONTEND_ENV" AUTH_SECRET)"
fi
is_missing_value "$auth_secret" && auth_secret="$(generate_secret)"

internal_secret="${BACKEND_INTERNAL_SECRET:-}"
if is_missing_value "$internal_secret"; then
  internal_secret="$(env_value "$BACKEND_ENV" BACKEND_INTERNAL_SECRET)"
fi
if is_missing_value "$internal_secret"; then
  internal_secret="$(env_value "$FRONTEND_ENV" BACKEND_INTERNAL_SECRET)"
fi
is_missing_value "$internal_secret" && internal_secret="$(generate_secret)"

backend_port="$(env_value "$BACKEND_ENV" PORT)"
is_missing_value "$backend_port" && backend_port="4000"
set_env_value "$BACKEND_ENV" PORT "$backend_port"
set_env_value "$BACKEND_ENV" BACKEND_INTERNAL_SECRET "$internal_secret"
set_env_value "$BACKEND_ENV" POSTGRES_URL "${POSTGRES_URL:-$(env_value "$BACKEND_ENV" POSTGRES_URL)}"
set_env_value "$BACKEND_ENV" REDIS_URL ""
set_env_value "$BACKEND_ENV" OPENROUTER_API_KEY "$openrouter_key"
set_env_value "$BACKEND_ENV" OPENROUTER_REFERRER "${OPENROUTER_REFERRER:-http://localhost:3000}"

set_env_value "$FRONTEND_ENV" AUTH_SECRET "$auth_secret"
set_env_value "$FRONTEND_ENV" BACKEND_URL "${BACKEND_URL:-http://localhost:4000}"
set_env_value "$FRONTEND_ENV" BACKEND_INTERNAL_SECRET "$internal_secret"
# backend/src/env.ts loads frontend/.env.local first during local development.
set_env_value "$FRONTEND_ENV" OPENROUTER_API_KEY "$openrouter_key"
set_env_value "$FRONTEND_ENV" OPENROUTER_REFERRER "${OPENROUTER_REFERRER:-http://localhost:3000}"

if is_missing_value "$(env_value "$BACKEND_ENV" POSTGRES_URL)"; then
  set_env_value "$BACKEND_ENV" POSTGRES_URL "postgres://shopper:shopper@localhost:5433/shopping_agent"
fi
postgres_url="$(env_value "$BACKEND_ENV" POSTGRES_URL)"
set_env_value "$FRONTEND_ENV" POSTGRES_URL "$postgres_url"
set_env_value "$FRONTEND_ENV" REDIS_URL ""

blob_token="${BLOB_READ_WRITE_TOKEN:-}"
if is_missing_value "$blob_token"; then
  blob_token="$(env_value "$BACKEND_ENV" BLOB_READ_WRITE_TOKEN)"
fi
if is_missing_value "$blob_token"; then
  blob_token="$(env_value "$FRONTEND_ENV" BLOB_READ_WRITE_TOKEN)"
fi
if is_missing_value "$blob_token"; then
  set_env_value "$FRONTEND_ENV" BLOB_READ_WRITE_TOKEN ""
else
  set_env_value "$BACKEND_ENV" BLOB_READ_WRITE_TOKEN "$blob_token"
  set_env_value "$FRONTEND_ENV" BLOB_READ_WRITE_TOKEN "$blob_token"
fi

if [[ ! -d "$BACKEND_DIR/node_modules" ]]; then
  printf 'Installing backend dependencies...\n'
  (cd "$BACKEND_DIR" && npm install)
fi
if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  printf 'Installing frontend dependencies...\n'
  (cd "$FRONTEND_DIR" && pnpm install --frozen-lockfile)
fi

printf 'Starting Postgres...\n'
"${compose_cmd[@]}" up -d postgres

printf 'Waiting for Postgres...\n'
for attempt in $(seq 1 30); do
  if "${compose_cmd[@]}" exec -T postgres pg_isready -U shopper -d shopping_agent >/dev/null 2>&1; then
    break
  fi
  [[ "$attempt" == 30 ]] && fail "Postgres did not become ready"
  sleep 1
done

printf 'Running database migrations...\n'
(cd "$BACKEND_DIR" && npm run db:migrate)

printf 'Starting backend and frontend...\n'
(cd "$BACKEND_DIR" && npm run dev) &
backend_pid=$!
(cd "$FRONTEND_DIR" && pnpm dev) &
frontend_pid=$!
printf 'Installing Chromium for web search in the background...\n'
(cd "$BACKEND_DIR" && npx playwright install chromium) &
chromium_pid=$!

cleanup() {
  local status=$?
  trap - EXIT INT TERM
  kill "$backend_pid" "$frontend_pid" "$chromium_pid" 2>/dev/null || true
  wait "$backend_pid" "$frontend_pid" "$chromium_pid" 2>/dev/null || true
  exit "$status"
}
trap cleanup EXIT INT TERM

wait_for_url "http://localhost:4000/health" "backend"
wait_for_url "http://localhost:3000/ping" "frontend"

printf '\nDemo is ready:\n'
printf '  App:         http://localhost:3000\n'
printf '  Discovery:   http://localhost:3000/discovery\n'
printf '  Backend:     http://localhost:4000/health\n'
printf '\nPress Ctrl-C to stop the app. Docker data stays saved.\n\n'

if command -v open >/dev/null 2>&1; then
  open http://localhost:3000 >/dev/null 2>&1 || true
fi

while kill -0 "$backend_pid" 2>/dev/null && kill -0 "$frontend_pid" 2>/dev/null; do
  sleep 1
done

fail "frontend or backend stopped unexpectedly"
