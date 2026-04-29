# wrdn-gha-workflows Specification

## Intent

`wrdn-gha-workflows` finds exploitable GitHub Actions workflow defects where CI boundaries turn untrusted or caller-controlled data into code execution, credential exposure, repository mutation, package publication, release tampering, or runner compromise.

The skill is for exploit review, not workflow style. It should explain the chain from trigger or caller to sink to privilege before reporting.

## Scope

In scope:

- `pull_request_target`, privileged `workflow_run`, and equivalent trusted contexts that consume PR-controlled code, artifacts, caches, or local actions.
- Expression injection in `run:`, composite action shell steps, `actions/github-script`, `actions/script`, interpreter flags, and workflow command files.
- `workflow_dispatch` and `workflow_call` free-form inputs reaching shell or script sinks in release, deploy, publish, PR-creation, token-bearing, secret-bearing, or runner-sensitive jobs. Hardcoded shell-safe `choice` inputs are hardening candidates, not automatic RCE.
- Comment, label, discussion, and chatops workflows that execute commands without authorization or with unsafe text interpolation.
- Secret, PAT, OIDC, write-token, package, release, artifact, cache, mutable third-party action, and self-hosted runner exposure tied to a traced exploit path.

Out of scope:

- YAML formatting, generic actionlint findings, missing names, and CI style.
- Broad permissions or privileged triggers with no attacker/caller-controlled path to execution or credential exposure.
- Manual workflow UX, branch protection policy, CODEOWNERS, or required-reviewer gaps unless the workflow itself creates an exploitable path.
- Standalone application vulnerabilities outside CI, except scripts/config loaded by workflows.

## Users And Trigger Context

- Primary users: Warden reviewers and agents reviewing GitHub Actions changes or CI-adjacent scripts.
- Common user requests: audit GitHub Actions workflows, review `pull_request_target`, check expression injection, inspect release workflow inputs, review reusable workflow secrets, scan composite actions, check GHA permissions.
- Should not trigger for: adding ordinary CI jobs, explaining GitHub Actions syntax, workflow formatting, or non-CI security review.

## Runtime Contract

- Required first actions: identify triggers and callers, map trust boundaries, resolve local actions/reusable workflows/scripts, trace inputs to code-executing sinks, and check token/secret/runner scope.
- Required outputs: file and line, entry point, attacker/caller-controlled input, execution mechanism, privileges exposed, impact, confidence, and concrete fix.
- Non-negotiable constraints: trace before reporting; calibrate `workflow_dispatch` as manual/caller-controlled unless an external route exists; do not report vague resemblance.
- Expected bundled files loaded at runtime: references listed in `SKILL.md` based on observed patterns.

## Source And Evidence Model

Authoritative sources:

- Repository instructions and neighboring Warden security skills for layout, voice, output, and examples.
- GitHub Docs secure-use guidance, workflow syntax, and script-injection documentation.
- CodeQL Actions query help and GitHub Security Lab research/advisories for GHA code injection, pwn-request, and token exposure shapes.
- Sentry, Getsentry, and Warden historical fixes listed in `SOURCES.md`.

Useful improvement sources:

- positive examples: accepted findings or fixes for workflow RCE, secret exposure, pwn requests, artifact/cache abuse, and mutable action compromise.
- negative examples: rejected findings on metadata-only workflows, safe `env:` quoting, hardcoded `choice` inputs, first-party actions, and read-only jobs.
- commit logs/changelogs: fixes mentioning GHA, workflow, shell injection, command injection, pwn request, action pinning, artifact, cache, OIDC, or runner.
- issue or PR feedback: reviewer comments that change exploitability, severity, or false-positive boundaries.
- eval results: prompts in `references/examples-and-usage.md`.

Data that must not be stored:

- secrets, tokens, private URLs, customer data, or private workflow logs.
- raw proprietary snippets longer than needed to reproduce the detection behavior.
- sensitive internal issue details beyond public or local commit identifiers.

## Reference Architecture

- `SKILL.md` contains: runtime workflow, scope, reference routing, threat model, severity, report criteria, false-positive traps, canonical examples, and output requirements.
- `references/` contains: focused lookup guides for expression injection, privileged PR context, comment commands, reusable/indirect flows, permissions/secrets/runners, supply chain, and examples/evals.
- `references/evidence/` contains: none today. Add compact redacted examples only when repeated false positives or false negatives need durable calibration.
- `scripts/` contains: no scripts today.
- `assets/` contains: no assets today.

## Evaluation

- Lightweight validation: check frontmatter, relative reference paths, Warden naming, multi-language examples, and the eval prompts in `references/examples-and-usage.md`.
- Deeper evaluation: run the skill against known pre-fix commits or PR diffs, including Sentry bump-version input injection, Sentry setup-devservices composite input injection, Getsentry `$GITHUB_OUTPUT` expression injection, and Warden release workflow input injection.
- Holdout examples: safe metadata-only `pull_request_target`, safe constrained manual `choice` input, shell-safe `choice` interpolation with no bypass, read-only workflow with third-party action tag, and caller-controlled reusable workflow with no interpreting sink.
- Acceptance gates: findings must distinguish external from manual/reusable caller control; input injection findings must identify the code sink and the privilege or runner impact.

## Known Limitations

- The skill cannot always know who may trigger `workflow_dispatch`; severity should state that assumption when repository settings are not visible.
- External reusable workflows and third-party actions may need source access to prove the callee behavior.
- OIDC findings may need cloud trust policies before high confidence.
- Some manual workflows intentionally grant trusted maintainers powerful operations. The finding must be arbitrary command execution or meaningful privilege amplification, not simply "a maintainer can run a workflow."

## Maintenance Notes

- Update `SKILL.md` when trigger behavior, source/sink criteria, severity, false-positive traps, or output requirements change.
- Update `SOURCES.md` when new public advisories, Sentry-family fixes, Warden findings, or source-discovery decisions materially change coverage.
- Update `references/examples-and-usage.md` when adding reusable eval prompts for new positive or negative behavior.
- Update `references/evidence/` only for redacted examples that future authors should preserve.
