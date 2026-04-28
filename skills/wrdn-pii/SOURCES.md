# wrdn-pii Sources

Retrieval date: 2026-04-28.

## Source Inventory

| Source | Trust tier | Confidence | Contribution | Usage constraints |
|--------|------------|------------|--------------|-------------------|
| `AGENTS.md`, `CONTRIBUTING.md`, `TESTING.md` in this repository | canonical | high | Established `skills/wrdn-*` layout, required frontmatter, `allowed-tools`, `skill-writer` usage, multi-language examples, trace-first rules, and Warden voice. | Repo-specific conventions only. |
| Neighboring skills: `wrdn-authz`, `wrdn-data-exfil`, `wrdn-code-execution`, `wrdn-gha-workflows` | canonical | high | Reused trace-first structure, severity tables, false-positive traps, canonical pattern style, and one-concern boundary. | Do not inherit unrelated vulnerability classes. |
| `skill-writer` references: mode selection, synthesis path, authoring path, security-review example, registration validation | canonical | high | Required security-review coverage dimensions, source inventory, decisions, `SPEC.md`, and validation workflow. | Authoring guidance, not runtime PII guidance. |
| [NIST SP 800-122, Guide to Protecting the Confidentiality of PII](https://csrc.nist.gov/pubs/sp/800/122/final) | canonical | high | PII should be protected from inappropriate access, use, and disclosure; PII identification is context-based. | Federal guidance; adapt to product engineering review. |
| [MITRE CWE-359, Exposure of Private Personal Information to an Unauthorized Actor](https://cwe.mitre.org/data/definitions/359.html) | canonical | high | Defines the weakness as unauthorized access to private personal information and lists examples like contact info, location, communications, health, financial data, and credentials. | CWE examples are broad; skill narrows to code-review findings. |
| [MITRE CWE-598, Sensitive Query Strings](https://cwe.mitre.org/data/definitions/598.html) | canonical | high | Specific bug shape: sensitive data, including email/phone/PII, in GET query strings can leak through logs, referrers, history, and downstream systems. | Covers query strings; skill extends to redirects and path segments. |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | canonical | high | Logging can create confidentiality risk; sensitive personal data should usually be masked, sanitized, hashed, encrypted, or omitted; emails and phone numbers need special handling. | Logging guidance is contextual; do not ban all audit logging. |
| [OWASP Email Validation and Verification Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Email_Validation_and_Verification_Cheat_Sheet.html) | canonical | high | Email addresses are primary identifiers; email enumeration is a threat model. | Identity-flow guidance only; skill uses it for PII classification and enumeration. |
| [European Commission personal data guidance](https://commission.europa.eu/law/law-topic/data-protection/reform/what-personal-data_en) | canonical | high | Examples of personal data include email addresses, IP addresses, cookie IDs, and identifiers that can identify a living person alone or together. | Legal framing is broader than engineering findings; skill avoids legal conclusions. |
| [HackerOne FAQ](https://www.hackerone.com/policies/faq) and [information-disclosure deep dive](https://www.hackerone.com/vulnerability-management/information-disclosure-deep-dive) | secondary | medium | PII encountered during vulnerability work should be minimized; information disclosure is common and can expose PII. | Secondary source; used for risk framing, not exact criteria. |
| [GitHub Advisory GHSA-8xx5-h6m3-jr33 / CVE-2025-51586](https://github.com/advisories/GHSA-8xx5-h6m3-jr33) | canonical | high | Real email-enumeration bug shape through reset-token/back-office parameters, with phishing and social-engineering impact. | Product-specific advisory; generalized to email enumeration flows. |
| Local Sentry commit `f70fce7b4fc` / `79f2ccdfa73`, "forbid customer info in PRs, commits, and code" | canonical | high | Established local rule: never include customer org slugs, user emails, account names, customer-tied internal IDs, or support details in PRs, commits, or code; use `org-slug` and `user@example.com`. | Local Sentry policy; generalized because this repo ships Warden skills for similar codebases. |
| Local Sentry checkout scan for email/IP/logging patterns | canonical | medium | Showed legitimate controlled uses: hashed email rate-limit key, audit/security IP logging, schema fields, translator metadata, VCS author fixtures, and some raw logging patterns that require context. | Snapshot of local checkout; do not treat every existing pattern as approved. |
| Local Getsentry checkout scan for email/IP/customer logging patterns | canonical | medium | Showed customer-facing surfaces with admin emails, beacon IPs, billing emails, webhook payload logging, and jobs that may carry customer data. | Private repo idioms; store only summarized observations. |

## Decisions

| Decision | Status | Rationale |
|----------|--------|-----------|
| Scope the skill to personal/customer identifiers and customer-confidential business data, not every information-disclosure primitive. | adopted | Keeps one concern per skill and avoids duplicating `wrdn-data-exfil`. |
| Require both an identifier or customer-data item and an exposure sink before reporting. | adopted | NIST, CWE-359, and neighboring skills all point to context and impact, not keyword matches. |
| Add explicit fake-data controls for example domains, reserved IPs, placeholders, author metadata, role aliases, and schema field names. | adopted | User requested differentiation between fake and real PII; local Sentry scans showed many safe examples. |
| Cover real customer-confidential business data, including revenue and billing data, when tied to a specific customer or production account. | adopted | User requested revenue-like data; CWE-359 and HackerOne information-disclosure guidance include financial/customer data exposure as a privacy/confidentiality impact. |
| Treat email in URL query/path/redirect/state as high-signal. | adopted | CWE-598 and public advisories show recurring email-in-URL and email-enumeration shapes. |
| Treat raw PII in logs, metrics tags, analytics, Sentry scope, and exceptions as reportable only when unnecessary or lower-trust. | adopted | OWASP Logging recommends masking/sanitizing; local code has legitimate audit/security uses that require context. |
| Exempt author, translator, maintainer, changelog, and GitHub noreply metadata by default. | adopted | User explicitly allowed "say the author"; local code has many translator and VCS fixture emails. |
| Avoid repeating full PII in findings. | adopted | Reporting should not amplify the privacy leak. |
| Add no runtime reference files initially. | adopted | The core decision logic fits in `SKILL.md`; references would add navigation without enough conditional depth. |
| Add a literal scanner script. | deferred | Useful later if false negatives appear, but current skill needs human context to separate real from fake. |

## Coverage Matrix

| Dimension | Coverage status | Evidence |
|-----------|-----------------|----------|
| Vulnerability class definitions and prerequisites | complete | `SKILL.md` defines identifier/customer-data item plus exposure sink and separates privacy/customer-data exposure from generic exfiltration. |
| Exploitable dataflow and literal exposure examples | complete | Canonical patterns cover committed fixtures, logs/telemetry, URLs, customer IPs, and customer revenue/account data in Python and TypeScript. |
| False-positive controls | complete | Classification section and false-positive traps cover placeholders, reserved IPs, author metadata, role aliases, schemas, audit paths, and hashes. |
| Severity and confidence calibration | complete | Severity table ties impact to public/durable/vendor-visible exposure, retention, and ambiguity. |
| Concrete remediation patterns | complete | Output requirements and examples prescribe synthetic replacement, hashing/HMAC, redaction, URL removal, serializer narrowing, and internal tooling. |
| Framework or context caveats | complete | Runtime guidance covers Sentry scope, logs, analytics, metrics, API responses, AI/replay payloads, audit/rate-limit exceptions, and VCS fixtures. |
| Negative examples and safe cases | complete | Multi-language safe examples plus synthetic-data and author-metadata exclusions. |
| Version/platform variance | not applicable | PII exposure shapes are framework-agnostic; no library-version rule is required at creation. |

## Description Optimization

Final description:

> Detects real personally identifiable information, customer identifiers, and customer-confidential business data in code changes. Use when asked to find PII, customer IPs, real email addresses, revenue data, billing data, personal data, privacy leaks, customer info in logs, PII in URLs, or accidental production data in tests, fixtures, comments, docs, config, telemetry, or API responses.

Should-trigger queries:

- "Find PII in this diff."
- "Check whether this PR includes real customer emails."
- "Review this fixture for customer IPs."
- "Audit logs for personal data leakage."
- "Does this endpoint expose user email addresses?"
- "Look for real PII in tests and snapshots."
- "Find real revenue data in this fixture."
- "Check whether this change leaks customer billing details."

Should-not-trigger queries:

- "Find SQL injection."
- "Scan for hardcoded API keys."
- "Review generic authz scope checks."
- "Update email validation copy."
- "Add a normal email field to the user serializer."
- "Fix a translation header author attribution."

Optimization notes:

- Added "real", "customer identifiers", "customer IPs", "real email addresses", "revenue data", "billing data", "logs", "URLs", "tests", and "fixtures" to improve recall for user language.
- Kept "code changes" and "accidental production data" to avoid triggering on legal/privacy policy questions.

## Evaluation Summary

Representative behavior:

- Real-looking customer email in a test fixture: should report when not author metadata and not an example domain.
- Customer-specific revenue, billing, or account-health data in fixtures/logs: should report when tied to a customer or production account.
- `user@example.com`, `jane@example.com`, and `198.51.100.23`: should not report.
- `logger.info(..., extra={"email": user.email})`: should report when new and unnecessary, with remediation to use user ID or hash.
- `User.objects.filter(email__iexact=email)`: should not report without a lower-trust sink.
- Email in `/oauth/error?email=...`: should report as PII in URL.
- Translator header with an example-domain author address: should not report as customer PII.

Outcome: improved expected behavior over a generic PII scanner because the skill requires context and has explicit fake-data, synthetic-business-data, and author-metadata controls.

Residual risks:

- Ambiguous real domains in fixtures require judgment.
- Ambiguous commercial metrics require customer or production-account linkage before reporting.
- Repo-specific approved logging fields may need future references.
- No quantitative benchmark was run.

## Open Gaps

- Collect accepted and rejected Warden findings after the first real PR reviews to tune ambiguous fixture-email handling.
- Add a focused reference if a consumer repo has approved PII hashing/redaction helpers or telemetry field allowlists.
- Build a small redacted fixture repository if quantitative regression testing becomes useful.

## Retrieval Stopping Rationale

Further collection is currently low-yield. The source set includes repo conventions, authoring rules, neighboring security skills, canonical privacy/logging/query-string guidance, public advisory examples, and local Sentry/Getsentry idioms. Remaining uncertainty is repo-specific policy around approved telemetry fields, which should be gathered from actual consumer feedback rather than more generic sources.
