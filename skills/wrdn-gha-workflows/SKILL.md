---
name: wrdn-gha-workflows
description: >
  Find exploitable GitHub Actions workflow defects where CI trust
  boundaries — privileged triggers, reusable workflow callers, or
  chatops handlers — turn untrusted or caller-controlled data into
  code execution, credential exposure, repository mutation, package
  publication, release tampering, or self-hosted runner compromise.
  Every finding must trace trigger or caller → sink → privilege.
  Use when asked to "audit these GitHub Actions workflows for security
  issues", "review this pull_request_target workflow", "check this
  workflow for expression injection", "look at our release workflow
  inputs for injection", "review the secrets exposure in this reusable
  workflow", "scan these composite actions for RCE", "are the
  permissions on this workflow safe", "is this chatops workflow
  exploitable", "review GHA workflow_run handler for poisoned
  artifacts", or "security review of .github/workflows".
---

<!--
  Generated from spec.yaml. The behavior set, must-nots, and
  triggers live in spec.yaml — edit there. `skillet improve` may
  tune the prose in this file between runs to satisfy evals;
  those tweaks survive until the spec itself changes.
-->

# GitHub Actions Workflow Exploit Review

This skill is exploit-path review, not workflow style. A finding is
only valid when you can state the chain from a trigger or caller,
through any intermediate steps, to a sink that executes code, exposes
credentials, mutates the repo, publishes a package, tampers with a
release, or compromises a runner.

## Enumerate triggers and callers first

Before reviewing any step, list every `on:` trigger for the workflow
and, for `workflow_call` reusable workflows, every known caller you
can find. Label each as trusted (maintainer-only path), untrusted
(reachable by external contributors or the public), or
caller-controlled (depends on which workflow calls in). Exploitability
is determined by who can invoke the workflow with what data, so
without this map every downstream judgment is guessing.

## Map trust boundaries per job

For each job, identify which steps run with PR-controlled code or
inputs, which run with repo secrets, write-scoped `GITHUB_TOKEN`,
OIDC, or publish credentials, and where the boundary between the two
is crossed. Most GHA RCE and secret-exfil bugs sit exactly at the step
where untrusted content meets a privileged context — finding that
boundary is the core analytical move.

## Resolve local actions and reusable workflows

Open every `uses: ./...` local action, composite action, called
script, and `uses: ./.github/workflows/*` reusable workflow from disk
and treat their steps as part of the same exploit graph. Sinks are
frequently hidden one or two hops away from the workflow file you
were given; reviewing only the top-level YAML misses them.

## Flag pull_request_target / workflow_run checkout of PR head

Flag `pull_request_target` workflows (and equivalently privileged
`workflow_run` workflows) that check out the PR head ref, run
untrusted code from that checkout (build scripts, lockfile resolvers,
test runners, generators), or load PR-controlled config or lockfiles
into privileged steps. This is the canonical path from an external
contributor's PR to full repo write access and secret exfiltration,
so it is the first thing to look for whenever these triggers appear.

## Flag workflow_run artifact and cache trust

Flag privileged `workflow_run` handlers that download artifacts,
caches, or build outputs from the triggering run and use them as code,
config, or executable inputs without integrity checks. When the
upstream workflow ran on a fork PR, those artifacts and caches are
attacker-controllable, and a privileged downstream consumer that
trusts them gives the attacker the privileged context.

## Flag expression injection in run and shell steps

Flag `${{ ... }}` interpolation of attacker- or caller-controlled
fields — PR titles and bodies, branch and ref names, `head_ref`,
commit messages, issue and comment bodies, label names, free-form
inputs — directly into `run:` shell, composite shell steps, or
interpreter argument strings. GHA expands expressions before the shell
sees them, so any such interpolation in a privileged context is shell
injection regardless of quoting.

## Flag script-action injection

Flag interpolation of untrusted fields into `actions/github-script`,
`actions/script`, or other inline-JS action `script:` bodies. Inline
script bodies are templated the same way `run:` is and are equally
injectable. The fix is to pass the value via `env:` and read it as
`process.env.VAR`.

## Flag workflow command injection

Flag untrusted text written to `$GITHUB_OUTPUT`, `$GITHUB_ENV`,
`$GITHUB_PATH`, `$GITHUB_STEP_SUMMARY`, or via legacy `::set-output`
or `::set-env` without delimiter and content controls. Newline- or
delimiter-bearing inputs can inject environment variables, step
outputs, or PATH entries that later privileged steps consume, turning
an apparently passive write into code execution downstream.

## Trace inputs to sinks for every finding

For every reported finding, trace the explicit chain from entry point
(event field, input, artifact, cache, output) through any intermediate
steps to the executing sink, and include that chain in the finding.
Without a traced chain, findings degrade into pattern matching and
produce false positives the reviewer cannot evaluate or confirm.

## Calibrate workflow_dispatch carefully

Treat `workflow_dispatch` inputs as manual and caller-controlled by
default. Only escalate to RCE when an external route reaches the
dispatch — a public chatops workflow that calls it, a less-privileged
caller that forwards untrusted data, or a permission setting that
allows non-maintainers to fire it. Most dispatch inputs are typed by
maintainers, and flagging them as RCE without an external route is
the dominant false positive in this class.

## Calibrate hardcoded choice and boolean inputs

Treat `type: choice` and `type: boolean` inputs with hardcoded,
shell-safe options as hardening candidates rather than automatic RCE,
even when they are interpolated into `run:`. The attacker cannot
supply shell metacharacters through a closed enum, so the exploit
precondition fails. Note them as worth fixing, not as injection.

## Review workflow_call inputs across callers

For `workflow_call` reusable workflows, review every caller's argument
plumbing and flag callers that forward attacker-controlled fields
(event payload data, comment bodies, PR metadata) into the reusable
workflow's shell or script sinks. A reusable workflow is only as safe
as its least-trusted caller, so the review must include the callers,
not just the callee.

## Flag chatops handlers without authorization

Flag comment, label, discussion, and chatops workflows that execute
commands or mutate the repo without verifying actor association or
permission, and flag any that interpolate comment, label, or
discussion bodies into shells. Chatops handlers routinely run on
every commenter and combine missing authorization with raw text
interpolation, which is a direct path from any GitHub user to
privileged execution.

## Flag token and secret exposure paths

Flag steps that expose `secrets.*`, `GITHUB_TOKEN`, OIDC tokens, PATs,
registry tokens, or signing keys to untrusted code, third-party
actions pinned by tag, network egress to attacker-controlled hosts,
or `pwsh -Command` / `bash -c` strings that include those secrets.
Once attacker-influenced code runs in the same job, anything reachable
via env, files, or the runner's token endpoint is exfiltratable.

## Flag mutable third-party action pins

In privileged jobs (those with write tokens, secrets, OIDC, or
publish capability), flag third-party `uses:` references pinned by
branch or tag instead of a full commit SHA. Tag and branch pins let
the action owner — or anyone who compromises them — push code into a
privileged context without any change visible in your repo.

## Flag self-hosted runner exposure

Flag self-hosted runner usage (`runs-on:` with self-hosted labels) on
workflows reachable from public PRs, public chatops, or other
untrusted triggers, and flag missing ephemeral or isolation
guarantees. Self-hosted runners persist state and network access, so
untrusted code on them is host compromise, not just CI compromise.

## Flag publish and release tampering paths

Flag publish, release, tag, and deploy jobs whose inputs — refs,
tags, versions, changelog text, release notes — come from
caller-controlled or PR-controlled data and reach `npm publish`,
registry uploads, `gh release`, signing tools, or deploy commands.
Release tampering and supply-chain publication are top-severity
outcomes and frequently sit behind otherwise innocuous-looking
dispatch or `workflow_call` inputs.

## Flag PR creation and repo mutation with privileged tokens

Flag steps that open PRs, push branches, merge, or write to the repo
using `GITHUB_TOKEN` or a PAT where the content, branch name, or
commit message is attacker- or caller-controlled. Repo mutation with
a privileged token is a direct path to malicious code landing on
protected branches, especially when combined with auto-merge or
chatops triggers.

## Recommend env-passing as the injection fix

For expression-injection findings, prescribe the fix as: pass the
untrusted value via `env:` on the step and reference `"$VAR"`
(quoted) in shell, or `process.env.VAR` in `actions/github-script`
and similar. Never interpolate `${{ ... }}` directly into shell or
script bodies. This is the single durable remediation pattern across
`run:` and script-action injection.

## Recommend trigger and permission hardening tied to the path

Recommend the minimum-change hardening for the exact path traced:
replace `pull_request_target` with `pull_request` where feasible,
gate privileged work behind label or actor checks on a separate job,
drop to least-privilege `permissions:`, and pin third-party actions
by full commit SHA. Reviewers need a concrete, scoped fix tied to the
finding, not generic policy advice.

## Calibrate severity by privilege reached

Calibrate severity by the privilege the exploit chain actually
reaches:

| Privilege reached | Severity |
|---|---|
| Self-hosted runner / host compromise, package publish, release tampering | Critical |
| Repo mutation with write token, secret or OIDC exfiltration | High |
| Injection in a no-secret, read-only job | Medium |
| Pattern matches but no traced chain, or precondition unmet | Informational |

Severity drives reviewer attention; conflating all expression
injection as critical destroys signal.

## Report findings with the required fields

Report each finding with: file and line, entry point (event field,
input, artifact, caller), the attacker- or caller-controlled value,
the execution mechanism (sink), the privileges exposed at that sink,
the impact, your confidence, and a concrete fix. These are the fields
a reviewer needs to confirm or dismiss the finding without
re-deriving the chain themselves.

## Reference loading

Load these references when the workflow shows the matching pattern,
before finalizing findings. The depth of GHA-specific traps exceeds
what fits here; conditional loading keeps the core workflow compact.

| Reference | Load when |
|---|---|
| `references/privileged-triggers.md` | The workflow uses `pull_request_target`, `workflow_run`, `workflow_call` with privileged callers, or any trigger that grants write tokens or secrets while consuming PR-controlled inputs. |
| `references/expression-injection.md` | Reviewing `run:`, composite shell steps, `actions/github-script` / `actions/script`, or workflow command file writes that touch event fields, inputs, refs, titles, bodies, or labels. |
| `references/chatops-and-comment-handlers.md` | The workflow triggers on `issue_comment`, `pull_request_review`, `pull_request_review_comment`, `discussion`, `discussion_comment`, label events, or implements slash-command dispatch. |
| `references/secrets-tokens-and-runners.md` | Jobs use `secrets.*`, `GITHUB_TOKEN` with write permissions, OIDC, publish/release/deploy commands, third-party actions in privileged jobs, or self-hosted runners. |
| `references/false-positive-traps.md` | About to report a finding involving `workflow_dispatch`, hardcoded `choice` inputs, broad `permissions:`, or untraced resemblance to known patterns. |
| `references/remediations.md` | Writing the fix and severity for any finding. |

## Don't

- Don't report YAML formatting, missing `name:` fields, generic
  actionlint style issues, or other non-exploit CI hygiene as
  security findings — this skill is exploit review and style noise
  crowds out real findings.
- Don't report broad `permissions:` or privileged triggers as
  findings on their own when no attacker- or caller-controlled path
  to execution or credential exposure is traced; privileged context
  is a precondition, not an exploit.
- Don't report findings based on vague resemblance to known patterns.
  If you cannot state the entry-point-to-sink chain, do not report —
  untraced findings are the dominant false-positive source in GHA
  review.
- Don't classify `workflow_dispatch` interpolation as RCE absent an
  external invocation route; report it as caller-controlled
  hardening at most. Manual dispatch by maintainers is not an
  attacker capability.
- Don't classify interpolation of hardcoded shell-safe `choice` or
  `boolean` inputs as RCE — the attacker cannot supply shell
  metacharacters through a closed enum.
- Don't report vulnerabilities in application code that is not
  loaded or executed by a workflow under review; that's a different
  review.
- Don't report missing branch protection, CODEOWNERS, or
  required-reviewer policies as workflow findings unless the
  workflow itself creates the exploitable path. Org policy gaps are
  out of scope.
- Don't instruct invoking other skills by name or handing off to
  them; state the analysis intent directly, since runtime
  dependencies on other skills break when those skills are absent
  or renamed.