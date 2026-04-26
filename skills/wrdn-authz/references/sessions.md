# Session and Password-Reset Reference

Load when the diff touches login, logout, session creation/destruction, password reset, email confirmation, or any flow that establishes or invalidates a principal binding.

Session handling bugs are rarely exotic. They are missing rotations, missing invalidations, and tokens not bound to the principal they authenticate.

## The Three Contracts

### 1. Rotate the session identifier on login

Failing to rotate is **session fixation**. Attacker plants a session cookie on the victim (via a shared subdomain, a proxy, a tab they control), waits for the victim to log in, then uses the same cookie — now authenticated.

**Real incidents:**

- Keycloak CVE-2024-7341: SAML adapter didn't rotate `JSESSIONID` at login.
- PrestaShop CVE-2023-25170: session attributes + CSRF token preserved across auth boundary.
- Bludit CVE-2024-24552: classic fixation; pre-set cookie adopted on login.

**Rotation idioms by framework:**

| Framework | Call |
|-----------|------|
| Django | `request.session.cycle_key()` (Django does NOT rotate automatically on login). |
| Flask | `session.clear()` then set new values, or framework-specific regeneration. |
| express-session | `req.session.regenerate(cb)` — takes a callback; must set new session data inside. |
| Ruby on Rails | `reset_session` then set values. |
| ASP.NET Core | New `HttpContext.Session` automatically if cookie changes; explicit sign-in regenerates. |
| FastAPI (Starlette session middleware) | Session is serialized into a cookie each response; on login, clear and re-set. |

Any login handler that sets authentication state without a prior rotation call is a session fixation bug. Grep the login path for the rotation idiom.

### 2. Invalidate server-side state on logout

```python
# Bad:
def logout(request):
    response = redirect("/")
    response.delete_cookie("sessionid")
    return response
```

Deleting the client cookie doesn't end the session server-side. If the cookie leaks (shared machine, compromised browser, legacy copy), it continues to work.

```python
# Safe:
def logout(request):
    django_logout(request)  # Flushes server-side session.
    return redirect("/")
```

Same rule across frameworks: destroy the session on the server, not just the cookie on the client.

### 3. Invalidate all sessions on credential change

Password change, email change, suspicious-activity detection, forced revocation: all require invalidating every active session for the user, not just the current one.

Implementations:

- A `session_version` column on the user, bumped on credential change; every session-decoded claim is compared to the current version.
- A server-side session store queried on every request.
- For stateless JWTs: a `token_version` claim compared against the user's current version.

**Bug shape**: password reset flow that changes the password but leaves existing sessions active. An attacker who retains a session cookie from before the reset continues to have access.

## Password Reset Tokens

Reset tokens are the most-abused auth primitive. A reset token is a bearer credential for the duration of its validity; every property of a session cookie applies.

### Contracts

1. **Single use.** Redeeming a token invalidates it.
2. **Expiring.** Short window (minutes to hours), not days.
3. **Bound to the verified primary email.** Not a claim in the request body; the email on the user record at the time of issuance.
4. **Unguessable.** Cryptographically random, at least 128 bits.
5. **Constant-time comparison** on lookup.
6. **Invalidated on account changes.** Deleting an account, changing the primary email, or enabling/disabling 2FA should invalidate outstanding reset tokens.

### Real incidents

**GitLab CVE-2023-7028**. Password reset endpoint accepted an *array* of emails. The code iterated and sent to all, including attacker-controlled unverified addresses. Severity 10.0.

Root cause: the reset flow did not bind the token to a single, verified principal. Any attacker who could list their own email alongside the victim's received a valid token.

**H1 #230076 (Weblate)**: reset token remained valid after account deletion. Re-registering with the same email produced a new account; the old reset token now authenticated into the new account.

**Host-header poisoning class**: reset link built from `Host:` header. Attacker sends reset request with a crafted `Host: attacker.com`; victim receives link pointing at attacker's domain; clicking leaks the token.

### Canonical bug shapes

1. **Reset email built from `request.get_host()` / `req.headers.host` without an allowlist.** Host-header poisoning.
2. **Reset token stored as plaintext** (lookup by `token=X`). A database leak hands over every reset.
3. **Reset token not invalidated after use.** Can be replayed.
4. **Reset endpoint returns different responses for existing vs non-existent emails.** Enumeration primitive; not strictly access control but commonly paired.
5. **Reset token not bound to the email on the user record at the time of issuance.** Changing email before redemption shouldn't let the old token still work against the new email.
6. **Reset accepts the new password in the GET request.** Landed in logs.

## Session Cookies

### Flags

- `HttpOnly`: prevents JS access; required for session cookies.
- `Secure`: HTTPS only; required in production.
- `SameSite`: `Lax` is the Chrome default; `Strict` for sensitive admin sessions; `None` requires `Secure` and explicit consideration.
- `Domain`: don't set to a parent domain you don't control exclusively. A `.example.com` session cookie is readable by `untrusted.example.com`.
- `Path`: scope narrowly for admin sessions.

**Bug shapes:**

- `SameSite=None` without `Secure` (browser rejects, but the intent is concerning).
- Setting a session cookie on `.example.com` when untrusted subdomains exist.
- Missing `HttpOnly` on the session cookie.

### Lifetime

- Idle timeout (inactivity-based).
- Absolute timeout (max session age, e.g., 24 hours).
- Sensitive-action re-auth (sudo-style, for admin actions).

A new session flow that has no absolute expiration is a finding when the product previously had one.

## Login Rate Limiting (Related, Not Strictly Access-Control)

Missing rate limiting on login is traditionally a DoS + credential-stuffing concern. It becomes authorization when combined with:

- Account lockout that can be triggered for arbitrary users (DoS via lockout).
- Password-reset flows that leak outstanding tokens.

Flag as defense-in-depth, not as a direct bypass.

## Impersonation Sessions

See `getsentry.md` for the full contract. General principle:

- Impersonation requires elevated role (staff).
- Every impersonated action logs actual_user + target user.
- Impersonation sessions have a tight absolute expiration.
- Impersonation does not allow escalating to other staff/admin accounts.

## Canonical Bug Shapes (Login Flows)

1. **Login handler sets `session["user_id"]` without rotation.** Session fixation.
2. **Logout deletes the cookie but doesn't invalidate the session on the server.**
3. **Password change doesn't invalidate other active sessions.**
4. **Reset token lookup by plaintext value.**
5. **Reset token is not single-use.**
6. **Reset email built from `Host:` without allowlist.**
7. **`session_version` / `token_version` absent on the user model, when the product supports forced revocation.**
8. **"Remember me" cookie that decodes to an identity claim without server-side validation.**

## Verification Commands

```bash
# Session rotation idioms
rg -n 'cycle_key|session\.regenerate|reset_session|session\.clear' <project>

# Login handlers
rg -n 'def login|@app\.post\("/login"\)|router\.post\([\x27"]/login' <project>

# Logout handlers
rg -n 'def logout|@app\.post\("/logout"\)' <project>

# Password reset flows
rg -n 'reset.*token|password.*reset|forgot.*password' <project>

# Host header usage in email/link building
rg -n 'get_host|headers\.host|request\.host' <project>

# Cookie flags
rg -n 'HttpOnly|Secure|SameSite' <project>
```
