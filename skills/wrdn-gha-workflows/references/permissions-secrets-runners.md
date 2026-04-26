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

## ArtiPACKED: Checkout Credentials in Uploaded Artifacts

`actions/checkout` writes the `GITHUB_TOKEN` (and on some runners `ACTIONS_RUNTIME_TOKEN`) into `.git/config` for credential persistence. A later `actions/upload-artifact` whose `path:` includes `.git/` ships the token off the runner. On a public repository the artifact is world-readable; the token's lifetime is the workflow run, but that is enough to push code, open and merge PRs, or hand off to a longer-lived credential.

High-signal indicators:

- `actions/upload-artifact` `path:` is `.`, `./`, `${{ github.workspace }}`, the repository root, or any glob that does not exclude `.git/`
- the prior `actions/checkout` step did not set `persist-credentials: false`
- artifact upload of a directory that received `git config --local credential.helper` writes, `~/.docker/config.json` after a registry login, `~/.npmrc` after `npm login` or `setup-node` writes, or `~/.gitconfig` after credential helper writes

Fix patterns:

- set `persist-credentials: false` on every `actions/checkout` whose work product later gets uploaded
- upload only the build output directory, not the workspace
- treat `.git/`, `~/.docker/config.json`, `~/.npmrc`, `~/.gitconfig`, and `~/.aws/credentials` as denylisted from artifact uploads

## Cache Trust Boundaries

Caches are cross-job storage. Two shapes recur:

- A `pull_request` workflow writes a cache the privileged `workflow_run`/`push`/`release` workflow later restores. The privileged job is now executing or trusting attacker-supplied content. Either the cache scope must be partitioned by trust (different keys, different scopes, or no shared scope at all), or the privileged job must validate the restored data before using it.
- An attacker run stuffs the 10 GiB GitHub-imposed cache scope to evict legitimate entries, then writes a poisoned replacement under the expected key. The Angular dev-infra compromise documented by Adnan Khan used this exact pattern: an unprivileged job poisoned a cache that a release job restored. Cache eviction is a feature, not a bug; relying on a cache key being "the one we wrote" is wrong.

Validate cache contents before using them in privileged jobs, or do not share cache scope across trust boundaries.

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
