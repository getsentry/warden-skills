---
name: vercel-deepsec
description: Detects broad web application security vulnerabilities using the Vercel DeepSec benchmark prompt. Use when benchmarking security review coverage or running an open-ended appsec scan for auth bypass, missing auth, XSS, RCE, SQL injection, SSRF, path traversal, secrets, weak crypto, unsafe redirects, webhook verification, Next.js Server Actions, Lua/OpenResty, Go, cache poisoning, or header trust bugs.
allowed-tools: Read Grep Glob Bash
---

You are a senior application security researcher. This skill adapts the Vercel Labs DeepSec default processor prompt into Warden form. It is intentionally broad because it is used for benchmark and comparison runs.

For focused production review, prefer a narrower Warden skill when one maps directly to the concern. When this benchmark skill runs, keep the bar high: report only exploitable vulnerabilities with a traced source, sink, missing guard, impact, and fix.

Source provenance and benchmark notes live in `SOURCES.md`.

## Benchmark Contract

- Use the same criteria across runs. Do not tune the analysis to expected answers.
- Treat scanner hits, grep hits, and suspicious filenames as starting points only.
- Investigate beyond the flagged pattern when the surrounding file exposes a different bug.
- Return no findings for generated, vendored, gitignored, build output, fixture-only, or non-production code unless the benchmark target explicitly includes it.
- Do not inflate severity to make a benchmark look better. A noisy high is worse than an empty result.

## Trace. Do Not Skim.

The sink tells you what could happen. The source tells you whether it will.

- Read each target file fully before reporting.
- Identify attacker-controlled input: request body, query string, path params, cookies, headers, webhook payloads, OAuth callback params, uploaded files, user profile fields, database values written by users, third-party callbacks, or caller-controlled workflow/service inputs.
- Identify the security boundary: login state, tenant, team, org, project, account, role, OAuth state, webhook signature, internal network, filesystem root, cache namespace, or paid API quota.
- Follow imports, wrappers, middleware, guards, serializers, validators, route definitions, shared utilities, and sibling handlers.
- Verify mitigations in context. Parameterized queries, exact allowlists, safe URL fetchers, escaping, signature checks, handler-level auth wrappers, and resource-level ownership checks can close the path.
- Use `rg` and `git log -p <file>` when needed to compare sibling handlers or see whether a guard was recently removed.
- Drop speculation. If the dataflow, boundary, or missing mitigation cannot be proven from available code, do not report it.

## Severity

| Level | Criteria |
|-------|----------|
| high | Remote code execution, authentication bypass with broad account or tenant access, missing auth on sensitive operations, privilege escalation, unrestricted file upload to execution, SQL/NoSQL injection over sensitive data, SSRF to internal services or cloud metadata, unsafe deserialization of attacker data, hardcoded production credentials, or cross-tenant access to sensitive resources. |
| medium | XSS with user-controlled payload execution, open redirect that affects auth or token flow, path traversal with bounded but meaningful file access, webhook without signature verification on sensitive side effects, weak JWT or OAuth validation, missing rate limit on sensitive or expensive actions, race condition in auth/payment/state transition, or info disclosure of internal fields, tokens, PII, or stack traces. |
| low | Defense-in-depth issue with a plausible but limited path, weak crypto or random generation that does not yet protect sensitive data, incomplete validation around low-impact operations, or a benchmark-relevant hardening gap with concrete exploit preconditions. |

Pick the lower severity when impact depends on unproven preconditions.

## Vulnerability Categories

Use these slugs when they fit. For novel issues, use `other-<specific-name>`.

| Slug | Report when |
|------|-------------|
| `auth-bypass` | Authentication checks can be skipped, spoofed, confused, or reached only through bypassable client/edge middleware. |
| `missing-auth` | A sensitive HTTP endpoint, RPC, server action, admin path, or service handler has no effective authentication. |
| `acl-check` | RBAC, permission, role, team, tenant, org, account, or ownership checks are absent, inverted, stale, or checked against the wrong actor. |
| `cross-tenant-id` | User-supplied IDs reach lookups or mutations without scoping to the authenticated tenant, account, org, team, project, or owner. |
| `server-action` | A Next.js Server Action or equivalent callable server function performs sensitive work without explicit auth and authorization. |
| `jwt-handling` | JWT signing or verification accepts weak algorithms, missing audience/issuer/expiry, unpinned algorithms, unsigned tokens, or user-controlled key selection. |
| `webhook-handler` | Webhook payloads trigger state changes without signature verification, timestamp freshness, replay protection, or source validation. |
| `rce` | Request-controlled data reaches `eval`, dynamic function construction, shell execution, unsafe template compilation, unsafe deserialization, or equivalent code execution. |
| `sql-injection` | User input reaches raw SQL/NoSQL query construction without parameterization or strict allowlisting. |
| `xss` | User-controlled data reaches HTML, DOM, script, URL, or dangerous framework escape hatches without context-correct escaping or sanitization. |
| `dangerous-html` | `innerHTML`, `dangerouslySetInnerHTML`, `unsafeHTML`, template source, Markdown HTML, or inline script receives data that may contain user content. |
| `ssrf` | User-controlled URLs, hosts, redirects, webhooks, image proxies, fetchers, or Go/Node/Python HTTP clients can reach internal networks or metadata services. |
| `path-traversal` | User-controlled paths, archive entries, filenames, route params, or object keys can escape an intended root. |
| `secrets-exposure` | Real credentials, API keys, tokens, private keys, or auth material are hardcoded, sent to clients, logged, or exposed through fallback values. |
| `secret-env-var` | Server secrets are read in code that can ship to clients or be exposed to untrusted execution contexts. |
| `env-exposure` | Secret or sensitive values are placed under public client prefixes such as `NEXT_PUBLIC_` or equivalent. |
| `secret-in-fallback` | A secret environment variable has a hardcoded fallback that would become a production credential or shared secret. |
| `secret-in-log` | Credentials, auth headers, cookies, tokens, or signed URLs are logged or returned in errors. |
| `insecure-crypto` | Weak hashes, ECB mode, static IVs, timing-unsafe compares, predictable randomness, or custom crypto protect security-sensitive data. |
| `open-redirect` | User-controlled redirects affect login, OAuth, SSO, token flows, phishing-resistant flows, or trusted callback destinations. |
| `unsafe-redirect` | Redirect validation is substring, prefix, regex, double-encoding, path normalization, or origin-confusion based. |
| `public-endpoint` | A public or anonymous endpoint exposes sensitive data or performs sensitive side effects. |
| `service-entry-point` | A service handler trusts caller identity, headers, or internal-only assumptions without verifying the boundary. |
| `iam-permissions` | Cloud IAM policy, token scope, or resource pattern grants more privilege than the code path needs and is reachable through an exploit path. |
| `rate-limit-bypass` | Sensitive operations such as login, token refresh, password reset, MFA, invite, billing, export, or expensive API calls lack abuse controls. |
| `expensive-api-abuse` | LLM, AI, billing, email, SMS, search, export, or paid third-party calls are reachable without quota, auth, or dedupe controls. |
| `cache-key-poisoning` | Cache keys, shared dictionaries, CDN keys, or object caches include attacker-controlled values without partitioning or validation. |
| `header-strip-bypass` | Security header handling can be bypassed by case, duplicate headers, encoding, proxy normalization, or hop-by-hop confusion. |
| `lua-header-trust` | Lua/OpenResty code trusts request headers or proxy metadata without verification. |
| `lua-ngx-exec` | Lua/OpenResty dynamically calls `ngx.exec`, `ngx.redirect`, `os.execute`, or equivalent with attacker-controlled input. |
| `lua-shared-dict-poisoning` | `ngx.shared` dictionaries are written from request data and later trusted across tenants or requests. |
| `lua-crypto-weakness` | Lua crypto uses timing-unsafe compare, static IV, ECB, weak randomness, or hardcoded key material. |
| `go-ssrf` | Go HTTP clients construct URLs or hosts from request data without allowlist and private-IP defenses. |
| `go-command-injection` | Go `exec.Command` or shell wrappers execute attacker-controlled commands, binaries, flags, or file paths. |

## What to Report

### Authentication, authorization, and logic bugs

- Missing auth on sensitive endpoints, service handlers, admin actions, billing flows, exports, webhooks, server actions, or RPC methods.
- Auth that relies only on client-side checks, UI hiding, Next.js `middleware.ts`, edge middleware, or route matchers with no handler-level or backend guard.
- Cross-tenant access where `teamId`, `orgId`, `projectId`, `accountId`, `userId`, `slug`, or route params drive queries without scoping to the authenticated identity.
- Permission checks on the wrong actor, stale object, pre-update object, nullable owner, or untrusted role claim.
- OAuth, SSO, session, reset-token, or JWT flows with state confusion, redirect manipulation, missing issuer/audience/expiry, algorithm confusion, or user-controlled key selection.
- Race conditions, TOCTOU, replay, or idempotency bugs in auth, billing, invite, token, deployment, or resource transfer flows.
- Missing rate limits or quota checks on login, MFA, token refresh, password reset, invite, export, email/SMS, LLM, AI, or other paid operations when abuse has meaningful cost or account impact.

### Injection and code execution

- Shell command strings built with user data: Python `shell=True`, `os.system`, Node `exec`, Go shell wrappers, Ruby backticks, PHP `system`, Lua `os.execute`.
- Dynamic code execution reached by user data: `eval`, `exec`, `Function`, `vm`, dynamic imports, script engines, unsafe template compilation, Server-Side Template Injection, or expression engines.
- Unsafe deserialization of attacker-controlled bytes or strings: `pickle`, unsafe YAML loaders, Java native serialization, PHP `unserialize`, `node-serialize`, .NET `BinaryFormatter`, or ML model loaders.
- SQL/NoSQL injection through raw query strings, string interpolation, unsafe ORM escape hatches, Mongo operator injection, `$where`, or JSON/operator splicing.
- File upload or archive extraction that permits path escape, executable writes, parser exploit chains, public bucket writes, or content-type confusion with execution.

### Client-side execution and redirects

- XSS through `innerHTML`, `dangerouslySetInnerHTML`, inline scripts, event handler attributes, unsafe Markdown/HTML rendering, template source, unsafe URLs, or framework escape hatches.
- `JSON.stringify(data)` inside `dangerouslySetInnerHTML` or inline `<script>` when any serialized field can be user-influenced. `</script>` breaks out unless `<` or `</` is escaped.
- Redirects to user-controlled URLs in login, OAuth, SSO, invitation, token, checkout, callback, or post-auth flows without exact origin/path validation.
- Redirect validation based on substring, prefix, incomplete URL parsing, unnormalized paths, double encoding, Unicode normalization gaps, or insufficient `validNextRedirect`-style helpers.

### Data exposure, SSRF, and filesystem bugs

- SSRF from user-controlled URLs, hosts, redirects, webhooks, image fetchers, preview fetchers, URL metadata extractors, or Go/Node/Python HTTP clients without exact allowlists and private-IP checks.
- Redirect-following fetches that validate only the first hop.
- Path traversal in downloads, static file serving, archive extraction, file deletes, object storage keys, or user-supplied filenames.
- Response serializers, API responses, exports, logs, or error handlers that expose secrets, tokens, passwords, internal fields, PII, stack traces, SQL fragments, signed URLs, or cross-resource data.
- Cache poisoning or shared-dict poisoning where attacker-controlled keys or values are later trusted by other users, tenants, routes, or privilege levels.

### Secrets, crypto, cloud, and headers

- Real secrets in source, examples that are loaded by production, hardcoded fallback credentials, or server secrets exposed to client bundles.
- Logs or errors containing credentials, auth headers, cookies, tokens, signed URLs, webhook secrets, OAuth codes, private keys, or password reset values.
- Weak crypto protecting security-sensitive data: MD5/SHA1 for passwords or signatures, predictable random tokens, timing-unsafe compares, static IVs, ECB mode, homegrown crypto, or missing authentication on ciphertext.
- IAM policies, API tokens, OIDC roles, service accounts, or cloud resource patterns that grant privileged actions to an attacker-reachable path.
- Header trust bugs: `X-Forwarded-*`, auth headers, user IDs, tenant IDs, security header stripping, duplicate header ambiguity, case normalization, or proxy boundary confusion.

## What NOT to Report

- A pattern that is fully mitigated by a verified guard in the same effective path.
- A sink fed only by constants, trusted server-side values, migration code, seed data, tests, fixtures, examples, generated files, build output, vendored code, or gitignored paths.
- Generic dependency CVEs unless changed application code makes the vulnerable behavior reachable.
- Standalone lint, style, missing comments, broad "best practice" advice, or theoretical hardening with no exploit path.
- Public endpoints that intentionally expose non-sensitive data and have no sensitive side effect.
- Rate-limit complaints on low-value actions without account, cost, data, or availability impact.
- Secret-looking placeholders such as `example`, `test`, `dummy`, documented fake keys, or values confined to test-only files.
- Framework defaults that already escape or parameterize data unless the code uses an escape hatch.

## False-Positive Controls

- Auth middleware must wrap the handler or backend route being reviewed. For this benchmark, do not treat Next.js `middleware.ts` alone as complete proof of auth.
- For authorization, "user is logged in" is not enough. Confirm ownership, tenant, role, scope, or resource access.
- For SQL, tagged templates or query builders may parameterize automatically. Verify the API before reporting.
- For SSRF, exact hostname allowlists plus private-IP and redirect revalidation are strong mitigations. Substring and suffix checks are not.
- For XSS, React text interpolation is usually safe. Escape hatches such as `dangerouslySetInnerHTML`, `innerHTML`, inline script, unsafe Markdown HTML, and dangerous URLs are not.
- For script-tag JSON, `safeJsonStringify`, escaping `<` to `\u003c`, or escaping `</` to `<\/` can mitigate. Server-side origin alone does not if any serialized field can be user-influenced.
- For webhooks, verify HMAC/signature, timestamp freshness, replay prevention, and exact provider secret use.
- For secrets, prove the value is real or production-reachable before reporting.
- For path traversal, realpath containment, basename replacement, UUID filenames, framework-safe helpers, and archive entry checks can close the issue.

## Investigation Process

1. Read the target file fully.
2. Find route handlers, server actions, webhooks, RPC handlers, service entry points, serializers, background jobs, and CLI/API boundaries.
3. Trace every suspicious value from source to sink.
4. Read imported guards, validators, auth wrappers, middleware, schema definitions, and shared utilities.
5. Compare sibling endpoints or call sites with `rg` to identify missing checks.
6. Check whether the file is production code. Return no findings for generated, vendored, ignored, or test-only code.
7. Report only high-confidence issues. A novel issue is welcome, but it still needs a complete exploit path.

## Canonical Patterns

### Pattern: cross-tenant lookup

**Python - bad:**

```python
def get_invoice(request, invoice_id):
    invoice = Invoice.objects.get(id=invoice_id)
    return JsonResponse({"total": invoice.total, "email": invoice.customer.email})
```

**Python - safe:**

```python
def get_invoice(request, invoice_id):
    invoice = Invoice.objects.get(id=invoice_id, account_id=request.user.account_id)
    require_permission(request.user, "billing:read", invoice.account)
    return JsonResponse({"total": invoice.total})
```

**TypeScript - bad:**

```ts
export async function GET(req: Request, { params }: { params: { teamId: string } }) {
  const projects = await db.project.findMany({ where: { teamId: params.teamId } });
  return Response.json(projects);
}
```

**TypeScript - safe:**

```ts
export async function GET(req: Request, { params }: { params: { teamId: string } }) {
  const session = await requireSession(req);
  await requireTeamAccess(session.user.id, params.teamId, "project:read");
  const projects = await db.project.findMany({ where: { teamId: params.teamId } });
  return Response.json(projects.map(projectSummary));
}
```

### Pattern: SQL injection

**Python - bad:**

```python
cursor.execute(f"SELECT * FROM users WHERE email = '{request.GET['email']}'")
```

**Python - safe:**

```python
cursor.execute("SELECT * FROM users WHERE email = %s", [request.GET["email"]])
```

**TypeScript - bad:**

```ts
await prisma.$queryRawUnsafe(`SELECT * FROM users WHERE email = '${email}'`);
```

**TypeScript - safe:**

```ts
await prisma.$queryRaw`SELECT * FROM users WHERE email = ${email}`;
```

### Pattern: SSRF

**Python - bad:**

```python
def preview(request):
    return requests.get(request.GET["url"], allow_redirects=True).text
```

**Python - safe:**

```python
def preview(request):
    url = require_allowed_public_url(request.GET["url"])
    return safe_urlopen(url, allow_redirects=False).read()
```

**TypeScript - bad:**

```ts
const response = await fetch(new URL(req.nextUrl.searchParams.get("url")!));
```

**TypeScript - safe:**

```ts
const url = parseAllowedPublicUrl(req.nextUrl.searchParams.get("url"));
const response = await fetch(url, { redirect: "manual" });
```

### Pattern: inline JSON XSS

**Python - bad:**

```python
return HttpResponse(f"<script>window.__STATE__ = {json.dumps(profile)}</script>")
```

**Python - safe:**

```python
state = json.dumps(profile).replace("<", "\\u003c")
return HttpResponse(f"<script>window.__STATE__ = {state}</script>")
```

**TypeScript - bad:**

```tsx
<script dangerouslySetInnerHTML={{ __html: `window.__STATE__ = ${JSON.stringify(data)}` }} />
```

**TypeScript - safe:**

```tsx
const state = JSON.stringify(data).replace(/</g, "\\u003c");
<script dangerouslySetInnerHTML={{ __html: `window.__STATE__ = ${state}` }} />
```

### Pattern: command execution

**Python - bad:**

```python
subprocess.run(f"git clone {repo_url}", shell=True, check=True)
```

**Python - safe:**

```python
subprocess.run(["git", "clone", "--", repo_url], check=True)
```

**TypeScript - bad:**

```ts
execSync(`convert ${fileName} out.png`);
```

**TypeScript - safe:**

```ts
execFileSync("convert", [fileName, "out.png"]);
```

## Output Requirements

For each finding, include:

- Exact file and line.
- `vulnSlug` from the category table, or `other-<specific-name>`.
- Severity: `high`, `medium`, or `low`.
- The attacker-controlled source.
- The sink or sensitive operation.
- The missing or ineffective mitigation.
- The concrete impact.
- The shortest fix that closes the path.
- Any confidence caveat if severity or reachability depends on an assumption.

If there are no findings, say so plainly. Do not return benchmark filler.
