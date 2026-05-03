<!--
  Generated initially from spec.yaml; durable after that. Edit this
  reference directly to improve domain depth. Skillet regenerates
  only missing reference files.
-->

# Reusable workflows, workflow_call, and workflow_dispatch inputs

## When to use

Load this reference when the workflow under review:

- defines `on: workflow_call:` or `on: workflow_dispatch:`,
- is invoked by another workflow via `uses: ./.github/workflows/x.yml` or `org/repo/.github/workflows/x.yml@ref`,
- runs release, deploy, publish, tag, or PR-creation logic driven by `inputs.*`.

## Contents

1. Trust model for `workflow_call` and `workflow_dispatch`
2. Tracing the caller chain
3. Input type hardening (choice / boolean / string)
4. Sinks that elevate input severity
5. Release / publish / PR-creation specifics
6. Severity calibration table
7. Remediation patterns
8. False-positive traps

---

## 1. Trust model

| Trigger | Default controllability | Treat inputs as |
|---|---|---|
| `workflow_dispatch` (UI/API) | Requires `actions: write` on the repo (maintainer/collaborator) | Trusted-by-default; raise only with an external route |
| `workflow_call` from a trusted caller (same repo, only invoked by `push`/`workflow_dispatch`) | Inherits caller's trust | Trusted-by-default |
| `workflow_call` from a caller that is itself reachable by `pull_request`, `pull_request_target`, `issue_comment`, `workflow_run` from forks, etc. | Attacker-reachable | Treat as attacker-controlled |
| `repository_dispatch` | Requires PAT with `repo` scope; often piped from external systems | Treat as attacker-controlled unless the dispatch source is locked down |

The single most important question: **is there any path where a non-maintainer can populate this input?** If yes, treat it as PR-equivalent attacker-controlled. If no, it is hardening, not RCE.

## 2. Tracing the caller chain

Before grading any reusable workflow finding, walk every caller:

```
grep -R "uses:.*\.github/workflows/<file>\.yml" .github/workflows/
```

For each caller, record:

- `on:` triggers of the caller
- whether the caller passes user-controlled fields (`github.event.pull_request.*`, `github.event.comment.body`, etc.) into `with:`
- whether `secrets: inherit` is used (full secret blast radius downstream)

A reusable workflow is only as trusted as its **least-trusted caller**. Stop when every caller resolves to a trusted trigger or you find an attacker-reachable path.

### Example: caller upgrades trust

```yaml
# caller.yml — public trigger
on: pull_request_target
jobs:
  build:
    uses: ./.github/workflows/release.yml
    with:
      version: ${{ github.event.pull_request.title }}   # attacker-controlled
    secrets: inherit
```

Even if `release.yml` looks like a maintainer-only `workflow_call`, this caller turns `inputs.version` into a PR-controlled value with full secrets. Findings inside `release.yml` should be graded against this exposure.

## 3. Input type hardening

| Input type | Shell-safe? | Notes |
|---|---|---|
| `boolean` | Yes | Always renders as `true`/`false`. Safe to interpolate into `run:`. |
| `choice` with hardcoded shell-safe options | Yes | Treat as hardening. Do **not** flag RCE. |
| `choice` whose options contain spaces, quotes, `$`, backticks, `;`, `&&` | No | Rare but real; flag if any option is unsafe. |
| `number` | Yes for arithmetic; pass via `env:` defensively | Renders as digits. |
| `string` | **No** | Free-form; treat as injection sink unless source is trusted. |
| `environment` | Effectively a `choice` over configured environments | Safe. |

Rule: a `choice` input is only a finding when (a) one of the listed values is itself shell-unsafe, or (b) the value is concatenated with a separately attacker-controlled field.

### Bad

```yaml
inputs:
  tag:
    type: string
steps:
  - run: git tag ${{ inputs.tag }} && git push --tags
```

### Safe (hardened input + env + quoting)

```yaml
inputs:
  release_kind:
    type: choice
    options: [patch, minor, major]
steps:
  - env:
      KIND: ${{ inputs.release_kind }}
    run: ./scripts/release.sh "$KIND"
```

## 4. Sinks that elevate input severity

A `string` input matters when it reaches:

- `run:` (shell) — RCE in job context
- `actions/github-script` body — RCE with `GITHUB_TOKEN`
- `git tag`, `git push`, `git commit -m` — release tampering, history rewrite
- `gh release create`, `gh pr create`, `gh pr edit` — release/PR forgery
- `npm publish`, `pip upload`, `twine upload`, `cargo publish`, `gem push`, `docker push` — supply-chain publish
- container `image:` field, `tags:` in publish actions — registry overwrite
- `actions/checkout` `ref:` — checkout of attacker ref into a trusted job
- HTTP URLs constructed for downloads (`curl ${{ inputs.url }} | bash`)
- `JSON.parse`, `eval`, `Function(...)` inside `github-script`

Without a sink, an unsafe string input is a hardening finding, not an exploit.

## 5. Release / publish / PR-creation specifics

These workflows hold the strongest credentials (publish tokens, signing keys, `id-token: write`, `contents: write`). Apply extra scrutiny.

Checklist for release/publish workflows driven by inputs:

- [ ] Are inputs `boolean` / `choice` where possible?
- [ ] Are `string` inputs validated by a regex step before any sink?
- [ ] Are inputs read via `env:` and used as quoted shell variables?
- [ ] Is the version/tag derived from the repo (`git describe`, file in repo) instead of a free-form input where feasible?
- [ ] Is the workflow callable only from trusted triggers (no `pull_request*` caller)?
- [ ] Are signing/publish steps gated on `github.ref == 'refs/heads/main'` or a tag pattern?
- [ ] If `secrets: inherit` is used downstream, do all callers warrant it?

A `string` version input concatenated into `git tag ${{ inputs.version }}` plus `gh release create` plus `npm publish` is a critical-severity supply-chain RCE if any caller route is attacker-reachable.

## 6. Severity calibration

| Scenario | Severity |
|---|---|
| `workflow_dispatch` `string` input → `run:` shell, no external route | Low (hardening) |
| Same, but workflow also callable from `workflow_call` reached by `pull_request_target` caller | Critical |
| `workflow_call` `string` input → `run:`, all callers trusted (push/manual only) | Low |
| `workflow_call` `string` input → `npm publish` tag, called by chatops workflow with weak auth | Critical |
| `choice` input with hardcoded safe options interpolated into `run:` | **No finding** |
| `boolean` input interpolated into `run:` | **No finding** |
| `string` input → `actions/github-script` body | High (RCE with `GITHUB_TOKEN`) regardless of caller, since `github-script` evaluates as JS |
| `string` input → `actions/checkout` `ref:` in a job that later runs build/test | High → Critical depending on caller reachability |
| `repository_dispatch` payload field → shell, dispatch source is a public webhook | Critical |

## 7. Remediation patterns

### Constrain the input

```yaml
inputs:
  bump:
    type: choice
    options: [patch, minor, major]
    default: patch
```

### Validate before use

```yaml
- name: Validate version
  env:
    VERSION: ${{ inputs.version }}
  run: |
    if [[ ! "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.]+)?$ ]]; then
      echo "Invalid version: $VERSION" >&2
      exit 1
    fi
```

### env + quoted shell variable

```yaml
- env:
    TITLE: ${{ inputs.title }}
  run: |
    printf '%s\n' "$TITLE" > release-notes.md
    gh release create "$TAG" --notes-file release-notes.md
```

### Lock callers explicitly

For a reusable workflow that should never run on PR-reachable triggers, document and enforce in callers:

```yaml
# release.yml
on:
  workflow_call:
    inputs: ...
  # NO workflow_dispatch unless intended
```

Audit every caller; do not rely on the reusable workflow alone.

### Avoid `secrets: inherit` for callers driven by untrusted data

Pass only the specific secrets needed:

```yaml
uses: ./.github/workflows/release.yml
secrets:
  NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Gate privileged steps on ref/event

```yaml
- name: Publish
  if: github.event_name == 'workflow_dispatch' && startsWith(github.ref, 'refs/tags/v')
  run: npm publish
```

## 8. False-positive traps

- **Choice/boolean reported as RCE.** Do not flag. Note as defense-in-depth at most.
- **`workflow_dispatch` flagged as remote RCE.** Maintainer-only by default. Require a traced external route before escalating.
- **`inputs.x` interpolated into `run:` but read via `env:` and quoted.** Not a finding on the shell path; still check non-shell sinks (eval, github-script) before clearing.
- **Reusable workflow analyzed in isolation.** Always trace callers; a workflow that looks dispatch-only may have a public-trigger caller.
- **`secrets: inherit` flagged as a vuln.** Inheritance is a finding only when the called workflow has an attacker-reachable input or sink that can spend those secrets.
- **Version input flagged as supply-chain RCE without checking caller chain.** A maintainer-typed version string is not an exploit; require an attacker route or escalation to demote-to-low.
- **Branch-name / ref inputs assumed attacker-controlled.** In `workflow_dispatch` the ref is selected by a maintainer in the UI; treat it like a `choice` over branches unless the input is a free-form string.
- **`number` input flagged.** Renders as digits; not a shell sink.
- **`environment` input flagged.** Constrained to configured environments; treat as `choice`.

When in doubt, downgrade to a hardening recommendation rather than asserting RCE. Every escalation must point at a concrete caller or external route.
