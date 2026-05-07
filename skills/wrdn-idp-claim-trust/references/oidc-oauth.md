# OIDC / OAuth Claim Trust Reference

Load when the diff touches OIDC ID-token verification, OAuth userinfo parsing, or identity-linking code using `authlib`, `openid-client`, `oauth2-proxy`, `passport-*` OIDC strategies, `google-auth`, `msal`, or custom verify code.

This reference covers **claim trust for identity linking**. It does not cover `state`/`nonce`/PKCE (session-fixation territory) or JWT signature bypass (see `wrdn-access-control`'s `jwt.md`). The concern here is: given a verified ID-token, which claims can a relying party trust for *which* decision?

## Stable-Subject vs. Email

The one rule that matters:

```
identity lookup key for linking and login == (iss, sub)
NOT email, NOT email_verified, NOT preferred_username
```

`sub` is issuer-scoped and immutable per the OIDC spec. A relying party that remembers `(iss, sub)` from a confirmed first link can re-identify the same user on every future login without trusting any mutable claim. Email and other human-readable claims are routinely re-assigned by the IdP's own admins (tenant reorganization, user rename, tenant deletion and reuse) and can be forged outright by a rogue IdP.

Microsoft Entra's claims-validation docs are explicit: *"Never use claims like `email`, `preferred_username`, or `unique_name` to store or determine whether the user in an access token should have access to data."* The guidance applies to every OIDC provider, not just Entra.

## nOAuth: The Reference Class

nOAuth (Descope, 2023) is the canonical public disclosure of this bug class. Azure AD tenants allow an administrator to set any string as a user's `email` attribute, unverified, mutable. A multi-tenant SaaS app that "signs in with Microsoft" and links user accounts by `email` grants any attacker who controls any Azure tenant the ability to set their own email to `victim@company.com`, sign in, and take over the victim's account on the SaaS.

The fix is not to reject nOAuth-style IdPs. The fix is to link by `(iss, sub)` and require a session-authenticated confirmation before binding an IdP identity to an existing local account.

## Which Claims Are Cryptographically Bound?

For an OIDC ID-token verified against the IdP's published JWKS:

| Claim | Bound by the signature? | Trust for identity linking |
|-------|-------------------------|----------------------------|
| `iss` | Yes | Stable-subject anchor (paired with `sub`). Pin to expected issuer. |
| `sub` | Yes | Stable-subject anchor. Immutable per issuer. |
| `aud` | Yes | Must match your client_id. Unrelated to identity linking but must be checked. |
| `email` | Yes, but the *value* is IdP-admin-controlled, mutable, and may be unverified | Advisory only. Never sole authority for linking. |
| `email_verified` | Yes, but the *semantics* depend on the IdP | Advisory. See per-provider table below. |
| `preferred_username` | Yes | Do not use for linking. Often equals email; same trust as email. |
| `hd` (Google) | Yes | Useful as a tenant allowlist for Google Workspace. Not a link key. |
| `tid` (Microsoft) | Yes | Tenant identifier. Combine with `sub` for a stable intra-tenant key. |
| `upn` (Microsoft) | Yes | Same trust level as email. |

"Bound by the signature" means the relying party can prove the IdP sent this value. It does not mean the value is accurate. An attacker-controlled IdP signs whatever it wants.

## Per-Provider `email_verified` Semantics

| Provider | `email_verified` source | Safe to trust for confirmation UI pre-fill? |
|----------|-------------------------|------------------------------------|
| Google consumer (Gmail) | OIDC ID-token; Google cryptographically binds this for accounts it operates | Yes |
| Google Workspace | ID-token, but the email is tenant-admin-controlled | Mostly yes; combine with `hd` check |
| Microsoft Entra (v2 `common`/`organizations`) | `xms_edov` extension if present; `email` itself is unverified and mutable | **No.** Trust only the `xms_edov` / `verified_primary_email` extension, not the `email` claim. This is nOAuth. |
| Okta | ID-token | Yes (Okta verifies at enrollment) |
| Auth0 | ID-token | Yes, but see Auth0's own guidance: do not auto-link by verified email |
| Apple | ID-token `email_verified` | Yes; may be a private relay address |
| GitHub (non-OIDC OAuth) | No `email_verified` claim on the OAuth profile. Use `/user/emails` and filter `primary=true, verified=true` | Requires the extra API call |
| Self-hosted Keycloak / Dex / generic OIDC | Depends entirely on deployment config | Do not assume; document the requirement |

## Bug Shapes

### 1. Log-in by email

```python
# bad
def oauth_callback(request):
    claims = verify_id_token(request.GET["id_token"])
    user = User.objects.get(email=claims["email"])
    auth.login(request, user)
```

```ts
// bad
app.get("/oauth/callback", async (req, res) => {
  const claims = await verifyIdToken(req.query.id_token as string);
  const user = await db.user.findUnique({ where: { email: claims.email } });
  req.session.userId = user!.id;
  res.redirect("/");
});
```

Safe equivalents key off `(iss, sub)` against a confirmed link row.

### 2. `authlib` OIDC without `nonce`/`at_hash` check

Authlib's `parse_id_token` validates standard claims, but callers that use `client.parse_id_token(token, nonce=None)` disable the nonce binding. For identity *linking* this is usually a session-fixation concern, not a claim-trust concern. Only flag if the downstream code then links by email. The missing nonce lets an attacker replay a leaked ID-token.

### 3. `openid-client` `tokenSet.claims()` fed to email-based resolver

```ts
// bad
const tokenSet = await client.callback(redirectUri, params, { nonce });
const claims = tokenSet.claims();
const user = await db.user.findUnique({ where: { email: claims.email as string } });
```

Same shape. The library verified the signature; the code then dropped back to email for identity resolution.

### 4. Manual JWKS / bare JWT verify

```python
# bad -- even if signature verifies, email linking is the flaw
payload = jwt.decode(id_token, key, algorithms=["RS256"], audience=CLIENT_ID)
user = User.objects.get(email=payload["email"])
```

Signature verification does not imply claim trust for linking.

### 5. Userinfo endpoint trusted as identity oracle

```ts
// bad
const userinfo = await fetch(`${issuer}/userinfo`, { headers: { authorization: `Bearer ${access_token}` } }).then(r => r.json());
await db.user.upsert({ where: { email: userinfo.email }, update: {}, create: { email: userinfo.email } });
```

Userinfo is just a longer path to the same trust decision. The authoritative key is still `(iss, sub)`, not the email returned.

### 6. Missing `iss` pin

```python
payload = jwt.decode(id_token, key, algorithms=["RS256"])
# No `issuer=` argument. Any IdP whose JWKS is reachable can impersonate.
```

Multi-provider apps especially: `iss` must be pinned per provider config or a malicious IdP's token passes verify against its own JWKS.

### 7. `azp` / `aud` confusion in multi-client apps

When one `aud` is expected but the token has a different `azp`, some libraries accept the token. Pin both for privileged writes.

## Safe Patterns

### A. Login path
```python
def oauth_callback(request):
    claims = verify_id_token(
        request.GET["id_token"],
        issuer=EXPECTED_ISS, audience=CLIENT_ID,
    )
    link = LinkedIdentity.objects.filter(
        issuer=claims["iss"], subject=claims["sub"],
    ).first()
    if link is None:
        return start_linking_flow(request, claims)
    auth.login(request, link.user)
    return redirect("/")
```

### B. First-time linking path
```python
def start_linking_flow(request, claims):
    if not request.user.is_authenticated:
        return redirect_to_login(next=request.get_full_path())
    return render_confirm_link(request, claims)  # POST re-resolves from request.user

def confirm_link(request, claims):
    LinkedIdentity.objects.create(
        user=request.user,
        issuer=claims["iss"], subject=claims["sub"],
        email=claims.get("email"),   # stored for display only
    )
```

### C. TypeScript equivalent
```ts
const claims = await verifyIdToken(idToken, { issuer: EXPECTED_ISS, audience: CLIENT_ID });
const link = await db.linkedIdentity.findUnique({
  where: { issuer_subject: { issuer: claims.iss, subject: claims.sub } },
});
if (link) return loginAs(req, link.userId);
if (!req.session.userId) return redirect("/login?next=" + encodeURIComponent(req.originalUrl));
await db.linkedIdentity.create({
  data: { userId: req.session.userId, issuer: claims.iss, subject: claims.sub },
});
```

## Verification Commands

```bash
# OIDC library usage
rg -n '(parse_id_token|verify_id_token|jwtVerify|verifyIdToken)\(' <project>
rg -n '(openid-client|authlib|google-auth|msal|passport-openidconnect)' <project>

# Email-based identity resolution in OAuth callbacks
rg -nB 2 -A 5 'oauth|oidc|callback|id_token' <project> | rg -n 'email=|where.*email'

# Missing iss pin
rg -n 'jwt\.decode\(.*algorithms' <project> | rg -v 'issuer|iss='

# Entra / Azure AD -- check for email-based linking in multi-tenant apps
rg -nB 2 -A 5 'common|organizations' <project> | rg -n 'email'
```

## References

- Descope, "nOAuth". https://www.descope.com/blog/post/noauth
- Microsoft, Entra claims validation. https://learn.microsoft.com/en-us/entra/identity-platform/claims-validation
- Auth0, Verified email usage. https://auth0.com/docs/manage-users/user-accounts/user-profiles/verified-email-usage
- RFC 6819 §4.4.1.13 (Code Substitution / OAuth Login). https://datatracker.ietf.org/doc/html/rfc6819#section-4.4.1.13
- OpenID Connect Core 1.0, §5.7 (Claim Stability and Uniqueness). https://openid.net/specs/openid-connect-core-1_0.html#ClaimStability
