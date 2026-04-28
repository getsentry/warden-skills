# wrdn-pii Evaluation Prompts

Use these prompts for lightweight qualitative checks after changing `SKILL.md`.

## Positive Cases

### Real Email In Fixture

Prompt:

```text
Review this diff with wrdn-pii:

tests/fixtures/customer.json
+ {"email": realCustomerEmailFromTicket, "org": realCustomerOrgSlugFromTicket}
```

Expected:

- Report a finding.
- Explain that the address and org slug look customer-specific and are committed to a fixture.
- Recommend `user@example.com` and `org-slug`.
- Avoid repeating the full email if possible.

### PII In Log Sink

Prompt:

```text
Review this diff with wrdn-pii:

+ logger.warning("signup failed", extra={"email": user.email, "ip": request.META["REMOTE_ADDR"], "body": request.data})
```

Expected:

- Report a finding.
- Identify email, IP, and full request body as runtime PII copied to logs.
- Recommend user ID, reason code, hashing/HMAC, or redaction.

### Email In URL

Prompt:

```text
Review this diff with wrdn-pii:

+ return redirect(f"/magic/error?email={quote(email)}&reason=invalid")
```

Expected:

- Report a finding.
- Identify query-string PII and retention through logs, browser history, and referrers.
- Recommend storing state server-side or using a non-identifying reason code.

### Customer Revenue In Fixture

Prompt:

```text
Review this diff with wrdn-pii:

+ account = {"org": realCustomerOrgSlugFromCrm, "arr_usd": realCustomerArrFromCrm, "renewal": realCustomerRenewalDateFromCrm}
```

Expected:

- Report a finding.
- Identify customer-specific commercial data committed to a fixture.
- Recommend synthetic account data with placeholder org slug and sample rounded values.

## Negative Cases

### Synthetic Fixture

Prompt:

```text
Review this diff with wrdn-pii:

+ payload = {"email": "jane@example.com", "ip": "198.51.100.23", "org": "org-slug"}
```

Expected:

- No finding.
- If explaining, cite example domain, reserved documentation IP, and placeholder org slug.

### Author Metadata

Prompt:

```text
Review this diff with wrdn-pii:

+ # Last-Translator: Jane Developer <jane.developer@example.org>, 2026
+ Co-authored-by: Some Agent <noreply@anthropic.com>
```

Expected:

- No finding.
- Treat as author/translator metadata, not customer data.

### Normal Email Lookup

Prompt:

```text
Review this diff with wrdn-pii:

+ user = User.objects.filter(email__iexact=email, is_active=True).first()
```

Expected:

- No finding.
- The email is used inside the feature's normal trust boundary and is not sent to a lower-trust sink.

## Acceptance Gates

- Positive cases produce findings with file/line, identifier or customer-data class, sink, false-positive analysis, remediation, and severity.
- Negative cases produce no findings.
- Findings do not unnecessarily repeat full PII values.
- The skill does not drift into generic secret scanning or non-PII data exfiltration.
