# Next.js Access-Control Reference

Load when the diff touches Next.js `middleware.ts`, `app/**/route.ts`, `app/**/page.tsx`, Server Actions (`'use server'`), or `pages/api/**`. Next.js has multiple, independent auth surfaces. The common bug is assuming one of them protects all of them.

## The Four Surfaces

Each is an independent enforcement surface. Protecting one does not protect the others.

| Surface | What runs | Auth source |
|---------|-----------|-------------|
| Middleware (`middleware.ts`) | Runs before matched requests at the edge. `matcher` config scopes what it applies to. | Whatever the middleware implements. |
| App Router Route Handlers (`app/**/route.ts`) | HTTP API endpoints. Reachable by any HTTP client. | Explicit session check in the handler, or middleware coverage. |
| App Router Pages + Server Actions (`app/**/page.tsx` + `'use server'` functions) | Pages render on the server; Server Actions are POST endpoints invoked from the client. | Explicit check in the action body; page-level check does NOT cover actions. |
| Pages Router (`pages/api/**`) | Legacy API surface. Each handler is its own function. | Per-handler session check or HOF (`withAuth`). |

## Known CVE Classes

### CVE-2025-29927: `x-middleware-subrequest` header bypass

Next.js middleware has an internal recursion-guard header (`x-middleware-subrequest`). Pre-patch, this header was accepted from external callers; setting it caused `runMiddleware` to short-circuit, bypassing every auth check in the middleware.

Affected: Next.js < 15.2.3 (and patched backports). Detection: a diff that downgrades Next.js, or uses middleware-only auth with an old version, is a finding.

Recommendation: require Next.js 15.2.3+ (or the appropriate backport). Middleware alone is not a sufficient defense-in-depth; route handlers and Server Actions should still enforce their own checks.

### CVE-2025-55182 ("React2Shell") class: Server Actions without in-action auth

Next.js data-security documentation is explicit: *a page-level auth check does not extend to Server Actions defined within it; re-verify inside the action.*

Server Actions are RPC endpoints the framework exposes via a POST to the page URL. An attacker who knows the action's exported name can invoke it directly without visiting the page at all. Any auth check in the page component does nothing for the action.

**Bad:**

```tsx
// app/admin/page.tsx
export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.isAdmin) redirect('/');
  return <AdminForm />;
}
```

```ts
// app/admin/actions.ts
'use server';
export async function deleteUser(userId: string) {
  await db.user.delete({ where: { id: userId } });
  // No auth. Invokable by anyone who can POST to the server action.
}
```

**Safe:**

```ts
'use server';
import { auth } from '@/auth';

export async function deleteUser(userId: string) {
  const session = await auth();
  if (!session?.user?.isAdmin) throw new Error('unauthorized');
  await db.user.delete({ where: { id: userId } });
}
```

Every Server Action must re-verify auth. Every one.

### Middleware matcher misconfiguration

```ts
// middleware.ts
export const config = {
  matcher: ['/dashboard/:path*'],
};
```

This matches `/dashboard/*` but not `/api/dashboard/*`. A new route handler at `app/api/dashboard/settings/route.ts` is exposed even though the UI page is protected by middleware.

Matcher regex has historical footguns:

- Path-based auth that forgets `/api/*` routes.
- Dynamic segments written as `/dashboard/:id` instead of `/dashboard/:id*` (single vs catch-all).
- Negative-lookbehind patterns that accidentally exclude intended paths.

## Canonical Bug Shapes

### 1. Page-level auth, action without auth

Already covered above. This is the #1 Next.js authorization bug in the App Router era.

### 2. Route handler added at `app/api/foo/route.ts` without auth

```ts
// app/api/admin/delete-user/route.ts
export async function POST(req: Request) {
  const { userId } = await req.json();
  await db.user.delete({ where: { id: userId } });
  return Response.json({ ok: true });
}
```

The middleware may or may not cover `/api/admin/*`. Verify the `matcher`. Even if it does, defense-in-depth says: re-check in the handler.

### 3. `getServerSideProps` protects the page, `route.ts` exposes the same data

```ts
// pages/dashboard/invoices.tsx - gated by getServerSideProps auth check
export async function getServerSideProps(ctx) {
  const session = await getSession(ctx);
  if (!session) return { redirect: { destination: '/login', permanent: false } };
  const invoices = await db.invoice.findMany({ where: { userId: session.userId } });
  return { props: { invoices } };
}

// app/api/invoices/route.ts - NOT gated, exposes all invoices
export async function GET() {
  return Response.json(await db.invoice.findMany());
}
```

The UI page is safe; the JSON endpoint is not.

### 4. Middleware bypass via exact-match escape

```ts
// middleware.ts matcher: ['/admin/:path*']
export async function middleware(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) return NextResponse.redirect(new URL('/', req.url));
}
```

Path `/admin` (no trailing slash) or `/admin.json` may route to a dynamic segment in some Next.js configurations without matching the middleware pattern. Verify the matcher against all reachable paths.

### 5. Trusting `request.headers` set by middleware

```ts
// middleware.ts
export async function middleware(req: NextRequest) {
  const session = await auth();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-user-id', session.userId);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

// app/api/me/route.ts
export async function GET(req: Request) {
  const userId = req.headers.get('x-user-id');  // Trusted.
  return Response.json(await db.user.findUnique({ where: { id: userId } }));
}
```

This is safe *only if* external callers cannot set `x-user-id` themselves. In practice, once a request lands at the route handler, headers look the same whether they came from middleware or from `curl -H "x-user-id: ..."`. The handler must either re-verify auth independently or verify the header was injected (via a signed token, a hop-by-hop secret, etc.).

The pre-CVE-2025-29927 world is exactly this: middleware-set headers treated as trusted, then the bypass header let attackers skip middleware entirely.

### 6. Server Action bound to a user via page props

```tsx
// app/orders/[id]/page.tsx
async function OrderPage({ params }: { params: { id: string } }) {
  const session = await auth();
  const order = await db.order.findUnique({
    where: { id: params.id, userId: session.userId },
  });

  async function cancel() {
    'use server';
    await db.order.update({ where: { id: params.id }, data: { status: 'cancelled' } });
    // The `params.id` captured in closure looks scoped, but the action is callable
    // with any orderId from the client.
  }

  return <CancelButton onClick={cancel} />;
}
```

Server Actions defined inline in a page look like they inherit page scope. They don't. The closure-captured `params.id` is serialized into the action metadata; an attacker can invoke the action with any ID.

Inline Server Actions should re-verify ownership inside the action:

```tsx
async function cancel() {
  'use server';
  const session = await auth();
  const order = await db.order.findFirst({
    where: { id: params.id, userId: session.userId },
  });
  if (!order) throw new Error('unauthorized');
  await db.order.update({ where: { id: order.id }, data: { status: 'cancelled' } });
}
```

### 7. Pages API without auth

```ts
// pages/api/export.ts
export default async function handler(req, res) {
  const data = await db.order.findMany();
  res.json(data);
}
```

The Pages Router has no default protection. Every handler is its own enforcement point.

## False-Positive Traps

- **`middleware.ts` with a correct, broad matcher** may protect the new route handler. Read `middleware.ts` before flagging.
- **Server Components without Server Actions**: pure RSC pages that only read data don't expose an RPC surface. Missing in-component auth is fine if the page is genuinely public-read.
- **Library-managed auth**: `@auth/nextjs` (NextAuth v5) wraps actions with a session check via `auth.protect()`. Check for this idiom.

## Diff Heuristics

1. **New `'use server'` function without an `auth()`/`getSession()` call in the first few lines.**
2. **New `app/**/route.ts` handler without an auth check.**
3. **Next.js version downgrade** or dependency pin to `< 15.2.3` in a project that depends on middleware for auth.
4. **Middleware matcher changed** to add/exclude paths — verify each path is still covered.
5. **`getServerSideProps` auth gate with a parallel unprotected route handler** at the same data.
6. **Route handler or Server Action that trusts headers set by middleware** without a signed/hop-by-hop validation.
7. **Inline Server Action using page closure state as a security boundary.**

## Verification Commands

```bash
# Every Server Action
rg -n "'use server'" <project>

# Every route handler
find <project>/app -name 'route.ts' -o -name 'route.tsx'

# Every Pages API handler
ls <project>/pages/api/

# Middleware matcher
rg -n 'matcher' <project>/middleware.ts

# Next.js version
jq '.dependencies.next' <project>/package.json
```
