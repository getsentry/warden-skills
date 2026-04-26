# Django Data-Exfiltration Reference

Load when the diff touches Django views, DRF serializers, raw ORM queries, file responses, or settings that affect debug output. Ignore SSTI and pickle session config unless they expose data.

## DEBUG and Settings Leakage

### `DEBUG = True` in production

Django's 500 page in debug mode exposes:

- Full Python traceback with local variables.
- Settings values (redacted for `SENSITIVE_SETTINGS` and `_KEY`-named settings, but not comprehensive).
- Template source.
- SQL queries (via the debug toolbar if installed).

A diff that flips `DEBUG = True` or disables a prod-mode guard is high severity.

### `ALLOWED_HOSTS` and Host header

`ALLOWED_HOSTS = ['*']` enables Host-header poisoning. The exfil shape is password-reset emails built from `request.get_host()` — attacker sends a reset request with a crafted `Host:`, receives the link, exfiltrates the token.

## DRF Serializers

### `fields = '__all__'`

```python
class UserSerializer(ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'   # Includes is_staff, password_hash, api_token via future migrations.
```

Exposes every column on read; accepts every column on write (mass assignment, but the leak angle is this skill).

```python
class UserPublicSerializer(ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'display_name', 'avatar_url', 'timezone']
```

Allowlist required.

### Writable nested serializers

A nested serializer with its own `__all__` carries the same risk for nested types.

### `read_only_fields` / `write_only_fields`

Use `write_only=True` on `password`, tokens, secrets so they accept input but never serialize out. Use `read_only=True` to prevent overrides on input.

## ORM Raw / Extra / RawSQL

See `references/sql-injection.md`. Django-specific:

- `.raw(sql)` — first positional arg not parameterized. Use `params=[...]`.
- `.extra(where=[...])` — values not parameterized unless via `params=`.
- `RawSQL("...")` — same.
- `connection.cursor().execute(sql, params)` — parameterize via `%s`.

```python
# unsafe
Invoice.objects.raw(f"SELECT * FROM invoices WHERE customer_id = {cid}")

# safe
Invoice.objects.raw("SELECT * FROM invoices WHERE customer_id = %s", [cid])
Invoice.objects.filter(customer_id=cid)
```

## File Handling

### `FileResponse(open(user_path))`

Path traversal. See `references/path-traversal.md`.

```python
# bad
return FileResponse(open(os.path.join("exports", request.GET["name"])))
```

### `FileField` / `ImageField` upload paths

```python
# unsafe upload_to
def user_upload_path(instance, filename):
    return os.path.join("uploads", instance.user_id, filename)   # filename unchecked.
```

`filename` can be `../../etc/cron.d/pwn`. Sanitize via `os.path.basename` or replace with a UUID.

### Archive imports / management commands

Data import / relocation commands accepting user archives must apply zip-slip defenses. Sentry's `src/sentry/utils/zip.py` has `safe_extract_zip`; non-Sentry projects need their own.

## Logging

```python
logger.info("request received", extra={"body": request.body})  # Captures auth payloads, secrets.
```

See `references/data-leakage.md`. Django's default request logger is reasonable; custom logging that captures `request.body`, `request.headers`, or full POST data is the bug.

## Detection Heuristics

1. ORM `.raw(f"...")`, `.extra(where=[f"..."])`, `RawSQL(f"...")`, `cursor.execute(f"...")` with user data.
2. DRF serializer with `fields = '__all__'` on any read or write endpoint.
3. `FileResponse(open(user_path))` without containment.
4. `upload_to` callable using `filename` without `basename`/UUID substitution.
5. `DEBUG = True` in a production-reachable setting.
6. `ALLOWED_HOSTS = ['*']` in production.
7. Custom logger capturing `request.body` / `request.headers` / payloads wholesale.
8. Verbose error handlers returning `traceback.format_exc()` in API responses.

## False-Positive Traps

- `Model.objects.raw("SQL", [params])` with parameter list is safe.
- DRF `fields = '__all__'` on a `ReadOnlyModelViewSet` exposing genuinely-public columns is reviewable, not automatically a finding.
- `FileResponse` with a server-generated filename is safe.
- `upload_to` callable using `instance.id` and a UUID for the filename is safe.
- `mark_safe(literal_html)` on hardcoded HTML is XSS-adjacent (different skill); not data exfil.

## Verification Commands

```bash
rg -n '\.raw\(|\.extra\(|RawSQL\(|cursor\.execute\(' <project> --type py
rg -n "fields\s*=\s*['\"]__all__['\"]" <project> --type py
rg -n 'FileResponse\(|FileField|ImageField' <project> --type py
rg -n 'upload_to\s*=' <project> --type py
rg -n '^DEBUG\s*=\s*True|^ALLOWED_HOSTS' <project>/settings*.py
rg -n 'logger\.(info|warning|error).*request\.(body|json|data|headers)' <project> --type py
```
