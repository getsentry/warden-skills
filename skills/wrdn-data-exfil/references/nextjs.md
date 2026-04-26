# Next.js Data-Exfiltration Reference

Load when the diff touches `middleware.ts`, `app/**/route.ts`, Server Actions, `next.config.js` `images.remotePatterns`, or any Server Component returning DB data. Ignore React2Shell and Server Actions reaching `eval`/`Function` unless they expose data.

## CVE-2024-34351 — Server Actions SSRF

Manipulating the `Host` header made server-action redirects originate from the app server. An attacker read full internal HTTP responses, including `169.254.169.254`. Affected Next.js prior to 14.1.1.

Detection:

- Next.js version pinned below the patch.
- Code that explicitly trusts the `Host` header to construct URLs.
- Server Actions that fetch a URL constructed from request data.

## GHSA-rvpw-p7vw-wj3m — `/_next/image` SSRF

Over-broad `remotePatterns`:

```ts
// bad
module.exports = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};
```

`/_next/image?url=http://169.254.169.254/...` becomes a metadata proxy.

```ts
// safe
module.exports = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.example.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};
```

## CVE-2025-29927 — Middleware Bypass Enables SSRF Bypass

`x-middleware-subrequest` header short-circuited middleware. The exfil angle: a middleware that pre-filters URLs, for example for SSRF defense, is bypassable, turning a "safe" downstream fetch into an SSRF primitive.

Pin Next.js `>= 15.2.3` (or appropriate backport) and don't rely on middleware as the sole defense.

## Server Components Returning Full DB Rows

```tsx
// bad
export default async function Profile() {
  const user = await db.user.findUnique({ where: { id: session.userId } });
  return <ProfileView user={user} />;   // Serializes every column to client.
}
```

React Server Components serialize props. A full DB row reaches the client even if the displayed UI uses only two fields. Filter at the RSC boundary:

```tsx
const user = await db.user.findUnique({
  where: { id: session.userId },
  select: { id: true, displayName: true, avatarUrl: true },
});
```

## Route Handlers (`app/api/**/route.ts`)

Independent surface. Common shapes:

```ts
// app/api/download/route.ts — bad
export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get('name');
  const stream = fs.createReadStream(path.join('exports', name));
  return new Response(stream);
}
```

Path traversal. See `references/path-traversal.md`.

```ts
// app/api/proxy/route.ts — bad
export async function GET(req: Request) {
  const target = new URL(req.url).searchParams.get('url');
  const upstream = await fetch(target);
  return new Response(upstream.body);
}
```

SSRF. See `references/ssrf.md`.

## `getServerSideProps` Leaking Data

```ts
export async function getServerSideProps(ctx) {
  const user = await db.user.findUnique({ where: { id: ctx.query.id } });
  return { props: { user } };           // Full row passed as props; visible in HTML source.
}
```

Same shape as RSC: select explicit fields.

## Trusting Middleware-Set Headers

```ts
// middleware.ts
export async function middleware(req: NextRequest) {
  const session = await auth();
  const headers = new Headers(req.headers);
  headers.set('x-user-id', session.userId);
  return NextResponse.next({ request: { headers } });
}

// app/api/me/route.ts — bad
export async function GET(req: Request) {
  const userId = req.headers.get('x-user-id');     // Trusted blindly.
  return Response.json(await db.user.findUnique({ where: { id: userId } }));
}
```

If the route is reachable without going through middleware (CVE-2025-29927 or matcher gap), the header is attacker-controlled.

## Detection Heuristics

1. Next.js version below 14.1.1 (CVE-2024-34351) or below 15.2.3 (CVE-2025-29927) with related defenses depended on.
2. `images.remotePatterns` containing `**` / overly broad hostnames.
3. Server Action or route handler making outbound `fetch` with user URL — see `references/ssrf.md`.
4. Server Component / `getServerSideProps` returning full DB rows as props.
5. `app/api/**/route.ts` reading user paths into `fs.*` without containment.
6. Route handler trusting middleware-set headers without re-verification or hop-by-hop signing.

## False-Positive Traps

- `remotePatterns` with specific hostnames is safe.
- RSC returning a hand-shaped DTO (not a raw row) is safe.
- Middleware-set headers consumed by a route handler that *also* re-verifies the session are safe.

## Verification Commands

```bash
jq '.dependencies.next' package.json
rg -n 'remotePatterns|images:' <project>/next.config.*
rg -n "'use server'" <project>
find <project>/app -name 'route.ts' -o -name 'route.tsx'
rg -n 'export default async function' <project>/app
rg -n 'matcher' <project>/middleware.ts
```
