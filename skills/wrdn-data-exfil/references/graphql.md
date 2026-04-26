# GraphQL RCE / Exfil Reference

Load when the diff touches GraphQL schema, resolvers, federation, introspection config, or debug-mode config. This file covers the exfil-through-schema angle.

## Introspection in Production

```ts
// bad
const server = new ApolloServer({ typeDefs, resolvers, introspection: true });
```

Introspection queries return the full schema: every type, every field, every mutation, every input. For an attacker, this is reconnaissance. Paired with any resolver-level auth gap, introspection tells them exactly where to point the probe.

```ts
// safe
const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: process.env.NODE_ENV !== 'production',
});
```

Not a direct exfil primitive, but the severity should reflect "paired with a missing resolver guard, this accelerates finding it." Medium severity in prod.

## Debug Mode

```ts
const server = new ApolloServer({ debug: true });
```

Verbose errors. Stack traces with source paths and sometimes SQL strings.

```ts
const server = new ApolloServer({ formatError: (err) => ({ message: err.message }) });
```

Strip internals in the error formatter.

## Mass-Field Queries

GraphQL's flexibility is an exfil surface: a single query can request every field of every resource. If a type exposes sensitive fields without resolver-level guards, an authenticated user can enumerate everyone's data.

Real example: Salt Labs fintech case — authenticated root query but resolvers fetched across tenants. <https://salt.security/blog/api-threat-research-graphql-authorization-flaws-in-financial-technology-platform>

```graphql
query ExfilAll {
  users {            # Returns every user if resolver doesn't scope.
    id
    email
    internalNotes
    subscriptionTier
  }
}
```

### Detection

- New top-level `Query.users` / `Query.organizations` / `Query.invoices` without a `ctx.user`-scoped `where` clause in the resolver.
- Resolvers that call `db.model.findMany()` without a scope filter.

## Field-Level Exposure

Sensitive fields on an otherwise-scoped type:

```graphql
type User {
  id: ID!
  email: String
  ssn: String        # Reachable via any User fetch unless the resolver guards this field.
}
```

A top-level query `Query.user(id: "me")` that returns the current user is safe for `id` and `email` but leaks `ssn` to anyone who queries it — because there's no resolver distinguishing "me querying me" from "anyone querying anyone via `node(id:)`".

```ts
// safe
const resolvers = {
  User: {
    ssn: (parent, _, ctx) => {
      if (parent.id !== ctx.user.id && !ctx.user.isAdmin) return null;
      return parent.ssn;
    },
  },
};
```

## Relay `node(id:)` as an Exfil Primitive

```graphql
query { node(id: "T3JkZXI6MTIz") { ... on Order { total } } }
```

If `node` authorizes "user must be authenticated" but delegates to per-type resolvers that don't scope, any global ID fetches any object. Per-type authz required on every `Node` implementation.

## Federation: `__resolveReference`

```ts
const resolvers = {
  Order: {
    __resolveReference(ref: { id: string }) {
      return db.order.findUnique({ where: { id: ref.id } });
    },
  },
};
```

Federation gateways invoke `__resolveReference` for any entity reference a client constructs. No visit-query-first gate. Without per-entity scoping, this is an IDOR / exfil primitive across the federated graph.

CVE-2025-64530 (interface directive propagation) and GHSA-m8jr-fxqx-8xx6 (`@requires` / `@fromContext` transitive fields) are relevant when they expose fields or objects across a data boundary.

## DataLoader Scope

```ts
const orderLoader = new DataLoader(async (ids: string[]) => {
  const orders = await db.order.findMany({ where: { id: { in: ids } } });
  return ids.map(id => orders.find(o => o.id === id));
});
```

Problems:

- **Module-scoped instance**: shared across requests. One user's batch can return another user's rows.
- **Unscoped query**: `where: { id: { in: ids } }` with no `userId` filter is mass IDOR.

Safe: create per-request, scope by principal.

```ts
// safe
function makeLoaders(ctx: { user: User }) {
  return {
    order: new DataLoader(async (ids: string[]) => {
      const orders = await db.order.findMany({
        where: { id: { in: ids }, userId: ctx.user.id },
      });
      return ids.map(id => orders.find(o => o.id === id) ?? null);
    }),
  };
}
```

## Error Messages

```ts
// bad
throw new GraphQLError(`SQL failed: ${err.message}`);   // Leaks internal schema via error text.
```

GraphQL errors land in `errors[]` with full detail unless `formatError` strips them. Internal errors should return `{ message: "internal" }` in production.

## Query Depth / Complexity

Not strictly exfil, but combined with unscoped resolvers a deeply-nested query can cascade reads across the entire DB. Enforce query-depth limits (`graphql-depth-limit`) and complexity limits (`graphql-query-complexity`).

## Detection Heuristics

1. `introspection: true` in production config.
2. `debug: true` or missing `formatError` in production.
3. Top-level `Query.*` returning list-of-entities without resolver scoping.
4. Per-type resolver on sensitive field (SSN, email, payment method) without field-level guard.
5. `__resolveReference` in federated schema without scoping.
6. DataLoader at module scope (not per-request).
7. DataLoader query without principal scoping.
8. GraphQL error messages that include SQL fragments, paths, or internal state.

## False-Positive Traps

- Introspection enabled in dev-only config.
- `debug: true` behind a production-env check.
- Resolver-level auth via a framework-level guard (`@UseGuards(GqlAuthGuard)` on the class) — safe if the guard runs on every field.
- DataLoaders created in a per-request context factory are safe.
- Schema types that are intentionally public (product catalog, marketing copy).

## Verification Commands

```bash
# Apollo / Yoga / Mercurius / Strawberry servers
rg -n 'ApolloServer|createYoga|mercurius|GraphQLServer|strawberry' <project>

# Introspection / debug
rg -n 'introspection\s*:|debug\s*:' <project>

# Resolver files
rg -n 'Resolver|resolvers\b|@Query|@Mutation|@ResolveField' <project>

# Federation entity resolvers
rg -n '__resolveReference' <project>

# DataLoader usage
rg -n 'new DataLoader' <project>

# Error formatters
rg -n 'formatError|errorFormatter' <project>

# Depth/complexity guards
rg -n 'graphql-depth-limit|graphql-query-complexity|maxDepth' <project>
```
