<!--
  Generated initially from spec.yaml; durable after that. Edit this
  reference directly to improve domain depth. Skillet regenerates
  only missing reference files.
-->

# Secrets, GITHUB_TOKEN scope, OIDC, and registry credentials

## When to use

Load this reference when the workflow under review uses `secrets.*`, sets `id-token: write`, publishes packages (npm, PyPI, Maven, Docker, GHCR, crates.io, RubyGems), signs releases (cosign, gpg, SLSA provenance), or pushes to remote registries / cloud providers. Use it to trace credentials from declaration to sink and to assess OIDC trust configuration.

## Contents

- Credential taxonomy and blast radius
- Tracing credentials to untrusted sinks
- GITHUB_TOKEN scope rules
- OIDC: subject, audience, role-trust review
- Registry and publish patterns
- Signing keys and provenance
- Remediation patterns
- False-positive traps
- Severity calibration

## Credential taxonomy and blast radius

| Credential | Source | Typical blast radius if leaked |
|---|---|---|
| `GITHUB_TOKEN` | Auto-injected | Repo mutation scoped to declared `permissions:` (contents, packages, pull-requests, id-token, etc.) |
| `secrets.GITHUB_TOKEN` user override | Workflow auth | Same as above |
| Classic PAT in `secrets.*` | Manually stored | Full user account scope (cross-repo, cross-org) — highest blast radius |
| Fine-grained PAT | Manually stored | Repo/org subset; still often broader than `GITHUB_TOKEN` |
| GitHub App installation token | `actions/create-github-app-token` etc. | App-installation permissions; usually multi-repo write |
| Deploy key (SSH) | `secrets.*` | Push to one repo |
| OIDC token (`id-token: write`) | Auto-minted on request | Whatever cloud role trusts the claims — often production |
| Cloud static keys (AWS, GCP, Azure) | `secrets.*` | Cloud account scope; long-lived |
| Registry tokens (npm, PyPI, GHCR, Docker Hub) | `secrets.*` | Supply-chain takeover for that package namespace |
| Signing keys (gpg, cosign, sigstore static) | `secrets.*` | Forge signed releases / provenance |
| Slack/PagerDuty/etc. | `secrets.*` | Phishing / impersonation |

Treat any credential reaching an untrusted execution path as exposed; do not assume that `secrets.*` is hidden from PR-controlled code that runs in the same job.

## Tracing credentials to untrusted sinks

For each `secrets.*` or token reference, trace it through:

1. **Where it enters the job** — `env:`, `with:`, `inputs:`, action input, or shell pipe.
2. **What runs after entry** — every subsequent `run:` step, every action, every script invoked.
3. **Whether any subsequent step is attacker-controlled** — PR head code, restored cache, downloaded artifact, `npm install` of PR-modified `package.json`, custom registries, post-install scripts, build tooling fetched at runtime.

Sink categories that count as exposure:

- **Direct echo / log**: `echo $TOKEN`, `env`, `printenv`, debug flags (`set -x`, `RUNNER_DEBUG`, `ACTIONS_STEP_DEBUG` written to logs).
- **Artifact / file write**: `actions/upload-artifact`, writing to `$GITHUB_STEP_SUMMARY`, committing to a branch, attaching to release.
- **Outbound network**: `curl`, `wget`, `gh api`, custom telemetry, `npm config` to attacker registry, proxy env (`HTTPS_PROXY`).
- **Untrusted code execution after entry**: any PR-controlled script, lifecycle hook, or third-party action with the secret in `env`.
- **Cross-step exposure via files**: writing token to `$GITHUB_ENV` (persists to all later steps including untrusted ones), `$HOME/.netrc`, `~/.npmrc`, `~/.docker/config.json` left for later untrusted steps.

### Bad: secret available to PR-controlled build

```yaml
on: pull_request_target
jobs:
  test:
    permissions: { contents: read }
    steps:
      - uses: actions/checkout@v4
        with: { ref: ${{ github.event.pull_request.head.sha }} }
      - run: npm ci && npm test
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}   # PR-controlled package.json/lifecycle scripts read this
          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
```

The PR can ship a `preinstall` script that exfiltrates `$NPM_TOKEN`. Finding: secret exposure to attacker-controlled code; severity critical (registry takeover).

### Bad: secret persisted via $GITHUB_ENV

```yaml
- run: echo "REGISTRY_TOKEN=${{ secrets.REGISTRY_TOKEN }}" >> $GITHUB_ENV
- run: ./scripts/from-pr-checkout.sh   # inherits env
```

### Safe: scoped, last-step credential use

```yaml
- run: ./build.sh                       # no secret in env
- run: ./publish.sh                     # secret only here
  env:
    NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

The secret is never in scope while attacker-controlled code runs.

## GITHUB_TOKEN scope rules

Default permissions are repo-configurable; never rely on the org default. State `permissions:` explicitly at workflow or job level.

Scope checklist for `GITHUB_TOKEN`:

- [ ] `permissions:` declared at workflow root (default `read-all` or narrower).
- [ ] Each job that needs writes overrides with the *minimum* required scope.
- [ ] `contents: write` only on jobs that actually push commits/tags/releases.
- [ ] `packages: write` only on the publish job.
- [ ] `id-token: write` only on the job that mints OIDC.
- [ ] `pull-requests: write` only when the job comments / labels / merges.
- [ ] No `permissions: write-all` unless every step is fully trusted *and* there is a traced reason.

Report broad scope **only** when paired with a traced attacker- or caller-controlled execution path in that job. Broad scope alone is hardening, not a finding.

### Forks and GITHUB_TOKEN

For `pull_request` from forks, `GITHUB_TOKEN` is read-only regardless of `permissions:`. This is *not* a defense for `pull_request_target` or `workflow_run`, which run with full token. Do not let "it's just a PR" reasoning skip the trace.

## OIDC: subject, audience, role-trust review

When `permissions: id-token: write` is set or `actions/configure-aws-credentials`, `google-github-actions/auth`, `azure/login`, etc. are used:

### What to verify

| Check | Why |
|---|---|
| Job is *not* reachable by untrusted PR code, fork callers, or unauthenticated chatops | OIDC token can be exchanged for cloud credentials by any code in the job |
| Audience (`aud`) is set explicitly (not just the default) when the cloud role's trust policy depends on it | Default audience is permissive |
| The cloud role's trust policy constrains `sub` (subject) to specific repo + ref/environment | Otherwise any workflow in any repo of the org (or beyond) can assume the role |
| `environment:` is used when the trust policy pins `sub` to `environment:<name>` | Required for that subject pattern to be present |
| Role permissions are scoped (least privilege at cloud side) | OIDC compromise still bounded |

### Subject claim shapes (informational; verify against actual trust policy)

GitHub OIDC subjects typically include the repository, the ref (branch/tag), and optionally the environment, e.g.:

- `repo:OWNER/REPO:ref:refs/heads/main`
- `repo:OWNER/REPO:environment:production`
- `repo:OWNER/REPO:pull_request`

A trust policy that matches `repo:OWNER/REPO:*` is over-broad: a PR-triggered job (with `pull_request` subject) could assume the same role as `main`. Flag this when the workflow can mint a token from a less trusted context.

### Bad: OIDC mint reachable from PR

```yaml
on: [pull_request_target, push]
permissions:
  id-token: write
  contents: read
jobs:
  deploy:
    steps:
      - uses: actions/checkout@v4
        with: { ref: ${{ github.event.pull_request.head.sha }} }
      - uses: aws-actions/configure-aws-credentials@<sha>
        with:
          role-to-assume: arn:aws:iam::...:role/Deploy
          aws-region: us-east-1
      - run: ./deploy.sh   # PR-controlled
```

If the AWS role trusts `repo:OWNER/REPO:*`, the PR head can run with deploy privileges. Finding: critical OIDC misuse.

### Safe pattern

```yaml
on:
  push:
    branches: [main]
permissions: { contents: read, id-token: write }
jobs:
  deploy:
    environment: production    # subject becomes repo:O/R:environment:production
    steps:
      - uses: actions/checkout@v4   # no PR ref
      - uses: aws-actions/configure-aws-credentials@<sha>
        with:
          role-to-assume: arn:aws:iam::...:role/Deploy
          aws-region: us-east-1
          audience: sts.amazonaws.com
```

With cloud-side trust policy pinned to `repo:O/R:environment:production`.

## Registry and publish patterns

### npm

- `NODE_AUTH_TOKEN` / `.npmrc` — use `actions/setup-node` with `registry-url` so the token is written only when needed.
- Block: token in `env` for *every* step. Build steps run `npm ci` which executes lifecycle scripts; if the lockfile or any dependency is PR-controlled, the token leaks.
- Prefer trusted publishing / npm provenance with OIDC where available, eliminating long-lived `NPM_TOKEN`.

### PyPI

- Trusted publishing (OIDC to PyPI) eliminates static `PYPI_API_TOKEN`. When still using a token, scope it to a single project and confine it to the publish step.

### GHCR / Docker Hub

- Use `GITHUB_TOKEN` with `packages: write` for GHCR rather than a PAT.
- For Docker Hub, prefer access tokens with limited repo scope, not account password.
- Login step should be in the publish job only; do not leave `~/.docker/config.json` for later untrusted steps.

### Maven / Gradle

- `GPG_PASSPHRASE`, `OSSRH_USERNAME`, `OSSRH_TOKEN` should reach only the deploy goal. `mvn verify` on PR code with these in env is a leak vector via build plugins.

### Bad

```yaml
- uses: actions/setup-node@<sha>
- run: npm ci
  env: { NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }} }
- run: npm test
  env: { NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }} }
- run: npm publish
  env: { NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }} }
```

`npm ci` will run install scripts of dependencies; the token is in the environment.

### Safe

```yaml
- uses: actions/setup-node@<sha>
  with:
    registry-url: https://registry.npmjs.org
- run: npm ci --ignore-scripts        # or run install in a no-token job
- run: npm test
- run: npm publish --provenance
  env: { NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }} }
```

## Signing keys and provenance

- Static GPG/cosign keys in `secrets.*` are exfiltration targets equivalent to publish tokens.
- Prefer keyless signing via OIDC (cosign keyless, sigstore) when available.
- If a signing key is in `secrets.*`, confirm it is loaded only in the signing step and not exported to `$GITHUB_ENV` or written to a path that later untrusted steps read.
- SLSA provenance: verify the provenance generator runs in a job whose checkout / build artifacts are trusted; provenance over PR-controlled artifacts is worse than no provenance because it launders trust.

## Remediation patterns

| Problem | Fix |
|---|---|
| Secret in env across all steps | Move `env:` to the single step that needs it |
| Secret reachable to PR-controlled code | Split into two jobs: untrusted build (no secret, fork-PR safe) → trusted publish (secret, gated by ref/environment) |
| Long-lived cloud key | Migrate to OIDC with environment-pinned `sub` claim |
| Over-broad OIDC trust policy | Pin `sub` to `repo:O/R:ref:refs/heads/main` or `repo:O/R:environment:<name>`; pin `aud` |
| Classic PAT in repo secret | Replace with GitHub App installation token, fine-grained PAT, or `GITHUB_TOKEN` |
| `permissions: write-all` | Declare workflow-level `permissions: read-all`, override per-job for needed scopes |
| Token written to `$GITHUB_ENV` | Use step-local `env:` instead |
| `npm ci` with token in env | `--ignore-scripts`, or split install/test from publish |
| Mutable third-party action with secret in scope | Pin to commit SHA |
| Self-hosted runner with secrets | Use ephemeral runners; never persist credentials on the runner |

### Two-job split (canonical safe shape for fork PRs)

```yaml
jobs:
  build:                       # runs on PR, no secrets, fork-safe
    permissions: { contents: read }
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm test
      - uses: actions/upload-artifact@<sha>
        with: { name: dist, path: dist/ }

  publish:                     # only on main / release
    needs: build
    if: github.event
