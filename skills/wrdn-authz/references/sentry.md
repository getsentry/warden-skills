# Sentry Access-Control Reference

Load when the diff imports from `sentry.api.*`, subclasses an `Endpoint` base, or references `OrganizationPermission`, `ProjectPermission`, `ScopedPermission`, `request.access`, `has_project_access`, `has_team_access`, or `get_projects`.

Sentry is Django + DRF with heavy internal convention. The OSS authentication and authorization model is dense; the common bugs are nearly always "this endpoint used the wrong idiom."

## The Base Classes

| Class | Location | Purpose |
|-------|----------|---------|
| `Endpoint` | `src/sentry/api/base.py` | Bare `APIView` subclass. `permission_classes = (NoPermission,)` by default. Use ONLY for endpoints with no org/project scope (e.g., `/api/0/users/me/`). |
| `OrganizationEndpoint` | `src/sentry/api/bases/organization.py` | Resolves `organization` from the URL, runs `check_object_permissions(request, organization)`, populates `request.access`. Required for any endpoint that reads or mutates org-scoped data. |
| `ProjectEndpoint` | `src/sentry/api/bases/project.py` | Extends `OrganizationEndpoint`. Resolves both `organization` and `project`, enforces project membership/access. |
| `TeamEndpoint` | `src/sentry/api/bases/team.py` | Similar, team-scoped. |

**The #1 bug shape**: endpoint handles org-scoped data but subclasses `Endpoint` instead of `OrganizationEndpoint`. The base class is the enforcement point. Without the correct base, `check_object_permissions` never runs and `request.access` is not populated.

When reviewing a new endpoint, the first question is always: *is the base class right for the scope?*

## The Permission Classes

Located in `src/sentry/api/permissions.py`.

- **`ScopedPermission`** (line ~126): `has_object_permission` **defaults to False**. Subclass and override when adding object-level checks.
- **`SentryPermission`** (line ~151): adds `determine_access()`, which sets `request.access` based on org context. Enforces 2FA, SSO, and member-limit checks. Every permission class used on org-scoped endpoints should inherit from this.
- **`OrganizationPermission`** (line ~48): the core mixin. Subclass for org-scoped endpoints. Maps HTTP methods to scope lists (`scope_map`).
- **`ProjectPermission`** (line ~43): extends `OrganizationPermission`, adds project-level checks.
- **`NoPermission`**: deny-all. The default on `Endpoint`.

When a custom permission class is defined in a diff, verify:

1. It inherits from `SentryPermission` (or a subclass), not directly from DRF's `BasePermission`. Direct inheritance bypasses `determine_access()` and leaves `request.access` unset.
2. `has_permission` is implemented if endpoint-level access depends on anything beyond auth.
3. `has_object_permission` is implemented if the endpoint loads a specific resource. Default `False` is the safe default but only kicks in if `check_object_permissions` is actually called.
4. `scope_map` lists the correct scopes for each HTTP method. A missing method key denies by default; an extra allowed scope is an escalation.

## The Access Object

`request.access` (populated by `SentryPermission.determine_access()` in `src/sentry/auth/access.py`) is Sentry's authorization kernel. Every object-level check should go through it.

| Method | Returns |
|--------|---------|
| `access.has_scope(scope)` | Has the given scope (e.g., `"org:read"`, `"project:write"`). |
| `access.has_project_access(project)` | Can access this specific project (team membership or open membership). |
| `access.has_project_scope(project, scope)` | Combination of above. |
| `access.has_team_access(team)` | Can access this specific team. |
| `access.has_global_access` | Has `member`/`manager`/`owner` role with open membership on the org. |

**Scope intersection**: when a request uses an API token, effective scopes are `member_scopes ∩ token_scopes` (`src/sentry/auth/access.py` around line 200). A bug that treats token scopes as additive rather than restrictive is a privilege escalation (historical shape: commit `b4aeabc03de`).

**Token-only scopes**: some scopes (e.g., `org:ci`) are intended to be reachable only via API tokens, not user sessions. If a scope is added to the session auth flow that was meant for tokens, that is a finding (historical: commit `7a009be6b1c`).

## The Project-Resolution Idiom

`OrganizationEndpoint.get_projects(request, organization, project_ids=...)` is the safe way to resolve user-supplied project IDs. It:

1. Scopes the query to the organization.
2. Checks that the user has access to each requested project via `request.access`.
3. Validates that the requested project IDs match what the caller is allowed to see (`_validate_fetched_projects` around `src/sentry/api/bases/organization.py:344`).

**Unsafe shapes that keep recurring:**

- `Project.objects.get(id=request.GET["project_id"])` or `Project.objects.get_from_cache(id=...)` — no org scoping, no access check. Historical fix: commit `cf341c9c950`.
- `self.get_projects(request, organization, project_ids={id})` called, but then the handler uses `Project.objects.get(id=id)` to fetch the actual object. The validation is dropped (`get_projects` result is unused).
- Query-param IDs (`?project_id=X`) passed straight to an RPC without prior `get_projects` validation. The RPC cannot re-verify user access.

Same idiom applies to teams via `get_teams`, and in some cases to members.

## The `has_project_access` Gate for Groups and Issues

When an endpoint operates on a Group, Issue, Incident, or similar entity that belongs to a project, check `request.access.has_project_access(entity.project)` before reading or mutating it. A user may be in the org but not have access to every project's data.

Historical shapes:

- `681d46fef66` — external issue linking: `Group.objects.get(id=...)` followed by linking without `has_project_access(group.project)`.
- `fb21d886a08` — external-issue create/delete/select-options accepted cross-project IDs for users in the same org.

These are IDORs scoped at the project level. The pattern is: *resolve entity → check principal has access to its project → act*.

## The `convert_args` Hook

`OrganizationEndpoint.convert_args` (around `src/sentry/api/bases/organization.py:265`) is where:

1. The org is resolved from the URL.
2. `check_object_permissions(request, organization)` runs.
3. `request.access` is populated.

When a subclass overrides `convert_args` and does not call `super().convert_args(...)` before performing its own resolution, the object-permission check may be skipped for the custom-resolved object. Verify the super call and the order: resolve → check permissions → attach.

## Scopes and Roles

Scopes are frozen sets. Common ones:

| Scope | Granted to | Used for |
|-------|------------|----------|
| `org:read` | member+ | GET on org data |
| `org:write` | manager+ | PUT/POST on org settings |
| `org:admin` | owner | Destructive org actions |
| `org:billing` | billing role | Billing-scoped data |
| `org:ci` | token-only | CI-scoped API access |
| `project:read` | member+ with team access | Project data |
| `project:write` | admin/manager | Project mutations |
| `project:admin` | admin | Destructive project actions |
| `project:releases` | member+ | Release management |
| `event:admin` | member+ | Issue/event mutations |

**Scope leakage**: a scope added to a new role or a new auth flow that wasn't intended to carry it. Review against the original scope definitions.

## 2FA, SSO, and Sudo

`SentryPermission.determine_access` enforces:

- 2FA required flag on orgs that set it.
- SSO required flag; an SSO-required org blocks non-SSO sessions from scoped actions.
- Sudo (short-lived re-auth) required for certain sensitive actions.

When an endpoint bypasses these by not going through `SentryPermission`, or when `sudo_required` is removed from a handler that does something sensitive, that is a finding.

## OAuth, SSO, and Session Reuse

Historical bug classes:

- **OAuth session hijack via shared session key**: commit `29f2120be4a`. OAuth authorize flow used a single `oa2` session key; opening a second authorize tab overwrote the first. Fix: unique `tx_id` per request. Shape: any auth flow that stores state in a single session slot is vulnerable to this.
- **SSO identity link replay**: commit `0c67558ae7f`. SSO link wasn't pinned to the authenticated session; could be replayed. Shape: when adding an SSO link step, bind it to the current session identifier, not just the user.

When reviewing auth flows: every in-flight state object must be bound to the *specific session*, not to the user or the org.

## Bug Shapes to Flag in a Sentry Diff

Prioritized from historical fixes:

1. **Wrong base class.** Endpoint subclasses `Endpoint` or plain `APIView` but handles org/project-scoped data. Fix: use `OrganizationEndpoint` or `ProjectEndpoint`.
2. **Unscoped ORM lookup on user-supplied ID.** `Project.objects.get(id=...)`, `Team.objects.get(id=...)`, `Group.objects.get(id=...)` on input from path/body/query. Fix: `self.get_projects(...)`, `self.get_teams(...)`, or an explicit access check.
3. **`get_projects` result unused.** Called for validation, then the handler fetches a different object. Fix: use the validated result.
4. **Missing `has_project_access` before acting on an entity.** Group, Issue, Incident, or similar loaded by ID without `request.access.has_project_access(entity.project)`. Fix: add the check.
5. **Custom permission class with `has_permission` but no `has_object_permission`.** Endpoint-level check passes, no object check runs, or `has_object_permission` is never invoked because `get_object` is bypassed.
6. **Scope check without ownership check.** `has_scope("org:admin")` alone is insufficient when the resource has a creator or owner field (e.g., notification actions, commit `b9ea4f87297`).
7. **Token-only scope in a non-token flow.** A scope meant for API tokens (Sentry's `org:ci`) reachable via session or OAuth.
8. **`convert_args` override that skips `super()`.** Custom resolution that bypasses the object-permission check.
9. **Session key collision in an auth flow.** Storing flow state in a generic session key rather than a per-request `tx_id`. The OAuth hijack shape.
10. **`sudo_required` removed.** A decorator that previously required fresh re-auth silently dropped.
11. **RPC call missing `user=` parameter.** Cross-service call that cannot verify access on the receiver side because the caller is anonymous to it.

## Verification Commands

```bash
# Which base class does this endpoint use?
rg -n 'class \w+\((Endpoint|OrganizationEndpoint|ProjectEndpoint|TeamEndpoint|APIView)' <file>

# Does it declare permission_classes?
rg -n 'permission_classes' <file>

# Is it routed? Which URL pattern?
rg -n '<EndpointClass>' src/sentry/api/urls.py

# History of the file
git log --oneline -- <file>

# Every call site of a permission class
rg -n 'OrganizationPermission' src/sentry/ --type py

# Scope definitions
rg -n "^SCOPES = \{" src/sentry/conf/server.py
```
