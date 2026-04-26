# GraphQL Access-Control Reference

Load when the diff touches GraphQL schema (SDL or code-first), resolvers, directives, federation, or a GraphQL server (Apollo, Yoga, Mercurius, graphql-ruby, Strawberry, graphql-core).

GraphQL exposes a much larger authorization surface than REST. Every field is individually reachable. A query-level auth check is almost never sufficient.

## The Core Principle: Field-Level Authz

Authorization in GraphQL happens at the **resolver** level, not the query level. A top-level `@auth` directive on `Query.user` does not protect `User.ssn` if `ssn` is resolved via a separate resolver.

Examples of the principle in action:

- **Salt Labs fintech case**: resolver-level authz was absent; root query authenticated but per-entity resolvers fetched across tenants.
- **Shopify H1 #2207248**: `BillingInvoice` lookup by global ID without shop scoping in the resolver.

## Known CVE Classes

### CVE-2025-64530 — Apollo Federation interface directive propagation

Authorization directives on an *interface* type were not propagated to implementing types. Querying via inline fragment on the concrete type bypassed the check.

```graphql
interface Sensitive @requiresScopes(scopes: [["admin"]]) {
  value: String
}

type Secret implements Sensitive {
  value: String
}

# Query: `{ secretOne { ... on Secret { value } } }` bypassed the interface's directive.
```

Detection: when `@authenticated`, `@requiresScopes`, or any custom authorization directive is applied to an interface or union, check that either (a) the server version handles propagation, or (b) the directive is duplicated on each implementing type.

### GHSA-m8jr-fxqx-8xx6 — Apollo Federation `@requires` / `@fromContext`

Transitive fields fetched from subgraphs were not re-checked against their own `@authenticated` / `@requiresScopes`. A field referenced via `@requires` could leak to a subgraph that doesn't have the scopes to read it.

Detection: `@requires` or `@fromContext` on a field whose target has an authorization directive.

### Relay `Query.node(id: ID!)` global lookup

The Relay specification defines a global object lookup:

```graphql
query { node(id: "T3JkZXI6MTIz") { ... on Order { total } } }
```

If `node` authorizes at the query level ("user must be logged in") but does not delegate to the target type's authz, it is a per-type IDOR primitive. Every `Node` implementation needs its own authz, or `node` must route through per-type guards.

## Canonical Bug Shapes

### 1. Root-only `@auth` directive

```graphql
type Query {
  me: User @auth
  order(id: ID!): Order @auth
}

type Order {
  id: ID!
  total: Float
  customer: Customer
  invoice: Invoice
}
```

`Query.order(id:)` is protected. But:

- Does the `order(id:)` resolver scope by `ctx.user.id`? If not, any logged-in user reads any order.
- Do `Order.customer` and `Order.invoice` have their own access checks? If a Customer is sensitive, the field resolver needs its own guard.

### 2. `__resolveReference` bypassing parent authz

In Apollo Federation, entity resolvers can be called by the gateway for any entity reference a client constructs:

```ts
const resolvers = {
  Order: {
    __resolveReference(ref: { id: string }) {
      return db.order.findUnique({ where: { id: ref.id } });
    },
  },
};
```

The gateway may invoke this resolver without the user ever visiting the query path that would otherwise guard it. `__resolveReference` must include its own ownership scoping.

### 3. `DataLoader` without per-request authorization

```ts
const orderLoader = new DataLoader(async (ids: string[]) => {
  const orders = await db.order.findMany({ where: { id: { in: ids } } });
  return ids.map(id => orders.find(o => o.id === id));
});
```

Batches across requests (if declared at module scope), or fetches without user scoping. Rule: DataLoaders must be created per-request (scoped to the GraphQL context) and scoped to the current user's tenant.

### 4. Mutation resolver without authorization

```ts
const resolvers = {
  Mutation: {
    deleteOrder: async (_, { id }, ctx) => {
      if (!ctx.user) throw new Error('unauthorized');  // Auth only.
      await db.order.delete({ where: { id } });       // No ownership check.
    },
  },
};
```

Authentication is present. Authorization is not. Add ownership scoping to the query or load-and-check:

```ts
deleteOrder: async (_, { id }, ctx) => {
  if (!ctx.user) throw new Error('unauthorized');
  const order = await db.order.findFirst({ where: { id, userId: ctx.user.id } });
  if (!order) throw new Error('not found');
  await db.order.delete({ where: { id: order.id } });
},
```

### 5. Field-level resolvers on sensitive fields

```ts
const resolvers = {
  User: {
    email: (parent) => parent.email,      // OK for self-query.
    ssn: (parent) => parent.ssn,          // Always returns SSN if parent has it.
  },
};
```

If the parent `User` can be reached via a non-self query (e.g., `Query.user(id:)`), every sensitive field needs its own resolver guard:

```ts
ssn: (parent, _, ctx) => {
  if (parent.id !== ctx.user.id && !ctx.user.isAdmin) return null;
  return parent.ssn;
},
```

### 6. Introspection left on in production

```ts
const server = new ApolloServer({ typeDefs, resolvers, introspection: true });
```

Not directly an authorization bypass, but exposes the schema (mutation and query surface) to unauthenticated callers, making reconnaissance trivial. When paired with a missing resolver-level guard, it accelerates exploitation.

### 7. Custom directive with a silent fail-open

```ts
// Schema directive that checks a scope:
const requireScope = (scope: string) => (next, source, args, context) => {
  const scopes = context.user?.scopes;
  if (!scopes) return next();  // Fail-open if scopes not loaded.
  if (!scopes.includes(scope)) throw new ForbiddenError();
  return next();
};
```

The `if (!scopes) return next()` branch is the bug. Scopes not loaded should be treated as no scopes (deny), not a free pass.

## False-Positive Traps

- **Framework-level resolver guards** (NestJS `@UseGuards(GqlAuthGuard)` applied to the resolver class) may cover every field. Check for resolver-class decorators.
- **Field derived purely from the request principal** (e.g., `me.id` returning `ctx.user.id`) is not an IDOR target.
- **Read-only, intentionally public schema** (marketing copy, public product catalog). Confirm scope before flagging.
- **Union / interface type with directives on every concrete member** is safe even when the interface lacks directives.

## Diff Heuristics

1. **New resolver that loads by ID from `args` without scoping by `ctx.user`.**
2. **New `@auth` or custom authorization directive on an interface or union** — verify propagation.
3. **New `__resolveReference` for a federated entity without scoping.**
4. **New DataLoader created at module scope** instead of per-request.
5. **New mutation that does `ctx.user ? ok : deny` only**, without ownership.
6. **Directive logic with an early `return next()` on unexpected input** (fail-open).
7. **`introspection: true` shipped to production in a diff.**

## Verification Commands

```bash
# All resolvers
rg -n 'Resolver|resolvers\b' <project> --type ts --type js
rg -n 'def resolve_|@strawberry\.field|@query\.field' <project> --type py

# Directive usage in schema
rg -n '@auth|@requiresScopes|@authenticated' <project>

# Federation entity resolvers
rg -n '__resolveReference' <project>

# DataLoader scope
rg -n 'new DataLoader' <project>

# Introspection flag
rg -n 'introspection' <project>
```
