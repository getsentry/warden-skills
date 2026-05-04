# Sources

Retrieved 2026-05-04.

## Synthesis Summary

`vercel-deepsec` adapts the Vercel Labs DeepSec default processor prompt into a Warden skill for benchmark use. The upstream prompt is broad by design, so the skill keeps broad vulnerability coverage while adding Warden conventions: trace-first analysis, concise output requirements, high-confidence reporting, Python and TypeScript examples, and explicit false-positive controls.

## Source Inventory

| Source | Trust tier | Confidence | Contribution | Usage constraints |
|--------|------------|------------|--------------|-------------------|
| https://github.com/vercel-labs/deepsec/blob/main/packages/processor/src/index.ts at `cf8bae9ad37e22a4f23c675493c4c553c6379162` | canonical upstream | high | Supplies the default DeepSec processor prompt, category slugs, severity framing, investigation process, false-positive guidance, Next.js middleware caveat, JSON-in-script XSS guidance, and benchmark intent. | Adapted into Warden syntax and severity labels rather than copied as processor runtime code. |
| https://github.com/vercel-labs/deepsec README, LICENSE, and NOTICE at `cf8bae9ad37e22a4f23c675493c4c553c6379162` | canonical upstream | high | Establishes DeepSec purpose, Apache 2.0 licensing, and Vercel notice text. | LICENSE is copied intact. README is summarized locally to avoid turning the skill folder into DeepSec product docs. |
| `AGENTS.md`, `CONTRIBUTING.md`, `TESTING.md`, and repository `README.md` | canonical local | high | Establishes `skills/wrdn-*` layout, frontmatter, allowed tools, trace-first authoring rules, benchmark note placement, and validation expectations. | User explicitly requested this benchmark skill use the upstream-style unprefixed name. |
| Existing local Warden skills: `wrdn-authz`, `wrdn-code-execution`, `wrdn-data-exfil`, `wrdn-gha-workflows`, and `wrdn-pii` | canonical local | high | Supplies local voice, severity style, source/sink tracing, false-positive controls, and output shape. | Used for style and Warden behavior. The new skill remains broader for benchmark parity. |
| `skill-writer` references: mode selection, synthesis, authoring, description optimization, evaluation, registration validation, and security-review example | canonical workflow | high | Defines the creation workflow, source inventory, coverage matrix, description trigger checks, validation command, and security-review depth gates. | Applied without adding unnecessary reference files. |
| OWASP Top Ten Web Application Security Risks, current project page | primary external | high | Confirms broad webapp coverage for access control, injection, auth, crypto, SSRF, and related risk families. | Awareness standard, not a substitute for traced exploitability. |
| OWASP Cross Site Scripting Prevention Cheat Sheet | primary external | high | Confirms framework escape hatches, context-specific encoding, dangerous contexts, and safe sinks. | Used to calibrate XSS and `dangerouslySetInnerHTML` guidance. |
| OWASP SQL Injection Prevention Cheat Sheet | primary external | high | Confirms parameterized queries and safe query APIs as the preferred mitigation. | Used to avoid false positives on parameterized APIs. |
| OWASP Server Side Request Forgery Prevention Cheat Sheet | primary external | high | Confirms allowlist, URL, DNS, IP, and redirect controls for SSRF defense. | Used to calibrate SSRF false-positive controls. |
| GitHub advisory GHSA-fr5h-rqp8-mj6g for Next.js Server Actions SSRF | primary external | high | Confirms modern Next.js Server Action SSRF risk and reinforces explicit server-side validation. | Specific advisory informs category coverage but does not imply every Server Action is vulnerable. |
| Local Sentry and Getsentry source scans for permission classes, `safe_urlopen`, raw SQL, pickle, serializers, and superuser/staff checks | local prior art | medium | Confirms common real-code idioms and safe/unsafe-looking patterns in large Django/DRF monorepos. | Scans were breadth-oriented; no new Sentry-specific reference file was added for this benchmark skill. |

## Decisions

| Decision | Status | Rationale |
|----------|--------|-----------|
| Rename `skills/wrdn-vercel-deepsec/` to `skills/vercel-deepsec/`. | adopted | User explicitly requested the unprefixed benchmark name `vercel-deepsec` after the initial repo-convention name was created. |
| Keep the skill broad instead of splitting concerns. | adopted | The user requested a DeepSec prompt adaptation for benchmarking. Splitting would make it a different benchmark. |
| Put most guidance in `SKILL.md`. | adopted | User asked to focus on `SKILL.md`; the skill is short enough to avoid conditional references. |
| Include local `README.md`. | adopted | The README records upstream source and states benchmark purpose. |
| Copy upstream Apache 2.0 `LICENSE` intact and include `NOTICE`. | adopted | User requested intact license preservation; upstream also ships a notice file. |
| Use Warden `high` / `medium` / `low` severities. | adopted | Local skill conventions use these labels. DeepSec critical-class issues map to high-impact Warden findings. |
| Require trace-first evidence before reporting. | adopted | Keeps the broad prompt from becoming a pattern matcher and matches Warden voice. |
| Prefer narrower production skills for focused work. | adopted | This prevents the benchmark skill from displacing one-concern Warden skills. |

## Coverage Matrix

| Dimension | Status | Notes |
|-----------|--------|-------|
| Vulnerability classes | complete | Covers DeepSec categories: auth bypass, missing auth, ACL, XSS, dangerous HTML, RCE, SQL injection, SSRF, path traversal, secrets, crypto, redirects, public endpoints, service handlers, webhooks, IAM, server actions, JWT, env exposure, rate limiting, Lua/OpenResty, Go, header trust, cache poisoning, and expensive API abuse. |
| Exploit paths | complete | SKILL.md requires source, sink, missing mitigation, impact, and exact fix. |
| False-positive controls | complete | Covers mitigated sinks, trusted inputs, framework defaults, Next.js middleware caveat, parameterized queries, allowlists, safe JSON escaping, webhook signatures, path containment, and secret placeholders. |
| Remediation patterns | complete | Examples include resource scoping, parameterized queries, safe URL fetch, inline JSON escaping, and argument-vector command execution. |
| Multi-language examples | complete | SKILL.md includes Python and TypeScript bad/safe examples for authz, SQL injection, SSRF, XSS, and command execution. |
| Benchmark purpose | complete | README and SKILL.md state that the skill is benchmark-oriented. |
| Evaluation | partial | Structural validation was run. No quantitative benchmark run was requested or executed. |

## Description Optimization

Should trigger:

- Benchmark Warden against the Vercel DeepSec prompt.
- Run the DeepSec-style broad security review skill.
- Scan this app for auth bypass, XSS, RCE, SQL injection, SSRF, and path traversal.
- Review a Next.js app for server action auth and dangerous HTML issues.
- Use the Vercel DeepSec benchmark skill.

Should not trigger:

- Add Vercel deployment configuration.
- Explain how to install DeepSec.
- Review only GitHub Actions workflow security.
- Review only PII exposure.
- Create a narrow authorization-only skill.

Final description explicitly names Vercel DeepSec, benchmark usage, and the major security classes to improve recall while reducing accidental triggers for Vercel deployment or DeepSec installation questions.

## Evaluation

Lightweight qualitative evaluation:

- Expected improvement over the raw upstream prompt: Warden-compatible frontmatter, local severity labels, explicit output contract, and fewer pattern-only reports.
- Expected unchanged behavior: broad DeepSec-style issue coverage and open-ended review posture.
- Expected risk: broad scope can still be noisier than one-concern skills. That is acceptable for benchmark parity but not ideal for routine focused review.

## Open Gaps

- Add quantitative benchmark fixtures if this repository adopts a repeatable benchmark harness.
- Re-run against known public vulnerable examples before promoting this beyond benchmark use.
- Split any repeatedly useful subset into a narrower focused skill rather than growing this benchmark prompt indefinitely.

## Stopping Rationale

Further retrieval is low-yield for this task because the upstream DeepSec prompt, upstream license files, local repo conventions, existing Warden security skills, OWASP references, and one modern Next.js advisory are enough to adapt the prompt into a benchmark skill. Remaining work is empirical benchmark execution, not more source collection.
