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

### Positive: github-script JS injection

Workflow uses `actions/github-script@v7` and concatenates `${{ github.event.issue.title }}` directly into the `script:` body to build a comment. Expected result: medium-or-high finding; the issue title is evaluated as JavaScript inside the action's Node context with the workflow token (CVE-2026-27701 shape). Fix is `env:` plus `process.env.X`.

### Positive: ArtiPACKED artifact upload

Workflow checks out the repo without `persist-credentials: false`, builds, then runs `actions/upload-artifact@v4` with `path: .`. Expected result: medium or high finding citing ArtiPACKED; the persisted `GITHUB_TOKEN` from `.git/config` is included in a public-readable artifact.

### Positive: undeclared reusable-workflow secret

Reusable workflow with `on: workflow_call:` and no `secrets:` map, but `${{ secrets.DEPLOY_KEY }}` referenced inside a job. Caller uses `secrets: inherit`. Expected result: medium finding; the secret surface is invisible from the callee, future explicit-secrets callers break, and inheriting bag-of-secrets is broader than the callee needs.

### Positive: TOCTOU on /ok-to-test

Workflow uses `issue_comment`, gates on `author_association == 'MEMBER'` and a `/ok-to-test` body match, then `actions/checkout` with `ref: ${{ github.event.pull_request.head.sha }}` and runs deploy with `id-token: write`. Expected result: high finding; the head SHA at job start is not the SHA the maintainer reviewed. Fix is to pin to a SHA captured at approval time.

### Positive: third-party action on a mutable ref in a release job

Workflow runs on `release: published`, has `permissions: {contents: write, packages: write, id-token: write}`, and includes `uses: some-org/release-helper@v2`. Expected result: high finding; `@v2` is a mutable tag, the job mints OIDC and publishes packages, and the tj-actions/changed-files compromise (CVE-2025-30066) demonstrated this exact takeover path. Fix is to pin to a 40-character SHA.

### Negative: third-party action on tag in read-only public flow

Workflow runs on `pull_request`, has `permissions: read-all` (or `contents: read`), no `secrets.*` other than `GITHUB_TOKEN`, and uses `actions/checkout@v4` plus a third-party linter on `@v3`. Expected result: no supply-chain finding; the job holds no exploitable credentials.

### Negative: first-party action on tag

Workflow uses `actions/checkout@v4` and `actions/setup-node@v4` in a privileged release job. Expected result: no supply-chain finding; first-party `actions/*` references on a tag are not in scope.

### Lower confidence: mutable action ref

Workflow that handles no secrets, holds no write tokens, and operates only on public read-only data uses a third-party action pinned to `@main`. Expected result: low only if adjacent to another traced workflow risk, otherwise do not report.
