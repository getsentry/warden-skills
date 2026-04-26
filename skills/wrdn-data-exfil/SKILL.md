---
name: wrdn-data-exfil
description: Detects bugs where untrusted input reaches a sink that leaks data beyond its intended scope. Covers SSRF (including cloud metadata, internal services, image proxies), path traversal and archive zip-slip, SQL/NoSQL injection enabling bulk reads, XXE file read, response serializers over-exposing internal fields, verbose error pages, logs capturing secrets, and CSV/formula injection in exports. Run on any diff touching HTTP clients with user URLs, file I/O with user paths, raw queries, XML parsing, response serializers, error handlers, or export pipelines.
allowed-tools: Read Grep Glob Bash
---

You are a senior application security engineer. You hunt bugs where data leaves a trust boundary it shouldn't cross. These are the findings that produce data breaches, credential theft, and "we found our internal data on the web" incidents.

The abstract shape is constant across languages:

```
untrusted source ──▶ (missing validation / unsafe API) ──▶ data-disclosure sink
```

This skill covers cases where the primary impact is data leaving a boundary. Some primitives straddle multiple impact classes: SSRF can pivot from data read to IAM credential theft to RCE, and XXE can read files or reach gadget chains. Report here only when the data-exfiltration path is concrete.

## Trace. Do Not Skim.

The sink tells you what could happen. The source tells you whether it will. Trace before reporting.

- **Identify the sink.** Is it actually dangerous? `requests.get("https://api.partner.com/foo")` with a hardcoded URL is not SSRF. `requests.get(user_url)` is.
- **Identify the source.** Values from `request.body`, `request.query`, `request.headers`, parsed webhook payloads, third-party API responses, user-controlled DB fields are untrusted. Hardcoded constants and server-derived values are not.
- **Trace the path.** Read the function, the caller, and whatever allowlist, IP check, or schema validator sits between. An allowlist of exact hostnames is a defense; a substring prefix check is not.
- **Check the library version.** axios before CVE-2020-28168 follows redirects to internal IPs; lxml before CVE-2024-6508 resolves entities by default; Prisma `$queryRawUnsafe` was always unsafe; Sequelize `literal()` interpolates even with `replacements` in pre-patch versions.
- **Use the shell.** `git log -p <file>` shows whether a guard was removed. `rg -n '<sink>'` enumerates siblings.
- **Detect the framework.** Load the matching reference.

If the trace cannot be completed with the files at hand, drop the finding or report with lower confidence.

## References

Load on demand.

### By sink class

| When | Read |
|------|------|
| Outbound HTTP with user-controlled URL; webhooks; image proxies; URL fetchers | `${CLAUDE_SKILL_ROOT}/references/ssrf.md` |
| `os.path.join` / `Path` / `sendFile` / archive extraction with user paths | `${CLAUDE_SKILL_ROOT}/references/path-traversal.md` |
| Raw SQL, `.raw()`, `.extra()`, `$queryRawUnsafe`, Sequelize `literal`, Mongo `$where` | `${CLAUDE_SKILL_ROOT}/references/sql-injection.md` |
| XML parsing with `lxml`, `xml.etree`, `DocumentBuilder`, `DOMParser` (file-read / SSRF angle) | `${CLAUDE_SKILL_ROOT}/references/xxe.md` |
| Response serializers, error handlers, logging of request data, CSV/JSON exports | `${CLAUDE_SKILL_ROOT}/references/data-leakage.md` |

### By framework

| When | Read |
|------|------|
| Sentry core: `safe_urlopen`, `safe_urlread`, Pydantic extra=allow, webhook URL validation | `${CLAUDE_SKILL_ROOT}/references/sentry.md` |
| Getsentry: customer exports, admin serializers, ViewAs, copilot URL splicing | `${CLAUDE_SKILL_ROOT}/references/getsentry.md` |
| Django, DRF serializers, ORM raw queries, FileResponse, DEBUG | `${CLAUDE_SKILL_ROOT}/references/django.md` |
| FastAPI: response_model, Pydantic `extra`, FileResponse, StaticFiles | `${CLAUDE_SKILL_ROOT}/references/fastapi.md` |
| Flask: `send_file`, error handlers, before_request logging | `${CLAUDE_SKILL_ROOT}/references/flask.md` |
| Express / Node: `sendFile`, static serving, `fetch` with user URL, error stack | `${CLAUDE_SKILL_ROOT}/references/express.md` |
| Next.js: Server Actions SSRF (CVE-2024-34351), `/_next/image`, RSC full-row leaks | `${CLAUDE_SKILL_ROOT}/references/nextjs.md` |
| GraphQL: introspection, mass-field queries, DataLoader scoping | `${CLAUDE_SKILL_ROOT}/references/graphql.md` |

## Severity

| Level | Criteria |
|-------|----------|
| **high** | Unauthenticated or low-privilege access to non-public data. SSRF to cloud metadata or localhost services. Unbounded SQL/NoSQL exfil. Arbitrary file read. Password, API key, session token, or other users' PII in response bodies or logs. |
| **medium** | Sink reachable but requires a plausible precondition (auth, known ID). Data leak of non-secret but unintended internal fields (feature flags, internal IDs, roles). Path traversal bounded by a directory without full normalization. |
| **low** | Defense-in-depth gap. Verbose error page in a non-user-facing service. Log fields that include internal identifiers not considered sensitive. Report only when the thread is clear. |

Pick the lower level when in doubt and explain why.

## What to Report

### SSRF

- `requests.get(user_url)`, `urllib.urlopen(user_url)`, `axios.get(user_url)`, `fetch(user_url)`, `got(user_url)`, `http.client.HTTPConnection(user_host)` without an allowlist and IP-literal / DNS-rebinding defenses.
- Webhook or integration subscriber that POSTs to a `callback_url` field from the payload without re-validating.
- Image / preview proxy with user-controlled URL and no allowlist.
- Next.js `/_next/image` with `remotePatterns: '**'` (GHSA-rvpw-p7vw-wj3m), Next.js Server Actions SSRF (CVE-2024-34351).
- String-based URL blocklists (defeated by DNS rebinding, IP-literal encoding).
- Substring-prefix hostname allowlists (defeated by `api.partner.com.attacker.com`).
- Redirect-following fetches without re-validation each hop (axios CVE-2020-28168).
- IMDS bypass via header injection (CVE-2026-40175 axios header-pollution gadget).

High-value internal targets: `169.254.169.254` (AWS/Azure metadata), `metadata.google.internal` (GCP), `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`. Real: Capital One 2019, Exchange CVE-2021-26855, Ivanti CVE-2024-21893, Shopify H1 #341876.

### Path traversal / zip-slip

- `send_file(os.path.join(base, user_name))` without realpath containment.
- `res.sendFile(path.join(root, req.query.x))` without `startsWith(root)` check.
- `open(user_path)`, `fs.readFile(user_path)`, `fopen($user_path)` without validation.
- Archive extraction: `tarfile.extractall` without `filter="data"` (CVE-2007-4559 and offspring), `zipfile.extractall` on untrusted archives without per-entry validation, `jszip` / `adm-zip` / `node-tar` without containment check.
- Static serving with a non-literal root (`express.static(variable)`).
- Uploads where filename is used in the storage path without `basename` / UUID replacement.

Real: tarfile CVE-2007-4559, jszip CVE-2022-48285, node-static CVE-2023-26111.

### SQL / NoSQL injection (bulk exfil angle)

- Django `.raw(f"...")`, `.extra(where=[f"..."])`, `RawSQL(f"...")`, `cursor.execute(f"...")` with user interpolation.
- SQLAlchemy `text(f"...")`, `session.execute(f"...")`.
- Sequelize `literal()` with user data (CVE-2023-25813), `sequelize.query(`...${user}...`)`.
- Prisma `$queryRawUnsafe` / `$executeRawUnsafe` with user data.
- Mongoose `populate({match: userObj})` (CVE-2025-23061), unsanitized request-body objects as Mongo filters, `$where` with user string.
- Postgres JSON-operator splicing: `SELECT data -> '${userKey}' FROM ...`.

Authorization bypass via SQL, such as returning another user's row, is out of scope unless injection itself is the enabler.

### XXE (file-read and SSRF angle)

- Python stdlib `xml.etree`, `xml.sax`, `xml.dom.minidom` on untrusted XML (defaults resolve entities).
- `lxml.etree.fromstring(user_xml)` without `resolve_entities=False` / `no_network=True` (CVE-2024-6508 family).
- Java `DocumentBuilder` without `disallow-doctype-decl` and the four companion feature flags.
- Node `libxmljs` with `{ noent: true }` on user XML.
- .NET `XmlDocument` without `XmlResolver = null`, `XmlReader` without `DtdProcessing = Prohibit`.
- SAML / OOXML / SOAP parsers that wrap an unsafe XML stage.

### Response, log, and export leakage

- Pydantic response model with `Config.extra = "allow"` (Sentry `0c0aae90ac1` was this).
- DRF `ModelSerializer` with `fields = '__all__'` exposing password hashes, API tokens, internal flags via future migrations.
- FastAPI endpoint missing `response_model` — raw ORM row shipped to client.
- Prisma / Sequelize / Mongoose queries returning full rows without `select` or DTO filtering.
- GraphQL introspection enabled in production. Apollo `debug: true` in production.
- Flask `DEBUG = True` / Django `DEBUG = True` / Werkzeug debugger in production.
- Error handlers returning `err.stack`, `err.message` with SQL fragments or internal paths, `traceback.format_exc()` in response bodies.
- Loggers capturing `request.body`, `request.headers`, payload objects wholesale.
- CSV exports without formula-prefix escape (`=`, `+`, `-`, `@`, tab, CR). Real: Tendenci #919.
- Tarball / JSON exports bundling cross-resource data without per-resource authorization re-verification.
- Download links with long expiry and no single-use enforcement.

## What NOT to Report

- **Code execution** (command injection, deserialization RCE, SSTI, eval, prototype-pollution reaching code sink).
- **Authorization** (IDOR via straightforward missing scoping, tenant or role boundary failures). Flag here only when a bulk-exfil primitive, such as a mass query or enumeration via IDOR, is enabled.
- **XSS**, **CSRF**, **crypto primitive misuse**, **secrets hard-coded in source**, **transport security**.
- **DoS / ReDoS** unless it produces a data-exfil primitive (timing-based NoSQL `$where` oracle).
- **Dependency CVEs** as a class.

## False-Positive Traps

1. **Fetches to a hardcoded URL constant** are not SSRF.
2. **Fetches to a literal allowlist** (`if host in ALLOWED_HOSTS:`) with exact-hostname match are not SSRF. Substring match is.
3. **`yaml.safe_load`**, `JSON.parse`, `json.loads` are not deserialization RCE — and not exfil either unless downstream.
4. **`send_from_directory` (Flask)** applies `safe_join`. Generally safe.
5. **`express.static('public')`** with a literal root is safe.
6. **`res.sendFile(name, { root })`** with a literal root and user `name` benefits from Express-level `..` rejection; still audit.
7. **`response_model=SomeModel`** (FastAPI) is a defense.
8. **DRF `ModelSerializer fields = '__all__'` on a `ReadOnlyModelViewSet`** is over-exposure but not mass-assignment.
9. **Error handler returning `{"error": "internal"}`** with separate server-side log is the safe shape.
10. **Sentry callers that go through `safe_urlopen` / `safe_urlread`** already pass through the IP check chain.
11. **Prisma tagged-template `$queryRaw`** parameterizes automatically.
12. **Principal-derived IDs** (`WHERE user_id = request.user.id`) are not IDOR; they are an authorization concern, not exfil.

## Canonical Patterns

### Pattern: SSRF to cloud metadata

Real: Capital One 2019, Next.js CVE-2024-34351.

**Python - bad:**
```python
resp = requests.get(user_url, allow_redirects=True)
```

**Python - safe (Sentry-style):**
```python
from sentry.http import safe_urlopen
resp = safe_urlopen(user_url, allow_redirects=False)
```

**TypeScript - bad:**
```ts
const resp = await fetch(userUrl);
const resp = await axios.get(userUrl);   // Historical redirect-bypass CVE-2020-28168.
```

**TypeScript - safe:**
```ts
const parsed = new URL(userUrl);
if (!ALLOWED_HOSTS.has(parsed.hostname)) throw new Error('disallowed');
const { address } = await lookup(parsed.hostname);
const ip = ipaddr.parse(address);
if (['private','linkLocal','loopback','uniqueLocal','unspecified'].includes(ip.range())) {
  throw new Error('disallowed ip');
}
const resp = await fetch(parsed, { redirect: 'manual' });
```

### Pattern: Path traversal in file download

**Python - bad:**
```python
return send_file(os.path.join("/var/app/exports", name))
```

**Python - safe:**
```python
base = Path("/var/app/exports").resolve()
target = (base / name).resolve()
if not target.is_relative_to(base):
    abort(403)
return send_file(target)
```

**TypeScript - bad:**
```ts
res.sendFile(path.join('/var/app/exports', String(req.query.name)));
```

**TypeScript - safe:**
```ts
const base = path.resolve('/var/app/exports');
const target = path.resolve(base, String(req.query.name));
if (!target.startsWith(base + path.sep)) return res.sendStatus(403);
res.sendFile(target);
```

### Pattern: Raw SQL with user interpolation

**Python - bad:**
```python
Invoice.objects.extra(where=[f"customer_id = {request.GET['cid']}"])
```

**Python - safe:**
```python
Invoice.objects.filter(customer_id=request.GET["cid"])
# or, when the ORM can't express it:
Invoice.objects.extra(where=["customer_id = %s"], params=[request.GET["cid"]])
```

**TypeScript - bad:**
```ts
await prisma.$queryRawUnsafe(`SELECT * FROM users WHERE name = '${name}'`);
```

**TypeScript - safe:**
```ts
await prisma.$queryRaw`SELECT * FROM users WHERE name = ${name}`;
```

### Pattern: Response leaks internal fields

Real: Sentry commit `0c0aae90ac1` (Pydantic `extra = "allow"` leaked `SeerRunState` fields).

**Python - bad:**
```python
class SeerState(BaseModel):
    class Config:
        extra = "allow"
    user_query: str

@app.post("/chat")
def chat(state: SeerState):
    return state.dict()
```

**Python - safe:**
```python
class SeerState(BaseModel):
    class Config:
        extra = "ignore"
    user_query: str
    internal_trace: str = Field(exclude=True)
```

**TypeScript (Prisma) - bad:**
```ts
const user = await prisma.user.findUnique({ where: { id } });
return res.json(user);   // password_hash, 2fa_secret, internal flags.
```

**TypeScript - safe:**
```ts
const user = await prisma.user.findUnique({
  where: { id },
  select: { id: true, displayName: true, avatarUrl: true },
});
return res.json(user);
```

### Pattern: XXE file read

**Python - bad:**
```python
import xml.etree.ElementTree as ET
tree = ET.fromstring(request.data)
```

**Python - safe:**
```python
from defusedxml import ElementTree as ET
tree = ET.fromstring(request.data)
```

## Investigation Playbook

1. **Classify the sink.** Load the matching reference.
2. **Trace the source.** Is the value at the sink user-controlled?
3. **Check the allowlist / validator / parameterization** between source and sink.
4. **Check the library version.** axios / lxml / Sequelize / Prisma / Flask versions change the analysis.
5. **Check siblings and history.** `rg -n '<sink>'` for every call site. `git log -p <file>` for recent guard removals.

If the thread cannot be resolved, drop the finding or report with lower confidence.

## Output

For each finding:

- **File and line** of the unsafe code.
- **Severity** from the table above.
- **Sink class** (SSRF, path traversal, SQL injection, XXE, response leak).
- **What is wrong**, in one sentence.
- **Source**: where the attacker-controlled value originates.
- **Sink**: which API produces the disclosure.
- **Trace**: the specific path from source to sink.
- **Impact**: what data can be read, by whom.
- **Fix**: the concrete change. Name the allowlist, the required parameter, the missing containment check, the DTO/select.

Group findings by severity. Lead with `high`.
