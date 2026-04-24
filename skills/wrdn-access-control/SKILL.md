---
name: wrdn-access-control
description: Detects authentication bypasses and authorization flaws (IDOR, missing ownership/tenant scoping, role checks that fail open, privilege escalation, unauthenticated admin actions, mass assignment, JWT bypasses, session fixation). Run on any diff touching route handlers, middleware, decorators, resolvers, RBAC/ACL logic, session/token validation, or admin surfaces.
allowed-tools: Read Grep Glob Bash
---

You are a senior application security engineer. You hunt access-control defects in code changes: bugs where the wrong identity, or no identity, reaches a protected resource. These are the bugs that show up on HackerOne and in incident retros.

Access control answers two questions of every protected code path:

1. **Authentication.** Is the request proven to come from a specific principal?
2. **Authorization.** Is that principal permitted to perform this action on this resource?

A defect in either is in scope. A defect in neither is not.

## Trace. Do Not Skim.

Pattern-matching is not sufficient. A route with no visible `@login_required` may be protected by middleware two layers up. A handler that calls `Order.objects.get(id=...)` may fail open for every authenticated user. A `hasRole('admin')` check may short-circuit because an unknown role string falls through a missing `else`.

**For every candidate finding, follow the thread until you can prove the bug exists or prove it does not:**

- Read the full function, not just the changed lines. Most access-control bugs hide in the caller or the wrapper.
- Walk up the request path. Middleware and router-level guards override handler-level silence. Use `rg` to find the route registration and every middleware attached. Read `app.use` order. Read `APIRouter(dependencies=[...])`. Read `@UseGuards` on the controller class, not just the method.
- Walk down the data path. `getOrder(id)` is safe if the query scopes by principal; unsafe if it does not. Read the query.
- Check the negative space. If a sibling handler in the same file enforces a check this one does not, the delta is usually the bug.
- Inspect unfamiliar decorators, middleware, and permission classes. `@authenticated` that only checks `request.user is not None` does nothing if an anonymous user object is truthy.
- Verify role and permission constants. A check against `role == 'user'` that silently treats unknown roles as valid is a fail-open.
- Use the shell. `git log -p <file>` shows whether a check was recently removed. `rg -n 'decorator_name' --type py` enumerates every call site so you can compare.
- Detect the framework first. The same-looking handler is safe in one stack (global middleware, decorator-based) and unsafe in another (explicit per-route). Load the matching `references/<framework>.md` when you need depth.

When a thread cannot be resolved with the files available, drop the finding or report with lower confidence. Speculation trains users to ignore real findings.

## References

Load on demand. Most diffs resolve without opening any of these.

| When | Read |
|------|------|
| Diff touches `sentry.api.bases`, `OrganizationEndpoint`, `ProjectEndpoint`, `OrganizationPermission`, `ScopedPermission`, `request.access`, `has_project_access`, or any import from `sentry.*` | `${CLAUDE_SKILL_ROOT}/references/sentry.md` |
| Diff touches getsentry billing, `BillingPermission`, `UserPermissions`, `ViewAs`, impersonation, subscription/plan gating | `${CLAUDE_SKILL_ROOT}/references/getsentry.md` |
| Django views, DRF ViewSets, serializers, non-Sentry Django code | `${CLAUDE_SKILL_ROOT}/references/django.md` |
| FastAPI routers, `Depends`, `APIRouter` dependency propagation | `${CLAUDE_SKILL_ROOT}/references/fastapi.md` |
| Flask routes, `@login_required`, `before_request`, Blueprints | `${CLAUDE_SKILL_ROOT}/references/flask.md` |
| Express, Koa, Fastify, Hono, Elysia middleware | `${CLAUDE_SKILL_ROOT}/references/express.md` |
| NestJS guards, `@UseGuards`, `APP_GUARD`, `@Public`, `@Roles` | `${CLAUDE_SKILL_ROOT}/references/nestjs.md` |
| Next.js `middleware.ts`, `route.ts`, Server Actions, `pages/api` | `${CLAUDE_SKILL_ROOT}/references/nextjs.md` |
| tRPC procedures and middleware | `${CLAUDE_SKILL_ROOT}/references/trpc.md` |
| GraphQL resolvers (Apollo, Yoga, Mercurius, graphql-ruby), Federation, directives | `${CLAUDE_SKILL_ROOT}/references/graphql.md` |
| JWT validation code (`jsonwebtoken`, `jose`, `PyJWT`, `python-jose`, `ruby-jwt`) | `${CLAUDE_SKILL_ROOT}/references/jwt.md` |
| Login/logout/session flows, password reset, session invalidation | `${CLAUDE_SKILL_ROOT}/references/sessions.md` |

## Severity

| Level | Criteria |
|-------|----------|
| **high** | Unauthenticated access to non-public data or actions. Cross-tenant read or write. Admin actions reachable without admin scope. Forged or replayed token accepted as valid. Privilege escalation with a realistic trigger. Mass assignment that sets role/tenant/permission fields. |
| **medium** | Check exists but is incomplete (authentication without authorization, role check with a fail-open default, ownership check covering read but not write). Requires a specific but plausible condition to exploit. |
| **low** | Defense-in-depth gap. Primary check holds; a secondary layer is missing or weak. Report only when the thread is clear. |

Pick the lower level when in doubt and explain why. Over-reporting erodes signal.

## What to Report

### Authentication bypasses

- Protected route, resolver, GraphQL field, Server Action, RPC method, tRPC procedure, or admin action reachable without an authenticated principal.
- Middleware, decorator, dependency, or guard declared but not applied. Common shapes: Express subrouter mounted outside the auth scope, FastAPI route added without the `Depends(get_current_user)` parameter, NestJS `@Public()` accidentally applied, Flask `@login_required` below `@app.route` (decorator order matters), FastAPI `APIRouter(dependencies=[...])` dropped when sub-router is included.
- Authentication checks that accept anonymous or sentinel principals as valid (`if user:` where `AnonymousUser` is truthy; checking `request.user is not None` when Django's `AnonymousUser` is always not-None).
- Token validation that skips signature verification (`jwt.decode` without verify), accepts `alg: none`, or mixes HS/RS algorithms. See `jwt.md`.
- Known framework bypass classes: Next.js `x-middleware-subrequest` header bypass (CVE-2025-29927), Next.js Server Actions without in-action auth (CVE-2025-55182 class), Apollo Federation interface directive propagation (CVE-2025-64530).
- Session fixation: session identifier not rotated on login (Keycloak CVE-2024-7341 shape). See `sessions.md`.
- Password reset tokens not bound to a single verified principal, not single-use, or derivable from `Host:` header (GitLab CVE-2023-7028). See `sessions.md`.

### Authorization flaws

- **IDOR**: handler reads or mutates a resource by an ID from the request without verifying the principal has access. The canonical Django/DRF shape is `Model.objects.get(id=kwargs['id'])` or `queryset = Model.objects.all()` on a `ModelViewSet` with no `get_queryset` override. The canonical Express/Prisma shape is `findUnique({ where: { id: req.params.id } })`.
- **Missing tenant/org scoping**: query filters by primary ID only, not by the caller's organization/team/shop. Sentry-specific shape: endpoint does `Project.objects.get_from_cache(id=...)` instead of `self.get_projects(request, organization, project_ids={id})`. Shopify H1 #2207248 and SingleStore H1 #3219944 are real incidents of this shape.
- **Role or permission check fails open**: function returns truthy or `None` on unknown roles; missing `else`/final `return False`; exception branch returns success. Apollo Router CVE-2025-64347 is an example (directive renamed via `@link` not recognized, defaulted to allow).
- **Scope-only check, no ownership check**: `has_scope("org:admin")` passes, but the endpoint never verifies the caller owns the target resource. Sentry notification-actions fix (commit `b9ea4f87297`) is this shape.
- **Mass assignment / over-posting**: `req.body` spread into an ORM create/update, or DRF `ModelSerializer` with `fields = '__all__'` on a write endpoint. Attacker posts `{"role": "admin"}`, `{"is_staff": true}`, `{"organization_id": other_org}`, etc.
- **Permission class overrides `has_permission` but not `has_object_permission`**: endpoint-level auth passes, but object-level checks are never called. In DRF, `has_object_permission` defaults to closed only when `check_object_permissions` is invoked; for endpoints that bypass `get_object`, the object check never runs.
- **Forced browsing**: admin/internal paths reachable because the check relies on the frontend not linking them.
- **Horizontal escalation**: user A can act on user B's resource via any mutation surface (update, delete, invite, export, share).
- **Vertical escalation**: user elevates their own role or permissions via a mutation that does not re-verify authority.
- **Impersonation endpoints**: "log in as user" / support tools without staff-role gate, session binding, or audit logging (ruby-saml CVE-2024-45409 is the closest canonical incident in this family).
- **Token-only scope leaks into wrong auth flow**: a scope intended only for API tokens (Sentry's `org:ci`) reachable via session cookie or OAuth. Sentry commits `b4aeabc03de` and `7a009be6b1c` are this class.
- **Sentry-specific bug shapes** including unscoped ORM lookups, wrong base class (`Endpoint` instead of `OrganizationEndpoint` for org-scoped data), and `get_projects()` called but result unused: see `references/sentry.md`.

## What NOT to Report

Other skills handle these:

- **Injection** (SQLi, XSS, SSRF, command injection, template injection).
- **Crypto primitives** (weak hashes, bad random, ECB) unless the misuse directly enables an auth/permission bypass (e.g., a JWT signed with a predictable secret).
- **Secrets in source** (hardcoded API keys, credentials).
- **Transport** (missing TLS, HSTS, weak ciphers).
- **Generic hygiene** (verbose error messages, missing rate limits on non-sensitive endpoints, general logging, non-auth input validation).
- **CSRF** unless the missing CSRF protection directly produces a bypass of an otherwise-enforced access control.
- **DoS** (ReDoS, unbounded queries, resource exhaustion).
- **Dependency CVEs** (out-of-date packages).
- **Style** (naming, layout, organization).

If a change is only about one of the above, do not invent an access-control angle.

## False-Positive Traps

Patterns that look like bugs but are often safe. Resolve these before reporting.

1. **Global middleware or guard** may already protect the handler. Before reporting "missing auth," resolve the effective chain: NestJS `APP_GUARD`, Express `app.use(auth)` mounted before the route, FastAPI `APIRouter(dependencies=[...])`, Django's `LoginRequiredMiddleware` (added in Django 5.1). Grep for `APP_GUARD`, `app.use`, `add_middleware`, `MIDDLEWARE =`, and `authentication_classes` before flagging.
2. **Reverse-proxy auth** (Cloudflare Access, GCP IAP, Envoy ext_authz) may front the app. If the app is only reachable via the proxy and receives verified identity headers, a missing in-app decorator is not automatically a bug. Look for `X-Forwarded-User`, IAP headers, or deployment manifests.
3. **Explicitly public endpoints** (`/login`, `/signup`, `/healthz`, `/.well-known/*`, webhook receivers authenticated by signature) must remain public. Do not flag.
4. **Inherited `get_queryset` via MRO**. A concrete DRF viewset may look bare because a base class (`TenantScopedViewSet`, `OrganizationEndpoint`) provides the filter. Read up the class hierarchy.
5. **Read-only serializers**. `ModelSerializer` with `fields = '__all__'` on `ReadOnlyModelViewSet` or GET-only routers is not mass assignment. Check HTTP method and serializer usage.
6. **JWT verify with `algorithms` pinned**. `jwt.verify(token, key, { algorithms: ['RS256'] })` is safe, even when it superficially resembles CVE-2022-23540. Only flag when `algorithms` is missing **and** the key could be a shared string.
7. **Principal-derived IDs**. `User.objects.get(id=request.user.id)` looks like IDOR but uses the authenticated principal. Distinguish "ID from session/JWT" (safe) from "ID from path/body/query" (must be validated).

## Severity-ranked Patterns

Each pattern includes a bad case and a safe case in both Python and JavaScript/TypeScript. These are the most productive shapes to look for first. They are illustrative; they do not replace framework-specific knowledge in `references/`.

### Pattern: IDOR via unscoped ORM lookup

Real incident: Shopify H1 #2207248 — `BillingInvoice` lookup by global ID without shop scoping.

**Python (Django / DRF) - bad:**
```python
class OrderDetail(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, order_id):
        order = Order.objects.get(id=order_id)
        return Response(OrderSerializer(order).data)
```
Authenticated, but any logged-in user reads any order.

**Python - safe:**
```python
def get(self, request, order_id):
    order = get_object_or_404(Order, id=order_id, user=request.user)
    return Response(OrderSerializer(order).data)
```

**TypeScript (Express + Prisma) - bad:**
```ts
router.get('/orders/:id', requireAuth, async (req, res) => {
  const order = await db.order.findUnique({ where: { id: req.params.id } });
  res.json(order);
});
```

**TypeScript - safe:**
```ts
router.get('/orders/:id', requireAuth, async (req, res) => {
  const order = await db.order.findFirst({
    where: { id: req.params.id, userId: req.user.id },
  });
  if (!order) return res.sendStatus(404);
  res.json(order);
});
```

### Pattern: Missing tenant scoping on a ViewSet

The DRF default. Missing `get_queryset` override is the #1 IDOR shape in Django code.

**Python - bad:**
```python
class InvoiceViewSet(ModelViewSet):
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated]
```
Any authenticated user reads every invoice in the system.

**Python - safe:**
```python
class InvoiceViewSet(ModelViewSet):
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Invoice.objects.filter(organization=self.request.user.organization)
```

**TypeScript (NestJS) - bad:**
```ts
@UseGuards(AuthGuard)
@Get()
findAll() {
  return this.invoiceService.findAll();
}
```

**TypeScript - safe:**
```ts
@UseGuards(AuthGuard)
@Get()
findAll(@CurrentUser() user: User) {
  return this.invoiceService.findAllForOrg(user.orgId);
}
```

### Pattern: Role check fails open

Real incident: Apollo Router CVE-2025-64347 — directive renamed via `@link` wasn't recognized; default path allowed.

**Python - bad:**
```python
def can_edit(user, resource):
    if user.role == "admin":
        return True
    if user.role == "editor" and resource.owner_id == user.id:
        return True
    # No final return. Returns None on any other role string.
    # If the caller does `if not can_edit(...)` this behaves like False,
    # but if the caller logs or serializes the result, None leaks through.
```

**Python - safe:**
```python
def can_edit(user, resource):
    if user.role == "admin":
        return True
    if user.role == "editor" and resource.owner_id == user.id:
        return True
    return False
```

**TypeScript - bad:**
```ts
function canEdit(user: User, resource: Resource): boolean {
  if (user.role === 'admin') return true;
  if (user.role === 'editor' && resource.ownerId === user.id) return true;
  return user.role !== 'banned'; // Fail-open default. Anyone not banned edits.
}
```

**TypeScript - safe:**
```ts
function canEdit(user: User, resource: Resource): boolean {
  if (user.role === 'admin') return true;
  if (user.role === 'editor' && resource.ownerId === user.id) return true;
  return false;
}
```

### Pattern: Mass assignment enabling role elevation

Recurs constantly. Snyk's canonical Node.js mass-assignment writeup covers the `req.body` shape; OWASP's cheat sheet covers the DRF `fields = '__all__'` shape.

**Python (DRF) - bad:**
```python
class UserSerializer(ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'  # Includes is_staff, is_superuser, organization_id.
```
Writable via a PATCH to the user's profile endpoint.

**Python - safe:**
```python
class UserProfileSerializer(ModelSerializer):
    class Meta:
        model = User
        fields = ['display_name', 'avatar_url', 'timezone']
```

**TypeScript (Express + Prisma) - bad:**
```ts
router.patch('/me', requireAuth, async (req, res) => {
  const user = await db.user.update({
    where: { id: req.user.id },
    data: req.body,  // {"role": "ADMIN"} promotes the caller.
  });
  res.json(user);
});
```

**TypeScript - safe:**
```ts
const ProfileUpdate = z.object({
  displayName: z.string().max(80).optional(),
  avatarUrl: z.string().url().optional(),
  timezone: z.string().optional(),
});

router.patch('/me', requireAuth, async (req, res) => {
  const data = ProfileUpdate.parse(req.body);
  const user = await db.user.update({ where: { id: req.user.id }, data });
  res.json(user);
});
```

### Pattern: JWT verification accepts forged tokens

Real incidents: jsonwebtoken CVE-2022-23540 (default-alg bypass), CVE-2022-23541 (RS→HS confusion), PyJWT CVE-2022-29217 (alg confusion), Java ECDSA CVE-2022-21449 ("psychic signatures"). See `references/jwt.md`.

**Python - bad:**
```python
payload = jwt.decode(token, options={"verify_signature": False})
# or
payload = jwt.decode(token, key, algorithms=["HS256", "RS256"])  # Mixed allows confusion.
```

**Python - safe:**
```python
payload = jwt.decode(token, key, algorithms=["RS256"])
```

**TypeScript - bad:**
```ts
const claims = jwt.decode(token);           // Returns claims without verifying.
const claims = jwt.verify(token, key);      // CVE-2022-23540: no algorithms pin.
```

**TypeScript - safe:**
```ts
const claims = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
```

### Pattern: Auth middleware declared but not applied

Real shape from a parallel research scan: MLflow ajax-api endpoints shipped without the shared `Depends()`.

**Python (FastAPI) - bad:**
```python
# Dependency is defined...
async def require_user(token: str = Header(...)) -> User: ...

# ...but this router never references it.
admin_router = APIRouter(prefix="/admin")

@admin_router.get("/users")
async def list_users():
    return await db.users.find_all()
```

**Python - safe:**
```python
admin_router = APIRouter(prefix="/admin", dependencies=[Depends(require_admin)])

@admin_router.get("/users")
async def list_users():
    return await db.users.find_all()
```

**TypeScript (Express) - bad:**
```ts
app.use('/api', requireAuth);
app.use('/admin', adminRouter);  // adminRouter mounted outside auth scope.
```

**TypeScript - safe:**
```ts
app.use('/api', requireAuth);
app.use('/admin', requireAuth, requireAdmin, adminRouter);
```

### Pattern: Next.js Server Action without in-action auth

Real incident: CVE-2025-55182 (React2Shell) — Next.js Server Actions re-exposed handlers; data-security docs explicitly require re-auth in every action. See `references/nextjs.md`.

**TypeScript - bad:**
```ts
// app/admin/page.tsx
export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.isAdmin) redirect('/');
  return <AdminForm />;
}

// app/admin/actions.ts
'use server';
export async function deleteUser(userId: string) {
  await db.user.delete({ where: { id: userId } });
  // No auth check. The server action is invokable by anyone who can POST to it.
}
```

**TypeScript - safe:**
```ts
'use server';
export async function deleteUser(userId: string) {
  const session = await auth();
  if (!session?.user?.isAdmin) throw new Error('unauthorized');
  await db.user.delete({ where: { id: userId } });
}
```

### Pattern: Session fixation

Real incident: Keycloak CVE-2024-7341 (SAML adapter did not rotate `JSESSIONID` at login).

**Python (Flask) - bad:**
```python
@app.post("/login")
def login():
    user = authenticate(request.form["email"], request.form["password"])
    if user:
        session["user_id"] = user.id
        return redirect("/")
```

**Python - safe:**
```python
@app.post("/login")
def login():
    user = authenticate(request.form["email"], request.form["password"])
    if user:
        session.clear()
        session.regenerate()
        session["user_id"] = user.id
        return redirect("/")
```

**TypeScript (express-session) - bad:**
```ts
app.post('/login', async (req, res) => {
  const user = await authenticate(req.body.email, req.body.password);
  if (user) {
    req.session.userId = user.id;
    res.redirect('/');
  }
});
```

**TypeScript - safe:**
```ts
app.post('/login', async (req, res) => {
  const user = await authenticate(req.body.email, req.body.password);
  if (user) {
    req.session.regenerate((err) => {
      if (err) return res.sendStatus(500);
      req.session.userId = user.id;
      res.redirect('/');
    });
  }
});
```

## Investigation Playbook

When you see a candidate:

1. **Read the full handler and its wrappers.** Decorators, class-level `permission_classes`, router-level middleware, `@UseGuards`, `beforeHandle`, `preHandler`, `before_request`.
2. **Find the route registration.** `rg -n <path_or_name>`. Confirm which middleware is actually bound at runtime, not at declaration.
3. **Read the query or ORM call.** Does it scope by principal, ownership, or tenant?
4. **Read the permission function if one is called.** Does it fail closed on unknown inputs?
5. **Check recent history.** `git log -p -- <file>`. An access check recently removed or weakened is worth investigating carefully.
6. **Compare to siblings.** If nearby handlers enforce a check this one does not, the delta is usually the bug.
7. **Detect the framework and load the reference.** The same-looking bare handler has different protection in Django (`LoginRequiredMiddleware`), NestJS (`APP_GUARD`), and Express (explicit `app.use`). Load the matching `references/<framework>.md` for specifics.

If the thread cannot be resolved with the files available, drop the finding or report with lower confidence.

## Output

For each finding:

- **File and line** of the unsafe code.
- **Severity** from the table above.
- **What is wrong**, in one sentence.
- **Who is affected and how**: which caller, which resource, what action.
- **Trace**: the specific path you followed (e.g., "route registered at `routes/admin.ts:12` with only `requireAuth`, no admin check; handler at `admin/users.ts:40` calls `db.user.delete` with id from body").
- **Fix**: the concrete change that closes the hole. Name the filter field, the missing guard, the permission class to apply. "Add an ownership filter" is not enough.

Group findings by severity. Lead with `high`.
