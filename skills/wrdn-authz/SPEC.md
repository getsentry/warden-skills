# wrdn-authz Specification

## Intent

`wrdn-authz` finds authorization defects in code review: wrong principal, tenant, role, scope, or ownership boundary reaching protected data or actions.

Authentication details matter only when the resulting identity, role, tenant, session, or token claim is trusted by an authorization decision.

## Scope

In scope:

- IDOR and missing object ownership checks.
- Missing tenant, organization, project, shop, team, or account scoping.
- Role, permission, and scope checks that fail open or check the wrong actor.
- Admin, support, impersonation, billing, and export actions missing the required authorization gate.
- Mass assignment that changes role, tenant, permission, ownership, or staff fields.
- JWT, session, OAuth, or password-reset claims trusted for roles, scopes, tenants, or ownership without sufficient verification.

Out of scope:

- Pure login, logout, MFA, password reset, credential stuffing, session fixation, or account recovery bugs that do not feed an authorization decision.
- Injection, server-side code execution, SSRF, XSS, path traversal, and data leakage unless the missing authorization check is the direct bug.
- Generic hygiene: logging, rate limits, error verbosity, style, or transport settings.
- Dependency CVEs with no changed application authorization logic.

## Users And Trigger Context

- Primary users: Warden code reviewers analyzing application-security diffs.
- Common user requests: review route handlers, API endpoints, resolvers, serializers, ORM queries, RBAC/ACL changes, admin tooling, billing flows, and token-derived scopes.
- Should not trigger for: standalone authentication lifecycle work, generic crypto review, or broad code-quality review.

## Runtime Contract

- Required first actions: identify framework and effective route/middleware/guard chain, then trace the data path to the object, tenant, role, or scope decision.
- Required outputs: file and line, severity, what is wrong, affected caller/resource/action, trace, and concrete fix.
- Non-negotiable constraints: trace before reporting; compare sibling handlers; load framework references only when needed; drop unresolved speculation.
- Expected bundled files loaded at runtime: `references/<framework>.md`, `references/sentry.md`, `references/getsentry.md`, `references/graphql.md`, `references/jwt.md`, or `references/sessions.md` based on the reference table in `SKILL.md`.

## Source And Evidence Model

Authoritative sources:

- Historical Sentry and getsentry authorization fixes.
- Public incident writeups, CVEs, HackerOne reports, and framework security documentation captured in `SKILL.md` and references.

Useful improvement sources:

- Positive examples: diffs where the skill caught a real authorization flaw.
- Negative examples: false positives caused by inherited guards, global middleware, proxy auth, public endpoints, or principal-derived IDs.
- Commit logs/changelogs: known Sentry authorization fixes listed in `TESTING.md` and `references/sentry.md`.
- Issue or PR feedback: reviewer comments where the skill was too broad, too narrow, or loaded the wrong reference.
- Eval results: regression runs against known Sentry fixes.

Data that must not be stored:

- Secrets, tokens, cookies, customer data, or private URLs.
- Proprietary code snippets longer than needed to reproduce the detection behavior.
- User, organization, project, or customer identifiers that are not needed for the evidence.

## Reference Architecture

- `SKILL.md` contains: trigger description, scope boundaries, reference routing, severity, core patterns, investigation playbook, and output requirements.
- `references/` contains: framework- and product-specific authorization lookup guides.
- `references/evidence/` contains: future durable positive/negative examples if iteration data needs to persist.
- `scripts/` contains: no scripts today.
- `assets/` contains: no assets today.

## Evaluation

- Lightweight validation: frontmatter name matches directory, relative reference paths resolve, and examples include Python and JavaScript/TypeScript bad and safe cases.
- Deeper evaluation: run Warden against known Sentry pre-fix commits listed in `TESTING.md`, especially `cf341c9c950`, `681d46fef66`, `fb21d886a08`, and `b9ea4f87297`.
- Holdout examples: public endpoints, principal-derived IDs, inherited Sentry endpoint permissions, read-only serializers, and global middleware-protected routes.
- Acceptance gates: findings must explain the authorization boundary, affected caller, affected resource/action, trace path, and exact fix.

## Known Limitations

- Pure authentication lifecycle bugs are intentionally out of scope unless they feed an authorization decision.
- Framework references may mention authentication mechanics when they affect authorization. Future edits should keep those mechanics tied to a permission or ownership decision.

## Maintenance Notes

- Update `SKILL.md` when trigger behavior, scope boundaries, severity, core examples, or output requirements change.
- Add `SOURCES.md` when new source discovery materially changes the evidence base.
- Add `EVAL.md` when regression checks become repeatable enough to document as a runnable suite.
- Add `references/evidence/` entries only for compact, redacted examples that future authors should preserve.
