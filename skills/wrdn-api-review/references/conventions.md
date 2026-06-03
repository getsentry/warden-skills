# API Design Conventions, Rule Catalog

Source: https://develop.sentry.dev/backend/api/design/

Each rule below carries its severity, client impact, detection anchors, safe counterpatterns, and the traps that produce false positives. Quote the rule when you report so the author can check it against the doc. Rules marked house style are Sentry-specific; the rest are general REST hygiene.

## Philosophy

- Public-first. Every endpoint is public-facing. Conventions apply regardless of documentation status or `ApiPublishStatus`.
- Stateless and focused. An endpoint does one specific thing. Complex operations get their own endpoint, not a flag on an existing one.
- Code-first. Serializers and handlers are the source of truth; the OpenAPI schema is generated from them. Enforcement is lint on the code, never a hand-edited spec.

---

## Identifier output type

Rule: return resource identifiers as strings, even when numeric.

Severity: high. The only unambiguous, every-client defect.

Client impact: emitting `id` or `*_id` as a JSON number forces every consumer into a `string | number` union, and JavaScript silently loses precision on integers above 2^53. The instability cascades through every SDK and the MCP server.

Detection anchors:
- Field names `id`, `*_id`, `userId`, `organizationId`, `projectId`.
- Sentry function-based serializer returning a bare `obj.id` / `obj.project_id`.
- DRF `IntegerField` / `BigIntegerField` on an identifier without string coercion.
- Express/Nest: a `number` reaching `res.json` or a DTO without `String(...)`.

Safe counterpatterns:
- `str(obj.id)` or `f"{obj.id}"` in the returned dict.
- DRF `CharField(source="id")`, a `SerializerMethodField` returning `str(...)`, or a `to_representation` override that stringifies id keys.
- Express `String(row.id)`; NestJS `@Transform(({ value }) => String(value))`.

Traps:
- Flexible input params (`{organization_id_or_slug}`) are correct. The rule is output-only.
- Non-identifier numbers are fine as numbers: counts, indices, status codes, HTTP codes, timestamps (epoch).
- The model column being an int is irrelevant if the serializer stringifies it. Read the emitted value.

---

## Decimal and float output type

Rule: return decimals as strings; do not return floating point numbers.

Severity: medium, rising to high on money or other precision-critical fields where the loss is real.

Client impact: float JSON loses precision and varies across language runtimes. Financial values, rates, and percentiles must be stable.

Detection anchors:
- Field names suggesting currency, rate, ratio, percentage, precision.
- DRF `DecimalField(coerce_to_string=False)` or `FloatField` on a precision-sensitive value.
- Express/Nest: `parseFloat(...)`, a raw float, or a `.toFixed()` result used as a number rather than a string.

Safe counterpatterns:
- DRF `DecimalField(coerce_to_string=True)` (the DRF default in most setups), or `CharField` wrapping the decimal.
- `str(value)` or a quantized string; Express `value.toFixed(2)` returned as a string; NestJS `@Transform` to a string.

Traps:
- Integer counts and indices are not float violations.
- Low-precision metrics (a score, an average) where a number is acceptable by existing convention. Check the field, do not blanket-flag every number.
- Read the serialized output, not the internal computation type.

---

## Casing and naming

Rule: response attributes in camelCase; path params in snake_case; collections plural and hyphenated (`commit-files`); abbreviate `organization` to `org` (house style); query and body params in camelCase with standard names `sortBy`, `orderBy`, `limit`, `cursor`.

Severity: low. Mechanical and catchable; do not fail a build on it. A brand-new resource shipping fully snake_case may rise to medium.

Client impact: mixed casing breaks generated clients and readability.

Detection anchors:
- A serializer whose emitted key is snake_case (`date_created`, `ip_address`), even when `source=` points at a snake_case column.
- A path param in camelCase (`{projectId}`).
- A singular or non-hyphenated collection segment (`/user`, `/apikeys`).
- `organization` rather than `org` in a customer-facing path.
- `sort_by`, `per_page`, raw `offset` where a cursor is the convention.

Safe counterpatterns:
- Response keys `userId`, `createdAt`; path params `{organization_id}`, `{project_slug}`; routes `/api-keys`, `/team-members`.

Traps:
- Read the emitted JSON key, not the model attribute. A camelCase key over a snake_case `source=` is correct.
- A transform layer (DRF renderer, class-transformer, `camelcaseKeys`) may convert keys downstream. Confirm the wire output before flagging.
- Path-param casing and response-key casing are different rules. Do not conflate them.

---

## Route structure and scoping

Rule: customer-data endpoints are path-scoped under `/organizations/{org}/` or `/projects/{org}/{project}/` (house style); never require `org` as a query param; max three levels of resource nesting; sort and filter via query params, not dedicated routes.

Severity: medium. (`org`-as-query-param is the sharpest case.)

Client impact: improper scoping hurts discoverability; deep nesting yields brittle URLs; query-param scoping requirements break RESTful expectations and complicate every client.

Detection anchors:
- A customer-data route missing the `/organizations/{org}/` prefix.
- A handler reading `org`/`organization` or `project` from the query string instead of the path.
- Resource nesting deeper than three nouns.
- New routes like `/events/sorted`, `/issues/filtered`, `/users/by-name`.

Safe counterpatterns:
- `/organizations/{org}/teams/{team}/members`; `/projects/{org}/{project}/events`.
- `?orderBy=-date` instead of a `/sorted` route.

Traps:
- Internal, relay, and ingestion routes are exempt from org-scoping.
- Count resource nouns, not path params, for nesting depth.
- An optional filtering query param is not a scoping-requirement violation.
- Legacy routes in untouched lines.

---

## HTTP verbs

Rule: GET reads, POST creates, PUT updates (partial supported), DELETE deletes. No PATCH; it is redundant with PUT (house style). For replacement, POST to the individual resource.

Severity: low.

Client impact: PATCH proliferates verbs; house style is PUT for any update.

Detection anchors: a new `def patch` handler, a `@Patch` decorator, or an HTTP method string `'PATCH'` in a new route.

Safe counterpatterns: PUT for partial updates; POST/GET/DELETE as above.

Traps: PATCH in test fixtures or mocks; legacy PATCH routes in untouched lines; third-party webhook receivers.

---

## Response shape and expansion

Rule: return a named resource (`{"user": {...}}`); collections use plural nouns (`{"users": [...]}`); paginated arrays are exempt from wrapping; use `expand` for bounded 1:1 relationships; unbounded relationships get their own paginated endpoint; `collapse` omits attributes without a breaking change; API endpoints must never return HTML error pages.

Severity: medium. (HTML error path and untyped response on a new endpoint are the sharpest cases.)

Client impact: unwrapped or singular-keyed responses create ambiguous parsing; inline unbounded relationships cause pagination and performance problems; HTML errors break JSON clients.

Detection anchors:
- A new single-object endpoint returning a bare object instead of `{"resource": {...}}`.
- A collection keyed singular: `{"user": [...]}`.
- A serializer inlining a `many=True` relationship with no pagination or `expand` gate.
- A new endpoint whose response is an open dict or an array of rows with no resolvable schema (the analytics/events surface is the canonical offender).
- An error handler emitting HTML content-type or `<html>`.

Safe counterpatterns:
- `{"widget": {...}}`, `{"widgets": [...]}`.
- `self.paginate(...)` returning a top-level array (the established list shape, exempt).
- `?expand=owner` to include a 1:1 inline; a separate `/users/{id}/projects` for an unbounded set.
- JSON error envelope.

Traps:
- Paginated arrays are exempt. Do not flag them as missing a wrapper.
- Internal serializers not used in a public response.
- A 1:1 `expand` is not an unbounded-inline violation.
- For the existing events endpoints, do not re-litigate the untyped shape. Recommend a typed, named envelope only on new endpoints of that kind.

---

## Not specified by the doc

The doc is silent on these. Do not assert a hard rule; note the gap at low confidence if a diff touches them. The one safe exception is HTML error pages, covered above as a shape defect.

- Error response envelope.
- Versioning and deprecation policy.
- Rate-limit headers.
- Auth and scope declaration.
