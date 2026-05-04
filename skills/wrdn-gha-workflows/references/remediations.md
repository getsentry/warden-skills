<!--
  Generated initially from spec.yaml; durable after that. Edit this
  reference directly to improve domain depth. Skillet regenerates
  only missing reference files.
-->

# Concrete remediations and severity rubric

## When to use

Load this file when writing the fix and severity for any GHA workflow finding. Every finding must end with a concrete, minimum-change remediation and a severity drawn from the rubric below.

## Contents

- Severity rubric by privilege reached
- Remediation pattern: env-passing for expression injection
- Remediation pattern: SHA-pinning third-party actions
- Remediation pattern: trigger downgrade and split-job gating
- Remediation pattern: least-privilege `permissions:`
- Remediation pattern: artifact / `workflow_run` integrity
- Remediation pattern: chatops authorization gate
- Remediation pattern: workflow-command file safety
- Required finding fields
- Anti-patterns to avoid in the fix

## Severity rubric (privilege reached)

Severity is set by what the traced exploit path actually reaches, not by the sink type alone.

| Severity      | Trigger condition                                                                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Critical      | Self-hosted runner or build host compromise; package publish, release tampering, signing-key use, deploy to prod from attacker- or caller-controlled inputs.    |
| High          | Repo mutation via write `GITHUB_TOKEN` / PAT; secret, OIDC, or registry-token exfiltration; protected-branch push; cache poisoning that reaches privileged jobs. |
| Medium        | Code execution in a job with no secrets, read-only token, hosted ephemeral runner, no publish/deploy reach.                                                     |
| Low           | Caller-controlled hardening (e.g. `workflow_dispatch` interpolation by maintainers) with no external route.                                                     |
| Informational | Style, defense-in-depth, or precondition-only patterns where no entry-point-to-sink chain exists.                                                               |

Calibration rules:

- Do not upgrade severity for "broad `permissions:`" alone — it is a precondition.
- Downgrade if the same job has no secrets and the token is `read-all`/`contents: read`.
- Upgrade if the job runs on a self-hosted, non-ephemeral runner.
- Upgrade if the job can produce signed or published artifacts even if the visible step is innocuous (path may chain through a later job).

## Remediation: env-passing for expression injection

The single durable fix for `${{ ... }}` interpolation into shells or inline scripts.

**Bad** — direct interpolation in `run:`:

```yaml
- run: echo "Title: ${{ github.event.pull_request.title }}"
```

**Safe** — value passed through `env:`, referenced as a quoted shell variable:

```yaml
- env:
    PR_TITLE: ${{ github.event.pull_request.title }}
  run: |
    echo "Title: $PR_TITLE"
```

**Bad** — `actions/github-script` body interpolation:

```yaml
- uses: actions/github-script@<sha>
  with:
    script: |
      console.log("ref: ${{ github.head_ref }}")
```

**Safe** — env-pass and read via `process.env`:

```yaml
- uses: actions/github-script@<sha>
  env:
    HEAD_REF: ${{ github.head_ref }}
  with:
    script: |
      console.log("ref:", process.env.HEAD_REF)
```

Checklist for the fix:

- [ ] Move every untrusted `${{ ... }}` into an `env:` mapping on the step (or job).
- [ ] Reference the env var with double quotes in shell (`"$VAR"`), never bare `$VAR`.
- [ ] In JS/TS scripts, read `process.env.VAR`; do not concatenate it into `eval`, `exec`, child-process strings, or template literals fed to a shell.
- [ ] Do not "sanitize" by regex — env-passing is the fix.

## Remediation: SHA-pin third-party actions in privileged jobs

A "privileged job" is one with any of: write-scope `permissions:`, `secrets.*` access, OIDC (`id-token: write`), publish/deploy capability, or self-hosted runner.

**Bad** — tag or branch pin:

```yaml
- uses: some-org/some-action@v3
- uses: some-org/some-action@main
```

**Safe** — full 40-char commit SHA, with the human-readable version as a comment:

```yaml
- uses: some-org/some-action@<40-char-sha>  # v3.4.1
```

Rules:

- Pin every third-party `uses:` in privileged jobs by full SHA.
- First-party (`actions/*`) actions: SHA-pin in privileged jobs as defense in depth; tag pin acceptable in unprivileged jobs.
- Local actions (`./.github/actions/...`) need no SHA but must be reviewed under the same exploit graph.
- Reusable workflows (`uses: org/repo/.github/workflows/x.yml@ref`) follow the same rule: SHA-pin if the callee handles privilege.

## Remediation: trigger downgrade and split-job gating

Prefer the least-privileged trigger that still does the job.

| Current trigger                                          | Preferred fix                                                                                          |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `pull_request_target` running PR code                    | Switch to `pull_request`. Drop write tokens. If a privileged step is genuinely needed, split jobs.     |
| `pull_request_target` checking out PR head               | Either switch to `pull_request`, or remove the checkout and operate only on event metadata.            |
| `workflow_run` consuming PR artifacts                    | Treat artifacts as untrusted: validate, hash-check, or move the privileged step to a separate, gated job.  |
| `issue_comment` running on every comment                 | Add an authorization job; downstream jobs `needs:` the gate.                                            |

**Split-job gating pattern** (privileged work isolated from PR code):

```yaml
jobs:
  build-untrusted:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@<sha>
        with:
          ref: ${{ github.event.pull_request.head.sha }}
      - run: ./build.sh   # no secrets, no write token

  comment-on-pr:
    needs: build-untrusted
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      # No checkout of PR code in this job.
      - uses: actions/github-script@<sha>
        env:
          BODY: ${{ needs.build-untrusted.outputs.summary }}
        with:
          script: |
            // post comment using process.env.BODY
```

The privileged job must not check out PR code, run PR-controlled scripts, install PR-controlled dependencies, or interpolate PR-controlled fields into shells.

## Remediation: least-privilege `permissions:`

Default to read-only at workflow level; raise per-job only as needed.

```yaml
permissions:
  contents: read

jobs:
  release:
    permissions:
      contents: write     # for tag/release
      id-token: write     # for OIDC publish
      pull-requests: read
    # ...
```

Rules:

- Set `permissions:` at workflow level even when each job overrides it — it caps anything you forget.
- Never set `permissions: write-all` or omit it on a workflow that has secrets and consumes untrusted input.
- `id-token: write` is high-impact: only on jobs that actually call the OIDC endpoint, never on jobs that run PR code.

## Remediation: artifact and `workflow_run` integrity

When a privileged `workflow_run` handler consumes outputs from the upstream run:

- Treat artifacts, caches, and outputs as attacker-controlled if the upstream ran on a fork PR.
- Do not `chmod +x` and execute downloaded files.
- Do not `source`, `eval`, or `npm install`/`pip install` from downloaded contents.
- Do not extract archives into paths that overwrite workflow files, action files, or `node_modules` of subsequent steps.
- If the artifact is data (e.g. a coverage XML), parse it with a strict parser and pass values via `env:`; never interpolate parsed values into `run:`.

## Remediation: chatops authorization gate

Every comment/label/discussion handler that mutates the repo or runs commands must gate on actor permission **before** any privileged step.

```yaml
jobs:
  authorize:
    runs-on: ubuntu-latest
    outputs:
      ok: ${{ steps.check.outputs.ok }}
    steps:
      - id: check
        uses: actions/github-script@<sha>
        with:
          script: |
            const { data } = await github.rest.repos.getCollaboratorPermissionLevel({
              owner: context.repo.owner,
              repo: context.repo.repo,
              username: context.actor,
            });
            const ok = ["admin", "maintain", "write"].includes(data.permission);
            core.setOutput("ok", ok);

  run-command:
    needs: authorize
    if: needs.authorize.outputs.ok == 'true'
    # ...
```

Do not gate on `author_association` alone for forks (it can be `NONE` for legitimate maintainers in some flows and is easy to misread). Prefer the permission-level API.

Always env-pass any comment/label body that reaches a sink — authorization does not waive injection hygiene, because the gate may be misconfigured or bypassed via label events that fire on PR creation.

## Remediation: workflow-command file safety

When writing untrusted text to `$GITHUB_OUTPUT`, `$GITHUB_ENV`, `$GITHUB_PATH`, or `$GITHUB_STEP_SUMMARY`:

**Bad** — newline in input forges a new variable / output:

```yaml
- run: echo "title=${{ github.event.pull_request.title }}" >> "$GITHUB_OUTPUT"
```

**Safe** — env-pass and use a random heredoc delimiter:

```yaml
- env:
    PR_TITLE: ${{ github.event.pull_request.title }}
  run: |
    DELIM="EOF_$(openssl rand -hex 16)"
    {
      echo "title<<$DELIM"
      printf '%s\n' "$PR_TITLE"
      echo "$DELIM"
    } >> "$GITHUB_OUTPUT"
```

Never write untrusted text to `$GITHUB_PATH`. If a path must be added, hardcode it.

Do not use deprecated `::set-output` / `::set-env` in any new code; in existing code, treat them as the same injection sink as the file forms.

## Required finding fields

Every reported finding must include:

- **File and line** of the sink (and of the entry point if different).
- **Entry point**: event field, input name, caller workflow, artifact, or cache.
- **Attacker- or caller-controlled value**: e.g. `github.event.pull_request.title`, `inputs.version`.
- **Execution mechanism (sink)**: e.g. `run:` shell, `script:` JS body, `$GITHUB_ENV` write, `npm publish` argument.
- **Privileges exposed**: token scopes, secrets in scope, OIDC, runner type.
- **Impact**: what the attacker achieves (RCE in CI, secret exfil, repo mutation, publish, host compromise).
- **Confidence**: high/medium/low based on whether the chain is fully traced.
- **Concrete fix**: one of the patterns above, written out for this specific step — not a link or a generic phrase.

## Anti-patterns to avoid in the fix

- "Add input validation" without specifying the env-passing pattern.
- "Sanitize the PR title" — there is no portable sanitizer for shell expansion in templated YAML; env-pass instead.
- "Use a separate token" without stating its scope.
- "Restrict to maintainers" without specifying the gating job and `if:` condition.
- Recommending Dependabot/Renovate as the fix for SHA-pinning — it is the maintenance mechanism, not the remediation.
- Suggesting `actions/checkout` with `persist-credentials: false` as a fix for `pull_request_target` checkout of PR head — it does not stop the PR code from running; it only narrows token reach.
- Recommending branch protection or CODEOWNERS as the workflow fix — those are org policy and out of scope unless the workflow itself creates the exploitable path.
