# Sources

Provenance for patterns, bug shapes, and reference material in `wrdn-idp-claim-trust`.

## Security Advisories and CVEs

| ID | Description | Used in |
|----|-------------|---------|
| nOAuth (Descope, 2023) | Azure AD mutable-email account takeover via OAuth auto-linking | SKILL.md, oidc-oauth.md, express.md |
| GHSA-7pq6-v88g-wf3w / CVE-2025-22146 | Sentry SAML cross-org impersonation via IdP email claim | SKILL.md, sentry.md |
| GHSA-ggmg-cqg6-j45g | Sentry orphaned AuthIdentity reattachment via SAML | SKILL.md, sentry.md |
| GHSA-rcmw-7mc7-3rj7 | Sentry SSO setup flow trusted IdP email for admin linking | SKILL.md, sentry.md |
| GHSA-jw9c-mfg7-9rx2 / CVE-2024-45409 | ruby-saml signature verification bypass (CVSS 10.0) | SKILL.md, saml.md |

## Vendor Documentation

| Source | Used in |
|--------|---------|
| Microsoft Entra claims validation guidance | SKILL.md, oidc-oauth.md, nextjs.md |
| Auth0 verified-email-usage docs | SKILL.md, oidc-oauth.md |
| Auth.js `allowDangerousEmailAccountLinking` docs | nextjs.md |
| Auth.js callbacks reference | nextjs.md |
| python-social-auth pipeline docs | django.md |
| django-allauth socialaccount configuration | django.md |
| OpenID Connect Core 1.0 (claim stability) | oidc-oauth.md |
| OASIS SAML 2.0 Core (NameID formats) | saml.md |
| OASIS SAML Security Considerations | saml.md |
| GitHub REST API /user/emails | oidc-oauth.md |
| RFC 6819 §4.4.1.13 (OAuth Threat Model) | SKILL.md |

## Codebase Analysis

Patterns in SKILL.md and `references/sentry.md` were derived from analysis of:
- `src/sentry/auth/helper.py` (auth pipeline, `AuthIdentityHandler.user` property)
- `src/sentry/identity/github/provider.py` (`email_verified` signal corruption)
- `src/sentry/auth/providers/saml2/provider.py` (SAML `email_verified: False` hardcode)
- `src/sentry/auth/providers/google/provider.py` (Google OIDC `email_verified` binding)
- `getsentry/web/identity.py` (HandleIdentityView email-based pipeline state binding)

49 files scanned across `sentry` and 8 files across `getsentry` using the skill itself for validation.
