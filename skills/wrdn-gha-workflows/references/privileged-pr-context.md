# Privileged PR Context

Use this reference when a workflow uses `pull_request_target`, privileged `workflow_run`, or another trusted context that may handle PR-controlled content.

## Core Rule

`pull_request_target` is intended for base-repository metadata work such as labeling or commenting. It becomes dangerous when the workflow explicitly checks out, builds, tests, imports, or otherwise materializes attacker-controlled PR content while trusted tokens or secrets are available.

## High-Signal Indicators

- `on: pull_request_target` with `actions/checkout` and `ref: ${{ github.event.pull_request.head.sha }}`.
- `ref: ${{ github.head_ref }}`, `ref: ${{ github.event.pull_request.head.ref }}`, `repository: ${{ github.event.pull_request.head.repo.full_name }}`, `refs/pull/...`, or custom `git fetch` of PR refs.
- Build or test commands after PR checkout: `npm install`, `npm ci`, `yarn`, `pnpm`, `pip install`, `tox`, `pytest`, `make`, `cargo`, `go test`, `bundle install`, `gradle`, `mvn`.
- Local actions referenced after checkout: `uses: ./.github/actions/...`.
- Commands that load repo files: `source`, `. ./script.sh`, `make`, `bash .github/...`, `python ci/...`, `node ci/...`.
- AI-agent actions that read repo instructions after PR checkout.
- `persist-credentials` omitted or set to true before untrusted code runs.
- Workflow or job permissions include write scopes: `contents: write`, `pull-requests: write`, `issues: write`, `packages: write`, `id-token: write`, `actions: write`, or `write-all`.

## Safe or Broken But Not Vulnerable

- `pull_request_target` with default `actions/checkout` checks out base repository code. It may fail to test the PR, but it does not execute fork code by itself.
- A `pull_request_target` workflow that only reads metadata, labels, or comments without loading PR files is usually safe.
- `pull_request` runs fork code with restricted token and no base secrets by default. It can still be part of a chain if artifacts later enter a privileged job.
- `persist-credentials: false` reduces token theft from `.git/config`, but does not protect other secrets or OIDC credentials exposed to the job.

## Verification Steps

1. Confirm the trigger can run for fork PRs.
2. Identify the exact ref checked out or fetched.
3. Determine whether subsequent steps execute code or load files from that ref.
4. Read scripts and local actions reached after checkout.
5. Confirm available secrets, token permissions, OIDC, and package publishing credentials.
6. Check `if:` guards for author association, maintainer approval, or fork exclusion.

## Fix Patterns

- Use `pull_request` for testing untrusted code.
- Split workflows: unprivileged `pull_request` produces inert results, privileged `workflow_run` comments or labels after validating artifacts as data.
- Avoid checking out PR head in `pull_request_target`.
- Set minimum permissions at workflow and job level.
- Use `persist-credentials: false` before any untrusted commands.
- Keep secrets and `id-token: write` out of jobs that handle PR-controlled content.
