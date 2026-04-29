# Sources

Retrieved 2026-04-26.

## Source Inventory

| Source | Trust | Confidence | Contribution | Usage constraints |
|--------|-------|------------|--------------|-------------------|
| `https://github.com/getsentry/warden/issues/258` | canonical | high | Defines requested Warden skill, target scope, acceptance criteria, non-goals, and emphasis on privileged PR context plus PR-controlled content. | Issue describes desired shape, not final implementation. |
| `AGENTS.md`, `CONTRIBUTING.md`, `TESTING.md`, `README.md` | canonical | high | Establishes `skills/wrdn-*` layout, naming, allowed-tools defaults, multi-language examples, local testing, and Warden usage. | Repo-local conventions override generic skill-writer defaults. |
| Existing security skill prose in this repository | canonical | high | Provides local voice, structure, trace-first review style, severity tables, false-positive controls, and canonical examples. | Security-review prose is reusable for tone and structure only. |
| `getsentry/skills/skills/gha-security-review/SKILL.md` and `~/src/sentry-skills/skills/gha-security-review/references/*.md` | upstream/local prior art | high | Supplies exploit taxonomy, external-attacker threat model, pwn request, expression injection, changed-filename injection, comment command, AI config poisoning, credential, OIDC, supply-chain, cache/artifact, and runner checks. | Adapted to Warden naming and repo conventions; standalone hygiene guidance was narrowed to exploit-oriented findings. |
| `getsentry/skills/skills/skill-scanner/SKILL.md` | upstream prior art | medium | Supplies scanner-style phased workflow, confidence handling, false-positive discipline, and output contract precedent. | Scanner is for agent skills, so only workflow/output ideas were reused. |
| GitHub Security Lab, "Preventing pwn requests" | canonical/primary | high | Confirms `pull_request_target` risk, base-vs-fork checkout distinction, checkout credentials risk, and split `pull_request` plus `workflow_run` mitigation. | Public guidance; exact platform defaults may evolve. |
| GitHub Docs, "Security hardening for GitHub Actions" and "Script injections" | canonical | high | Confirms untrusted contexts, expression injection guidance, action pinning, least privilege, and self-hosted runner cautions. | Use current docs when resolving platform-specific details. |
| CodeQL query help, `actions/untrusted-checkout/high` | canonical/primary | high | Confirms dangerous pattern of trusted workflow context checking out untrusted PR code and links it to CWE-829. | Query help informs bug shape, not Warden output format. |
| `skill-writer` references: mode selection, synthesis, authoring, description optimization, evaluation, registration validation, security-review example | canonical workflow | high | Defines required synthesis, authoring, description optimization, lightweight evaluation, registration, and validation workflow. | Some validation tooling is not present in this repo. |

## Decisions

| Decision | Status | Rationale |
|----------|--------|-----------|
| Use `skills/wrdn-gha-workflows/` as the skill root. | adopted | Repo conventions require `wrdn-` prefix and canonical skills live under `skills/`. |
| Name the skill `wrdn-gha-workflows`, not `gha-workflow-scanner`. | adopted | User requested this exact repo skill name. |
| Make v1 prompt/reference-driven with no bundled deterministic script. | adopted | Issue recommends v1 as prompt/reference-driven; repo has no scanner script convention for existing Warden skills. |
| Treat `pull_request_target` alone as non-reportable. | adopted | Issue comments and GitHub guidance both identify the exploit as privileged context plus PR-controlled materialization. |
| Treat broad permissions as an amplifier, not the root finding. | adopted | Reduces noisy best-practice findings and matches issue framing. |
| Include reusable workflow, artifact, cache, and local action call-boundary tracing. | adopted | Issue explicitly calls out indirect and cross-workflow composition. |
| Report mutable third-party action refs only when adjacent to exploitability. | adopted | Standalone mutable refs are often hygiene; issue asks to prioritize externally exploitable paths. |
| Add changed-filename injection and AI-agent config poisoning. | adopted | `sentry-skills` includes concrete real-world GHA exploit patterns not explicit enough in the first Warden draft. |
| Add OIDC trust-policy checks only when repo/cloud config is visible or a workflow exposes `id-token: write` to untrusted refs. | adopted | OIDC risk depends on cloud-side claims, so report high only with the trust policy or a clearly unsafe workflow boundary. |
| Keep GitHub official unpinned actions out of standalone findings. | adopted | `sentry-skills` treats this as medium hygiene, but Warden issue asks to avoid non-exploit noise. |
| Include sample Warden config in a reference file instead of README. | adopted | Keeps top-level docs stable while satisfying usage documentation. |
| Add full eval harness. | deferred | Repository has no eval harness. `references/examples-and-usage.md` records lightweight prompts for follow-up fixture work. |

## Coverage Matrix

| Dimension | Status | Notes |
|-----------|--------|-------|
| Vulnerability classes | complete | Covers pwn request, expression and filename injection, comment commands, credentials, OIDC, AI config poisoning, reusable workflows, artifacts/caches, local actions, third-party action runtime downloads, and runners. |
| Exploit paths | complete | Findings require entry point, attacker-controlled input, execution mechanism, privileges, impact, confidence, and fix. |
| False-positive controls | complete | Safe patterns cover metadata-only `pull_request_target`, default checkout, `if:`/`with:` expression use, protected-branch/manual triggers, and standalone hygiene. |
| Remediation patterns | complete | References include split workflow, least permissions, `persist-credentials: false`, env quoting, authorization gates, and artifact validation. |
| Multi-language examples | complete | SKILL.md includes GitHub Actions YAML plus Python and TypeScript script/action examples with bad and safe cases. |
| Warden usage | complete | Sample `warden.toml` snippet included in `references/examples-and-usage.md`. |
| Evaluation | partial | Lightweight eval prompts included. No executable eval suite exists in this repo. |

## Description Optimization

Should trigger:

- Audit GitHub Actions workflows for pwn request bugs.
- Review `.github/workflows` for unsafe `pull_request_target`.
- Check GHA expression injection in `run:` blocks.
- Scan local composite actions and reusable workflows for CI abuse.
- Review workflow secrets and permissions exposure.

Should not trigger:

- Format GitHub Actions YAML.
- Add a CI workflow.
- Explain workflow syntax.
- Scan application source for hardcoded secrets.
- Review branch protection settings.

Final description explicitly names the concrete files and risk classes to improve recall while excluding generic CI style work.

## Stopping Rationale

Further retrieval is low-yield for v1 because the issue, upstream prior art, GitHub primary guidance, CodeQL query help, and local repo conventions all agree on the central detection model. The remaining open work is not more source collection; it is running the skill against real repos and adding fixture-based evals if the project adopts an eval harness.

---

## 2026-04-26 update, Sentry prior art and 2025/2026 CVEs

Iteration pulled bug shapes from sentry/getsentry git history and recent public CVEs. New rows below; existing rows above remain valid.

### Sentry prior art added (canonical, high confidence)

| Source | Contribution |
|--------|--------------|
| sentry `e93ee1ce463` "fix(security): Prevent shell injection in setup-devservices action" (DI-1860/VULN-1528) | Composite-action `${{ inputs.* }}` shell injection. Listed as a sink class in `expression-injection.md`. |
| sentry `c50c92f951c` "security: Fix shell injection vulnerability in bump-version workflow" (VULN-858) | Same shape on `${{ inputs.pr_options }}`. |
| getsentry `0898b3d814` "security(gha): fix potential for shell injection" | `||`-fallback expression interpolated into `>> $GITHUB_OUTPUT`. Added to expression-injection sinks list. |
| getsentry `b7c2a401ba` "fix(ci): declare secrets in select-sentry-tests reusable workflow" (#19582) | New "Undeclared Secrets in Reusable Workflows" reference section. |
| getsentry `ff221468c1` "fix(selective testing): fix permissions" (#19634) | New "Missing Permissions in Reusable Workflows" reference section. |
| sentry `a249a227f85` "chore: pin GitHub Actions to full-length commit SHAs" (#111336) | Org-wide pinning effort, citing tj-actions. Drives severity bump for unpinned third-party actions. |
| getsentry `4971e497ae` "security(gha): pin all actions to specific sha" (#17076) | Same. |

### Public CVEs and writeups added (secondary, high confidence)

| Source | Contribution |
|--------|--------------|
| CVE-2025-30066, tj-actions/changed-files (CISA, Wiz, Semgrep, Aqua, Phoenix, Unit 42) | Standing reason for the supply-chain severity bump. Cited in `supply-chain.md` and the SKILL.md severity table. |
| CVE-2025-30154, reviewdog/action-setup | Cascading supply-chain wave. Cited alongside CVE-2025-30066. |
| ArtiPACKED, Unit 42 | Persisted `GITHUB_TOKEN` exfiltrated through artifact uploads. New canonical pattern + `permissions-secrets-runners.md` section. |
| Cache poisoning, Adnan Khan (May 2024) and Angular dev-infra writeup | Eviction-stuffing variant; cross-trust cache scope warning. Added to `permissions-secrets-runners.md` and `reusable-and-indirect-flows.md`. |
| CVE-2026-27701, LiveCode `actions/github-script` PR-title injection | Justifies adding `actions/github-script` and `actions/script` as expression-injection sinks; new canonical pattern. |
| CVE-2025-53104, gluestack-ui discussion-title shell injection | Confirms `discussion.title`/`discussion.body` as attacker-controllable; added to `comment-commands.md` and the SKILL.md attacker surface list. |
| CVE-2025-61671, GoogleCloudPlatform/ai-ml-recipes pwn request | Confirms existing pwn-request coverage; no new shape. |
| Praetorian "Long Live the Pwn Request" | Confirms existing pwn-request coverage on Microsoft repos. |
| GitHub Security Lab, preventing pwn requests parts 1 and 4 | Source for TOCTOU-on-approval guidance. |

### New decisions

| Decision | Status | Rationale |
|----------|--------|-----------|
| Bump unpinned third-party action refs from "low defense-in-depth" to medium-or-high based on job privilege. | adopted | tj-actions/changed-files demonstrated the shape exploits at scale; 23k+ repos affected. |
| Keep first-party `actions/*` and `github/*` tag refs out of scope for the supply-chain finding. | adopted | These refs are governed under GitHub's organization, not arbitrary maintainers. Reduces false positives. |
| Add `actions/github-script` and `actions/script` as expression-injection sinks alongside `run:`. | adopted | CVE-2026-27701 LiveCode shipped this exact shape; the JavaScript context is an `eval`-equivalent. |
| Add ArtiPACKED upload-artifact pattern to "Credential exposure". | adopted | Real, public-repo, world-readable; not previously in scope of the skill. |
| Add TOCTOU-between-approval-and-checkout to comment-commands. | adopted | Common chatops shape; not previously called out. |
| Add reusable-workflow undeclared-secrets and missing-permissions detection. | adopted | Real Sentry incidents (`b7c2a401ba`, `ff221468c1`); not previously called out. |
| Create `references/supply-chain.md` rather than fold into `permissions-secrets-runners.md`. | adopted | Substantial enough to merit its own progressive-disclosure file; matches "one concern per reference". |

### Coverage matrix delta

| Dimension | Previous | Now |
|-----------|----------|-----|
| Expression-injection sinks | shell `run:` only | shell `run:` + `actions/github-script`/`actions/script` + `>> $GITHUB_OUTPUT`/`$GITHUB_ENV`/`$GITHUB_STEP_SUMMARY`/`$GITHUB_PATH` |
| Attacker-controlled surfaces | comments, PR title/body, branch names, filenames | + discussion title/body, label names |
| Reusable workflow shapes | secrets-passed-to-untrusted-callee | + undeclared-secrets-in-callee + missing-permissions-in-callee |
| Artifact risk | upload of attacker-supplied script consumed by privileged downstream | + ArtiPACKED upload of workspace including `.git/`-persisted `GITHUB_TOKEN` |
| Cache risk | attacker-controlled keys/contents restored into privileged jobs | + 10 GiB eviction-and-replace pattern (Angular dev-infra) |
| Comment-commands | authorization gate + safe-quoting | + TOCTOU between approval and head-ref resolution |
| Supply-chain pinning | low/defense-in-depth | tiered medium/high based on job privilege; first-party carve-out |

---

## 2026-04-29 update, manual and reusable workflow input injection

Iteration source: Warden PR #277, where `${{ inputs.bump }}` was interpolated directly into a release workflow shell command and fixed by moving the value into `env:` as `BUMP` and using `"$BUMP"` in the command. The concrete Warden workflow defines `bump` as a finite `choice` (`minor`, `patch`, `major`), so the PR is best treated as correct hardening and a detector-calibration example unless a caller path can bypass the option set. The same sink shape is exploitable for free-form `string` inputs, as shown by Sentry's `inputs.pr_options` fix.

### Sources added

| Source | Trust | Confidence | Contribution |
|--------|-------|------------|--------------|
| getsentry/warden PR #277, "fix: Prevent command injection in release workflow" | canonical | high | Prompt example: `workflow_dispatch` input reaches `npx semver -i` in a release workflow. Because `bump` is a finite `choice`, this calibrates hardening and choice-input false-positive handling as much as free-form input detection. |
| sentry `c50c92f951c` "security: Fix shell injection vulnerability in bump-version workflow" | canonical | high | Same family: free-form `inputs.pr_options` reached `gh pr create --fill` in a manual/reusable workflow with a PAT. Confirms this is recurring Sentry prior art, not a one-off. |
| sentry/getsentry local workflow scan for `workflow_dispatch`, `workflow_call`, `inputs.*`, and `github.event.inputs.*` | canonical/local | medium | Shows current repositories use manual inputs for refs, changed-file lists, release/version values, PR options, and workflow fanout. Some are safe via `env:` or non-shell contexts; the skill needs caller-aware tracing. |
| GitHub Docs, "Secure use reference" | primary | high | Confirms script injection occurs before shell execution and recommends intermediate environment variables plus native shell access and quoting. Also notes token/secrets impact and least-privilege mitigation. |
| GitHub Docs, "Workflow syntax for GitHub Actions" | primary | high | Confirms `workflow_dispatch` inputs are exposed in both `inputs` and `github.event.inputs`, and that `choice` resolves to a string while boolean values are preserved in `inputs`. |
| CodeQL Actions query help, `actions/code-injection/critical` | primary | high | Confirms user-controlled input in Actions can lead to code injection in `run:` or `script:` and recommends `env:` plus native interpreter variable access, not `${{ env.X }}`. |
| GitHub Security Lab, "Keeping your GitHub Actions and workflows secure Part 2: Untrusted input" | primary/operational | high | Confirms expression expansion before shell execution, untrusted input surfaces, impact on secrets/tokens, and env-variable remediation. |

### Example intake summary

| ID | Label | Kind | Origin | Source | Expected behavior | Previous behavior | Skill delta |
|----|-------|------|--------|--------|-------------------|-------------------|-------------|
| EX-2026-04-29-001 | negative | edge-case | human-verified | getsentry/warden PR #277 | Prefer `env:` plus `"$BUMP"` hardening for `${{ inputs.bump }}` in a release workflow, but account for the finite `choice` option set before calling it exploitable RCE. | The threat model and "What NOT to Report" excluded `workflow_dispatch` entirely, while the expression-injection guidance did not distinguish free-form inputs from constrained choices. | Add manual/reusable workflow input tracing, plus explicit `choice` false-positive controls and eval prompts. |
| EX-2026-04-29-002 | positive | fix | mixed | sentry `c50c92f951c` | Preserve detection for free-form input option strings such as `inputs.pr_options` reaching `gh pr create --fill` with privileged credentials. | Existing guidance mentioned composite action inputs but not top-level manual/reusable workflow inputs. | Add explicit `workflow_dispatch` and `workflow_call` input sources and severity calibration. |
| EX-2026-04-29-003 | negative | edge-case | synthetic from docs and local usage | GitHub workflow syntax; local workflow scan | Do not report hardcoded `choice`, `boolean`, `number`, or `environment` inputs used only in `if:`, `with:`, or safely quoted `env:` contexts. | Existing skill had no manual-input false-positive control because it excluded the whole class. | Add constrained-input carve-out and negative eval prompt. |

### Decisions

| Decision | Status | Rationale |
|----------|--------|-----------|
| Treat free-form `workflow_dispatch` and `workflow_call` inputs as caller-controlled in shell/script sinks. | adopted | GitHub expands expressions before interpreter execution; manual and reusable callers can supply the string. |
| Keep external attacker findings as the preferred threat model, but no longer exclude manual workflow RCE. | adopted | PR #277 and sentry `c50c92f` show release/bump workflows can grant tokens or release automation beyond ordinary caller actions. |
| Calibrate manual `workflow_dispatch` severity by caller and job privilege. | adopted | A write user triggering a manual workflow is not the same as a fork PR attacker, but arbitrary shell under PATs, release credentials, OIDC, packages, or self-hosted runners is still reportable. |
| Treat hardcoded `choice`, `boolean`, `number`, and `environment` inputs as usually safe unless the option set is shell-unsafe, a caller/API path can bypass the set, or a later sink reinterprets the value as code. | adopted | Reduces noise for common manual workflow UX while preserving tracing when a value becomes code or shell syntax later. |
| Add `SPEC.md` for `wrdn-gha-workflows`. | adopted | The change materially expands intended scope and out-of-scope behavior, so future maintainers need a maintenance contract. |
| Add durable `references/evidence/` files. | deferred | This is a focused false-negative fix. `SOURCES.md` captures the examples and behavior deltas; evidence files can be added if repeated examples accumulate. |

### Coverage matrix delta

| Dimension | Previous | Now |
|-----------|----------|-----|
| Threat model | External attacker without repo write access | External attacker preferred, plus manual/reusable callers when input reaches privileged code execution |
| Input sources | GitHub event context and externally reachable action inputs | + `workflow_dispatch` `inputs.*`, `github.event.inputs.*`, and `workflow_call` `inputs.*` |
| Expression-injection sinks | `run:`, composite shell, `github-script`, workflow command files | Same sinks, with explicit manual/reusable examples (`npx semver -i`, `gh pr create --fill`, tags/refs/options) |
| False-positive controls | Excluded all `workflow_dispatch` risks | Report only caller-controlled sink plus privileged impact; distinguish free-form strings from shell-safe constrained choices |
| Evaluation | PR/title/comment/callee expression injection prompts | + manual input injection positive, reusable input injection positive, constrained manual input negative |

### Description optimization

Should trigger additions:

- Review this release workflow for `workflow_dispatch` input command injection.
- Check a reusable workflow where `inputs.pr_options` reaches `gh pr create`.
- Audit manual GitHub Actions inputs used in shell commands.

Should not trigger additions:

- Tune the labels and defaults for a manual workflow form.
- Validate that a hardcoded `choice` input is listed in the UI.
- Explain how to manually run a GitHub Actions workflow.

Final description now names `workflow_dispatch` and `workflow_call` input command injection to improve recall for PR #277-class bugs without turning the skill into a manual workflow UX reviewer.

### Replay summary

- Warden PR #277-class diff: improved. The updated skill should load `references/expression-injection.md`, identify `inputs.bump` as caller-controlled, identify `npx semver -i` as the shell sink, notice `bump` is a finite `choice`, and recommend `env:` plus `"$BUMP"` as hardening unless a bypass to arbitrary input exists.
- Sentry `c50c92f951c` pre-fix shape: improved. The skill now explicitly flags free-form `inputs.pr_options` reaching `gh pr create --fill` under privileged credentials.
- Safe hardcoded choice input: improved. The new false-positive control tells the agent to drop constrained manual inputs used through quoted `env:` unless another exploit path exists.

### Stopping rationale

Further retrieval is low-yield for this iteration. The referenced Warden PR, Sentry historical fix, GitHub primary docs, CodeQL query help, and local workflow scan all point to the same missing class: caller-controlled workflow inputs interpolated into code-evaluating sinks. Remaining work is fixture-based regression testing if this repository later adds an executable eval harness.
