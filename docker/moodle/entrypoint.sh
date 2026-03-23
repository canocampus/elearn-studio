#!/bin/bash
set -e

DB_HOST="${MOODLE_DATABASE_HOST:-moodle-db}"
DB_PORT="${MOODLE_DATABASE_PORT_NUMBER:-3306}"
DB_NAME="${MOODLE_DATABASE_NAME:-moodle}"
DB_USER="${MOODLE_DATABASE_USER:-moodle}"
DB_PASS="${MOODLE_DATABASE_PASSWORD:-moodle_pass}"
ADMIN_USER="${MOODLE_USERNAME:-admin}"
ADMIN_PASS="${MOODLE_PASSWORD:-Admin1234!}"
WWWROOT="${MOODLE_WWWROOT:-http://localhost:8081}"

# ── Wait for MariaDB ───────────────────────────────────────────────────────
echo "[moodle-entrypoint] Waiting for database at ${DB_HOST}:${DB_PORT}..."
until php -r "
  try {
    new PDO('mysql:host=${DB_HOST};port=${DB_PORT};dbname=${DB_NAME}', '${DB_USER}', '${DB_PASS}');
    exit(0);
  } catch (Exception \$e) { exit(1); }
" 2>/dev/null; do
  sleep 3
done
echo "[moodle-entrypoint] Database ready."

# ── First-run install ──────────────────────────────────────────────────────
if [ ! -f /var/www/moodle/config.php ]; then
  echo "[moodle-entrypoint] Running Moodle installer (first run)..."
  php /var/www/moodle/admin/cli/install.php \
    --lang=en \
    --wwwroot="${WWWROOT}" \
    --dataroot=/var/www/moodledata \
    --dbtype=mariadb \
    --dbhost="${DB_HOST}" \
    --dbport="${DB_PORT}" \
    --dbname="${DB_NAME}" \
    --dbuser="${DB_USER}" \
    --dbpass="${DB_PASS}" \
    --dbprefix=mdl_ \
    --fullname="eLearn Studio Test LMS" \
    --shortname=elearn \
    --adminuser="${ADMIN_USER}" \
    --adminpass="${ADMIN_PASS}" \
    --adminemail=admin@elearn.local \
    --agree-license \
    --non-interactive
  echo "[moodle-entrypoint] Installation complete. Moodle available at ${WWWROOT}"
else
  echo "[moodle-entrypoint] Moodle already installed, skipping installer."
fi

exec "$@"
