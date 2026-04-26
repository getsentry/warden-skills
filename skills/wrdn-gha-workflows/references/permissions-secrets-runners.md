# Permissions, Secrets, and Runners

Use this reference when workflows expose credentials, broad token scopes, OIDC, package publishing, deployment rights, or self-hosted runners.

## Permissions

`GITHUB_TOKEN` permissions should be the minimum needed for the job. Broad permissions are an amplifier, not always the root bug.

High-impact scopes when untrusted execution is present:

- `contents: write`
- `pull-requests: write`
- `issues: write`
- `actions: write`
- `checks: write`
- `packages: write`
- `deployments: write`
- `id-token: write`
- `security-events: write`
- `write-all`

Read scopes can still matter for private repositories if untrusted code can exfiltrate source, dependency metadata, or internal artifacts.

## Secrets and Long-Lived Credentials

Look for:

- `secrets.*` in env, with, or scripts reached by untrusted code
- PATs, deploy keys, npm/PyPI/Docker tokens, cloud keys, signing keys
- OIDC token minting through `id-token: write`
- checkout credentials persisted before untrusted code runs
- secrets inherited into reusable workflows
- derived secret values written to logs, summaries, files, caches, or uploaded artifacts

Report when the credential is reachable from attacker-controlled execution or from a compromised self-hosted runner.

GitHub masks exact configured secret values in logs. It does not reliably mask transformed values such as base64-encoded, truncated, split, URL-encoded, or archived secrets. Treat those as leaks when an attacker can read logs or artifacts.

## OIDC Trust Boundaries

`id-token: write` lets a workflow mint an OIDC token. The cloud-side trust policy decides whether that token can assume a role. A workflow is risky when untrusted refs can satisfy the trust policy.

High-signal cloud-side patterns when visible in the repo:

- subject allows every ref: `repo:org/repo:*`
- subject allows every workflow in the repo when only release/deploy workflows need access
- pull request refs, feature branches, or unprotected branches can assume production roles
- no environment restriction for production cloud roles

Safer patterns bind the role to protected branches, trusted workflows, or protected environments such as `repo:org/repo:environment:production`.

## Self-Hosted Runners

Self-hosted runners are dangerous when untrusted code can run on them. A persistent runner may leak secrets across jobs or let attackers persist on internal infrastructure.

High-signal indicators:

- `runs-on: self-hosted` in a PR-reachable workflow
- labels indicating production, release, deploy, macos signing, gpu, internal network, or privileged cloud access
- no approval gate for fork PRs
- cache or workspace reuse across untrusted and trusted jobs
- runner groups or labels do not separate trusted deploy jobs from untrusted PR jobs

Do not report self-hosted use when the workflow is only reachable by trusted branches or maintainers, unless another path lets external input reach it.

## Fix Patterns

- Set workflow default:

```yaml
permissions:
  contents: read
```

- Grant write scopes only to the job that needs them.
- Remove secrets from jobs that checkout or execute PR-controlled content.
- Use short-lived OIDC credentials with restricted claims and environments.
- Check cloud trust policies for narrow GitHub OIDC `sub` claims before treating `id-token: write` as safe.
- Disable credential persistence for untrusted checkouts:

```yaml
- uses: actions/checkout@v4
  with:
    persist-credentials: false
```

- Use GitHub-hosted runners for untrusted PR code, or require maintainer approval before self-hosted execution.
