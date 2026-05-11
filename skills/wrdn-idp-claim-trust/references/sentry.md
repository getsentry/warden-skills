# Sentry IdP Claim Trust Reference

Load when the diff touches `src/sentry/auth/`, `AuthIdentity`, `AuthProvider`, `handle_attach_identity`, `handle_unknown_identity`, `FLOW_SETUP_PROVIDER`, or identity-linking code in the Sentry auth pipeline.

## Contents
- The Auth Pipeline
- The Dangerous Property: `AuthIdentityHandler.user`
- `handle_attach_identity`
- `AuthIdentity` Lifecycle
- `FLOW_SETUP_PROVIDER`
- Bug Shapes Summary
- Verification Commands

Sentry's auth system is hand-rolled Django, not allauth or python-social-auth. The patterns in `django.md` do not directly apply. This reference covers Sentry's custom auth pipeline, where the same class of IdP-claim-trust bugs has produced multiple critical account takeovers.

## The Auth Pipeline

Sentry's SSO auth flow is managed by `AuthHelper` in `src/sentry/auth/helper.py`. It dispatches based on flow type:

| Flow | Entry | Purpose |
|------|-------|---------|
| `FLOW_LOGIN` | SSO login callback | Authenticate or link a user via an existing IdP |
| `FLOW_SETUP_PROVIDER` | Admin SSO setup wizard | Configure a new IdP for an organization |

Both flows can trigger `handle_attach_identity`, which creates or updates `AuthIdentity` rows. Both flows use `self.user` to decide which user the identity gets attached to. Both are attack surfaces.

## The Dangerous Property: `AuthIdentityHandler.user`

`AuthIdentityHandler` has a `user` cached property that resolves the target user. The historical (vulnerable) implementation preferred IdP email over the session:

```python
# VULNERABLE SHAPE (historical)
@cached_property
def user(self):
    email = self.identity.get("email")  # from IdP -- attacker-controlled
    if email:
        user = resolve_email_to_user(email, organization=self.organization)
        if user is not None:
            return user  # returns victim
    return (
        User.objects.get(id=self.request.user.id)
        if self.request.user.is_authenticated
        else self.request.user
    )
```

This is the core bug. Every downstream method that calls `self.user` to decide whose identity to create, update, or link is trusting the IdP's email claim as proof of identity. A rogue IdP admin sets any email and the linked user changes.

The safe shape: `self.user` resolves from the authenticated session. IdP email is informational, not authoritative.

```python
# SAFE SHAPE
@cached_property
def user(self):
    if self.request.user.is_authenticated:
        return User.objects.get(id=self.request.user.id)
    return self.request.user
```

### What to check

When a diff modifies `AuthIdentityHandler.user` or any code that calls it:

1. Does the resolution path ever prefer IdP claims over `request.user`?
2. Is there a fallback chain where IdP email is tried first and session user second?
3. In `FLOW_SETUP_PROVIDER`, is the IdP email overridden with the admin's session email?

## `handle_attach_identity`

This method creates or updates an `AuthIdentity` row. It uses `self.user.id` as the target. If `self.user` came from IdP email resolution, the attacker controls which user gets the identity.

Two entry paths:

1. **Login flow**: user authenticates via SSO; code finds or creates an `AuthIdentity` linking the IdP subject to a local user.
2. **Setup flow**: admin configures SSO; the admin's identity is linked as part of the setup process.

Both paths are exploitable if `self.user` resolves from IdP email.

### Shapes to flag

- `AuthIdentity.objects.create(..., user_id=self.user.id, ...)` where `self.user` derives from IdP claims.
- `auth_identity.update(user_id=self.user.id, ...)` that reassigns an existing identity to a different user based on IdP email.
- Any branch that reaches `handle_attach_identity` gated only by `request.user.is_authenticated` without verifying the authenticated user matches the identity target.

## `AuthIdentity` Lifecycle

`AuthIdentity` rows link an IdP subject to a local user. When a user is deactivated or deleted, their `AuthIdentity` rows must be cascade-deleted. An orphaned `AuthIdentity` (pointing at a deactivated user) can be found by `_get_auth_identity(ident=...)` and reassigned to a different user in a subsequent linking flow.

GHSA-ggmg-cqg6-j45g is this shape: attacker creates and deactivates a user via their own SSO, leaving an orphaned `AuthIdentity`. They then sign into a different account, trigger SSO again with the victim's email, and the orphaned identity gets reattached.

### What to check

- When user deactivation/deletion code runs, does it also delete `AuthIdentity` rows?
- When `_get_auth_identity` returns an identity for a deactivated user, does the code treat it as a new-user case or does it proceed to reattach?
- `rg -n 'is_active.*False|deactivate' src/sentry/models/user.py` and trace whether `AuthIdentity.objects.filter(user=user).delete()` follows.

## `FLOW_SETUP_PROVIDER`

The SSO setup flow has the same `handle_attach_identity` call path as the login flow. The admin setting up SSO is redirected to the IdP to authenticate, and on return the code links their identity. If the code resolves the target user from the IdP email (which the admin controls in their IdP), the admin can link any user's account.

GHSA-rcmw-7mc7-3rj7 is this shape. The fix: in the setup flow, override IdP email with the authenticated admin's email so the IdP cannot steer the link to a different account.

### What to check

- Does the setup flow override `self.identity["email"]` with `request.user.email` before calling `handle_attach_identity`?
- Are there separate code paths for `FLOW_LOGIN` vs `FLOW_SETUP_PROVIDER`? The setup flow needs stricter controls because the admin *controls the IdP*.

## Bug Shapes Summary

1. **`self.user` resolves from IdP email.** Any code path where the `user` property or method prefers `identity["email"]` over `request.user`.
2. **`handle_attach_identity` gated by `is_authenticated` alone.** Being authenticated is not the same as being the target. Must verify `request.user.id == target_user.id`.
3. **Orphaned `AuthIdentity` after deactivation.** Identity rows not cascade-deleted. Existing identity for deactivated user gets reassigned.
4. **Setup flow trusts IdP email.** `FLOW_SETUP_PROVIDER` does not override IdP email with admin session email.
5. **`_get_auth_identity` returns stale identity.** Code finds an identity for a deactivated or deleted user and proceeds to update it instead of treating it as an error.

## Verification Commands

```bash
# AuthIdentityHandler.user resolution
rg -n 'def user|resolve_email_to_user|identity.*email' src/sentry/auth/helper.py

# handle_attach_identity call sites and implementation
rg -n 'handle_attach_identity' src/sentry/auth/

# AuthIdentity create/update
rg -n 'AuthIdentity\.objects\.(create|filter|get|update)' src/sentry/

# Identity cleanup on deactivation
rg -n 'is_active.*False|deactivate|delete.*user' src/sentry/models/user.py
rg -n 'AuthIdentity.*delete\|delete.*AuthIdentity' src/sentry/

# Flow type dispatch
rg -n 'FLOW_SETUP_PROVIDER|FLOW_LOGIN|_finish_setup' src/sentry/auth/

# Identity resolution methods
rg -n '_get_auth_identity' src/sentry/auth/helper.py
```
