<!--
  Generated initially from spec.yaml; durable after that. Edit this
  reference directly to improve domain depth. Skillet regenerates
  only missing reference files.
-->

# False-positive traps and calibration

## When to use

Load this before reporting any finding that involves `workflow_dispatch` inputs, `type: choice`/`type: boolean` inputs, broad `permissions:` blocks, or any pattern that "looks like" expression injection without a traced attacker path. Use it as a final suppression pass before findings leave your review.

## Contents

- The five recurring false-positive shapes
- Trap 1: `workflow_dispatch` treated as RCE
- Trap 2: Hardcoded `choice`/`boolean` inputs treated as RCE
- Trap 3: Broad `permissions:` reported standalone
- Trap 4: Untraced resemblance to known sinks
- Trap 5: Privileged trigger without untrusted reach
- Calibration checklist before reporting
- Severity downgrades, not deletions

## The five recurring false-positive shapes

| # | Shape | What it looks like | Why it's not a finding (alone) |
|---|-------|--------------------|-------------------------------|
| 1 | Manual dispatch RCE | `${{ inputs.foo }}` in `run:` on `workflow_dispatch` | The "attacker" is a maintainer who already has CI access |
| 2 | Closed-enum injection | `${{ inputs.env }}` where `env` is `type: choice` with shell-safe values | Attacker cannot supply metacharacters |
| 3 | Standalone `permissions: write-all` | Broad token, no untrusted code path traced | Privilege without reach is not an exploit |
| 4 | Pattern lookalike | "This step uses `github.event.*` so it's injectable" | No sink, or field is structured/non-string |
| 5 | Privileged trigger, trusted body | `pull_request_target` job that never checks out PR head and never reads PR-controlled data | Trust boundary not crossed |

## Trap 1: `workflow_dispatch` treated as RCE

### The trap

```yaml
on: workflow_dispatch
jobs:
  deploy:
    steps:
      - run: ./deploy.sh ${{ inputs.target }}     # "expression injection!"
```

### Why it usually isn't RCE

`workflow_dispatch` is invoked by users who already have at least `write` (or `actions: write`) on the repo. They can already push to a branch, edit the workflow, or run anything else. Calling raw shell injection an exploit when the attacker already has commit access is double-counting capability.

### When it *is* a finding

Escalate only if you can trace an external route to the dispatch:

- A public chatops handler that calls `gh workflow run` with attacker-controlled args.
- A `workflow_call` chain where a less-privileged or fork-reachable workflow forwards untrusted data into this dispatch's inputs (in practice, `workflow_call`, not `workflow_dispatch`, is what's invoked — check carefully).
- A repository_dispatch hook reachable by a token with weaker controls.
- Org policy that grants dispatch to a much wider audience than commit (rare, must be confirmed, not assumed).

### How to report it

If no external route exists: report at most as **informational hardening** ("caller-controlled value reaches shell; pass via `env:` to harden against future trigger changes"). Do not call it RCE. Do not assign high severity.

## Trap 2: Hardcoded `choice`/`boolean` inputs treated as RCE

### The trap

```yaml
on:
  workflow_dispatch:
    inputs:
      env:
        type: choice
        options: [staging, production]
jobs:
  deploy:
    steps:
      - run: kubectl --context=${{ inputs.env }} apply -f .
```

This pattern-matches as expression injection but the input is a closed enum of shell-safe tokens.

### Calibration rule

A `choice` or `boolean` input is **not** an injection sink if **all** of these hold:

- [ ] `type:` is `choice` or `boolean` (not `string`).
- [ ] Every `option` value contains only `[A-Za-z0-9._-]` (no spaces, quotes, `$`, backticks, `;`, `&`, `|`, `\n`).
- [ ] The options list is hardcoded in the workflow file, not loaded from an external source.

If any condition fails, treat as a `string` input and re-evaluate.

### Edge cases

- `type: environment` — values come from repo environment names, which maintainers control. Same calibration as `choice` if names are shell-safe.
- A `choice` interpolated inside a *single-quoted* shell string with no command substitution is doubly safe.
- A `boolean` reaching `if: ${{ inputs.flag }}` in YAML expression context is not a shell sink at all.

## Trap 3: Broad `permissions:` reported standalone

### The trap

```yaml
permissions: write-all     # "overprivileged!"
```

…but the job only runs `npm test` on trusted code with no untrusted inputs and no third-party actions pinned by tag.

### Calibration rule

Broad permissions are a **precondition multiplier**, not a finding. Report them only when paired with a traced path:

- Untrusted code or data reaches a step in this job, **and**
- The token's elevated scope is what makes the impact severe.

If reporting on its own, it belongs in a hardening note, not a security finding. Severity caps at informational.

### Exception

`permissions:` missing entirely on a workflow that uses `pull_request_target` plus checks out the PR head plus has secrets in scope — that *is* worth flagging, because the default token is `write` on `pull_request_target`. But the finding is the trigger+checkout pattern; the permissions are part of the impact, not the root cause.

## Trap 4: Untraced resemblance to known sinks

### The trap

Reporting "this workflow uses `github.event.pull_request.title` so it could be injection" without identifying the actual sink, or reporting a sink without identifying a reachable untrusted source.

### Required chain

Every reported finding must state, explicitly:

1. **Entry point** — the exact event field, input, artifact, or caller argument.
2. **Trust class** — untrusted (PR/comment/discussion from external actor), caller-controlled (reusable workflow input from any caller), or trusted.
3. **Propagation** — every intermediate step, output, env var, or file that carries the value.
4. **Sink** — the exact line where the value is interpreted (shell, JS `eval`/template, command argument that's parsed as code, etc.).
5. **Privilege** — what the job has access to at the sink (secrets, write token, OIDC, runner host, publish creds).

If you cannot fill all five, the finding is not ready. Drop it or reduce to "pattern note, exploit path not established."

### Common untraced shapes to reject

| Lookalike | Why it fails |
|-----------|--------------|
| `${{ github.event.repository.name }}` in `run:` | Repo name is set by repo owner; not attacker-controlled in a single-repo review |
| `${{ github.actor }}` in `run:` | Login chars are constrained; not a shell sink |
| `${{ github.sha }}` in `run:` | Hex string; not attacker-controllable as text |
| `${{ env.STATIC_VAR }}` set from a hardcoded literal | No untrusted source |
| `pull_request_target` with `if: github.event.pull_request.head.repo.full_name == github.repository` gating untrusted work | Forks excluded; same-repo PRs require write access |

### Fields that *are* attacker-controlled in PR/issue/comment events

`pull_request[_target].head.ref`, `pull_request[_target].head.label`, `pull_request[_target].title`, `pull_request[_target].body`, `head_commit.message`, `head_commit.author.email`, `head_commit.author.name`, `comment.body`, `review.body`, `issue.title`, `issue.body`, `discussion.title`, `discussion.body`, `pages.*.page_name`, label/branch/tag names from forks, file paths created in the PR.

If your finding's entry point isn't in this list (or a documented equivalent), justify why it's attacker-controlled.

## Trap 5: Privileged trigger without untrusted reach

### The trap

```yaml
on: pull_request_target
jobs:
  label:
    permissions:
      pull-requests: write
    steps:
      - uses: actions/labeler@v5    # pinned by tag — separate concern
        with:
          repo-token: ${{ secrets.GITHUB_TOKEN }}
```

`pull_request_target` is privileged, but this job:

- Doesn't `actions/checkout` the PR head.
- Doesn't read PR-controlled files.
- Passes only the token to a labeler that consumes structured event metadata.

The trigger choice is correct for labeling. The mutable-tag pin is a separate finding (see remediations); the trigger itself is not the bug.

### Calibration rule

`pull_request_target` and `workflow_run` are findings only when:

- They check out PR/fork head ref, **or**
- They read PR-controlled files (lockfiles, config, scripts) into a privileged step, **or**
- They download artifacts/caches from the upstream untrusted run without integrity checks, **or**
- They interpolate untrusted event fields into shell or scripts.

Without one of these, leave the trigger alone.

## Calibration checklist before reporting

Run this list against every draft finding. If any answer is "no" or "I'm not sure," fix it or drop the finding.

- [ ] I can name the entry point field/input/artifact/caller.
- [ ] I can classify it as untrusted or caller-controlled with a reason.
- [ ] I can point to the exact sink line.
- [ ] At the sink, the value is interpreted as code, command, path, or credential — not just printed.
- [ ] The job at the sink holds the privilege I'm claiming as impact.
- [ ] I have ruled out gating (`if:` actor checks, fork checks, association checks) on the path.
- [ ] If the input is `choice`/`boolean`, I've checked the options for shell-safety.
- [ ] If the trigger is `workflow_dispatch`, I've identified an external invocation route.
- [ ] If `permissions:` is the impact, I've traced it to an exploitable mutation.

## Severity downgrades, not deletions

When a draft finding fails the checklist, prefer downgrading over outright dropping it if there's still a defense-in-depth concern:

| Original claim | Downgrade to | When |
|----------------|--------------|------|
| RCE via `workflow_dispatch` | Informational: env-pass hardening | No external route to dispatch |
| RCE via `choice` interpolation | Informational: enum is shell-safe today | Options shell-safe and hardcoded |
| Critical: write-all permissions | Note attached to a real finding | No untrusted reach |
| High: `pull_request_target` use | Not reported | No PR-content consumption |
| High: secret in env | Informational | Secret never reaches untrusted-code job |

Downgraded items go in a separate "hardening notes" section, clearly distinguished from exploitable findings, so reviewers can see signal vs. polish.

## Final guard

If a finding survives the checklist but you still feel uncertain, write the exploit as a single sentence: *"An attacker who controls X can cause Y to execute in a job that has Z."* If you cannot complete that sentence with concrete values for X, Y, and Z, the finding is not ready.
