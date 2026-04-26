# Reusable Workflows and Indirect Flows

Use this reference when workflow risk crosses file boundaries through `workflow_call`, `workflow_run`, local actions, composite actions, artifacts, caches, or scripts.

## Core Rule

Review the effective graph, not one YAML file. The caller may introduce a privileged context while the callee checks out untrusted code. The producer may be unprivileged while the consumer trusts its artifact in a privileged job.

## What to Trace

- `uses: ./.github/workflows/name.yml`
- `uses: owner/repo/.github/workflows/name.yml@ref`
- `workflow_call` inputs, secrets, and permissions
- `secrets: inherit`
- local action calls under `.github/actions`
- composite action `runs.steps`
- third-party action source when vendored or available locally
- `actions/upload-artifact` and `actions/download-artifact`
- `actions/cache` keys and restored paths
- scripts called from workflow steps

## Dangerous Shapes

- Caller passes secrets to a reusable workflow that checks out PR-controlled refs.
- Caller grants write permissions, callee runs untrusted inputs in shell.
- `workflow_run` downloads artifacts from an untrusted PR workflow and executes scripts, imports code, publishes packages, or comments trusted results without validation.
- Cache restored from attacker-controlled keys places executable files, package cache contents, or build outputs in a privileged job.
- A local composite action comes from the PR checkout and runs with caller secrets.
- An otherwise pinned action downloads mutable remote scripts or binaries at runtime and executes them.

## Undeclared Secrets in Reusable Workflows

A reusable workflow defines its secret surface under `on: workflow_call: secrets:`. Any `${{ secrets.X }}` reference inside the workflow that is not declared there (and is not the implicit `GITHUB_TOKEN`) is a hidden contract:

- the workflow only runs when the caller writes `secrets: inherit`, which exposes the entire caller secret bag
- a future caller that passes secrets explicitly silently breaks
- reviewers reading the callee cannot see which secrets the workflow needs

Detection signal: grep the reusable workflow for `secrets\.` references and compare against the declared `secrets:` map. Anything missing is a finding. getsentry #19582 (`b7c2a401ba`) fixed exactly this on `select-sentry-tests.yml` by declaring `SENTRY_INTERNAL_APP_PRIVATE_KEY`, `SENTRY_GCP_DEV_WORKLOAD_IDENTITY_POOL`, and `COLLECT_TEST_DATA_SERVICE_ACCOUNT_EMAIL`.

## Missing Permissions in Reusable Workflows

A reusable workflow without a top-level or job-level `permissions:` block inherits whatever the caller granted. That is fine when the callee is a thin trusted helper; it is not fine when the caller routinely grants write scopes the callee does not actually need. getsentry #19634 (`ff221468c1`) added `permissions: {contents: read, id-token: write, pull-requests: read}` to a reusable workflow that previously over-inherited.

Report when the reusable workflow has no `permissions:` block AND the operations inside it (read source, mint OIDC, write a single check, etc.) need a strictly narrower scope than callers commonly grant.

## Cache Eviction and Trust Crossing

GitHub caps each repository's Actions cache at 10 GiB and evicts oldest entries on overflow. An attacker run that stuffs the cache forces eviction of legitimate entries; the same run can then write a poisoned entry under the expected key. The Angular dev-infra compromise (Adnan Khan, 2024) used this technique to land malicious build artifacts in a release job. Trace cache scope across trust boundaries, not just cache contents.

## Verification Steps

1. Build a small call graph: trigger, caller job, callee workflow/action, scripts, artifact/cache producer and consumer.
2. Mark each node as trusted base code, PR-controlled, external action, or unknown.
3. Mark where secrets, OIDC, and write permissions become available.
4. Confirm whether untrusted data is executed or trusted in the privileged node.
5. Review the external reusable workflow only if available. Otherwise report the unresolved assumption as medium confidence, not high.

## Fix Patterns

- Do not use `secrets: inherit` unless the callee is trusted and never executes untrusted content.
- Pass only the specific secret needed by a callee.
- Pin external reusable workflows and third-party actions to immutable SHAs where practical.
- For security-critical workflows, review action source for runtime downloads such as `curl | bash`; SHA pinning does not pin the downloaded payload.
- Treat artifacts and caches from PR workflows as untrusted data. Validate format, never execute them.
- Keep local actions used in privileged workflows on base-repository code.
