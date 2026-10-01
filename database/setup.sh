#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

set -a
source "$SCRIPT_DIR/../.env"
set +a

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_ADMIN_USER="${DB_ADMIN_USER:-postgres}"
DB_ADMIN_DATABASE="${DB_ADMIN_DATABASE:-postgres}"

# Probes an admin connection: real connectivity, and that .env survives to the SQL session
# (a bare sudo resets the environment, which would break setup.sql's \getenv further down).
PROBE=$'\\getenv probe_db_name DB_NAME\nSELECT :\'probe_db_name\';\n'
ADMIN=()

try_admin() {
  printf '%s' "$PROBE" | "$@" -w -q -v ON_ERROR_STOP=1 -d "$DB_ADMIN_DATABASE" -f - >/dev/null 2>&1 || return 1
  ADMIN=("$@")
}

resolve_admin() {
  # Preserve, don't destroy, any PGPASSWORD the user already had: rung 2 falls back to an ambient
  # PGPASSWORD, and unsetting it here would erase a working credential just because DB_ADMIN_PASSWORD
  # (rung 1) was wrong, silently ruling out a rung the ladder promises to try.
  local prior_pgpassword="${PGPASSWORD:-}"
  if [ -n "${DB_ADMIN_PASSWORD:-}" ]; then
    export PGPASSWORD="$DB_ADMIN_PASSWORD"
    if try_admin psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_ADMIN_USER"; then
      return 0
    fi
    if [ -n "$prior_pgpassword" ]; then
      export PGPASSWORD="$prior_pgpassword"
    else
      unset PGPASSWORD
    fi
  fi
  if try_admin psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_ADMIN_USER"; then
    return 0
  fi
  if try_admin psql -U "$DB_ADMIN_USER"; then
    return 0
  fi
  # The system postgres user, not $DB_ADMIN_USER: this is the "sudo -u postgres" idiom peer auth
  # documents, a different identity switch than the TCP rungs above, which authenticate as whatever
  # role DB_ADMIN_USER names.
  if try_admin sudo -n --preserve-env=DB_NAME,DB_USER,DB_PASSWORD -u postgres psql -U postgres; then
    return 0
  fi
  if [ -t 0 ]; then
    echo "PostgreSQL needs administrator access to create the database. Requesting sudo..."
    if try_admin sudo --preserve-env=DB_NAME,DB_USER,DB_PASSWORD -u postgres psql -U postgres; then
      return 0
    fi
  fi
  return 1
}

if ! resolve_admin; then
  echo ""
  echo "Could not connect to PostgreSQL as an administrator. Tried:"
  echo "  - $DB_ADMIN_USER@$DB_HOST:$DB_PORT (with DB_ADMIN_PASSWORD from .env, if set)"
  echo "  - $DB_ADMIN_USER over the local Unix socket"
  echo "  - sudo -u postgres (non-interactive, then interactive)"
  echo "Set DB_HOST/DB_PORT/DB_ADMIN_USER/DB_ADMIN_PASSWORD/DB_ADMIN_DATABASE in .env for a remote host, a container, or a non-default install."
  exit 1
fi

echo "Creating database and user..."
"${ADMIN[@]}" -w -v ON_ERROR_STOP=1 -d "$DB_ADMIN_DATABASE" -f - < "$SCRIPT_DIR/setup.sql"

echo ""
echo "Done. Next: npm run migrate, then npm run setup:auth."
