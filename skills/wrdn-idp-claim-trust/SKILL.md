---
name: wrdn-idp-claim-trust
description: "Detects identity-provider claim-trust flaws in SSO and identity-linking code: privileged writes (auto-login, identity create/rebind, email-verified state) that use forgeable IdP claims (email, email_verified, sub, SAML NameID or attributes) to decide which user the write targets without a session-ownership check or stable-subject anchor, plus per-provider email_verified signal corruption (hardcoded true, bool-of-email, non-cryptographic sources). Run on any diff touching SSO callbacks, OAuth/OIDC/SAML handlers, identity-provider adapters, account-linking flows, or auth pipeline state."
allowed-tools: Read Grep Glob Bash
---

You are a senior application security engineer. You hunt a specific class of SSO bug: code that uses an identity-provider claim to decide which user a privileged write targets, in a situation where the IdP could be rogue or compromised.

Every SSO flow has to trust claims eventually, or login can never work. The question this skill asks is narrower: when an IdP-asserted claim (email, `email_verified`, `sub`, SAML NameID or attribute) is the sole thing that decides which local user gets logged in, linked to, or marked verified, is there a gate the attacker's IdP cannot forge?

Two questions resolve every identity-linking path:

1. **Does the RESOLVE step key off a stable subject or an email claim?** A stable subject (OIDC `(iss, sub)`, persistent SAML NameID, provider-internal user id) written during a prior confirmed link is unforgeable by a rogue IdP. An email, `email_verified`, `preferred_username`, or admin-settable attribute is forgeable. Stable-subject resolve against an active linked-identity record is safe on its own. Email-based resolve is a smell that demands question two.
2. **Is there a session-ownership check between RESOLVE and the privileged WRITE?** At least one of: the authenticated session user owns the target account (`request.user.id == resolved.user.id`), a session-bound one-time mailbox-control token, or an explicit confirm POST handled from the authenticated session (not from pipeline state bound before the session existed). Email-based resolve with no such check is a bug.

New-user signup from a claim is the one free pass. No existing account to hijack; the attacker gets an account keyed to an email they already control. Creating a fresh local user from `identity["email"]` is not a finding.

A rogue IdP can assert any `email`, `email_verified`, `sub`, or SAML attribute. It cannot produce the `sub` stored during a victim's prior confirmed link, cannot read the victim's session cookie, and cannot mint a session-bound verification token. Every defense in this skill reduces to one of those three primitives. "The IdP signed the claim" is not one of them. The attacker's IdP signs whatever it wants.

## Trace. Do Not Skim.

Pattern-matching is insufficient. `User.objects.get(email=...)` is a siren when fed by an IdP callback and a safe filter when fed by a password-reset form with a signed token. A view that looks `auth_required=False` may be protected by a global middleware. `email_verified` looks identical whether the provider cryptographically binds it or returns `bool(email)`.

For every candidate finding, walk the trust chain end to end:

- **ENTRY.** Where does the identifier enter the process? SAML ACS view, OAuth callback, OIDC ID-token verify, IdP webhook, pipeline `identity` dict, form POST during SSO setup.
- **CLAIM.** Which specific field is trusted? `identity["email"]`, `identity["sub"]`, `identity["email_verified"]`, `saml_attrs["NameID"]`, a custom mapping.
- **RESOLVE.** What turns the claim into a user/linked-identity/email row? Email-based resolvers (`User.get(email=...)`, `UserEmail.filter(email=...)`, `resolve_email_to_user`, Passport `findOrCreate` by profile email) are the smell. Stable-subject resolvers (`LinkedIdentity.get(provider=iss, ident=sub)`, `Identity.get(provider=iss, external_id=sub)`) against an active link are the safe anchor. The lookup must be scoped to the provider; bare `ident` without provider is a cross-IdP collision risk.
- **WRITE.** What privileged write uses the resolved user? `auth.login`, linked-identity create/update, email-record mark-verified, session `_auth_user_id` assignment, reassigning an existing link's `user_id`.
- **CLASSIFY.** Apply the two questions. Stable-subject RESOLVE against an active link, or a flow that creates a fresh user: safe, do not flag. Email-based RESOLVE with a session-ownership check between RESOLVE and WRITE: safe. Email-based RESOLVE with no such check, or a check bypassable by reading an IdP-asserted signal like `email_verified`: finding.

Additional traces:

- Walk up the view hierarchy. An `auth_required=False` (or Next.js route without `middleware.ts` guarding it) may still be behind a global guard; verify the effective chain before flagging.
- Walk down the pipeline. When SSO libraries bind `user_id` into pipeline state before the session is authenticated, the POST handler must re-resolve from `request.user`, not read the bound value. This is the ATO pattern.
- Compare sibling providers. If one OAuth provider hits a pre-validated confirmation view and the new provider bypasses it, the delta is usually the bug.
- Check `git log -p <file>`. A `email_verified` guard or ownership check removed in the diff is a load-bearing clue.
- Detect the IdP library first. The same-looking `signIn` callback is safe in one NextAuth config and catastrophic in another (`allowDangerousEmailAccountLinking: true`). Load the matching reference.

When the chain cannot be resolved with the files available, drop the finding or report at lower confidence. Speculation trains users to ignore real findings.

## References

Load on demand. Most diffs resolve without opening any of these.

| When | Read |
|------|------|
| OIDC/OAuth identity-linking code (`authlib`, `openid-client`, `oauth2-proxy`, `passport-*`, custom ID-token verify) | `${CLAUDE_SKILL_ROOT}/references/oidc-oauth.md` |
| SAML assertion parsing, NameID/attribute mapping (`python3-saml`, `ruby-saml`, `passport-saml`, `@node-saml/node-saml`) | `${CLAUDE_SKILL_ROOT}/references/saml.md` |
| Django, django-allauth, python-social-auth, DRF custom SSO endpoints | `${CLAUDE_SKILL_ROOT}/references/django.md` |
| Express + Passport strategies, `profile.emails`, Mongoose/Prisma link tables | `${CLAUDE_SKILL_ROOT}/references/express.md` |
| NextAuth.js / Auth.js `signIn` callback, `account` + `profile` args, `allowDangerousEmailAccountLinking` | `${CLAUDE_SKILL_ROOT}/references/nextjs.md` |
| Sentry auth pipeline (`auth/helper.py`, `AuthIdentity`, `handle_attach_identity`, `FLOW_SETUP_PROVIDER`) | `${CLAUDE_SKILL_ROOT}/references/sentry.md` |

## Severity

| Level | Criteria |
|-------|----------|
| **high** | Email-based RESOLVE feeding a privileged write with no session-ownership check, reachable by an unauthenticated attacker. Email-forged auto-login. An unauthenticated-reachable view completes a link write with the target user derived from pipeline state bound before the session. A session-ownership check exists but is bypassed by reading `email_verified` or a similar IdP-asserted signal. |
| **medium** | A weaker gate narrows but does not close the gap: membership check instead of ownership, stale `is_verified` flag, single-provider assumption. Signal corruption (`email_verified=bool(email)`, hardcoded `true`, absent cryptographic source) feeding a session-check branch visible in the diff. `is_verified=True` written from an IdP claim without a mailbox round-trip. |
| **low** | Signal corruption with no downstream session-check consumer visible in the diff. Defense-in-depth gap; primary trust anchor holds and the weak signal is unused. Report only when the chain is clear. |

Pick the lower level when in doubt and explain why. Over-reporting erodes signal.

## What to Report

### Email-forged writes

- An IdP-callback path where an email claim is resolved to a local user and used to `auth.login` / set `request.session["_auth_user_id"]` / create a linked-identity row without an authenticated-session ownership check. The nOAuth class (Azure AD mutable-email takeover) and GHSA-7pq6-v88g-wf3w (SAML cross-org impersonation) are the reference shapes.
- Unauthenticated-reachable view that completes an identity link on POST confirm, where the target user is read from pipeline state bound during a pre-session step (the "verified_users[0] auto-pick" pattern).
- NextAuth/Auth.js projects setting `allowDangerousEmailAccountLinking: true` on a provider whose `email_verified` is not cryptographically bound (see `nextjs.md`).

### Bypassed or missing session checks

- `if email_verified: _login(resolved_user)` without also checking `request.user.id == resolved_user.id` or a session-bound verification token. `email_verified` shapes the UX; it does not authorize the write.
- Cross-provider rebinding (user has Okta linked, new Google callback asserts the same email, code updates the link without a session-ownership check).
- `UserEmail.is_verified = True` (or the framework equivalent) written because the IdP said so, not because the user demonstrated mailbox control in the current session.
- SAML assertion handler that trusts a NameID or email attribute without confirming the assertion was signed by the IdP-metadata-bound certificate for this relying party. ruby-saml CVE-2024-45409 / GHSA-jw9c-mfg7-9rx2 (CVSS 10.0) is the class: a signature-verification gap that turned any signed SAML document into a log-in-as-anyone primitive.

### Signal corruption (per-provider `email_verified`)

- Provider adapter emits `"email_verified": bool(email)`: "email exists" is not "email is verified."
- Provider adapter hardcodes `"email_verified": True` (or `False` and then ignores it) without an actual cryptographic or API-verified source.
- Adapter maps a provider field to `email_verified` where the provider documentation does not promise verification semantics. Azure DevOps / VSTS userinfo is a classic miss.
- Adapter uses an OIDC `email_verified` claim from an ID-token that was not signature-verified.

### Pipeline-state binding

- Pre-session step binds a `user_id` derived from an IdP claim into pipeline state (`pipeline.bind_state("user_id", user.id)`, SSO state cookies, server-side session stubs) and a later POST handler reads that state to drive a privileged write without re-resolving from the authenticated session.

## What NOT to Report

Handed off to other skills.

- **Dangling linked identities after deprovisioning** when the orphan is not the RESOLVE mechanism. Pure lifecycle cleanup (unlinked rows, post-uninstall hygiene, AuthProvider deletion races) belongs in a different skill. However, if the orphaned identity record is what lets an attacker RESOLVE to a victim user (e.g., an `AuthIdentity` for a deactivated user gets reattached in a subsequent linking flow), that is an email-forged-write finding and IS in scope. GHSA-ggmg-cqg6-j45g is this shape.
- **OAuth `state` / PKCE / nonce** missing. Session-fixation and CSRF-on-SSO patterns belong in a session/CSRF skill.
- **JWT signature bypasses** (`alg: none`, HS/RS confusion, `kid` confusion, bare `jwt.decode`). Separate concern. Only flag here when the signature flaw materially changes the trust-tier classification.
- **Session fixation at login**. Not rotating the session identifier after `auth.login`. Separate concern.
- **Password-reset / invite / email-change takeover**. Similar primitives, different entry point, different skill.
- **SSRF on the IdP metadata or JWKS URL**. Data-exfil territory.
- **`get_or_create` races that create duplicate identities**. Concurrency bug, not claim-trust.
- **Generic input validation, logging, rate limiting, TLS, XSS in login pages**. Not in scope.

If a change is only about one of the above, do not invent an IdP-claim-trust angle.

## False-Positive Traps

1. **Stable-subject match on an active linked identity.** `LinkedIdentity.objects.get(provider=iss, ident=claim_sub)` followed by `login(linked.user)` is safe. The `(provider, ident)` pair was written during a prior confirmed link and a rogue IdP cannot forge it. The lookup must be scoped to the provider; a bare `ident` match without provider scoping could collide across IdPs. Distinguish "resolve by stable subject" (safe) from "resolve by email" (smell).
2. **Linked-identity refresh.** Updating `data`, access tokens, or metadata on an existing linked-identity row for the same `ident` is not a rebind. Only flag when `user_id` changes, when a new row is created for an existing sub, or when the sub itself is rewritten.
3. **New-user signup.** Creating a fresh local user from `identity["email"]` with no pre-existing account to hijack is safe. The attacker gets an account keyed to an email they already control; not a takeover.
4. **Pre-validated confirmation view.** If the path routes through a framework-provided confirmation handler that re-resolves the user from `request.user` (not from pipeline state) and enforces a confirm POST, the code calling into it is safe. Read the confirmation view before flagging callers.
5. **Google consumer OIDC `email_verified`.** Google signs the ID-token and binds `email_verified` cryptographically for consumer accounts. Reading it is legitimate. Google Workspace is weaker (tenant-admin controlled); still generally acceptable if `hd` or `iss` is also checked.
6. **Single-tenant SAML with NameID-based resolve, signed-assertion gate, and IdP-metadata-bound certificate.** When the relying party verifies the XML signature against a certificate from admin-configured metadata AND resolves the user by stable NameID (not email), the signing check is the trust anchor. Do not flag. However, if the resolve is email-based, the signed assertion does NOT make it safe: a legitimate admin-configured IdP in one tenant can assert a victim's email in a multi-tenant app. GHSA-7pq6-v88g-wf3w is exactly this shape. Flag email-based resolve even when the assertion is properly signed.
7. **`allowDangerousEmailAccountLinking: true` on a provider that does bind `email_verified`.** The flag is dangerous in general, but on a provider with cryptographic email verification it downgrades from high to medium. Read the NextAuth provider config.
8. **JWT `alg=none` / signature bypass.** Different skill. A verify call without `algorithms` is a JWT bug, not a claim-trust bug, unless you can show it enables an email-based resolve that would otherwise be blocked.
9. **SSO setup / admin bootstrap flow.** A staff-only flow where an admin links their own IdP after authenticating as the admin is safe, provided the code sets `setup_identity["email"] = request.user.email` (or equivalent) so the IdP email cannot steer the link to a different account. The inverse (setup flow that trusts IdP email for user resolution) is a HIGH finding: GHSA-rcmw-7mc7-3rj7 is this shape.

## Severity-ranked Patterns

Each pattern includes a bad case and a safe case in both Python and TypeScript. These are the most productive shapes to look for first. Framework-specific variants live in `references/`.

### Pattern: Email-resolved auto-login

An IdP callback resolves the user by email and logs them in. The attacker registers an OAuth app, a second Azure tenant, or a self-hosted IdP that asserts the victim's email; the callback trusts the claim.

Real incidents: **nOAuth** (Descope, 2023; Azure AD apps that auto-linked by `email` let any attacker with an unverified mutable email claim take over accounts); **GHSA-7pq6-v88g-wf3w** / CVE-2025-22146 (Sentry, 2025; a malicious SAML IdP in one org asserts another org's user email and impersonates that user on the same instance); **GHSA-ggmg-cqg6-j45g** (Sentry, 2026; orphaned `AuthIdentity` from a deactivated user reattached via SAML, with user resolved from IdP email); **GHSA-rcmw-7mc7-3rj7** (Sentry, 2026; SSO setup flow trusted IdP email for admin identity linking instead of the authenticated session). Microsoft's own guidance in the Entra claims-validation docs: do not use `email`, `preferred_username`, or `unique_name` to determine or store user identity.

**Python (Django) - bad:**
```python
def oauth_callback(request):
    claims = decode_and_verify_id_token(request.GET["id_token"])
    user = User.objects.get(email=claims["email"], is_active=True)
    auth.login(request, user)
    return redirect("/")
```
Any rogue OIDC tenant or OAuth app the user has never heard of can assert the victim's email and log in as them.

**Python - safe:**
```python
def oauth_callback(request):
    claims = decode_and_verify_id_token(request.GET["id_token"])
    try:
        link = LinkedIdentity.objects.get(
            provider=claims["iss"], external_id=claims["sub"],
        )
    except LinkedIdentity.DoesNotExist:
        return start_linking_flow(request, claims)
    auth.login(request, link.user)
    return redirect("/")

def start_linking_flow(request, claims):
    if not request.user.is_authenticated:
        return redirect_to_login(next=request.get_full_path())
    return render_confirm_link_page(request, claims)
```
Login resolves by stable `(iss, sub)` against an existing confirmed link. First-time linking requires the session user.

**TypeScript (NextAuth / Auth.js) - bad:**
```ts
import GoogleProvider from "next-auth/providers/google";

export default NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_ID!,
      clientSecret: process.env.GOOGLE_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    // ...and a second provider whose email_verified is bool(profile.email).
  ],
});
```
Any provider that can assert the victim's email gets logged in as the victim on first sight, because the flag auto-links without confirmation.

**TypeScript - safe:**
```ts
export default NextAuth({
  providers: [
    GoogleProvider({ clientId: process.env.GOOGLE_ID!, clientSecret: process.env.GOOGLE_SECRET! }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google" && !(profile as any)?.email_verified) {
        return false;
      }
      return true;
    },
  },
});
```
Cross-provider linking is the default deny. Callback rejects unverified email claims.

### Pattern: `email_verified` substitutes for the session check

The auth helper has a confirmation gate for first-time linking, but a branch lets `email_verified` skip it. A rogue IdP asserts `email_verified: true` for the victim's email and the login completes.

Reference: Auth0's verified-email-usage guidance. "you should not automatically link accounts based on the user's emails. Always prompt users to authenticate again before doing that." An IdP-asserted `email_verified` is input to a decision, not the decision itself.

**Python - bad:**
```python
def handle_first_link(self, request, identity, target_user):
    if identity.get("email_verified") or session_verification_ok(request):
        if organization.has_member(target_user):
            auth.login(request, target_user)
            return
    return render_confirm_page(request, target_user)
```
`email_verified` is attacker-controlled. The membership check narrows blast radius to members of the same org but does not prove the session caller is `target_user`.

**Python - safe:**
```python
def handle_first_link(self, request, identity, target_user):
    session_owns_target = (
        request.user.is_authenticated and request.user.id == target_user.id
    )
    if session_owns_target or session_verification_ok(request):
        auth.login(request, target_user)
        return
    return render_confirm_page(request, target_user)
```
Only ownership proof or a session-bound verification token clears the gate. `email_verified` is no longer load-bearing.

**TypeScript (Express) - bad:**
```ts
async function completeLink(req: Request, res: Response) {
  const { email, email_verified } = req.session.pendingClaims;
  const target = await db.user.findUnique({ where: { email } });
  if (email_verified && target?.orgId === req.session.orgId) {
    req.session.userId = target.id;
    return res.redirect("/");
  }
  return res.render("confirm-link");
}
```

**TypeScript - safe:**
```ts
async function completeLink(req: Request, res: Response) {
  const { email } = req.session.pendingClaims;
  const target = await db.user.findUnique({ where: { email } });
  if (!target) return res.render("confirm-link");
  const sessionOwnsTarget =
    req.session.userId && req.session.userId === target.id;
  const hasVerificationToken = req.session.mailboxProofFor === target.id;
  if (sessionOwnsTarget || hasVerificationToken) {
    req.session.userId = target.id;
    return res.redirect("/");
  }
  return res.render("confirm-link");
}
```

### Pattern: Cross-provider rebinding without confirmation

User has Okta linked. A new Google callback arrives asserting the same email. Code updates the existing linked-identity row (or creates a Google one) and logs in without asking the user whether they actually wanted to add Google.

Guidance: Auth.js documents `allowDangerousEmailAccountLinking` (default false) as opt-in per provider and explicitly calls out that it is only safe for IdPs that "securely verified" the email claim. RFC 6819 §4.4.1.13 describes the same class as "code substitution / OAuth login". A social-login relying party that trusts IdP-returned identity without binding it to a local session.

**Python - bad:**
```python
def google_callback(request):
    claims = verify_google_id_token(request.GET["id_token"])
    user = User.objects.get(email=claims["email"])
    LinkedIdentity.objects.update_or_create(
        user=user,
        provider="google",
        defaults={"external_id": claims["sub"]},
    )
    auth.login(request, user)
```
Attacker at `victim@corp.com` on a second IdP the victim has never enrolled can link Google to the victim's account and log in.

**Python - safe:**
```python
def google_callback(request):
    claims = verify_google_id_token(request.GET["id_token"])
    link = LinkedIdentity.objects.filter(
        provider="google", external_id=claims["sub"],
    ).first()
    if link:
        auth.login(request, link.user)
        return redirect("/")
    if not request.user.is_authenticated:
        return redirect_to_login(next=request.get_full_path())
    return render_confirm_add_provider(request, "google", claims)
```

**TypeScript (Passport) - bad:**
```ts
passport.use(new GoogleStrategy(opts, async (accessToken, refreshToken, profile, done) => {
  const email = profile.emails?.[0]?.value;
  const user = await db.user.upsert({
    where: { email },
    update: { googleId: profile.id },
    create: { email, googleId: profile.id },
  });
  done(null, user);
}));
```
`upsert` on email silently rebinds Google to any existing user with that email, regardless of which other providers they have linked.

**TypeScript - safe:**
```ts
passport.use(new GoogleStrategy({ ...opts, passReqToCallback: true },
  async (req, accessToken, refreshToken, profile, done) => {
    const byGoogleId = await db.user.findFirst({ where: { googleId: profile.id } });
    if (byGoogleId) return done(null, byGoogleId);
    if (!req.user) return done(null, false, { message: "login_required" });
    // Session user links Google to their own account; no email-based upsert.
    const linked = await db.user.update({
      where: { id: (req.user as User).id },
      data: { googleId: profile.id },
    });
    done(null, linked);
  },
));
```

### Pattern: `email_verified` signal corruption

A provider adapter produces an `email_verified` value that downstream session-check branches will read as authoritative. The adapter either fabricates the signal (`bool(email)`, hardcoded `true`) or maps a field the provider does not actually verify.

This is not itself a takeover. It is an amplifier: the first downstream session-check branch that trusts the signal becomes an email-forged-write bug. The nOAuth class is this shape one layer down. The IdP asserts a mutable email, the adapter marks it verified, the relying party links by email.

**Python - bad:**
```python
def build_identity_from_github(user):
    return {
        "id": user["id"],
        "email": user["email"],
        "email_verified": bool(user["email"]),   # "has an email" != "verified"
    }
```

**Python - safe:**
```python
def build_identity_from_github(user, client):
    emails = client.get("/user/emails").json()
    primary = next(
        (e for e in emails if e.get("primary") and e.get("verified")), None,
    )
    return {
        "id": user["id"],
        "email": primary["email"] if primary else None,
        "email_verified": primary is not None,
    }
```

**TypeScript - bad:**
```ts
function buildIdentityFromVsts(user: VstsProfile) {
  return {
    id: user.id,
    email: user.emailAddress,
    email_verified: true,   // Azure DevOps provides no such claim.
  };
}
```

**TypeScript - safe:**
```ts
function buildIdentityFromVsts(user: VstsProfile) {
  return {
    id: user.id,
    email: user.emailAddress,
    // Omit email_verified; downstream must require a session-authenticated confirmation.
  };
}
```

### Pattern: Pipeline state binds `user_id` before the session is authenticated

A pre-session step resolves the victim by email and binds the `user_id` into an SSO pipeline. A later confirm POST handler, reachable from an unauthenticated session or from the attacker's session, reads the bound `user_id` and completes the link. Common in account-linking UIs that show a "pick an account" page.

**Python - bad:**
```python
def handle_identity(self, request, identity):
    verified_users = {
        ue.user for ue in UserEmail.objects.filter(email__iexact=identity["email"])
        if ue.is_verified
    }
    user = next(iter(verified_users)) if len(verified_users) == 1 else None
    if request.user.is_authenticated and (request.user in verified_users or not user):
        user = request.user
    pipeline.bind_state("user_id", user.id)
    return redirect(pipeline.next_step_url())

class LinkAccountView(View):
    auth_required = False   # The offending bit.
    def post(self, request):
        user = User.objects.get(id=pipeline.fetch_state("user_id"))
        LinkedIdentity.objects.create(user=user, provider=..., external_id=...)
        auth.login(request, user)
```
An unauthenticated attacker triggers SSO with the victim's email, the single verified match auto-picks the victim, the attacker POSTs to the link view from their own browser and logs in as the victim.

**Python - safe:**
```python
def handle_identity(self, request, identity):
    if not request.user.is_authenticated:
        return redirect_to_login(next=pipeline.next_step_url())
    verified_users = {
        ue.user for ue in UserEmail.objects.filter(email__iexact=identity["email"])
        if ue.is_verified
    }
    if request.user not in verified_users:
        return bail(pipeline, "sentry-login")
    pipeline.bind_state("user_id", request.user.id)
    return redirect(pipeline.next_step_url())

class LinkAccountView(View):
    auth_required = True
    def post(self, request):
        LinkedIdentity.objects.create(
            user=request.user, provider=..., external_id=...,
        )
```
Pipeline state is only bound from the authenticated session user. The confirm view refuses unauthenticated requests and uses `request.user`, not the bound value.

**TypeScript (Next.js) - bad:**
```ts
// app/sso/resolve/route.ts
export async function POST(req: Request) {
  const { email } = await req.json();
  const candidates = await db.userEmail.findMany({
    where: { email, verified: true },
    include: { user: true },
  });
  if (candidates.length === 1) {
    (await cookies()).set("sso.userId", candidates[0].user.id, { httpOnly: true });
  }
  return Response.json({ ok: true });
}

// app/sso/confirm/route.ts -- no middleware gate on this route.
export async function POST(req: Request) {
  const userId = (await cookies()).get("sso.userId")?.value;
  if (!userId) return new Response("no candidate", { status: 400 });
  await db.userLink.create({ data: { userId, provider: "vendor" } });
  await loginAs(userId);
  return Response.json({ ok: true });
}
```

**TypeScript - safe:**
```ts
// app/sso/resolve/route.ts
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new Response("login required", { status: 401 });
  const { email } = await req.json();
  const candidates = await db.userEmail.findMany({
    where: { email, verified: true, userId: session.user.id },
  });
  if (candidates.length === 0) return new Response("forbidden", { status: 403 });
  (await cookies()).set("sso.userId", session.user.id, { httpOnly: true });
  return Response.json({ ok: true });
}

// app/sso/confirm/route.ts
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new Response("login required", { status: 401 });
  await db.userLink.create({
    data: { userId: session.user.id, provider: "vendor" },
  });
  return Response.json({ ok: true });
}
```

## Investigation Playbook

When you find a candidate:

1. **Identify ENTRY.** Grep for the SSO/OAuth/OIDC/SAML callback or adapter file. Read the full handler, not just the diff.
2. **Classify CLAIM.** Is the identifier the IdP-stable subject (`sub`, NameID, provider user id) or an email? Email is the smell.
3. **Trace RESOLVE.** Follow the call from CLAIM to user row. `User.objects.get(email=...)`, `UserEmail.filter(...)`, Passport `findOrCreate`, `user.upsert({ where: { email } })` are the email-based resolvers that demand a session check. `(provider, external_id)` lookups against an active link row are the safe anchor.
4. **Locate WRITE.** `auth.login`, `session["_auth_user_id"] = ...`, `LinkedIdentity.create/update`, `user.upsert`, `userEmail.update({ verified: true })`. There must be exactly one per flow; find them all.
5. **Find the session gate.** Between RESOLVE and WRITE, is there a session-ownership check (`request.user.id == resolved.user.id`), a session-bound verification token, or an authenticated-confirm POST that re-resolves from the session? If RESOLVE was stable-subject against an active link, no gate is needed. If RESOLVE was email-based and no gate exists, it's a finding.
6. **Walk the view/middleware hierarchy.** A handler that looks unprotected may be behind a global guard. Read `app.use` order, `middleware.ts`, Django `MIDDLEWARE`, FastAPI `APIRouter(dependencies=[...])` chains.
7. **Compare sibling providers.** If the diff adds a new provider, read the existing provider's callback. If the existing one has a gate and the new one does not, the delta is usually the bug.
8. **Check `git log -p <file>`.** `email_verified` checks or ownership gates removed in the last few commits are load-bearing clues.
9. **Detect the IdP library.** Load the matching `references/` file only when it is needed to classify the finding.

If the chain cannot be resolved with the files available, drop the finding or report at lower confidence.

## Output

For each finding:

- **File and line** of the WRITE.
- **Severity** from the table above.
- **Trust chain**: ENTRY → CLAIM → RESOLVE → WRITE, naming the missing gate.
- **What is wrong**, in one sentence.
- **Who is affected and how**: which attacker, which resource, what action.
- **Fix**: the concrete change. Name the missing check, the resolver to swap, the flag to flip. "Add a session check" is not enough; say what to check and where.

Group findings by severity. Lead with `high`. Do not rank, rewrite section headers, or emit prose summaries. The Warden harness controls final rendering.
