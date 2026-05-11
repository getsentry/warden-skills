# SAML Claim Trust Reference

Load when the diff touches SAML assertion parsing, NameID extraction, attribute mapping, or identity-linking using `python3-saml`, `ruby-saml`, `passport-saml`, `@node-saml/node-saml`, `saml2-js`, `pysaml2`, or hand-rolled XML assertion handlers.

SAML is worse than OIDC in two specific ways: there is no spec-defined `email_verified` equivalent, and the trust model depends on the relying party correctly validating XML signatures against an admin-configured IdP certificate. Both failure modes shift up into claim-trust bugs the moment account linking is in scope.

## Contents
- The NameID vs. Email Question
- ruby-saml CVE-2024-45409: The Reference Class
- Decision Procedure for SAML
- Bug Shapes
- Safe Patterns
- Verification Commands
- References

This reference covers **claim trust for identity linking**. XML signature wrapping, XXE, and other SAML parser bugs are covered elsewhere; the concern here is: given a validly signed assertion, which attributes can a relying party trust for *which* decision?

## The NameID vs. Email Question

SAML has two candidate identity keys:

- **`NameID`** (with a `Format`). When `Format=urn:oasis:names:tc:SAML:2.0:nameid-format:persistent`, the value is a stable, opaque identifier the IdP assigns per relying party. Persistent NameID is the SAML equivalent of OIDC `(iss, sub)` and the correct stable-subject anchor.
- **Attributes** like `emailAddress`, `mail`, `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress`. The IdP admin maps these to user directory fields. Values are not guaranteed stable, unique, or verified.

Relying parties that key accounts off the email attribute instead of a persistent NameID inherit every problem a rogue or misconfigured IdP can cause: tenant reorganization renames users, an attacker with admin rights in a federated tenant sets their email to the victim's, a newly-onboarded IdP asserts the same email that an existing user already has on a different IdP.

## ruby-saml CVE-2024-45409: The Reference Class

ruby-saml / OmniAuth-SAML (CVSS 10.0, September 2024) failed to properly verify SAML Response signatures. A signed SAML document from any IdP (including the attacker's own, or a public test IdP) could be crafted to authenticate as any user on the relying party.

Two lessons for claim trust:

1. The signature check is load-bearing. A gap there is not "defense in depth missing". It is a full bypass.
2. The IdP certificate a relying party validates against must come from admin-configured metadata, not from the assertion itself. A relying party that reads `<ds:KeyInfo>` from the incoming assertion verifies the signature against the attacker's own key.

## Decision Procedure for SAML

- **Safe:** Persistent NameID matched against an existing link record. Relying party verified the assertion signature against the admin-configured IdP certificate, pinned the audience, checked `InResponseTo` against a stored request, and confirmed `NotOnOrAfter` / `NotBefore`. Login proceeds.
- **Needs session confirmation:** First-time linking of a SAML NameID to an existing local user. Relying party must require the session user to be authenticated and to confirm the link from a POST handler that re-resolves from `request.user`, not from assertion state. Pre-filling the confirmation UI from the email attribute is fine; treating it as authorization is not.
- **Finding:** Email-based user lookup driving a privileged write. `user = User.objects.get(email=saml_attrs["email"])` followed by `auth.login` is the pattern.

## Bug Shapes

### 1. Email-based user lookup on SAML callback

```python
# bad
def saml_acs(request):
    saml_response = OneLogin_Saml2_Response(settings, request.POST["SAMLResponse"])
    saml_response.is_valid(request.POST)   # returns bool; callers sometimes ignore it
    attrs = saml_response.get_attributes()
    email = attrs["emailAddress"][0]
    user = User.objects.get(email=email)
    auth.login(request, user)
```

Two distinct flaws: `is_valid` return value ignored (must `assert`, not just call), and the resolved user comes from email rather than NameID.

```ts
// bad (passport-saml)
const strategy = new SamlStrategy(opts, async (profile, done) => {
  const email = profile.email ?? profile.nameID;  // nameID falls back to email here
  const user = await db.user.findUnique({ where: { email } });
  done(null, user ?? false);
});
```

### 2. NameID used but Format ignored

```python
# risky
nameid = saml_response.get_nameid()
link = LinkedIdentity.objects.get(subject=nameid)
```

`Format=transient` NameIDs are regenerated per session and are useless as a link key. Pin the Format to `persistent` (or `emailAddress` only when the IdP has committed to stability) before storing.

### 3. IdP certificate not pinned to metadata

```ts
// bad
const strategy = new SamlStrategy({
  cert: req.body.signingCert,   // never do this
  // or
  cert: extractCertFromAssertion(req.body.SAMLResponse),
  // or absent entirely, relying on library default behavior
}, verifyFn);
```

```xml
<!-- bad -->
<saml:Issuer>https://any-idp.example.com</saml:Issuer>
<!-- ... -->
<ds:KeyInfo>
  <ds:X509Data><ds:X509Certificate>ATTACKER_CERT</ds:X509Certificate></ds:X509Data>
</ds:KeyInfo>
```

The certificate must come from IdP metadata stored server-side, pinned when the admin configured the integration. If the relying party accepts a certificate from the assertion itself, any SAML IdP can impersonate any user.

### 4. Assertion signature optional ("SignedResponse OR SignedAssertion")

Some libraries accept either a signed `<Response>` or a signed `<Assertion>`. Attackers who obtain a signed assertion for one context (e.g., a different relying party on the same federation) can wrap it in a new unsigned Response. Require both, or explicitly require one and reject the other shape.

### 5. Cross-tenant impersonation in multi-org apps (GHSA-7pq6 shape)

Reference: GHSA-7pq6-v88g-wf3w / CVE-2025-22146 (Sentry, 2025). A multi-org SaaS where each org configures its own IdP let an admin of Org A with control of Org A's IdP assert a victim user's email (belonging to Org B) and impersonate that user.

The fix: SAML authentication decisions must bind the assertion's NameID to a link record scoped to the specific org whose IdP configuration produced the signature. Looking up a user by email across the whole tenant, then checking membership afterward, is the wrong order.

```python
# bad -- email-first, then scoped
attrs = saml_response.get_attributes()
user = User.objects.get(email=attrs["email"][0])
if organization.has_member(user):
    auth.login(request, user)
```

```python
# safe -- scope-first, NameID-keyed
nameid = saml_response.get_nameid()
link = LinkedIdentity.objects.get(
    organization=request_organization,
    provider="saml",
    subject=nameid,
)
auth.login(request, link.user)
```

### 6. `InResponseTo` not validated

Not strictly a claim-trust bug, but a missing `InResponseTo` check lets an attacker replay a captured assertion at a relying party the victim hasn't visited. Flag when identity-linking code accepts any well-signed assertion without matching the request ID.

## Safe Patterns

### Django (python3-saml or djangosaml2)
```python
def saml_acs(request):
    saml_response = OneLogin_Saml2_Response(settings, request.POST["SAMLResponse"])
    if not saml_response.is_valid(request.POST, raise_exceptions=True):
        return HttpResponseForbidden()
    nameid = saml_response.get_nameid()
    nameid_format = saml_response.get_nameid_format()
    if nameid_format != "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent":
        return HttpResponseForbidden("persistent NameID required")
    try:
        link = LinkedIdentity.objects.get(
            organization=request.organization,
            provider="saml",
            subject=nameid,
        )
    except LinkedIdentity.DoesNotExist:
        return start_linking_flow(request, saml_response)
    auth.login(request, link.user)
    return redirect("/")
```

### Node (passport-saml / @node-saml/node-saml)
```ts
const strategy = new SamlStrategy(
  {
    entryPoint: ORG_IDP_SSO_URL,
    issuer: SP_ENTITY_ID,
    callbackUrl: SP_ACS_URL,
    idpCert: ORG_IDP_CERT,   // from admin-configured metadata, stored server-side
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: true,
    identifierFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent",
  },
  async (profile, done) => {
    const link = await db.linkedIdentity.findUnique({
      where: {
        orgId_provider_subject: {
          orgId: profile.attributes?.orgId,  // resolved from request context, not assertion
          provider: "saml",
          subject: profile.nameID,
        },
      },
    });
    done(null, link ? { id: link.userId } : false);
  },
);
```

## Verification Commands

```bash
# SAML library usage
rg -n '(python3-saml|djangosaml2|pysaml2|ruby-saml|omniauth-saml|passport-saml|@node-saml)' <project>
rg -n '(SAMLResponse|saml_response|parseSamlResponse|onelogin)' <project>

# Email-based lookups after a SAML callback
rg -nB 3 -A 5 'saml' <project> | rg -n 'email.*User|findUnique.*email'

# NameID Format not pinned
rg -n 'get_nameid\(' <project>
rg -n 'identifierFormat|nameid-format' <project>

# IdP cert source
rg -n '(idpCert|idp_cert|signingCert|x509cert)' <project>

# Signature check assertions
rg -n 'is_valid|wantAssertionsSigned|wantAuthnResponseSigned' <project>
```

## References

- ruby-saml CVE-2024-45409 / GHSA-jw9c-mfg7-9rx2. https://github.com/SAML-Toolkits/ruby-saml/security/advisories/GHSA-jw9c-mfg7-9rx2
- Sentry GHSA-7pq6-v88g-wf3w / CVE-2025-22146. https://github.com/getsentry/sentry/security/advisories/GHSA-7pq6-v88g-wf3w
- SAML 2.0 Core, §2.2 (NameID formats). https://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf
- OASIS SAML Security Considerations. https://docs.oasis-open.org/security/saml/v2.0/saml-sec-consider-2.0-os.pdf
