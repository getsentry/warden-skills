# Express / Node Data-Exfiltration Reference

Load when the diff touches Express, Koa, Fastify, Hono, or Elysia routes that serve files, fetch URLs, return ORM rows, or handle errors. Ignore `child_process`, `vm`/`Function`/`eval`, template engines, and `node-serialize` unless they expose data.

## File Serving

```ts
// bad
app.get('/download', (req, res) => {
  res.sendFile(path.join('/var/app/exports', String(req.query.name)));
});

// safe
const BASE = path.resolve('/var/app/exports');
app.get('/download', (req, res) => {
  const target = path.resolve(BASE, String(req.query.name));
  if (!target.startsWith(BASE + path.sep)) return res.sendStatus(403);
  res.sendFile(target);
});
```

`res.sendFile(name, { root })` with literal `root` is safer than manual joining.

### `express.static`

```ts
app.use('/static', express.static('public'));    // Literal root: safe.
app.use('/static', express.static('.'));         // Exposes project root: .env, package.json, etc.
app.use('/static', express.static(config.root)); // Dynamic root: audit config source.
```

## Outbound HTTP

See `references/ssrf.md`. Express-typical:

```ts
// bad
app.get('/proxy', async (req, res) => {
  const upstream = await fetch(String(req.query.url));
  upstream.body?.pipe(res);
});
```

Image proxies, URL previews, webhook forwarders — every fetch with a user URL needs IP/host validation.

axios CVEs (2020-28168 redirect-bypass, 2025-62718 NO_PROXY, 2026-40175 header-pollution → IMDS) matter for pinned versions.

## Returning Raw ORM Rows

```ts
// bad
const user = await prisma.user.findUnique({ where: { id } });
return res.json(user);   // Returns password hash, 2fa secret, internal flags.

// safe
const user = await prisma.user.findUnique({
  where: { id },
  select: { id: true, displayName: true, avatarUrl: true },
});
return res.json(user);
```

ORMs default to "select all columns." DTO-layer filtering (manual or via a DTO library) is required.

## Error Handlers

```ts
// bad
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message, stack: err.stack });
});
```

Return generic; log server-side.

## Logging

```ts
logger.info('request', { body: req.body });   // Captures passwords, tokens, PII.
```

```ts
catch (err) {
  logger.error(`Failed to process payment: ${JSON.stringify(paymentDetails)}`, err);
  // paymentDetails may include card details / tokens.
}
```

## Body-Parser and `qs`

`express.urlencoded({ extended: true })` uses `qs`. `?a[__proto__][isAdmin]=true` parses to a polluting object. Combined with downstream merges, prototype pollution lands. The data-exfil angle is when polluted properties are echoed back in responses or logged.

`bodyParser.json({ strict: true })` rejects non-object/array top-level JSON — small defense against payload shape attacks.

## Koa / Fastify / Hono / Elysia

Same patterns. `ctx.body` / `reply.send` / `c.json` / `set.body` change syntax but not sink semantics. `@fastify/static`, Hono `serveStatic`, Elysia `staticPlugin` mirror `express.static` concerns.

## Detection Heuristics

1. `res.sendFile(path.join(root, req.*))` without `startsWith(root)`.
2. `express.static('.')` or static root from config without audit.
3. `fetch(req.*.url)` / `axios.get(req.*.url)` without SSRF guard.
4. ORM query returning full row to client without `select` / DTO filter.
5. Error handler returning `err.stack` / `err.message` containing internals.
6. Logger capturing `req.body` / `req.headers` wholesale.
7. CSV/JSON exports of model fields without an explicit allowlist.

## False-Positive Traps

- `sendFile(name, { root })` with literal root has Express-level `..` rejection.
- `express.static('public')` with literal dir is safe.
- `fetch(ALLOWED_URL)` with hardcoded constant is safe.
- Error handler returning `{ error: "internal" }` with separate server-side log is safe.
- `res.json({ ...someUser, password: undefined, tfaSecret: undefined })` ad-hoc filtering works but is fragile; prefer `select`.

## Verification Commands

```bash
rg -n 'res\.sendFile|reply\.sendFile|express\.static|@fastify/static|serveStatic' <project>
rg -n 'fetch\(|axios\.|got\(|node-fetch|undici' <project>
rg -n 'res\.json\(.*await|reply\.send\(.*await' <project>
rg -n 'err\.stack|e\.stack|app\.use\(.*err.*=>' <project>
rg -n 'logger\.(info|warn|error|debug).*req\.(body|headers)' <project>
rg -n 'bodyParser\.|allowPrototypes|qs\.parse' <project>
```
