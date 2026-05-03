<!--
  Generated initially from spec.yaml; durable after that. Edit this
  reference directly to improve domain depth. Skillet regenerates
  only missing reference files.
-->

# Self-hosted runners, third-party actions, and cache supply chain

## When to use

Load this when the workflow under review:

- Targets `runs-on: self-hosted` (or a self-hosted label group / runner group).
- Uses third-party `uses:` references (anything not `actions/*` first-party, and even those when paranoid).
- Reads or writes caches (`actions/cache`, `setup-*` built-in caches, `cache/restore`, `cache/save`) or downloads artifacts that may originate from a less-trusted run.

## Contents

1. Self-hosted runner exposure
2. Third-party action trust and pinning
3. Cache poisoning and artifact trust
4. Decision tables and remediations
5. False-positive traps

---

## 1. Self-hosted runner exposure

### Core threat model

Self-hosted runners persist filesystem state, environment, package caches, credentials, and sometimes daemon access (Docker socket, kube context) **between jobs**. A single execution of attacker-controlled code on a non-ephemeral runner compromises:

- All subsequent jobs on that runner (including jobs from other repos in the same runner group).
- Any long-lived credentials on disk (`~/.aws`, `~/.docker/config.json`, `~/.npmrc`, kube configs, SSH keys).
- The host itself if the runner user has sudo or Docker socket access.

### What turns a self-hosted runner into a finding

Flag self-hosted jobs that admit **any** untrusted execution path:

| Path | Example sink |
|---|---|
| `pull_request_target` + checkout of PR head | running `npm install`, `make`, `pre-commit`, build scripts |
| `workflow_run` consuming PR artifacts | extracting/executing fetched archive |
| `pull_request` from forks (when fork PRs are allowed on self-hosted) | any build step |
| Chatops (`issue_comment`, label) without author authorization | any subsequent step |
| `workflow_dispatch` with an external trigger route | shell interpolation of inputs |

A self-hosted runner with **no** untrusted entry path is not by itself a finding — calibrate.

### Public repos on self-hosted runners

GitHub explicitly recommends against self-hosted runners on public repositories. If the repo is public and self-hosted runners exist, the bar for "untrusted entry path" drops: even default `pull_request` from forks runs fork code on your host. Always flag this combination unless ephemerality + isolation is proven.

### Ephemeral runner requirements

A runner is "ephemeral" only when **every** condition holds:

- Configured with `--ephemeral` (single-job lifetime) or equivalent autoscaler (e.g. ARC, Philips runners) that destroys the VM/container after each job.
- Filesystem and network state do not survive between jobs (fresh VM/container, not just a `--once` flag on a long-lived host).
- No host volumes, sockets, or shared caches mounted in.
- No long-lived credentials on the runner image beyond what registration requires.

A `--once` script that re-registers the same host is **not** ephemeral; the disk persists.

### Runner group & label hygiene

- Runner groups should restrict which repos/orgs can target them. A "default" group allowing all repos collapses isolation between projects.
- Labels are not authorization. `runs-on: [self-hosted, prod-deploy]` is a hint, not a gate; any workflow in any allowed repo can specify those labels.

### Remediation patterns

- Use ephemeral autoscaled runners (e.g. ARC, just-in-time runners) for any path reachable by untrusted code.
- Restrict runner groups to specific repos and explicitly disallow public repos from privileged groups.
- For mixed needs, split: trusted release/deploy jobs on isolated runners; PR/test jobs on GitHub-hosted runners.
- Never mount the Docker socket into a runner that handles untrusted PRs — container escape is trivial.
- Strip credentials from runner images; inject via OIDC or short-lived secrets at job start.

---

## 2. Third-party action trust and pinning

### Why pinning matters

`uses: some-org/some-action@v1` resolves the tag at job start. If the tag is moved (compromise, intentional rewrite, force-push to branch) the action runs new code under the calling job's privileges — secrets, write token, OIDC, runner state.

### Pinning ladder (worst → best)

| Form | Example | Verdict |
|---|---|---|
| Branch ref | `@main`, `@master` | **Always flag** in any privileged workflow |
| Floating major | `@v1`, `@v2` | Flag in any workflow with secrets, write perms, OIDC, publish, or self-hosted runner |
| Exact semver tag | `@v1.2.3` | Better but still mutable; tag can be force-moved |
| Full commit SHA + comment | `@abc123...def # v1.2.3` | Required for privileged contexts |

A SHA pin without a version comment still pins, but maintenance burden increases; recommend the comment pattern.

### What counts as a "privileged context" requiring SHA pin

Any one of:

- `permissions:` includes `contents: write`, `packages: write`, `id-token: write`, `pull-requests: write`, `deployments: write`, `actions: write`, or repo-scoped admin perms.
- The job has access to `secrets.*` other than `GITHUB_TOKEN`.
- The job runs on a self-hosted runner.
- The job publishes to a registry, signs releases, deploys, or mutates the repo.

For purely read-only PR validation jobs on GitHub-hosted runners, an unpinned tag is lower-severity hardening, not a critical finding — calibrate.

### Transitive action risk

A SHA-pinned action can itself `uses:` other actions internally. Resolve the pinned action's source and check whether it pulls floating refs internally. If it does and the action is in a privileged path, note the transitive exposure even though the top-level pin is correct.

### Action sources to scrutinize

- Actions from individual user accounts (not orgs) — single point of compromise.
- Actions that wrap a binary download from a non-pinned URL or run an `install.sh` from a remote host.
- Actions that ship pre-built JS in the repo (`dist/`) where the `dist/` was committed without source review.
- Marketplace actions with very low star count or recent ownership transfer.

### Docker-based actions (`uses: docker://image:tag`)

- `docker://image:latest` or floating tags are equivalent to branch refs — flag.
- Pin by digest: `uses: docker://ghcr.io/owner/image@sha256:...`.
- A Dockerfile-based action (`uses: ./` with `Dockerfile`) executes whatever is in that Dockerfile context; treat as local code.

### Remediation snippet

```yaml
# bad
- uses: some-org/some-action@v2

# good
- uses: some-org/some-action@1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b # v2.4.1
```

For repos with many third-party actions, recommend `dependabot` for `package-ecosystem: "github-actions"` so SHA bumps are tracked.

---

## 3. Cache poisoning and artifact trust

### The cross-context primitive

GitHub's cache scope is by branch, with **fallback** to the default branch and to base branches. A PR run from a fork can write a cache entry that a later trusted run on `main` (or a release branch) restores. If the cached content is **executed** in the trusted run, you have RCE in the privileged context originating from an unprivileged PR.

The same primitive applies to `actions/upload-artifact` → `actions/download-artifact` across `workflow_run` boundaries (covered in the workflow_run reference; here focus on cache).

### When a cache restore is exploitable

All must hold:

1. **Reachable cache key.** A less-trusted job (fork PR, public PR, scheduled job that ran fork code, etc.) can produce an entry under a key that the trusted job's `restore-keys` will match. Common: `cache-${{ hashFiles('**/lockfile') }}` with a fallback prefix that any branch can populate.
2. **Cached path is executed or loaded.** Examples: `node_modules/` (postinstall + require), Python venv (site-packages imported), Go build cache (linked into binary), Rust target dir, Bazel disk cache, pre-built compiler/toolchain dirs, `.gradle/`, `~/.m2/`, Docker layer caches that feed into a later `docker build`.
3. **Trusted job runs after restore.** The job has secrets, write token, OIDC, or self-hosted runner state.

If any of those is missing, downgrade or drop.

### Cache key patterns to inspect

| Pattern | Risk |
|---|---|
| `key: ${{ runner.os }}-${{ hashFiles(...) }}` with `restore-keys: ${{ runner.os }}-` | High — any branch's run populates the prefix |
| `key: deps-${{ github.ref }}-${{ hashFiles(...) }}` no fallback | Lower — branch-scoped, but fork PR runs can still seed `refs/pull/N/merge` keys depending on event |
| Built-in `setup-node` / `setup-python` / `setup-go` cache | Inherits whatever key strategy the action uses; typically lockfile hash with prefix fallback |
| `actions/cache/restore@... fail-on-cache-miss: false` in privileged job | Silent restore of attacker-influenced content |

`pull_request` runs from forks **can** write caches scoped to the PR's ref; whether trunk runs see them depends on the cache scope rules (refs/pull/* are isolated, but base-branch fallback and merge-queue paths are nuanced). Be conservative: if a privileged job restores a key whose namespace any PR has populated, treat as exploitable until proven otherwise.

### Specific cached paths and their execution sinks

| Cached path | Execution sink |
|---|---|
| `node_modules/` | `require()` of any module, npm/pnpm/yarn lifecycle hooks if reinstall happens |
| `~/.npm`, `~/.pnpm-store` | Reused on next install; tampered tarball cached locally |
| Python `~/.cache/pip`, venv, `site-packages` | Import on next run |
| Go module/build cache | Linker pulls in tampered archives |
| Rust `target/` and `~/.cargo/registry` | Linked into next compile |
| `~/.gradle`, `~/.m2/repository` | Resolved on next build |
| Docker layer cache (`/tmp/.buildx-cache`, registry cache) | Layer used as base for trusted image build |
| Pre-built CLI tools restored to `$PATH` | Executed by name in later steps |

### Remediations

- **Do not restore caches in privileged jobs that are reachable from untrusted code paths.** Build fresh.
- Scope keys tightly: include `github.workflow`, `github.job`, and the trusted ref; avoid base-branch fallbacks.
- For release/publish workflows: explicitly disable caching (`cache: false` on `setup-*`, no `actions/cache`).
- If caching is necessary, sign and verify cached payloads, or restrict cache writes to trusted refs only (`if: github.ref == 'refs/heads/main'` on the `cache/save` step).
- Treat artifacts uploaded by less-trusted runs the same way: validate, do not execute, do not deserialize into trusted code paths.

### Bad / safe examples

```yaml
# bad — release job restores cache that any PR may have populated
release:
  runs-on: ubuntu-latest
  permissions:
    id-token: write
    contents: write
  steps:
    - uses: actions/checkout@<sha>
    - uses: actions/setup-node@<sha>
      with:
        node-version: 20
        cache: 'npm'           # restore-keys fallback can pull PR-seeded entries
    - run: npm ci              # postinstall executes
    - run: npm publish
```

```yaml
# safer — no cache in the privileged job
release:
  runs-on: ubuntu-latest
  permissions:
    id-token: write
    contents: write
  steps:
    - uses: actions/checkout@<sha>
      with:
        ref: ${{ github.sha }}
    - uses: actions/setup-node@<sha>
      with:
        node-version: 20
        # no cache
    - run: npm ci --ignore-scripts   # also disable lifecycle scripts
    - run: npm publish --provenance
```

---

## 4. Decision tables

### Self-hosted runner finding decision

| Untrusted entry path? | Ephemeral? | Repo visibility | Verdict |
|---|---|---|---|
| Yes | No | Public | Critical |
| Yes | No | Private | High |
| Yes | Yes (true VM/container destroy) | Either | Low / hardening unless isolation gaps |
| No | No | Either | Not a finding on its own |

### Third-party action pinning finding decision

| Pin form | Privileged context? | Verdict |
|---|---|---|
| Branch (`@main`) | Yes | Critical |
| Branch (`@main`) | No (read-only PR validation) | Medium hardening |
| Floating tag (`@v1`) | Yes | High |
| Floating tag (`@v1`) | No | Low hardening |
| SHA-pinned | — | Not a finding (note transitive risk if relevant) |

### Cache restore finding decision

| Less-trusted writer can reach key? | Cached path executed in trusted job? | Trusted privileges available? | Verdict |
|---|---|---|---|
| Yes | Yes | Write token / secrets / OIDC / publish | Critical (cache poisoning RCE) |
| Yes | Yes | Read-only | Medium |
| Yes | No (data only, never executed) | — | Low (data integrity only) |
| No (strict scoping) | — | — | Not a finding |

---

## 5. False-positive traps

- **Self-hosted without an untrusted path.** A repo with self-hosted runners only used by `push` to protected branches and `workflow_dispatch` from maintainers is not exploitable from outside; do not report critical "self-hosted runner exposure" without a traced entry.
- **First-party `actions/*` unpinned by tag.** `actions/checkout@v4` is a lower bar than third-party `@v4`. Still recommend SHA pin for release workflows, but do not rate it the same as a random marketplace action.
- **Cache in a job with no executable cached
