# FastAPI Access-Control Reference

Load when the diff touches FastAPI routers, `Depends`, `APIRouter`, dependency injection, or Starlette middleware. FastAPI has no built-in route protection; every route is public until a dependency says otherwise.

## Auth Defaults

**Allow by default.** A new `@app.get("/whatever")` is public. There is no global "all routes require auth" unless someone wired it.

## How Auth Attaches

1. **Per-route dependency**: `user: User = Depends(get_current_user)` as a parameter on the handler.
2. **Router-level dependencies**: `APIRouter(dependencies=[Depends(require_user)])`. Applies to every route on that router.
3. **App-level dependencies**: `FastAPI(dependencies=[...])`. Applies to every route on the app.
4. **Middleware**: `app.add_middleware(AuthMiddleware)`. Runs before any handler. Most auth in FastAPI uses dependencies, not middleware.

## Canonical Bug Shapes

### 1. Dependency declared but not referenced

```python
async def get_current_user(token: str = Header(...)) -> User: ...

@app.get("/admin/users")
async def list_users():  # Missing `user: User = Depends(get_current_user)`.
    return await db.users.find_all()
```

A dependency that is not referenced in the signature or in `router.dependencies` does nothing. Adding it to a file is not protection.

This is the shape reported in several MLflow-style incidents: some endpoints wire the auth dependency, some don't, and the ones without it remain public while looking identical.

### 2. `include_router` without dependency propagation

```python
admin_router = APIRouter(prefix="/admin", dependencies=[Depends(require_admin)])

# Later, in a different file, someone includes a subrouter without the same gate:
admin_router.include_router(new_admin_router)
```

The `new_admin_router`'s routes inherit from `admin_router` correctly in this shape. But the inverse is common:

```python
# The gated router:
admin_router = APIRouter(prefix="/admin", dependencies=[Depends(require_admin)])

# Included directly on the app, bypassing the gate:
app.include_router(new_admin_router, prefix="/admin/new")
```

Verify the inclusion path for every new admin-ish router.

### 3. `dependency_overrides` left in place

```python
# In tests:
app.dependency_overrides[get_current_user] = lambda: FakeAdminUser()

# Left in a module imported at runtime, or not cleared in a fixture teardown:
```

Check that `dependency_overrides` is only populated inside test fixtures, and only in the test app instance.

### 4. Auth dependency that accepts `None`

```python
async def get_current_user(token: str | None = Header(None)) -> User | None:
    if token is None:
        return None  # Anonymous.
    return await resolve_user(token)
```

This dependency is valid for routes that support both auth and anonymous access. But if a handler uses it and does not then reject anonymous users, auth is effectively optional:

```python
@app.delete("/items/{id}")
async def delete_item(id: int, user: User | None = Depends(get_current_user)):
    await db.items.delete(id=id)  # No check that user is not None.
```

Separate dependencies for "requires auth" (raises 401 if no token) and "optional auth" (returns None).

### 5. `OAuth2PasswordBearer` without `auto_error`

```python
oauth2 = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

@app.get("/me")
async def me(token: str | None = Depends(oauth2)):
    # token can be None. If the handler forgets to check, anonymous passes.
```

`auto_error=False` changes the dependency from "401 if no token" to "returns None if no token." If the handler does not explicitly reject None, it is an auth bypass.

### 6. Middleware-based auth that returns without calling `call_next`

```python
class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        if request.url.path.startswith("/public"):
            return await call_next(request)
        if not self._check(request):
            return Response(status_code=401)
        return await call_next(request)
```

Path-prefix skip lists are fine when the prefix list is accurate. Common bug: `/publicly-exposed-secrets` matches `/public`. `startswith` without a trailing slash check is the footgun.

### 7. HTTPBearer not checking the scheme

```python
bearer = HTTPBearer()

@app.get("/me")
async def me(creds: HTTPAuthorizationCredentials = Depends(bearer)):
    user = decode_jwt(creds.credentials)  # Trusts the token's claims.
```

`HTTPBearer` only validates that a bearer token was provided; it does not verify the token. The verification is up to the caller. Pair with proper JWT verification (see `jwt.md`).

## False-Positive Traps

- **Dependency on the class, not the handler.** A method on a class-based route does not need its own `Depends` if the class-level or router-level dependencies cover it.
- **Global middleware.** Check `app.add_middleware(...)` calls in the app factory. A global auth middleware may protect every route, making the missing per-route dependency benign.
- **`oauth2_scheme` with `auto_error=True` (default)** already raises 401 on missing token. Combined with `Depends(get_current_user)` that decodes the token and raises on invalid, a route with just `user: User = Depends(get_current_user)` is protected.

## Diff Heuristics

1. **New endpoint in an admin/internal router without a `Depends(require_*)` parameter or inherited router dependency.** Check both signature and `APIRouter(dependencies=[...])` in the file and the inclusion chain.
2. **`auto_error=False` on an OAuth2/HTTP scheme dependency, paired with a handler that doesn't check for `None`.**
3. **`app.include_router` that drops the dependencies of the source router.**
4. **`dependency_overrides` touched outside a test file.**
5. **Dependency function that returns a user-like object on decoding error rather than raising.** Decode failures must raise `HTTPException(401)`, not return `AnonymousUser`.

## Verification Commands

```bash
# All include_router calls
rg -n 'include_router\(' <project> --type py

# Every APIRouter declaration and its dependencies
rg -n 'APIRouter\(' <project> --type py

# Global middleware
rg -n 'add_middleware' <project> --type py

# Dependency overrides
rg -n 'dependency_overrides' <project> --type py

# OAuth2 scheme definitions and auto_error settings
rg -n 'OAuth2PasswordBearer|HTTPBearer' <project> --type py
```
