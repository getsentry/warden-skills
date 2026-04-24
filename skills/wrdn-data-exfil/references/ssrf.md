# SSRF Reference

Load when the diff introduces or modifies outbound HTTP calls with user-influenceable URLs: webhooks, integrations, image proxies, URL preview fetchers, OAuth callbacks, metadata fetchers, import-from-URL flows, admin tools that fetch from customer URLs.

SSRF produces two outcomes that both belong in this skill:

1. **Data exfiltration**: attacker reads internal services (Redis, admin panels, metadata) via the server's network position.
2. **Code execution** (indirect): metadata → IAM creds → lateral movement → new RCE primitives. Capital One 2019 is the archetype.

## The Golden Rule

User-controlled URLs must be validated at the IP layer, not the string layer. String-based allowlists fail because:

- DNS can return any IP for a name the attacker owns.
- Redirects move the request to a new host mid-flight.
- Decimal, octal, hex, dotted-hex, and IPv6-compressed forms of the same IP all parse differently.
- DNS rebinding: first resolution passes the check, second resolution (at connect time) goes internal.

The correct validation is:

1. Resolve the hostname to one or more IPs.
2. Check every resolved IP against a blocklist of private/internal/metadata ranges.
3. Disable redirect following, or re-validate on every redirect.
4. Connect using the resolved IP (or ensure the socket enforces the same check).

Sentry's `safe_urlopen` / `safe_create_connection` does all of this. See `references/sentry.md`.

## High-Value Internal Targets

These must always be blocked:

| Target | Why |
|--------|-----|
| `169.254.169.254` | AWS, Azure, OpenStack metadata service. IAM creds, user data, host config. |
| `fd00:ec2::254` | AWS IMDSv2 IPv6. |
| `metadata.google.internal` / `169.254.169.254` | GCP metadata. Same risk. |
| `100.100.100.200` | Alibaba Cloud metadata. |
| `127.0.0.0/8`, `::1` | Loopback services: admin UIs, Redis, Memcached, Elasticsearch. |
| `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` | RFC1918 private networks. |
| `169.254.0.0/16` (broader) | Link-local, includes EC2/Azure metadata. |
| `fc00::/7` | IPv6 unique-local. |
| `fe80::/10` | IPv6 link-local. |
| `0.0.0.0` | Unspecified; can route to localhost on some OSes. |

## Canonical CVEs

- **Capital One 2019**: Misconfigured WAF on EC2 followed attacker-supplied URL to IMDSv1, stole IAM creds, dumped 30GB from S3. <https://krebsonsecurity.com/2019/08/what-we-can-learn-from-the-capital-one-hack/>
- **CVE-2021-26855 (Exchange ProxyLogon)**: `GetTargetBackEndServerUrl` trusted a cookie for backend selection, turning Exchange into an unauthenticated HTTP proxy with domain-computer-account credentials. <https://blog.orange.tw/posts/2021-08-proxylogon-a-new-attack-surface-on-ms-exchange-part-1/>
- **CVE-2023-46805 + CVE-2024-21893 (Ivanti Connect Secure)**: auth bypass chained with SSRF in the SAML component. <https://www.rapid7.com/blog/post/2024/01/11/etr-zero-day-exploitation-of-ivanti-connect-secure-and-policy-secure-gateways/>
- **CVE-2024-34351 (Next.js Server Actions SSRF)**: manipulating the `Host` header made server-action redirects originate from the app server; full internal HTTP responses readable, including `169.254.169.254`. <https://www.assetnote.io/resources/research/advisory-next-js-ssrf-cve-2024-34351>
- **CVE-2020-28168 (axios)**: proxy config applied only to the initial request; redirect to an internal IP bypassed restrictions. <https://www.sentinelone.com/vulnerability-database/cve-2020-28168/>
- **CVE-2025-62718 (axios NO_PROXY bypass)**: `localhost.` (trailing dot) and `[::1]` not normalized; loopback requests routed through proxy. <https://www.cve.news/cve-2025-62718/>
- **CVE-2026-40175 (axios header-injection gadget)**: prototype pollution of HTTP headers allowed injecting `X-aws-ec2-metadata-token-ttl-seconds`, bypassing IMDSv2 to steal IAM creds. <https://github.com/advisories/GHSA-fvcv-3m26-pcqx>
- **Shopify H1 #341876**: SSRF in Exchange screenshotting service → root on all instances via metadata. <https://hackerone.com/reports/341876>

## Canonical Bug Shapes

### 1. Naked fetch with user URL

```python
# bad
resp = requests.get(user_url)
resp = urlopen(user_url)
```

```ts
// bad
const resp = await fetch(userUrl);
const resp = await axios.get(userUrl);
const resp = await got(userUrl);
```

No IP validation, no redirect restriction, no timeout, no response-size limit.

### 2. String-based blocklist

```python
if "169.254.169.254" in user_url or "localhost" in user_url:
    abort(400)
resp = requests.get(user_url)
```

Defeated by: DNS name pointing to 169.254.169.254, IP encoded as `0xa9fea9fe`, `2852039166`, `[::ffff:a9fe:a9fe]`, a host that resolves normally on first check then rebinds to internal on connect.

### 3. Allowlist by hostname prefix

```python
if not user_url.startswith("https://api.partner.com/"):
    abort(400)
```

Defeated by `https://api.partner.com.attacker.com/`, `https://api.partner.com@attacker.com/`, `https://api.partner.com%00attacker.com/`.

Allowlists must be exact hostname match and must verify the URL parses into that exact host via a proper URL parser, not substring.

### 4. Redirect-following without re-validation

```python
resp = requests.get(user_url, allow_redirects=True)  # First hop passed check; second hop is 169.254.169.254.
```

Disable redirects or re-validate each hop. `requests` supports a custom session + hook that intercepts 3xx responses.

### 5. User-controlled URL in webhook payload

```python
# Webhook payload contains "callback_url"; server POSTs to it with data.
requests.post(payload["callback_url"], json=payload)
```

Even authenticated webhooks may come from compromised third parties or integration-config pages. Re-validate every outbound URL through the SSRF chain.

### 6. Image proxy / preview

```ts
// Next.js /_next/image with remotePatterns: '**' or overly broad
// OR custom:
app.get('/preview', async (req, res) => {
  const img = await fetch(req.query.url);
  img.body.pipe(res);
});
```

`/preview?url=http://169.254.169.254/latest/meta-data/iam/security-credentials/`. Cloud metadata leaked through the proxy.

### 7. IP parsing tricks

```python
from urllib.parse import urlparse
p = urlparse(user_url)
if p.hostname == "169.254.169.254":
    abort(400)
```

Defeated by `http://[::ffff:169.254.169.254]/`, `http://2852039166/`, `http://0xa9fea9fe/`, `http://0x0a.0x0a.0x0a.0x0a/`.

Use `ipaddress.ip_address(socket.gethostbyname(host))` and check networks, not strings.

### 8. IMDSv2 bypass via header injection

CVE-2026-40175 shape: prototype pollution or HTTP header-injection primitive lets attacker add `X-aws-ec2-metadata-token-ttl-seconds: 1` to an outbound request. When the server's outbound library is axios, this header is attacker-controlled even on an otherwise hardcoded URL. Pair with an SSRF primitive and IMDSv2 no longer protects.

## Safe Patterns

### Python (Sentry)

```python
from sentry.http import safe_urlopen, safe_urlread

resp = safe_urlopen(user_url, allow_redirects=False, timeout=10)
body = safe_urlread(resp)
```

### Python (non-Sentry)

```python
import ipaddress, socket
from urllib.parse import urlparse

DISALLOWED = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]

def safe_ip(host: str) -> str:
    addr = socket.gethostbyname(host)
    ip = ipaddress.ip_address(addr)
    for net in DISALLOWED:
        if ip in net:
            raise ValueError("disallowed IP")
    return addr

parsed = urlparse(user_url)
if parsed.scheme not in ("http", "https"):
    raise ValueError("bad scheme")
ip = safe_ip(parsed.hostname)
resp = requests.get(user_url, allow_redirects=False, timeout=10)
```

DNS rebinding still beats this at the socket layer; for high-assurance, bind the request to the resolved IP and pass a `Host` header.

### TypeScript

```ts
import { lookup } from 'dns/promises';
import ipaddr from 'ipaddr.js';

const DISALLOWED_RANGES = [
  ['private', 'linkLocal', 'loopback', 'uniqueLocal', 'unspecified'],
];

async function safeFetch(userUrl: string) {
  const url = new URL(userUrl);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('scheme');
  const { address } = await lookup(url.hostname);
  const ip = ipaddr.parse(address);
  const range = ip.range();
  if (['private', 'linkLocal', 'loopback', 'uniqueLocal', 'unspecified'].includes(range)) {
    throw new Error('disallowed');
  }
  return fetch(url, { redirect: 'manual' });
}
```

## False-Positive Traps

- **Fetch to a hardcoded URL constant** (e.g., `API_BASE_URL = "https://api.vendor.com"`) is not SSRF. No source reaches the sink.
- **Server-to-server calls inside a private network** where the destination is fixed infrastructure (e.g., internal Redis) are not SSRF; they're intentional.
- **Sentry callers that go through `safe_urlopen`** are already validated.
- **OAuth redirect URI validation** is a different class — exact-match is still required, but it's a redirect-URL problem, not an outbound-HTTP problem.
- **`fetch(req.body.url, { redirect: 'error' })`** — rejects redirects, mitigating one vector. Still needs IP validation.

## Diff Heuristics

1. New `requests.*`, `urllib.*`, `fetch`, `axios.*`, `got`, `node-fetch`, `http.get`, `undici` call where any part of the URL is derived from request input, webhook payload, integration config, or a DB field written by a user.
2. Existing fetch wrapper bypassed in favor of a direct library call.
3. New webhook/integration subscriber that POSTs to a `callback_url` field from the payload.
4. Image/preview proxy added without `remotePatterns` allowlist.
5. String-based IP/hostname blocklist. Never sufficient.
6. `allow_redirects=True` or default (which is True) on an outbound fetch with user-influenceable URL.
7. Validation function that parses the URL with `urlparse` and checks `hostname` against strings only.

## Verification Commands

```bash
# Outbound HTTP calls in the diff's scope
rg -n 'requests\.(get|post|put|delete|patch)|urlopen|urllib\.request|http\.client|fetch\(|axios\.|got\(' <file>

# Sentry: canonical safe helpers
rg -n 'safe_urlopen|safe_urlread|safe_create_connection|is_safe_hostname' src/sentry/

# Redirect handling
rg -n 'allow_redirects|redirect:|followRedirect' <file>

# URL validation via parsing
rg -n 'urlparse|new URL\(|URL\.parse' <file>
```
