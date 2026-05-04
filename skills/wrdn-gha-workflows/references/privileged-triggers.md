<!--
  Generated initially from spec.yaml; durable after that. Edit this
  reference directly to improve domain depth. Skillet regenerates
  only missing reference files.
-->

# Privileged triggers and trust boundaries

## When to use

Load this reference when the workflow uses `pull_request_target`, `workflow_run`, `workflow_call` with privileged callers, or any trigger that grants write tokens, secrets, or OIDC while consuming PR-controlled inputs (refs, artifacts, caches, config, lockfiles, source files).

## Contents

- Trigger trust model at a glance
- `pull_request_target` exploit paths
- `workflow_run` exploit paths (artifacts, caches, outputs)
- `workflow_call` and reusable workflows
- PR-controlled data inventory
- Decision checklist per privileged job
- Bad/safe patterns
- Edge cases and false-positive traps

## Trigger trust model at a glance

| Trigger | Runs on base? | Has secrets? | Default token | Attacker controls |
|---|---|---|---|---|
| `pull_request` (same repo) | head | yes | write | code, refs, titles, bodies |
| `pull_request` (fork) | head | no | read | code, refs, titles, bodies |
| `pull_request_target` | base | **yes** | **write** | refs, titles, bodies, labels, head SHA, fork repo contents (if checked out) |
| `workflow_run` | base | **yes** | **write** | upstream artifacts, caches, outputs, head_branch, head_sha |
| `workflow_call` | inherited from caller | inherited | inherited | inputs from caller; whatever caller forwards |
| `issue_comment`, `discussion_comment` | base | yes | write | body, author, issue context |
| `workflow_dispatch` | base | yes | write | inputs (only maintainers by default) |
| `schedule` | base | yes | write | nothing direct |
| `push` (protected branch) | base | yes | write | committer-controlled (gated by branch protection) |

The danger zone is "yes/write" with attacker-influenced inputs. Untrusted PRs from forks default to safe under plain `pull_request`; the privileged variants are the ones that cross the trust boundary.

## `pull_request_target` exploit paths

`pull_request_target` runs in the **base repo's** trust context (secrets, write token) but the event payload references the **PR head**. Anything that pulls the head into execution is the bug.

### Canonical sinks

1. **Checkout of PR head, then build/test/lint/format**
   ```yaml
   # BAD
   on: pull_request_target
   jobs:
     test:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
           with:
             ref: ${{ github.event.pull_request.head.sha }}  # PR code
         - run: npm ci && npm test                          # executes PR code with secrets in env
   ```
   Any of these are equally fatal: `npm install`, `npm ci`, `pip install -r`, `bundle install`, `make`, `pre-commit run`, `tox`, `cargo build`, running test runners, running linters/formatters that load project plugins, evaluating `.github/` scripts from the head.

2. **Loading PR-controlled config files into privileged steps**
   - `package.json` scripts (any `npm run`, `yarn`, `pnpm`)
   - lockfiles with `install` hooks
   - `.github/labeler.yml`, `.github/release-drafter.yml` consumed by an action that `eval`s them
   - `setup.py`, `setup.cfg`, `pyproject.toml` build hooks
   - `Makefile`, `justfile`, shell scripts under `scripts/`
   - GitHub Actions referenced by `uses: ./...` from the head ref
   - tool configs that allow plugin loading (`.eslintrc`, `babel.config.js`, `vite.config.js`, `webpack.config.js`)

3. **Exposing secrets to PR-checked-out code via env**
   ```yaml
   # BAD
   - uses: actions/checkout@v4
     with: { ref: ${{ github.event.pull_request.head.ref }} }
   - run: ./scripts/integration-test.sh
     env:
       NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
   ```

4. **Granting write token to PR head code**
   Any `permissions: contents: write` (or other write scopes) plus PR-head checkout plus any execution = repo mutation primitive.

### Safe usages of `pull_request_target`

- Labeling, commenting, assigning reviewers, posting status — using only event metadata, never checking out PR head.
- Two-job split: a privileged job that reads metadata and dispatches; an unprivileged `pull_request` job that runs head code.
- Checking out **base** ref only and using PR diff via the API.

### `pull_request_target` red-flag checklist

- [ ] Any `actions/checkout` with `ref:` derived from `pull_request.head.*`
- [ ] Any `actions/checkout` with no `ref:` followed by no explicit base checkout (default checks out head merge ref under `pull_request_target`? No — defaults to base, but verify)
- [ ] `npm ci`, `pip install`, `bundle install`, `cargo build`, `make`, etc. after head checkout
- [ ] Calls to `./.github/actions/*` resolved from head SHA
- [ ] Secrets, OIDC, or write `permissions:` in the same job as head execution

## `workflow_run` exploit paths

`workflow_run` fires in the base repo's privileged context **after** an upstream workflow (often `pull_request` from a fork) finishes. Inputs from that upstream run are attacker-controlled when the upstream ran on a fork PR.

### Attacker-controlled `workflow_run` inputs

| Source | Attacker controls? |
|---|---|
| Artifacts uploaded by upstream | **yes** — file contents and names |
| Cache restored by key the upstream wrote | **yes** if upstream ran on fork |
| `github.event.workflow_run.head_branch` | **yes** |
| `github.event.workflow_run.head_sha` | **yes** |
| `github.event.workflow_run.head_commit.message` | **yes** |
| `github.event.workflow_run.pull_requests` | influenced |

### Canonical sinks

1. **Downloading and executing artifacts**
   ```yaml
   # BAD
   on:
     workflow_run:
       workflows: [CI]
       types: [completed]
   jobs:
     deploy:
       permissions: { contents: write, id-token: write }
       steps:
         - uses: actions/download-artifact@v4
           with: { name: build, run-id: ${{ github.event.workflow_run.id }} }
         - run: ./build/run.sh        # attacker binary
   ```

2. **Trusting artifact filenames**
   `unzip` of attacker artifact into `.github/`, `node_modules/`, or any path checked into the PATH-like flow. Path traversal in artifact contents is also possible.

3. **Trusting artifact-supplied PR number / metadata**
   ```yaml
   # BAD: PR number written into a file by upstream, then used to comment as the base repo
   - run: echo "PR=$(cat pr_number.txt)" >> $GITHUB_OUTPUT
   - run: gh pr comment "$PR" -b "Build OK"   # attacker picks any PR number
   ```
   The fix is to look up the PR number via the API using `head_sha`, or to require artifact content matches an expected schema and signature.

4. **Interpolating `head_branch`/`head_commit.message` into shell**
   These are attacker-supplied strings (PR branch, PR commit message). Treat as expression-injection sources (see expression-injection reference).

### `workflow_run` red-flag checklist

- [ ] `download-artifact` followed by `run:` against any file from the artifact
- [ ] No allowlist of expected artifact names
- [ ] No size or content-shape validation
- [ ] PR number, ref, or branch sourced from the artifact instead of the API
- [ ] Cache restore keyed on a value the upstream fork run could write
- [ ] `${{ github.event.workflow_run.head_branch }}` (or `head_commit.message`) interpolated into `run:`

## `workflow_call` and reusable workflows

A reusable workflow's safety equals its **least-trusted caller**. Review must include callers.

### What flows from caller to callee

- `inputs.*` — typed values (string/boolean/number/choice). Strings are arbitrary.
- `secrets.*` — explicit or `secrets: inherit`.
- The caller's event context is preserved (`github.event_name`, `github.event.*`).

### Exploit shapes

1. **Caller forwards attacker-controlled event field as input**
   ```yaml
   # caller.yml — BAD
   on: pull_request_target
   jobs:
     call:
       uses: ./.github/workflows/build.yml
       with:
         ref: ${{ github.event.pull_request.head.ref }}   # attacker string
       secrets: inherit
   ```
   Now `inputs.ref` inside `build.yml` is attacker-controlled even though `build.yml` "looks safe."

2. **Callee interpolates an input into shell**
   ```yaml
   # build.yml — BAD when any caller forwards untrusted data
   on: { workflow_call: { inputs: { ref: { type: string, required: true } } } }
   jobs:
     b:
       steps:
         - run: git checkout "${{ inputs.ref }}"   # injection
   ```

3. **`secrets: inherit` from a privileged caller**
   The callee gets every secret. If callee has any execution path reachable from caller-controlled data, every secret is exfiltratable.

### Reusable workflow review steps

1. List every caller in the repo (`grep -r 'uses:.*workflows/<name>.yml'`).
2. For each caller, label its trigger trust (table above) and its `with:` arguments.
3. For each callee input, mark as trusted / caller-controlled / attacker-controlled based on the worst caller.
4. Review the callee's sinks against that worst-case label.

## PR-controlled data inventory

Treat all of these as attacker-controlled in fork PRs:

- `github.event.pull_request.title`, `body`
- `github.event.pull_request.head.ref`, `head.sha`, `head.label`, `head.repo.*`
- `github.event.pull_request.user.login` (spoofable as a string)
- `github.head_ref`, `github.event.pull_request.head.ref`
- file contents at the head SHA — every file in the repo
- `github.event.issue.title`, `body`, `labels[*].name`
- `github.event.comment.body`, `comment.user.login`
- `github.event.discussion.*`, `discussion_comment.*`
- `github.event.workflow_run.head_branch`, `head_commit.message`, `head_sha`
- artifacts, caches, and outputs from any upstream run that could have run on a fork PR

The following are **not** attacker-controlled but are still caller-controlled (treat as untrusted from external triggers, hardening-only from maintainer dispatch):

- `inputs.*` from `workflow_dispatch` (maintainer-typed)
- `inputs.*` from `workflow_call` (worst-case caller)

## Decision checklist per privileged job

For each job that has secrets, OIDC, or write `permissions:`:

- [ ] What trigger fired this? Is the trigger privileged?
- [ ] Does any step check out, download, or read PR-controlled data?
- [ ] Does any step execute code (build, install, test, lint, format, publish, deploy)?
- [ ] Is there an authorization gate (actor association check, label gate, environment with required reviewers) before the privileged work?
- [ ] Are third-party actions pinned by full commit SHA?
- [ ] Are secrets passed only to steps after the trust boundary is enforced?

If any of the first three are yes and the fourth is missing, you have a finding. State the chain: trigger → entry point → sink → privilege.

## Bad/safe patterns

### Split the trust boundary

```yaml
# SAFE pattern: privileged labeling job + unprivileged build job
on: pull_request_target
jobs:
  label:
    permissions: { pull-requests: write }
    steps:
      - uses: actions/labeler@<sha>     # only reads event metadata
  # build job runs under the unprivileged pull_request trigger in a separate workflow file
```

### Gate by label or actor before privileged work

```yaml
on:
  pull_request_target:
    types: [labeled]
jobs:
  e2e:
    if: github.event.label.name == 'safe-to-test'
    permissions: { contents: read }
    steps:
      - uses: actions/checkout@v4
        with: { ref: ${{ github.event.pull_request.head.sha }} }
      - run: ./scripts/e2e.sh
        env:
          API_TOKEN: ${{ secrets.E2E_TOKEN }}
```
Note: label gating still requires that **only maintainers can apply the label**, and that the label is **removed on new pushes** (otherwise approving once permits all later pushes). Without those, label gating is not a security control.

### Use environment with required reviewers

```yaml
jobs:
  deploy:
    environment: production   # required reviewers gate the secret release
    steps:
      - run: ./deploy.sh
        env: { TOKEN: ${{ secrets.DEPLOY_TOKEN }} }
```

### Validate artifacts before use

```yaml
# SAFER workflow_run handler
- uses: actions/download-artifact@<sha>
  with: { name: build-report, run-id: ${{ github.event.workflow_run.id }} }
- run: |
    test -f build-report/summary.json
    jq -e 'has("status") and (.status|type=="string")' build-report/summary.json
    # consume only specific JSON fields, never execute artifact contents
```

## Edge cases and false-positive traps

- **`pull_request_target` with metadata-only steps and no checkout** — usually safe; do not flag absent a sink. The presence of `pull_request_target` is not by itself a finding.
- **Default checkout under `pull_request_target`** — checks out the **base** ref, not head. Not exploitable on its own. Becomes exploitable when a later step explicitly fetches the head, or when the base contains symlinks/scripts the workflow then runs against PR-supplied paths.
- **Dependabot PRs under `pull_request_target`** — Dependabot PRs run with read-only secrets by default and `dependabot` context; verify whether the workflow assumes Dependabot trust without checking act
