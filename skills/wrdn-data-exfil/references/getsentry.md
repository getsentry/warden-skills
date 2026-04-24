# Getsentry RCE / Exfil Reference

Load when the diff touches `~/src/getsentry`, billing/subscription code, customer exports, staff/ViewAs surfaces, or third-party callbacks (Vercel, Stripe, Salesforce, Zendesk, HubSpot). Read `references/sentry.md` first; this file covers what getsentry layers on top.

Getsentry is where the high-value exfil targets live: invoices, seat counts, plan internals, customer lists, and bulk export tooling.

## Data-Export Surfaces

Files to inspect closely on any diff touching them:

- `getsentry/api/customer_invoices.py` (lines 16-34): Invoice list endpoint. Returns `AdminInvoiceSerializer` for superusers vs `InvoiceSerializer` for non-superusers. Both reachable through the same route.
- `getsentry/api/customer_details.py`: Large surface, 100+ line serializer, plan/subscription/trial internals.
- `getsentry/web/customer_history_export.py` (lines 47-100): CSV export of billing/usage history by period.
- `getsentry/web/customer_history_per_project_export.py`: Per-project historical data.
- `getsentry/bin/export_customer_data.py` (lines 127-170): CLI tool exporting full organization data (settings, teams, project config, alerts) as a tarball to GCS.
- `getsentry/api/serializers/customer.py` (line 70+): `AdminDetailedCustomerSerializer` vs `DetailedCustomerSerializer`. The admin version has strictly more fields.

**Bug shapes on these surfaces:**

1. **New endpoint returns `AdminDetailedCustomerSerializer` without an explicit superuser/staff check** surrounding the serializer selection. Pattern to match: `serializer = AdminDetailedCustomerSerializer if is_active_superuser(request) else DetailedCustomerSerializer`. Missing conditional → over-exposure to any org member.
2. **Export endpoint writes a tarball** including `organization_settings`, `teams`, `project_configuration`, without re-checking the caller's access to each resource. The CLI tool `export_customer_data.py` was designed for staff use; if an HTTP path is added that reaches the same machinery, every call must reverify authorization per-resource, not per-org.
3. **CSV export columns include fields not previously surfaced** via the JSON API. Adding a column to a CSV export that wasn't in the JSON response is data leakage unless reviewed.
4. **New field on an admin serializer that is not gated by a capability check** — e.g., adding `internal_notes` to `AdminDetailedCustomerSerializer` when only staff with a specific `UserPermissions` capability should see it.

## Third-Party Callbacks

### Vercel OAuth

`getsentry/web/vercel/oauth.py` (lines 69-430). Recent fix: commit `47d85ed7af` (Apr 14, 2026) removed email-based auto-login in the Vercel OAuth callback. Before the fix, an attacker could register a Vercel account with a victim's email; the callback auto-linked to the victim's Sentry account.

**Bug shapes:**

- New OAuth callback that resolves to a Sentry account via third-party email match without explicit "Sentry auth first, then confirm identity" flow.
- Callback that trusts the third-party identity for anything beyond "this is the account the user wants to link."
- Stored state in session without per-request `tx_id` (see Sentry session-overwrite fix `29f2120be4a`).

### Stripe Projects

Recent fix: commit `045e828fce` (Apr 16, 2026) — in `confirm_login`, rejected when `cached_user_id` is None; converted `ValueError` to `IntentValidationError`.

**Bug shapes:**

- New Stripe webhook / callback that treats `None` from session lookups as a proceed signal.
- Error branches that return generic 200 rather than explicitly rejecting — any "lenient" exception handler on an auth path.

### Salesforce Webhook

`getsentry/web/salesforce/webhook_handler.py` (lines 12-30). CSRF-exempt. Validates `X_SALESFORCE_SIGNATURE`.

**Bug shapes:**

- Signature validation without a replay window (no timestamp or nonce).
- Signature compared with `==` instead of `hmac.compare_digest`.
- Payload acted on before signature validation (ordering bug).
- Forwarding URLs from the payload to internal HTTP without SSRF guards.

### Copilot Workflows

`getsentry/api/copilot/workflows.py` (lines 23-42). Makes unauthenticated requests to Sentry API, GitHub, Codecov with URL templates containing `{org_slug}`, `{issue_id}`, `{path}`.

**Bug shapes (observed):**

- Path components spliced into URLs without validation. `{path}` in `https://api.codecov.io/.../file_report/{path}` is a path-injection / SSRF bypass vector if `{path}` can contain `../` or `@evil.com/`.
- GitHub token from the caller forwarded to `requests.get` without timeout / size limits.

Any diff expanding the copilot workflow surface should include URL-component validation on every templated segment.

## ViewAs / Impersonation

`getsentry/vendor/viewas/middleware.py` (lines 43-160). Superusers can impersonate non-superusers. Session expires after `SUDO_COOKIE_AGE` (3h). Logs to "viewas" logger.

**Bug shapes:**

- New admin endpoint that reads `request.user` (the impersonated target) when it should read `request.actual_user` (the staff user) for audit-log attribution.
- New action reachable under ViewAs without an entry in the audit log.
- Impersonation flow that allows superuser-to-superuser (blocked by commit `bfeac326a7`). Watch for regressions.
- New `login_as` target resolution that doesn't check the target is not a superuser.

## Billing / Subscription Data in Responses

Over-returning structures to check:

- `AdminDetailedCustomerSerializer` output reaching a non-admin endpoint.
- Pricing / plan tier data in error responses (e.g., "this feature requires Business plan at $X/mo"). Price leaks in error messages are a minor but real exfil vector.
- Internal category-usage fields appearing in public API responses.

## Historical Fixes (Recent)

| Commit | Fix |
|--------|-----|
| `47d85ed7af` | Vercel OAuth email-match ATO fix |
| `045e828fce` | Stripe projects: reject `cached_user_id = None`; proper error types |
| `d1e3ebdae0` | Stripe projects: `org:billing` scope enforcement on subscription API |
| `80b13d0899` | Vercel OAuth session + error handling |
| `c5e4dc1031` | Category usage: proto `DataCategory` for type safety |
| `1d5f30433a` | Removed dev-only superuser escalation form |

## Getsentry-Specific Bug Shapes

Prioritized:

1. **Admin serializer returned without an `is_active_superuser` / `is_active_staff` gate.** Grep for `AdminDetailedCustomerSerializer` and verify every use has a conditional.
2. **URL template splicing in `copilot/workflows.py`** or similar services — every `{placeholder}` in a URL template must be validated (allowlist, no `/`, no `..`, no `@`, no `?`).
3. **New third-party callback that resolves to a Sentry account via an unverified identifier** (email, username, external ID) without explicit Sentry auth first.
4. **Export endpoint (CSV, JSON, tarball) that is accessible to non-staff** without per-resource authorization re-verification.
5. **ViewAs-reachable action without audit log.** New endpoints that state-change should be in the audit stream.
6. **Pricing / plan data in error response bodies.** Error messages that include the plan name, price, or entitlement internals when not strictly necessary for the user.
7. **Webhook handler with `==` signature compare** instead of `hmac.compare_digest`.
8. **New admin surface using `is_active_staff` alone** when a specific `UserPermissions` capability (BILLING_ADMIN, USERS_ADMIN, etc.) is the right gate.

## Verification Commands

```bash
# Admin serializer uses
rg -n 'AdminDetailedCustomerSerializer|AdminInvoiceSerializer' getsentry/

# URL templating in outbound calls
rg -n 'requests\.(get|post)\(.*\{' getsentry/

# ViewAs actor vs user
rg -n 'request\.(actual_user|user)' getsentry/

# Signature compares
rg -n "hmac\.compare_digest|==\s*.*signature|signature.*==" getsentry/

# Export surfaces
rg -n 'export|download|csv|tarball|dump' getsentry/api/ getsentry/web/

# Recent fixes
git log --oneline --grep='SSRF\|leak\|exfil\|ATO\|deserializ\|webhook' --since='1 year ago'
```
