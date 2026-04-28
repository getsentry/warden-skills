# wrdn-pii Specification

## Intent

`wrdn-pii` detects real personal identifiers, customer identifiers, and customer-confidential business data introduced into code changes or exposed through unnecessary durable sinks. Its main job is to separate actual PII and customer data from fake example data so reviewers do not waste attention on `user@example.com` or synthetic dashboards while a real customer email or revenue figure walks into git history.

The skill overlaps with information-disclosure review only when the disclosed data is personal, customer-identifying, or customer-confidential. Generic SSRF, SQL injection, path traversal, and secret scanning stay outside this skill.

## Scope

In scope:

- Real emails, customer IPs, customer account identifiers, names plus context, phone numbers, addresses, support/ticket details, user/customer payloads, and similar identifiers.
- Customer-specific revenue, ARR/MRR, contract value, invoice amounts, spend, quota, usage volume, seat count, plan tier, renewal dates, churn risk, account health, sales notes, billing provider IDs, support/escalation details, and similar commercial data.
- Hardcoded PII in code, docs, tests, fixtures, snapshots, cassettes, comments, config, and generated artifacts.
- Runtime PII or customer-confidential business data sent to logs, exceptions, Sentry scope, analytics, metrics, URLs, redirects, cache keys, exports, or response payloads without a clear product need and privacy control.
- False-positive handling for synthetic examples, reserved IP ranges, author metadata, public role aliases, and field/schema names.

Out of scope:

- Standalone secrets and credentials.
- Generic data-exfiltration primitives with no personal/customer identifier.
- Legitimate storage, lookup, validation, or delivery of email/IP data within the feature's normal trust boundary.
- Legitimate revenue, billing, or usage functionality shown only to authorized users within the product trust boundary.
- Legal classification advice. The skill identifies engineering privacy exposure, not compliance obligations.

## Users And Trigger Context

- Primary users: Warden reviewers and agents reviewing code diffs for privacy exposure.
- Common user requests: find PII, detect real emails, check for customer IPs, review customer info in tests, audit PII in logs, check privacy leakage, find real revenue data, detect customer billing data.
- Should not trigger for: generic security reviews with no personal data angle, secret scanning, dependency CVEs, or plain schema/model work.

## Runtime Contract

- Required first actions: inspect the changed lines and surrounding context; classify each candidate identifier or customer data item; verify whether fake/example/author/synthetic-data exceptions apply; trace runtime values to sinks before reporting.
- Required outputs: file, line, identifier or customer-data class, exposure sink, reason it appears real, false-positive exception analysis, remediation, severity.
- Non-negotiable constraints: do not repeat full PII values unnecessarily; do not report vague resemblance; do not report obvious placeholders or author metadata.
- Expected bundled files loaded at runtime: `SKILL.md` only. `SOURCES.md` and `EVAL.md` are maintenance artifacts.

## Source And Evidence Model

Authoritative sources:

- Repository agent instructions and neighboring Warden security skills for style, layout, trace-first review, and multi-language examples.
- NIST SP 800-122, MITRE CWE-359, MITRE CWE-598, OWASP Logging, OWASP Email Validation, and European Commission personal-data guidance.
- Public advisory examples for email enumeration and PII-in-URL bug shapes.
- Local Sentry and Getsentry source scans for common email/IP/logging idioms and repo-specific customer-info policy.

Useful improvement sources:

- positive examples: Warden findings that correctly caught real customer identifiers or PII sinks.
- negative examples: false positives on placeholders, author metadata, reserved IPs, role accounts, and schemas.
- commit logs/changelogs: fixes mentioning PII, privacy, email leakage, customer information, scrubbing, or redaction.
- issue or PR feedback: reviewer comments where PII findings were accepted or rejected.
- eval results: prompts in `EVAL.md`.

Data that must not be stored:

- real customer emails, IPs, org slugs, names, ticket URLs, account IDs, revenue figures, billing details, screenshots, or payloads.
- secrets, tokens, or private URLs.
- raw production logs or customer support content.

## Reference Architecture

- `SKILL.md` contains: runtime workflow, classification rules, report criteria, false-positive traps, severity, examples, and output requirements.
- `references/` contains: none at creation time. Add focused references only if future iterations need framework-specific privacy rules.
- `references/evidence/` contains: none at creation time. Store only redacted positive/negative examples if repeated false positives appear.
- `scripts/` contains: none. Add automation only if Warden needs a reusable literal scanner.
- `assets/` contains: none.

## Evaluation

- Lightweight validation: run the skill against prompts in `EVAL.md` and confirm it reports real-looking PII and customer commercial exposure while ignoring placeholders, synthetic values, and author metadata.
- Deeper evaluation: build a redacted fixture repo with positive/negative cases for literal emails, customer business data, IP ranges, logs, URLs, fixtures, and serializers.
- Holdout examples: keep at least one ambiguous fake fixture and one real-looking customer identifier case outside the examples in `SKILL.md`.
- Acceptance gates: no findings for `example.com` or reserved IPs; findings include sink and why the identifier appears real; no full PII repeated in output when partial description is enough.

## Known Limitations

- The skill cannot prove whether an arbitrary public domain or IP belongs to a real customer without local context.
- Some organizations intentionally allow limited PII or customer commercial data in restricted audit/admin systems. The skill should report only new broad exposure or unnecessary lower-trust sinks.
- It does not replace a DLP scanner or legal privacy review.
- It may need repo-specific references if a consumer has approved telemetry fields or redaction helpers.

## Maintenance Notes

- When to update `SKILL.md`: accepted or rejected findings reveal missing criteria, false-positive controls, new PII sinks, or remediation patterns.
- When to update `SOURCES.md`: new public advisories, local policy changes, or source scans materially change the bug shapes.
- When to update `EVAL.md`: every meaningful criteria change should add or adjust at least one positive and one negative prompt.
- When to update `references/evidence/`: repeated real-world examples need durable redacted evidence for future calibration.
