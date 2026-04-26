# Getsentry Access-Control Reference

Load when the diff imports from `getsentry.*`, references `BillingPermission`, `UserPermissions`, `ViewAs`, `is_active_staff`, `has_budget_access`, or touches billing/subscription/plan/trial/seat/impersonation code. Read `references/sentry.md` first for the underlying Sentry idioms; this file covers what getsentry adds on top.

## What Getsentry Layers On

Getsentry is the commercial layer. It adds:

- Billing and subscription gating
- Staff auth and impersonation
- Plan-based feature entitlement
- `UserPermissions` enum for staff-only actions

The authorization surface is wider than OSS Sentry because billing data, subscription mutation, and staff actions all have their own gates.

## Billing Permission Classes

Located in `getsentry/api/permissions.py`.

| Class | File:line | Purpose |
|-------|-----------|---------|
| `BillingPermission` | ~line 18 | Gates `org:billing` scope. Write access requires the billing role or owner/manager. Use for financial data: invoices, payment methods, upcoming bill. |
| `RelaxedBillingPermission` | ~line 34 | Read access for any org member; write/delete requires billing. Use for data members need to see (e.g., current seat usage). |
| `TrialPermission` | ~line 52 | Staff + org members can access trial endpoints. |
| `BillingAndStaffPermission` | ~line 78 | Staff override on billing gates. |
| `RelaxedBillingAndStaffPermission` | ~line 84 | Staff override with relaxed read. |
| `CustomerBillingConfigEndpointPermission` | ~line 29 | Staff override + relaxed billing for plan tier enumeration. |

**The central bug shape**: picking the wrong class. A new billing endpoint should default to `BillingPermission` for writes. Using `RelaxedBillingPermission` on an endpoint that exposes financial detail is the exact shape that caused HackerOne report #2223696, fixed in commit `cebdfe99c2`.

When reviewing a new billing endpoint, verify:

1. Does the endpoint return financial data (amounts, invoices, payment methods)? → `BillingPermission`.
2. Does it return usage data members legitimately need? → `RelaxedBillingPermission`.
3. Does it mutate billing state (plan change, add seats, update payment)? → `BillingPermission` minimum, often with staff-only guards.
4. Is there a staff override path? If yes, the class should be one of the `*AndStaffPermission` variants.

## User Permissions (Staff-Only Capabilities)

Located in `getsentry/constants.py` around line 218. `UserPermissions` is an enum of staff-granted capabilities:

| Permission | Grants |
|------------|--------|
| `BILLING_ADMIN` | Staff ability to modify any customer's billing |
| `BILLING_PROVISION` | Provision new billing accounts |
| `SUPERUSER_WRITE` | Writes while in superuser mode |
| `BROADCASTS_ADMIN` | Manage in-product broadcasts |
| `RELOCATION_ADMIN` | Org relocation operations |
| `USERS_ADMIN` | Staff user management |
| `OPTIONS_ADMIN` | System option mutations |

`is_billing_admin(user)` (line ~90) checks `UserPermissions.BILLING_ADMIN`. `has_budget_access(user, org)` (line ~94) checks role (owner/manager/billing) with a superuser bypass.

**Bug shape**: new staff-only endpoint guarded by `is_active_staff(request)` alone, without the specific `UserPermissions` check. Staff is not monolithic; not every staff user should have every capability.

## Staff Auth

`getsentry/api/admin/staff_auth_index.py` (around line 70) enforces:

- Authentication (401 if unauth).
- Staff status (403 if not staff).
- SSO re-auth if not completed.
- U2F device if `STAFF_ORG_ID` is set.

When adding a new staff endpoint, the canonical path is to inherit from the shared staff base, not to hand-roll `if request.user.is_staff`. Hand-rolled checks miss the U2F and SSO re-auth requirements.

## ViewAs (Impersonation)

Located in `getsentry/vendor/viewas/middleware.py`.

Contract:

- Line ~79–84: impersonation is logged (actual_user, target, path, request context).
- Line ~88: superuser-to-superuser impersonation is explicitly blocked. Historical shape: commit `bfeac326a7`.
- Line ~89: `request.actual_user` is set only during real impersonation. Prior to commit `7041240404`, this was set unconditionally, which broke rate-limit and audit accounting.
- Line ~95–100: impersonation sessions expire after 3 hours (absolute datetime).
- Line ~117–122: `login_as` re-validated on each request.

**Bug shapes:**

1. New admin endpoint that triggers impersonation without logging.
2. Impersonation without the absolute-expiry check (attacker-controlled session can extend).
3. Code that reads `request.user` and assumes it's the actual staff user; under impersonation, `request.user` is the target. Sensitive audit logging should use `request.actual_user` when impersonating.
4. New `login_as` flow that bypasses the block on superuser-targeting.

## Subscription and Plan Gating

Located in `getsentry/models/subscription.py` and `getsentry/features.py`.

- `Subscription.can_invite_members()` (line ~1065-1094) checks seat limits. Counts billing roles toward used seats.
- `SubscriptionPlanFeatureHandler` (`getsentry/features.py` ~441-481) gates 40+ features (replay, profiling, SSO, advanced features) by plan tier.
- `_check_product_trials()` (~line 432) is the trial-window bypass path.

**Bug shapes:**

1. Endpoint that checks `user.is_superuser` but not `subscription.plan`. Staff should not get a free ride on plan gates unless that's explicit.
2. New feature gate that checks `has_category_trial()` but not whether the subscription is `active` or `trialing`. Expired trials should deny.
3. Seat-counting code that does `organization.member_set.count()` instead of going through `get_used_seats()`. Billing roles have free seats; direct counts miss that.
4. Plan enumeration endpoint that uses `RelaxedBillingPermission` or less. Plan tier info can be sensitive in some flows.

## OAuth and Cross-Account Attacks

Historical: commit `47d85ed7af` (Apr 2026) — Vercel OAuth integration allowed account takeover by email match. Attacker creates a Vercel account with the victim's email; the integration flow linked to the victim's Sentry account without requiring explicit Sentry auth and identity confirmation.

Shape: any cross-account link or OAuth callback that resolves to a Sentry account via an unverified email or third-party identifier. The canonical fix is "Sentry auth first, then explicit identity confirmation."

When reviewing a new OAuth/SSO integration:

1. Does the callback require an authenticated Sentry session, or does it log the user in?
2. If it creates a new link to an existing account, is there an explicit confirmation step?
3. Is the third-party identity verified on the third-party side, or is it self-asserted?

## Bug Shapes to Flag in a Getsentry Diff

Prioritized:

1. **New billing endpoint with wrong permission class.** `RelaxedBillingPermission` on financial-detail endpoints, or plain `OrganizationPermission` with no billing gate.
2. **Staff check without capability check.** `is_active_staff(request)` alone on an endpoint that needs `UserPermissions.BILLING_ADMIN` or similar specific capability.
3. **Subscription gate missing on new plan-restricted feature.** The code adds a feature but doesn't check `features.has(...)` or the appropriate `SubscriptionPlanFeatureHandler` path.
4. **Seat-counting bypass.** Counting `member_set` directly instead of `get_used_seats()`.
5. **Trial window gate without active-subscription check.** `has_category_trial()` without the `status == 'active' or 'trialing'` guard.
6. **Impersonation-triggering flow without logging.** New admin action reachable under ViewAs without audit.
7. **New cross-account link via unverified third-party identity.** OAuth callback that creates or overwrites an account link without explicit Sentry auth.
8. **Audit logging that uses `request.user` under impersonation.** Should be `request.actual_user` (the staff user) for attribution, with `request.user` (the impersonated target) as the subject.
9. **Unauthenticated billing or usage endpoint.** Historical: commit `91fb5c6bc4` — cron monitor count endpoint returned data in incognito.
10. **Endpoint that trusts a billing-related claim from the request.** Anything from the body or query that influences price, plan, trial status, or seat count without server-side validation is a high-crit finding.

## Verification Commands

```bash
# Which permission class does this billing endpoint use?
rg -n 'permission_classes' <file>

# Where is this permission class used?
rg -n 'BillingPermission\b' getsentry/

# Staff capability references
rg -n 'UserPermissions\.' getsentry/

# ViewAs / impersonation touches
rg -n 'actual_user|login_as|_impersonation_started' getsentry/

# Subscription gates
rg -n 'has_category_trial|get_used_seats|can_invite_members' getsentry/

# History
git log --oneline -- <file>
```
