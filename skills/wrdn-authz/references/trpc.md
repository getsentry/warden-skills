# tRPC Access-Control Reference

Load when the diff touches tRPC routers, `publicProcedure`, `protectedProcedure`, middleware, or `createContext`.

## Auth Defaults

**Per-procedure.** tRPC does not enforce anything by default; protection comes from using a procedure that includes auth middleware, typically named `protectedProcedure`.

The canonical pattern:

```ts
// server/trpc.ts
const t = initTRPC.context<Context>().create();

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use((opts) => {
  if (!opts.ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return opts.next({ ctx: { user: opts.ctx.user } });
});
```

`publicProcedure` is deliberate opt-out. Every use is worth reviewing.

## Canonical Bug Shapes

### 1. `publicProcedure` by accident

```ts
export const appRouter = router({
  deleteAccount: publicProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input }) => {
      await db.user.delete({ where: { id: input.userId } });
    }),
});
```

Copy-paste from a login/signup router. Every `publicProcedure` in a diff is a finding candidate; confirm it's actually meant to be public.

### 2. `ctx.user` truthiness trap

```ts
export const protectedProcedure = t.procedure.use((opts) => {
  if (!opts.ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
  return opts.next({ ctx: opts.ctx });
});
```

`opts.ctx.user` may be set to `{}` by an upstream middleware that tried to resolve a user and failed non-fatally. Empty object is truthy.

Check a specific field:

```ts
if (!opts.ctx.user?.id) throw new TRPCError({ code: 'UNAUTHORIZED' });
```

### 3. Authorization check inside the procedure, not the middleware

```ts
export const adminProcedure = protectedProcedure.use((opts) => {
  // No admin check here; every protected procedure qualifies as admin?
  return opts.next({ ctx: opts.ctx });
});
```

When naming a procedure `adminProcedure`, add the actual role check:

```ts
export const adminProcedure = protectedProcedure.use((opts) => {
  if (opts.ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return opts.next({ ctx: opts.ctx });
});
```

### 4. IDOR inside the procedure

```ts
getOrder: protectedProcedure
  .input(z.object({ orderId: z.string() }))
  .query(async ({ input }) => {
    return await db.order.findUnique({ where: { id: input.orderId } });
  }),
```

Authentication is present via `protectedProcedure`, but no ownership scoping. Add it:

```ts
.query(async ({ input, ctx }) => {
  return await db.order.findFirst({
    where: { id: input.orderId, userId: ctx.user.id },
  });
}),
```

### 5. `createContext` that silently swallows auth errors

```ts
export async function createContext(opts: CreateNextContextOptions): Promise<Context> {
  try {
    const session = await getSession(opts);
    return { user: session?.user ?? null };
  } catch {
    return { user: null };  // On any error, anonymous. Hides real auth problems.
  }
}
```

The `catch` that returns `{ user: null }` masks JWT validation errors, session-store outages, and other conditions that should fail loud. For sensitive operations, an auth-resolution error should throw, not silently anonymize.

### 6. Middleware ordering

```ts
export const protectedProcedure = t.procedure
  .input(z.object({ orgId: z.string() }))
  .use((opts) => {
    // Auth check uses opts.input.orgId before confirming user identity.
  });
```

tRPC middlewares run in declared order. `use()` placed after input parsing sees parsed input but the auth check itself must come first if the logic depends on identity.

### 7. Batched calls bypassing per-request rate/auth

tRPC supports batched calls. If a rate-limit middleware or auth-check middleware increments a counter per-batch rather than per-call, attackers can cram many sensitive operations into a single HTTP request. Not strictly authorization, but worth noting.

## False-Positive Traps

- **`createContext` sets `ctx.user` from a verified session**; subsequent `protectedProcedure` use is safe.
- **`publicProcedure` on explicitly-public operations** (signup, login, public marketing data). Confirm intent rather than flagging.
- **Procedures inherit middlewares from their base procedure chain**: `adminProcedure = protectedProcedure.use(...)` inherits the auth check.

## Diff Heuristics

1. **New use of `publicProcedure`.** Every one deserves review.
2. **New `ctx.user` check using truthiness (`if (ctx.user)`) instead of a field (`ctx.user?.id`).**
3. **Procedure named `adminProcedure` / `staffProcedure` without a role check in its middleware.**
4. **Database lookup in a procedure by input ID without scoping by `ctx.user`.**
5. **`createContext` with a `catch` that returns `{ user: null }`.**

## Verification Commands

```bash
# Every publicProcedure definition and use
rg -n 'publicProcedure' <project>

# Procedure base definitions
rg -n 'protectedProcedure|adminProcedure|staffProcedure' <project>

# Context creation
rg -n 'createContext' <project>

# tRPC routers
rg -n '= router\(' <project>
```
