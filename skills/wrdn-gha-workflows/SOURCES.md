# Sources

Retrieved 2026-04-26.

## Source Inventory

| Source | Trust | Confidence | Contribution | Usage constraints |
|--------|-------|------------|--------------|-------------------|
| `https://github.com/getsentry/warden/issues/258` | canonical | high | Defines requested Warden skill, target scope, acceptance criteria, non-goals, and emphasis on privileged PR context plus PR-controlled content. | Issue describes desired shape, not final implementation. |
| `AGENTS.md`, `CONTRIBUTING.md`, `TESTING.md`, `README.md` | canonical | high | Establishes `skills/wrdn-*` layout, naming, allowed-tools defaults, multi-language examples, local testing, and Warden usage. | Repo-local conventions override generic skill-writer defaults. |
| `skills/wrdn-access-control/SKILL.md` and `skills/wrdn-code-execution/SKILL.md` | canonical | high | Provides local voice, structure, trace-first review style, severity tables, false-positive controls, and canonical examples. | Neighboring skills are security skills, not GHA-specific. |
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
