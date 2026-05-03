---
name: wrdn-gha-workflows
description: >
  Find exploitable GitHub Actions workflow defects where CI boundaries turn
  untrusted or caller-controlled data into code execution, credential exposure,
  repository mutation, package publication, release tampering, or runner
  compromise. Trace the chain from trigger or caller to sink to privilege
  before reporting; this is exploit review, not workflow style. Use when asked
  to "audit these GitHub Actions workflows for security issues", "review this
  pull_request_target workflow", "check this workflow for expression
  injection", "look at the release workflow inputs for injection", "review the
  reusable workflow secrets exposure", "scan these composite actions for
  unsafe shell interpolation", "check GHA permissions and token scope on this
  workflow", "find pwn_request style bugs in our CI", "review this
  workflow_run handler for artifact poisoning", "is this chatops workflow
  command-injection safe", or "audit our self-hosted runner workflow exposure".
---

<!--
  Generated from spec.yaml. The behavior set, must-nots, and
  triggers live in spec.yaml — edit there. `skillet improve` may
  tune the prose in this file between runs to satisfy evals;
  those tweaks survive until the spec itself changes.
-->

## Enumerate triggers and callers

Before assessing any step, list every `on:` event and every caller of each reusable workflow or composite action. Label each entry point as trusted (maintainer-only, base ref, target repo) or attacker-controlled (PR head, fork, comment, issue body, external dispatch). Exploitability begins at the trust boundary; without a labeled entry point, sink findings are unranked and frequently wrong about who can reach them.

## Map trust boundaries per job

For each job, record whether it executes in a trusted context (target repo secrets, write `GITHUB_TOKEN`, base ref code) or an untrusted context (PR head code, fork content). Mark every transition: `actions/checkout` with a PR head ref, `workflow_run` artifact downloads, cache/artifact restores from cross-context keys. Most GHA exploits hinge on a trusted context running PR-controlled content, so the boundary must be explicit before any sink is judged.

## Resolve local actions, reusable workflows, and scripts

Open and read every `./path` action, composite action, `uses: ./.github/...` reference, `org/repo/.github/workflows/x.yml@ref` callee, and any script invoked from `run:`. Sinks are routinely hidden one or two indirections deep; declaring a step safe without reading what it actually executes produces false negatives and shallow reports.

## Flag expression injection in `run:`

Flag `${{ ... }}` interpolation of attacker-controlled fields — PR title and body, branch name, commit message, issue/comment/discussion body, label name, head ref, author fields — directly into `run:`, composite `run:`, or any shell step, as expression injection RCE in the surrounding context. This is the canonical `pwn_request`-style primitive; report it with the precise sink line and the trigger event that reaches it.

## Flag script-action injection

Flag interpolation of attacker-controlled expressions into `actions/github-script`, `actions/script`, or equivalent inline JS/Python bodies. The script body is evaluated as code, so `${{ }}` interpolation yields execution with the job's `GITHUB_TOKEN`. Recommend reading values via `env:` or the `context` argument instead of inline `${{ }}`.

## Flag workflow-command-file injection

Flag writes of attacker-controlled data to `$GITHUB_ENV`, `$GITHUB_OUTPUT`, `$GITHUB_PATH`, or `$GITHUB_STEP_SUMMARY` without sanitization. Trace whether a downstream step consumes the polluted variable in a privileged sink — newline-based injection in these files mutates env/PATH/outputs across steps and frequently escalates to RCE in a later trusted step.

## Flag `pull_request_target` checking out PR head

Flag any `pull_request_target` workflow that checks out PR head code (`ref: ${{ github.event.pull_request.head.sha }}`, head ref, or merge ref) and then runs build, test, install, lint, codegen, or any script from that checkout. This is the textbook `pwn_request` pattern: PR-controlled code executes with target repo secrets and the write token.

## Flag `workflow_run` artifact and PR-data trust

Flag privileged `workflow_run` jobs that download artifacts, read PR metadata, or check out PR head from the triggering run and then execute, evaluate, or interpolate that data. `workflow_run` runs with full target privileges, so trusting upstream artifacts or PR fields reintroduces the same exploit path as `pull_request_target`.

## Flag cache-poisoning paths

Flag privileged jobs that restore caches, dependency lockfiles, or build outputs whose keys can be populated by untrusted PR or fork runs, and trace whether the cached content is later executed. Cross-context cache restore turns an unprivileged PR run into a code-injection primitive against trusted jobs.

## Flag mutable third-party action references

Flag third-party `uses:` references pinned to a branch or mutable tag (`@main`, `@v1`, `@master`) in any workflow that holds secrets, write tokens, OIDC, publish credentials, or self-hosted runners. Require a commit SHA pin: a mutable ref lets the action author or a tag-rewrite attack run arbitrary code in a privileged context.

## Flag overbroad permissions only with a traced sink

Flag `permissions:` grants — especially `contents: write`, `packages: write`, `id-token: write`, `pull-requests: write` — when paired with a traced attacker- or caller-controlled execution path. Permission scope is only a finding when an exploit can spend it; flagging broad permissions in isolation produces noise that buries real issues.

## Flag secret and PAT exposure

Flag steps that pass `secrets.*`, PATs, deploy keys, npm/PyPI/registry tokens, signing keys, or OIDC-derived credentials into untrusted code paths, log them, write them into artifacts, or expose them via `set-output`/env to later untrusted steps. The finding is the trace from the secret to the untrusted sink, not the mere presence of a secret.

## Flag OIDC misuse

Flag workflows that mint cloud OIDC tokens (`id-token: write`) in jobs reachable by untrusted PR code, fork callers, or unauthenticated chatops. Check the audience and subject claims trusted by the cloud role: tokens issued from a compromised job grant cloud access, and a loose `sub` constraint extends blast radius beyond the repo.

## Flag self-hosted runner exposure

Flag workflows on `self-hosted` runners that accept untrusted code paths — PR head checkout, untrusted `workflow_run`, comment-driven exec — without ephemeral runner guarantees. Self-hosted runners persist filesystem and process state, so one untrusted execution compromises every subsequent job scheduled on that runner.

## Flag chatops without authorization

Flag `issue_comment`, `pull_request_review`, `pull_request_review_comment`, `discussion_comment`, and label-driven workflows that dispatch privileged actions without an explicit author association or membership check (`OWNER`, `MEMBER`, `COLLABORATOR`). Flag any that interpolate comment bodies into shell. These triggers default to anyone on the internet who can comment; missing authorization plus shell interpolation is a remote RCE primitive.

## Flag release and publish input injection

In release, deploy, publish, and PR-creation workflows, flag `workflow_dispatch` and `workflow_call` free-form `string` inputs that flow into `run:`, tag names, version strings, registry commands, or git operations. Assess RCE and supply-chain tampering: release pipelines hold the strongest secrets, so even caller-controlled inputs become high-impact when they reach shell or publish sinks.

## Calibrate `workflow_dispatch` severity

Treat `workflow_dispatch` and `workflow_call` as manual or caller-controlled by default. Raise severity only when an external or lower-trust route reaches the input — a reusable workflow called from a public-trigger workflow, `repository_dispatch` exposed via API, or a chained call from an untrusted context. This prevents false-positive RCE reports on inputs that only a maintainer can supply.

## Treat `choice` inputs as hardening

Treat hardcoded shell-safe `choice` and `boolean` inputs as hardening, not as automatic injection sinks. Only flag a `choice` when one of its values is itself shell-unsafe, or when the value is concatenated with attacker-controlled data downstream. Constrained inputs are not exploitable on their own, and reporting them as RCE wastes reviewer trust.

## Investigate context fields for controllability

For each `${{ github.* }}` and `${{ inputs.* }}` field on a sink path, classify it as attacker-controlled (PR fields, head ref, comment body, issue body, label name), caller-controlled (reusable workflow input from a known caller), or trusted (commit SHA, run id, repository name, base ref). Findings depend on this classification — not every context field is dangerous, and naming the class is what separates a real injection from noise.

## Check the `env:` + quoted-shell mitigation

When an attacker-controlled value is read via `env:` and consumed as `"$VAR"` in shell, do not report expression injection on that path. Verify that quoting is intact and word-splitting is not reintroduced (no unquoted use, no `eval`, no re-interpolation into another `${{ }}`) before clearing it. The `env:` + quoted-variable shape is the standard mitigation; flagging it produces false positives that erode trust.

## Report with full trace and concrete fix

Every finding must include: file:line, the trigger or caller entry point, the attacker- or caller-controlled input, the execution mechanism (sink), the privileges exposed (permissions, secrets, runner type), impact, confidence, and a concrete fix — env-var pattern, SHA pin, authorization gate, permission narrowing, ephemeral runner, audience/subject tightening. Reviewers need an exploit chain and a remediation, not a vague risk label.

## Calibrate severity by privilege and reach

Calibrate severity by the privileges the exploit actually reaches:

| Severity | Reach |
|---|---|
| Critical | Write-token RCE on default branch, secret exfiltration, package publish, signing-key access, self-hosted runner takeover |
| High | Repo mutation (push, PR merge, release create), release tampering, OIDC token to broad cloud role |
| Medium | Read-token leak, bounded artifact poisoning, cache poisoning into a non-publish job |
| Low | Hardening gap with no traced sink (kept only when explicitly requested) |

Severity must reflect blast radius; uniform severity collapses signal.

## Reference loading

Read the matching reference from `references/` before producing findings in that area. Load conditionally — only the patterns actually present in the workflows under review.

| Load when | Read |
|---|---|
| Workflow uses `pull_request_target`, `workflow_run`, or consumes PR head code/artifacts/metadata in a trusted context | `references/pull-request-target-and-workflow-run.md` |
| Any step uses `${{ }}` in `run:`, composite `run:`, `actions/github-script`/`actions/script`, or writes to `$GITHUB_ENV`/`$GITHUB_OUTPUT`/`$GITHUB_PATH` | `references/expression-injection-sinks.md` |
| Workflow triggers on `issue_comment`, `pull_request_review`, `pull_request_review_comment`, `discussion`, `discussion_comment`, or label/assignee events that dispatch privileged actions | `references/chatops-and-comment-triggers.md` |
| Workflow defines `workflow_call`/`workflow_dispatch`, is called by another workflow, or runs release/publish/PR-creation logic driven by inputs | `references/reusable-and-dispatch-inputs.md` |
| Workflow uses `secrets.*`, sets `id-token: write`, publishes packages, signs releases, or pushes to remote registries | `references/secrets-oidc-and-tokens.md` |
| Workflow uses `self-hosted` runners, third-party `uses:` references, or restores caches/artifacts crossing trust boundaries | `references/runners-actions-and-supply-chain.md` |
| Before producing findings, or whenever uncertain whether a pattern is exploitable or merely non-ideal | `references/false-positive-traps.md` |

## Don't

- Don't report YAML formatting, missing `name:`, generic actionlint style, or non-security best practices — this is exploit review and style noise drowns real findings.
- Don't report broad `permissions:` or privileged triggers without a traced attacker- or caller-controlled execution path; permission breadth alone is not an exploit.
- Don't report findings based on resemblance to a known pattern — require a concrete trigger-to-sink trace, otherwise the report is unranked and unactionable.
- Don't claim RCE on `choice` or `boolean` inputs whose values are hardcoded and shell-safe; constrained inputs are not exploitable on their own.
- Don't claim expression injection when the attacker value is read via `env:` and consumed as a quoted shell variable, unless quoting is broken or the value reaches a non-shell sink (`eval`, code, `github-script`); that pattern is the recommended mitigation.
- Don't report standalone application vulnerabilities outside CI unless the vulnerable code is loaded or executed by the workflow under review.
- Don't report missing branch protection, CODEOWNERS, or required-reviewer rules as workflow findings unless the workflow itself creates the exploitable path; repo policy is out of scope.
- Don't declare a step safe without resolving and reading the local action, composite action, or reusable workflow it invokes — sinks frequently live one indirection deep.
- Don't escalate `workflow_dispatch` injection to RCE severity unless an external or lower-trust route to the input is identified; maintainer-only inputs are not remote exploits.
- Don't instruct the agent to invoke another named skill at runtime; state the intent directly so the workflow remains runtime-independent.