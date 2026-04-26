# Sentry Data-Exfiltration Reference

Load when the diff touches `sentry.http`, `sentry.net`, integration webhooks that fetch URLs, response serializers, or anything that returns data to clients. Ignore YAML, pickle, and eval unless they expose data.

## SSRF: The Safe Path

Canonical helpers:

- `src/sentry/http.py` (lines 65-116): `safe_urlopen()`, `safe_urlread()`.
- `src/sentry/net/http.py`: `SafeSession`, `BlacklistAdapter`.
- `src/sentry/net/socket.py`: `safe_create_connection()`, `is_ipaddress_permitted()`, `is_safe_hostname()`, `ensure_fqdn()`.

Docstring on `safe_urlopen`: *"A slightly safer version of `urllib2.urlopen` which prevents redirection and ensures the URL isn't attempting to hit a blacklisted IP range."*

Enforcement chain:

1. `ensure_fqdn()` appends a trailing dot to kill DNS search-domain bypass.
2. DNS resolves.
3. Each resolved IP is checked against `SENTRY_DISALLOWED_IPS` via `is_ipaddress_permitted()`.
4. The socket opens only if every resolution passes.

**Rule**: a diff that introduces an outbound HTTP call to a user-controlled or integration-config URL must go through `safe_urlopen` / `safe_urlread`. Direct `requests.get(url)`, `urllib.request.urlopen(url)`, or any `http.client` call with attacker-influenceable input is a finding.

Historical fix: commit `808519d214d` ("Prevent Sentry Apps from using restricted IP addresses for webhooks") retrofitted `is_safe_hostname()` onto webhook URL validation.

## Response-Field Leakage

Recent fix: commit `0c0aae90ac1` ("Seer explorer chat") — Pydantic models with `Config.extra = "allow"` passed `.dict()` directly to responses, leaking `SeerRunState` internals. Fix: `extra = "ignore"` plus `Field(exclude=True)` on sensitive fields.

**Finding candidates:**

- New Pydantic models used as response bodies with `extra = "allow"`.
- `.dict()` or `.model_dump()` on a model with secret/internal fields and no `exclude`.
- DRF `ModelSerializer` with `fields = '__all__'` on a write endpoint.
- Serializers including `access_token`, `webhook_secret`, `private_key`, etc. without `write_only=True`.

Related: commit `06e1f08b516` ("Excluded refs list from lifecycle event extras") — git branch names from PR metadata attached to lifecycle logs, exposing internal branch and feature-flag names. Pattern: any audit/lifecycle log including a repository or integration payload should be reviewed for what gets captured.

## XML Parsing

`src/sentry/shared_integrations/response/xml.py` parses integration responses via `BeautifulSoup(text, "xml")`. Safe when used without an lxml feature flag.

**Finding candidates:**

- New `lxml.etree.fromstring(untrusted)` without `resolve_entities=False`.
- Stdlib `xml.etree`, `xml.sax`, `xml.dom.minidom` on untrusted data — defaults resolve entities.
- New SAML / OOXML / SOAP parser without explicit entity-hardening.

## OAuth Redirect URI

Fix: commit `3a8b6dc825e` ("improve api application redirect uri validation").

**Finding candidates** (this skill's exfil angle — leaked authorization codes / tokens via redirect):

- Redirect URIs validated by substring (vulnerable to `attacker.com.registered-prefix.com`). Must be exact-match, full-origin, case-sensitive.
- Open-redirect-like handlers that include attacker-controlled URL fragments in error pages or in cross-domain links.

The data-exfil angle is leaked authorization codes or tokens through redirect behavior.

## Webhook Callback URLs

Even authenticated webhooks may carry a `callback_url` field from a compromised third party or attacker-influenced integration config. Re-validate every outbound URL through the SSRF chain on use, not only at registration.

## Sentry-Specific Exfil Bug Shapes

Prioritized:

1. **New integration or webhook makes outbound HTTP** without `safe_urlopen` / `safe_urlread`. Direct `requests.get`, `urllib.request.urlopen`, `http.client` are red flags.
2. **Webhook URL derived from user/integration config** not re-validated through the SSRF chain on each use.
3. **New Pydantic response model with `extra = "allow"`** or that includes fields never meant to be serialized out.
4. **New DRF serializer with `fields = '__all__'`** on a write endpoint.
5. **`lxml.etree.fromstring(untrusted)`** without `resolve_entities=False`.
6. **OAuth redirect URI substring match** instead of exact match.
7. **Error handlers that include stack traces, request bodies, or integration tokens** in responses or exceptions routed back to clients.
8. **Lifecycle / audit logs capturing full webhook payloads** (commit `06e1f08b516` shape).

## Safe Idioms (Avoid False Positives)

- `BeautifulSoup(text, "xml")` is safe (no XXE by default).
- `safe_urlopen` / `safe_urlread` callers are safe (SSRF chain enforced).
- Pydantic v2 default `extra = "ignore"` is safe.
- DRF serializer with `fields = '__all__'` on a `ReadOnlyModelViewSet` is over-exposure but not write-amplifying.

## Verification Commands

```bash
# Outbound HTTP calls
rg -n 'requests\.(get|post|put|delete)|urllib|urlopen|http\.client' <file>

# Confirm use of safe helpers
rg -n 'safe_urlopen|safe_urlread|is_safe_hostname|SENTRY_DISALLOWED_IPS' src/sentry/

# Pydantic response models with extra=allow
rg -n "extra\s*=\s*['\"]allow['\"]" src/sentry/

# DRF __all__ usage
rg -n "fields\s*=\s*['\"]__all__['\"]" src/sentry/

# lxml resolve_entities flag
rg -n 'lxml|resolve_entities|no_network' src/sentry/

# Recent fixes on this surface
git log --oneline --grep='SSRF\|leak\|exfil\|webhook\|redirect' --since='1 year ago'
```
