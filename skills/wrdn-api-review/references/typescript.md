# Resolving the Emitted Shape, TypeScript / Node

Load when a finding depends on the JSON a TS API layer actually sends. The type annotation is not the contract. The serialized value is.

## Where the contract is

The contract is whatever reaches `res.json(...)`, the returned object in a tRPC procedure, or the value a NestJS handler returns. Trace to that value. A `Widget` interface that types `id: string` is not proof: confirm the runtime value is a string, because an ORM row often carries `id: number` and a spread `{ ...row }` carries the number straight through.

```ts
// The interface lies if the row is spread without coercion.
interface Widget { id: string }
const row = await db.widget.findUnique({ where: { id } }); // row.id is number
res.json({ widget: { ...row } });                          // emits a number
```

## Identifier type

| Expression | Emits | Verdict |
|---|---|---|
| `row.id`, `row.project_id` (numeric column) | number | defect, wrap in `String(...)` |
| `String(row.id)`, `` `${row.id}` `` | string | correct |
| `{ ...row }` spread of a row with numeric id | number | defect |
| BigInt serialized via a custom replacer to string | string | correct |

## Casing

The emitted key is the object property as written, or as transformed by a serialization layer. `{ date_created: row.created_at }` is a defect. If the layer runs a camelCase transform (a `camelcaseKeys` call, a class-transformer `@Expose({ name })`, a serializer interceptor), read that layer and confirm the output, do not flag the pre-transform property.

```ts
// Defect: snake_case reaches the client.
res.json({ user: { date_created: row.created_at, ip_address: row.ip } });

// Correct.
res.json({ user: { dateCreated: row.created_at, ipAddress: row.ip } });
```

## Floats and decimals

A numeric rate, money, or percentile sent as a JS number serializes as a JSON number. The rule wants decimals as strings and no floats. A Prisma `Decimal` often stringifies acceptably, but a `Number(...)` cast or a raw float does not. Confirm the serialized form.

## Named-resource envelope

```ts
res.json({ widget });          // named single resource
res.json({ widgets });         // plural collection
res.json(widget);              // bare object, flag on a new endpoint
```

A paginated list with a cursor envelope is the established list shape and is not a named-resource violation.

## NestJS and tRPC notes

- NestJS: the handler return value is serialized by the framework. A `ClassSerializerInterceptor` plus `@Expose`/`@Exclude` controls keys and inclusion. Read the DTO and the interceptor, not just the entity.
- tRPC: the procedure output (and its output `zod` schema if present) is the contract. A `z.number()` on an id output is the defect to flag.

## Checklist before reporting

1. Find the value that reaches `res.json` / the returned output.
2. Per key: right JSON type (ids and decimals as strings, no floats), camelCase key after any transform layer.
3. Named resource, or a paginated array.
4. If a serialization interceptor or transform sits between the value and the wire and you cannot see its config, say so and lower confidence.
