# Flask Access-Control Reference

Load when the diff touches Flask routes, `@login_required`, `before_request` hooks, Blueprints, or session handling. Flask has no built-in auth; everything is explicit.

## Auth Defaults

**Allow by default.** A new `@app.route("/thing")` is public until a decorator or `before_request` hook says otherwise.

## How Auth Attaches

1. **Decorators on view functions**: `@login_required` (Flask-Login), custom decorators.
2. **`before_request` hooks**: app-level or Blueprint-level. Run before every matching request.
3. **Blueprint-level guards**: `before_request` registered on the Blueprint.

## Canonical Bug Shapes

### 1. Decorator order

```python
@login_required
@app.route("/admin/users")
def list_users():
    return {...}
```

This is a silent bypass. `@app.route` registers the view under the Flask app at decoration time. The `@login_required` decorator, placed *above* `@app.route`, wraps the already-registered view but the registered reference still points to the undecorated function.

**Correct order:**

```python
@app.route("/admin/users")
@login_required
def list_users():
    return {...}
```

The route decorator must be on the outside. Any deviation is a bug.

This is one of the most durable Flask footguns. Grep diffs that add `@login_required` for cases where it appears before `@route`.

### 2. `before_request` skip list that's too permissive

```python
@app.before_request
def require_login():
    if request.path.startswith("/public") or request.path.startswith("/api/docs"):
        return
    if not g.user:
        abort(401)
```

Problems:

- `request.path.startswith("/public")` also matches `/publicly-leaked-data`. Missing trailing slash.
- New public-ish path added to the skip list without review.
- Path-based skip can be fooled by path normalization (`/..%2f/admin`). Flask's router normalizes before dispatch, but proxies and some middlewares can confuse the matcher.

Prefer an allowlist keyed on the endpoint name (`request.endpoint`) rather than the path, and a deny-by-default stance.

### 3. Blueprint without a `before_request` hook

```python
admin_bp = Blueprint("admin", __name__, url_prefix="/admin")

@admin_bp.route("/users")
def list_users():
    return {...}
```

If the app-level `before_request` hook doesn't cover `/admin` (e.g., because it only checks session for certain paths), the Blueprint is public. Register a Blueprint-level `before_request` on admin Blueprints so auth travels with the Blueprint.

```python
@admin_bp.before_request
def require_admin():
    if not current_user.is_admin:
        abort(403)
```

### 4. `session["user_id"]` trusted without validation

```python
@app.before_request
def load_user():
    uid = session.get("user_id")
    if uid:
        g.user = User.query.get(uid)
```

Problems:

- Session cookie is trusted. If `SECRET_KEY` is weak or reused, attacker forges `user_id`.
- No check that the user still exists or is active. A deleted/banned user can keep acting via an existing session until `get` returns `None` and then `g.user` is None silently.
- No validation that the session version/token matches (for revocation on password change).

Pair session auth with a server-side session store or an explicit session version check.

### 5. No session regeneration on login

```python
@app.post("/login")
def login():
    user = authenticate(request.form["email"], request.form["password"])
    if user:
        session["user_id"] = user.id
        return redirect("/")
```

Session fixation. An attacker can set a session cookie on the victim (via subdomain, proxy, or simple physical access) and, once the victim logs in, the attacker's pre-existing session is now authenticated.

Use `session.clear()` or the newer `session.regenerate()` (where available) on login. See `sessions.md` for the cross-framework guidance and real CVEs.

### 6. `@app.route` without method restriction

```python
@app.route("/admin/delete")  # Default allows only GET, but...
def delete_admin():
    # ...the function state-changes and is decorated @csrf_exempt.
```

Not strictly access control, but a GET that mutates is reachable via `<img>` and similar link-based primitives. Restrict methods explicitly when the handler mutates.

## Flask-Login Specifics

- `current_user.is_authenticated` is the real check; `if current_user:` is always truthy (it's `AnonymousUserMixin` when logged out).
- `@login_required` uses `current_user.is_authenticated`.
- `login_user(user)` does NOT regenerate the session by default. Configure `SESSION_PROTECTION = "strong"` (regenerates on IP/User-Agent change but not always on login) or handle rotation explicitly.
- `logout_user()` clears the Flask-Login state but does not call `session.clear()`; residual session keys persist.

## False-Positive Traps

- **`before_request` at app level** may protect the route even without a decorator on the handler. Check the app factory.
- **Blueprint registered under an already-protected Blueprint**: nested Blueprints inherit prefixes and hooks.
- **Reverse-proxy auth**: production app deployed behind an auth proxy. Missing in-app decorator is not a bug if the proxy enforces identity.
- **Explicitly public endpoints**: `/healthz`, `/login`, `/signup`, webhooks, `/.well-known/*`.

## Diff Heuristics

1. **`@login_required` placed above `@app.route`** (or above `@<blueprint>.route`).
2. **New Blueprint with sensitive routes but no Blueprint-level `before_request`** and no evidence the app-level hook covers it.
3. **New path added to a `before_request` skip list.** Read the full skip list and verify the prefix doesn't match unintended paths.
4. **`session.clear()` or session rotation missing on login.** Session fixation.
5. **`session["user_id"]` set without verifying the user exists and is active.**
6. **`@csrf_exempt` on a new handler that lacks auth.**
7. **`LoginManager` not configured with `session_protection`**, or explicitly set to `None` where session rotation matters.

## Verification Commands

```bash
# Find decorator-order inversions
rg -n -B1 '@app\.route' <project> --type py | rg -B1 'login_required'

# before_request hooks
rg -n 'before_request' <project> --type py

# Blueprint declarations
rg -n 'Blueprint\(' <project> --type py

# Login flows
rg -n 'login_user\(|session\["user_id"\]|session\.regenerate' <project> --type py

# CSRF exemptions
rg -n '@csrf_exempt|@exempt' <project> --type py
```
