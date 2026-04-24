# JWT Verification Reference

Load when the diff touches JWT validation: `jsonwebtoken`, `jose`, `PyJWT`, `python-jose`, `ruby-jwt`, `go-jwt`, or custom JWT parsing code.

Every major JWT library has shipped a critical verification bug at some point. Most are caller-contract violations the library documentation warned about but many callers missed.

## Golden Rule: Pin the Algorithm

```ts
// Bad:
const payload = jwt.verify(token, key);

// Safe:
const payload = jwt.verify(token, key, { algorithms: ['RS256'] });
```

Every JWT verify call must pass an allowlist of algorithms. No mixing HS and RS unless the caller fully understands the implications (separate keys, separate verify paths). No `'none'`, ever.

## Known CVE Classes

### jsonwebtoken (Node)

| CVE | Version | Bug |
|-----|---------|-----|
| CVE-2022-23540 | `< 9.0.0` | `jwt.verify(token, key)` with falsy `key` and no `algorithms` allowed `alg: none` verification. |
| CVE-2022-23541 | `< 9.0.0` | RS→HS key confusion: the same code path verified public keys and HMAC secrets; attacker signs HS256 with the RSA public key as the HMAC secret. |
| CVE-2022-23539 | `< 9.0.0` | Unrestricted key type allowed legacy/non-blocklisted formats. |
| CVE-2022-23529 | `< 9.0.0` | Crash on malformed key exploited in some flows. |

Upgrade to `>= 9.0.0` and always pass `algorithms`.

### PyJWT (Python)

| CVE | Version | Bug |
|-----|---------|-----|
| CVE-2022-29217 | `< 2.4.0` | Algorithm confusion when caller doesn't pin `algorithms`; `get_default_algorithms()` accepts the token's declared algorithm. |

Always pass `algorithms=["RS256"]` (or the appropriate pinned list).

### python-jose

Historically accepted `alg: none` without explicit rejection. Project is unmaintained as of 2024.

**Recommendation**: flag its presence in a diff as a finding candidate. Suggest migration to `PyJWT` or another maintained library.

### jose (panva, Node)

Generally safer defaults than `jsonwebtoken`. Still, common misuse:

- Calling `jwtVerify(token, keyLike)` without an `algorithms` option.
- Trusting embedded `jwk` or `jku` headers. Attacker provides their own key or key URL.
- Using `importJWK` on a key from an untrusted source.

### Java ECDSA — CVE-2022-21449 ("Psychic Signatures")

Java SE accepted ECDSA signatures with `r=s=0`. Any empty signature verified for `ES256`/`ES384`/`ES512`. This affected JWT, SAML, and WebAuthn in any JVM-based service using vulnerable versions.

Detection: JVM service using ES* JWT algorithms on Java SE prior to the April 2022 patch level.

### ruby-saml — CVE-2024-45409

Signature verification flaw in ruby-saml allowed a signed assertion from any IdP to log in as anyone. Affected GitLab and many OmniAuth-SAML consumers.

Not strictly JWT, but the same family: a verification path that accepted forged credentials. Included here because SAML and JWT verification code often sit in the same file.

## Canonical Bug Shapes

### 1. `jwt.decode` without verify

```ts
const claims = jwt.decode(token);  // Never verifies the signature.
```

```python
payload = jwt.decode(token, options={"verify_signature": False})
```

`decode` is a parsing helper, not a verification step. Any use that feeds into an authz decision is a bypass.

**False-positive trap**: decoding is legitimate when the result is used for non-security purposes (logging, display). Check how `claims` is used downstream.

### 2. Missing `algorithms` parameter

```ts
jwt.verify(token, key);  // CVE-2022-23540.
```

Same shape across languages. The library may fall back to the token's `alg` header, which is attacker-controlled.

### 3. `alg: none` accepted

```python
jwt.decode(token, key, algorithms=["HS256", "RS256", "none"])
```

`"none"` in the algorithms list accepts any token. Never include it.

### 4. Mixed HS and RS algorithms

```python
jwt.decode(token, key, algorithms=["HS256", "RS256"])
```

If `key` is the RSA public key and the caller allows both, an attacker signs HS256 with the public key as the secret. The verify passes.

Pick one algorithm family per verification context. If you genuinely support both, keep separate keys and route by algorithm before verifying.

### 5. `kid` header trusted to select a key

```ts
const kid = jwt.decode(token, { complete: true }).header.kid;
const key = await fetchKeyById(kid);
const payload = jwt.verify(token, key, { algorithms: ['RS256'] });
```

The `kid` is attacker-controlled. If `fetchKeyById` performs path traversal, fetches arbitrary URLs, or looks up in an untrusted store, the attacker can pick the verification key.

Safe variants:

- Use a fixed JWKS endpoint and validate `kid` against the known key set.
- Validate `kid` against an allowlist before lookup.

### 6. Embedded `jwk` or `jku` header trusted

```ts
const payload = jwt.verify(token, (header, callback) => {
  if (header.jwk) callback(null, header.jwk);  // Attacker-supplied key.
});
```

Never trust `jwk`/`jku` headers. These are metadata; the relying party picks the key.

### 7. Missing expiration check

```python
jwt.decode(token, key, algorithms=["RS256"], options={"verify_exp": False})
```

Disabling expiration lets expired tokens (including revoked sessions) continue working. Verify `exp`, `nbf`, `iat` with their default-on behavior.

### 8. Signed-but-not-authenticated claims

```ts
const payload = jwt.verify(token, key, { algorithms: ['RS256'] });
return payload.userId;  // Trusted as "who the user is".
```

Valid JWT verification proves the token was signed by someone holding the key. It does not prove the token was issued *to* the caller. If the JWT is a long-lived "user token" with no audience binding, a leaked token works from anywhere.

Check `aud` (audience), `iss` (issuer), and for short-lived JWTs, `sub` + session binding.

### 9. Revocation assumptions

Stateless JWTs are hard to revoke. A password change, logout, or permission revocation should invalidate existing tokens. If the code emits long-lived JWTs with no revocation list and the product supports revocation (e.g., password reset invalidates sessions), there is a gap.

Options:

- Short expirations + refresh tokens with server-side state.
- A `token_version` claim compared against the user's current version on each verify.
- A denylist keyed by `jti`.

## False-Positive Traps

- **`jwt.decode` used purely for logging or telemetry.** Not a bypass; confirm the claims aren't fed into an authorization decision.
- **`algorithms` is not literal but comes from a config constant.** Verify the constant value is a safe allowlist.
- **Separate keys for HS and RS in a two-path verify.** Mixed algorithms with careful key routing can be safe. Read the full code path.

## Diff Heuristics

1. **New `jwt.verify(token, key)` call without an `algorithms` option.**
2. **New `jwt.decode(token, ...)` result used in an auth decision.**
3. **`algorithms` list containing `'none'` or mixing HS and RS.**
4. **`kid`, `jwk`, or `jku` read from the token header and used to select a key.**
5. **`verify_exp: false` or equivalent disabling of standard claim checks.**
6. **New use of `python-jose` (unmaintained).**
7. **Downgrade of `jsonwebtoken` to a version `< 9.0.0`.**
8. **Long-lived JWT emission with no revocation path** and a product requirement that implies revocation (password reset, permission change).

## Verification Commands

```bash
# JWT library usage
rg -n 'jwt\.(verify|decode|sign)\(' <project>
rg -n 'import (jwt|jose|PyJWT)' <project>

# Algorithm configuration
rg -n "algorithms\s*[:=]" <project>

# Header-derived keys
rg -n '(jwk|jku|kid)' <project>

# Claim verification flags
rg -n 'verify_exp|verify_signature|verify_aud|verify_iss' <project>

# Dependency versions
jq '.dependencies | to_entries[] | select(.key | test("jsonwebtoken|jose"))' <project>/package.json
grep -E 'PyJWT|python-jose|jose' <project>/requirements.txt <project>/pyproject.toml 2>/dev/null
```
