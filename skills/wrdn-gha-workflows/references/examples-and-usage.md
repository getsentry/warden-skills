# Examples and Usage

This file captures sample Warden configuration, trigger-quality checks, and lightweight eval prompts for `wrdn-gha-workflows`.

## Sample Warden Config

```toml
[[skills]]
name = "wrdn-gha-workflows"
paths = [
  ".github/workflows/**/*.yml",
  ".github/workflows/**/*.yaml",
  ".github/actions/**/*.yml",
  ".github/actions/**/*.yaml",
  ".github/actions/**/action.yml",
  ".github/actions/**/action.yaml",
  "action.yml",
  "action.yaml",
]

[[skills.triggers]]
type = "pull_request"
actions = ["opened", "synchronize", "reopened"]

[[skills.triggers]]
type = "local"

[[skills.triggers]]
type = "schedule"
```

The skill may also need scripts or config files referenced by workflows. Add those paths in repositories where CI loads repo-local shell, Python, JavaScript, Makefile, package, or agent-instruction files.

## Should Trigger

- "Audit our GitHub Actions workflows for pwn request bugs."
- "Review this `.github/workflows` diff for unsafe `pull_request_target` usage."
- "Check whether this comment-triggered deployment workflow can be abused."
- "Scan these local composite actions for expression injection."
- "Review GHA permissions and secrets exposure in this PR workflow."
- "Does this reusable workflow chain execute fork code with write permissions?"

## Should Not Trigger

- "Run actionlint on the workflow formatting."
- "Add a new CI job for unit tests."
- "Explain GitHub Actions syntax."
- "Review Dockerfile security."
- "Find hardcoded secrets in source code."
- "Check branch protection settings in GitHub."

## Lightweight Eval Prompts

Use these prompts against small fixture repos or targeted diffs.

### Positive: pwn request

Workflow uses `pull_request_target`, checks out `${{ github.event.pull_request.head.sha }}`, grants `contents: write`, and runs `npm install`. Expected result: high-severity finding with PR checkout, package script execution, token exposure, and fix to use unprivileged `pull_request` or remove PR checkout.

### Negative: safe metadata workflow

Workflow uses `pull_request_target` only to label PRs and comment using PR number. It never checks out code or reads artifacts. Expected result: no finding.

### Positive: expression injection

Workflow runs on `pull_request` and has `run: echo "${{ github.event.pull_request.title }}"`. Expected result: medium or high finding depending on token/secrets impact, with fix to pass through `env` and quote.

### Positive: filename injection

Workflow runs on `pull_request`, collects changed files, and loops over `${{ steps.changed.outputs.files }}` in a shell. Expected result: expression-injection finding explaining that filenames from the PR are attacker-controlled shell data.

### Negative: safe expression context

Workflow uses `${{ github.event.pull_request.number }}` in `run:` and `${{ github.event.pull_request.title }}` only in `if:`. Expected result: no expression-injection finding.

### Positive: comment command

Workflow runs on `issue_comment`, deploys when comment contains `/deploy`, uses deployment secrets, and has no author association check. Expected result: high or medium finding with missing authorization and secret exposure.

### Positive: indirect artifact chain

Unprivileged PR workflow uploads an artifact containing a script. Privileged `workflow_run` downloads the artifact and executes it with `packages: write`. Expected result: high finding if execution is clear, medium if artifact provenance is unresolved.

### Positive: AI config poisoning

Workflow uses `pull_request_target`, checks out fork code, runs an AI coding agent with write permissions, and allows non-write users. PR modifies `AGENTS.md` or `CLAUDE.md`. Expected result: finding describing poisoned project instructions plus privileged agent tool access.

### Positive: OIDC trust policy

Workflow grants `id-token: write` on PR-reachable jobs and the repo includes a cloud trust policy matching `repo:org/repo:*`. Expected result: finding if untrusted refs can assume the role, or medium confidence if cloud-side binding needs verification.

### Lower confidence: mutable action ref

Security-critical release workflow uses a third-party action pinned to `@main`, but no external attacker can modify the workflow or action source. Expected result: low only if adjacent to another traced workflow risk, otherwise do not report.
