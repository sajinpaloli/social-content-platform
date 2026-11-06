# Security and operations checklist

## Already enforced by this codebase

- Sessions use an `HttpOnly`, `SameSite=Lax` cookie, refresh while active, and expire after 30 minutes idle. The browser also signs out after 30 minutes without user input.
- Login attempts are limited to eight failures per 15 minutes per client IP and account pair. In-process limits reset when the API restarts; apply an edge rate limit as well.
- Passwords are hashed with bcrypt; password setup/change requires 14 characters.
- API credentials remain server-side and are encrypted by the existing credentials encryption key. Never expose `.env`, database dumps, or credentials in logs or source control.
- Helmet headers include a restrictive content security policy. Mutating API requests reject unexpected browser origins.
- Website analysis accepts public HTTP/HTTPS hosts only, rejects non-public DNS results and redirects, and applies a request timeout.
- Uploads are limited to 25 MB each and 10 files at a time. Supported image/video/font types are checked against file signatures and saved under generated filenames. Media in use by a post cannot be deleted.
- Docker Compose does not publish PostgreSQL, web, or API ports publicly; the app containers use a private Docker network and the API image runs as the unprivileged `node` user.
- Security events (successful/failed logins and media deletion) are stored in `security_audit_events` without recording passwords or tokens.

## Apply on the DigitalOcean server

These host controls must be applied by the server owner; they are not changed by replacing application files.

1. In the cloud firewall, allow inbound TCP 22 only from administrator IP addresses, and TCP 80/443 for the reverse proxy. Do not expose 3000, 3001, or 5432.
2. In Ubuntu, enable UFW only after confirming SSH is allowed: `ufw allow OpenSSH`, `ufw allow 80/tcp`, `ufw allow 443/tcp`, then `ufw enable`. Keep SSH keys, disable root password SSH after verifying a sudo user can connect, and keep a second active SSH session while changing SSH settings.
3. Copy `env.production.example` to `.env` and replace every placeholder. `POSTGRES_USER`/`POSTGRES_PASSWORD` are migration-owner credentials. The API uses the separate restricted `POSTGRES_APP_USER`/`POSTGRES_APP_PASSWORD` role for normal requests; the migration step grants it table and sequence access. Keep passwords alphanumeric random hex so Compose database URLs parse correctly.
4. Set the public URLs, CORS origin and LinkedIn callback exactly as shown in the template. Keep `CREDENTIAL_ENCRYPTION_KEY` backed up separately; losing it makes stored provider tokens  unreadable. Restart/rebuild the API after changing secrets.
5. Update Docker images and OS packages regularly. Review `docker compose logs --since 24h api` and the audit table. Restrict access to the Docker socket and `.env` (root ownership, mode 600).

## Encrypted PostgreSQL backup

Run from the project directory on the server. `gpg` prompts for a backup passphrase; keep it separately from the server and test restoration periodically.

```bash
docker compose exec -T db sh -lc 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gpg --symmetric --cipher-algo AES256 --output "backup-$(date -u +%Y%m%dT%H%M%SZ).sql.gpg"
docker compose run --rm --no-deps --entrypoint tar api czf - -C /app uploads | gpg --symmetric --cipher-algo AES256 --output "media-$(date -u +%Y%m%dT%H%M%SZ).tar.gz.gpg"
```

For restoration, stop the API first, then decrypt to PostgreSQL only after verifying the target database and preserving a second backup. A restore replaces database state; test it on a separate database before production recovery.

## Audit query

```sql
SELECT created_at, event, actor_id, request_key, details
FROM security_audit_events
ORDER BY created_at DESC
LIMIT 200;
```
