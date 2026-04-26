# Express / Koa / Fastify / Hono / Elysia Access-Control Reference

Load when the diff touches any middleware-based Node server: Express, Koa, Fastify, Hono, or Elysia. These frameworks all share the same foundational footguns; the APIs differ but the bugs are the same shape.

## Auth Defaults

**Allow by default.** A route defined without an auth middleware is public.

## How Auth Attaches

| Framework | Attachment |
|-----------|------------|
| Express | `app.use(auth)` globally, `router.use(auth)` on subrouter, `app.get('/x', auth, handler)` per-route. Order-sensitive: middleware must be registered *before* the route it protects. |
| Koa | `app.use(ctx, next)` middleware. Same order-sensitivity. |
| Fastify | `fastify.addHook('preHandler', auth)`, `fastify.register(plugin, { prefix })`, or route-level `{ preHandler: auth }`. |
| Hono | `app.use('*', auth())` globally, `app.use('/admin/*', requireAdmin())` path-scoped. |
| Elysia | `.guard({ beforeHandle: auth })`, `.use(authPlugin)`, or route-level guards. |

The common principle: declare a middleware, then ensure it actually runs before the protected handler. Declaration without attachment does nothing.

## Canonical Bug Shapes

### 1. Middleware order: route defined before auth is applied

```ts
app.get('/admin/users', handleListUsers);  // Registered now, no auth.
app.use('/admin', requireAuth);             // Applied later, ignored for the above.
```

Express matches middleware and routes in registration order. Any middleware added after a route is not applied retroactively.

**Safe:**

```ts
app.use('/admin', requireAuth);
app.get('/admin/users', handleListUsers);
```

### 2. Subrouter mounted outside the auth scope

```ts
app.use('/api', requireAuth);
app.use('/admin', adminRouter);  // Mounted outside /api. requireAuth doesn't apply.
```

`requireAuth` is scoped to `/api`. The admin router under `/admin` inherits nothing.

**Safe:**

```ts
app.use('/api', requireAuth);
app.use('/admin', requireAuth, requireAdmin, adminRouter);
```

### 3. Spreading `req.body` into an ORM create/update

The mass-assignment shape. Every ORM is vulnerable.

```ts
// Prisma
const user = await db.user.update({
  where: { id: req.user.id },
  data: req.body,  // {"role": "ADMIN"} works.
});

// Mongoose
const user = await User.findByIdAndUpdate(req.user.id, req.body, { new: true });

// Sequelize
const user = await User.update(req.body, { where: { id: req.user.id } });
```

Snyk documents this as the top Node.js mass-assignment shape. Fix by validating with Zod/Yup/Joi or explicitly picking allowed fields.

```ts
const Profile = z.object({
  displayName: z.string().max(80).optional(),
  avatarUrl: z.string().url().optional(),
});

const data = Profile.parse(req.body);
const user = await db.user.update({ where: { id: req.user.id }, data });
```

### 4. Middleware that calls `next()` unconditionally on some branch

```ts
function requireAuth(req, res, next) {
  const token = req.headers.authorization;
  if (!token) return res.sendStatus(401);
  try {
    req.user = verify(token);
    next();
  } catch (err) {
    // "Lenient" for rollout. Anyone with a bad token passes through.
    req.user = null;
    next();
  }
}
```

Any middleware whose exception path calls `next()` without rejecting is a fail-open. Exception branches must `return res.sendStatus(401)` (or `next(err)` with a proper error handler) unless the dependency is genuinely optional.

### 5. Truthiness check on `req.user` that accepts empty objects

```ts
function requireAuth(req, res, next) {
  if (req.user) return next();  // req.user = {} from an upstream middleware is truthy.
  return res.sendStatus(401);
}
```

Check `req.user?.id` or an explicit identity field, not existence.

### 6. IDOR via unscoped query

```ts
router.get('/orders/:id', requireAuth, async (req, res) => {
  const order = await db.order.findUnique({ where: { id: req.params.id } });
  res.json(order);
});
```

Authentication without ownership scoping.

```ts
// Safe
const order = await db.order.findFirst({
  where: { id: req.params.id, userId: req.user.id },
});
```

### 7. CORS set to `*` with credentials

```ts
app.use(cors({ origin: '*', credentials: true }));
```

Technically, browsers reject `*` with credentials, but CORS middleware may reflect the `Origin` header:

```ts
app.use(cors({ origin: true, credentials: true }));
// "true" means: echo the Origin header. Every origin is allowed with credentials.
```

This makes CSRF a full-authorization bypass. Flag when `origin: true` combines with `credentials: true`.

## Framework-Specific Notes

### Koa

- Same middleware-order rules as Express.
- `ctx.state.user` is the convention; same truthiness traps.

### Fastify

- `preHandler` hooks are the canonical auth attachment.
- `fastify.register(plugin, { prefix })` — each plugin gets its own scope. A plugin registered without an auth hook is public.
- `fastify-auth` and `@fastify/jwt` require caller-side configuration; default behaviors are not deny-by-default.

### Hono

- Middleware syntax: `app.use('/admin/*', auth())`. Wildcard patterns must match the route registration path exactly. `/admin` does not match `/admin/users` without the `/*`.
- Middleware ordering: Hono runs middleware in registration order; same rules as Express.

### Elysia

- `.guard({ beforeHandle: auth })` scopes to subsequent routes in the chain.
- `.use(authPlugin)` can be scoped or global depending on the builder pattern.
- Verify the chaining order: a guard declared after the protected route is a bug.

## False-Positive Traps

- **Global auth middleware registered early in the app factory.** Routes added anywhere afterward are covered.
- **Reverse-proxy auth** (Cloudflare Access, IAP, Envoy). The app may not enforce identity because the proxy does.
- **Public endpoints**: `/healthz`, webhook receivers, public static asset serving.
- **JWT middleware that also sets `req.user`**: the route doesn't need its own auth if the JWT middleware already ran globally and rejects on failure.

## Diff Heuristics

1. **New route added before a later `app.use(auth)`.** Registration order.
2. **New subrouter mounted at a path not covered by upstream auth middleware.** Check `app.use` chain.
3. **`req.body` spread into ORM create/update.** Mass assignment.
4. **Middleware with an exception branch that calls `next()`.** Fail-open.
5. **Truthiness check on `req.user` or `ctx.state.user` without a field check.**
6. **`cors({ origin: true, credentials: true })`.** Credentialed reflection.
7. **`findUnique`/`findFirst` with `{ where: { id: req.params.id } }` alone** on a resource that should be user-scoped.
8. **New Fastify plugin registered without `preHandler` on sensitive routes.**
9. **New Hono route without a matching `app.use('/prefix/*', auth())`.**

## Verification Commands

```bash
# Middleware registrations and order
rg -n 'app\.use\(' <project> --type js --type ts

# Router mount points
rg -n 'app\.(use|all|get|post|put|delete|patch)\(' <project>

# Mass-assignment candidates
rg -n 'req\.body' <project> | rg -v 'test|spec'
rg -n 'findByIdAndUpdate|update\(.*req\.body|create\(.*req\.body' <project>

# CORS
rg -n 'cors\(' <project>

# Fastify preHandler
rg -n 'preHandler' <project>

# Hono patterns
rg -n "app\.(use|get|post|put|delete|patch)\(" <project>
```
