## Decision: Use PHP instead of wget for Moodle container healthcheck

## Context
The Moodle service in `docker-compose.yml` and `docker-compose.dev.yml` had a healthcheck
that used `wget` to probe `http://localhost:8080/login/index.php`. The Bitnami Moodle image
does not include `wget` (nor `curl`), causing the container to report `unhealthy` with
a failing streak of 1958+ checks despite Moodle being fully functional.

Symptoms observed:
- `docker ps` showed `docker-moodle-1` as `(unhealthy)`
- `docker inspect` log: `/bin/sh: 1: wget: not found`
- Moodle was actually responding correctly (HTTP 200 on port 8081)
- The E2E Moodle integration test passed without issues

## Alternatives considered
1. **`wget` (original)** — not present in bitnami/moodle image
2. **`curl`** — also not present in bitnami/moodle image
3. **`php file_get_contents`** — PHP is always present (it IS the Moodle runtime); probes
   the login page and checks the response body contains `'login'`
4. **`bash -c "echo > /dev/tcp/localhost/8080"`** — only tests TCP, not HTTP response validity

## Reasoning
PHP is the only reliable binary guaranteed to exist in the Bitnami Moodle image because
Moodle is a PHP application. The one-liner uses `file_get_contents` with a 3-second timeout,
checks the response is non-false, and greps for `'login'` in the page body — functionally
equivalent to the original `wget | grep` approach.

## Trade-offs accepted
- The PHP command is verbose compared to `wget -qO-`. Acceptable — Docker compose files
  tolerate long lines and the comment explains the rationale.
- `$$r` double-dollar escaping is required in Docker Compose CMD-SHELL YAML strings
  (single `$` is treated as a compose variable interpolation).

## How to verify
```bash
docker exec docker-moodle-1 php -r "\$r=@file_get_contents('http://localhost:8080/login/index.php',false,stream_context_create(['http'=>['timeout'=>3]]));exit(\$r!==false&&strpos(\$r,'login')!==false?0:1);"
echo $?   # must print 0
```
