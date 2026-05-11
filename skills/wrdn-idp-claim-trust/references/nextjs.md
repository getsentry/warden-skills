# Next.js / NextAuth / Auth.js IdP Claim Trust Reference

Load when the diff touches NextAuth.js (v4) or Auth.js (v5) configuration, `signIn` / `jwt` / `session` callbacks, `pages/api/auth/[...nextauth]`, `app/api/auth/[...nextauth]/route.ts`, or custom Next.js Server Actions that handle SSO claims.

## Contents
- `allowDangerousEmailAccountLinking`
- The `signIn` Callback
- Database Session vs. JWT Session Implications
- Server Actions That Talk to IdPs Directly
- Bug Shapes
- Safe Patterns
- Verification Commands
- References

Auth.js handles the mechanics of OAuth/OIDC/SAML correctly by default. The claim-trust bugs are almost always in the configuration: a flag flipped to `true`, a `signIn` callback that trusts the IdP, or a Server Action that talks to the IdP directly bypassing the library.

## `allowDangerousEmailAccountLinking`

The name is the documentation. Auth.js ships this off by default for every provider. Flipping it on for a provider tells the library: if an incoming OAuth identity matches an existing user by email, link it automatically without asking the session user. Auth.js docs explicitly state this is only safe when the IdP "securely verified" the email. And the library cannot check whether that's true for your specific provider config.

Provider-by-provider judgment:

- **Google consumer:** Safe-ish. Google cryptographically binds `email_verified`.
- **Google Workspace:** Depends on the tenant admin. Combine with `hd` allowlist.
- **Microsoft Entra / Azure AD (`AzureADProvider`):** **Not safe.** This is the nOAuth class. Azure AD `email` is admin-settable in any tenant. Never set the flag on Azure AD without also validating the `xms_edov` / `verified_primary_email` extension claim.
- **GitHub:** Safe only when the provider config uses the `/user/emails` API to pick the primary verified address. The default `GitHubProvider` does this; custom profiles may not.
- **Generic OIDC / Keycloak / Dex / "OAuth" provider:** Depends entirely on deployment. Do not set the flag on these without a documented reason.
- **Email magic-link / Credentials / passkeys:** Flag is irrelevant; ignore.

Flag shapes to catch in diffs:

```ts
// bad without provider-specific verification
AzureADProvider({
  clientId: process.env.AZURE_ID!,
  clientSecret: process.env.AZURE_SECRET!,
  tenantId: "common",
  allowDangerousEmailAccountLinking: true,
})
```

```ts
// bad -- generic OIDC where email_verified semantics are unknown
Providers.OAuth({
  id: "corp-sso",
  allowDangerousEmailAccountLinking: true,
})
```

## The `signIn` Callback

`signIn({ user, account, profile })` runs before Auth.js persists the user or the session. Returning `true` allows the sign-in; returning `false` blocks it; returning a URL redirects.

```ts
async signIn({ user, account, profile }) { ... }
```

The callback receives the IdP's claims essentially unfiltered. Return-`true` paths that do not verify `profile?.email_verified`, do not scope to a trusted tenant, and do not check for cross-provider conflicts are giving the IdP full authority.

Bug shape:

```ts
// bad
callbacks: {
  async signIn({ user, account, profile }) {
    return true;   // or return !!user?.email;
  },
}
```

Safer:

```ts
callbacks: {
  async signIn({ user, account, profile }) {
    if (account?.provider === "azure-ad") {
      const edov = (profile as any)?.xms_edov;
      if (!edov) return false;   // block nOAuth vector
    }
    if (account?.provider === "google") {
      if (!(profile as any)?.email_verified) return false;
    }
    return true;
  },
}
```

Note that even this is not a complete fix. The call returns early before any account-linking decision. The `allowDangerousEmailAccountLinking` flag still governs whether the IdP identity attaches to an existing user by email. If the flag is off (the default), Auth.js's built-in flow requires the session user to confirm.

## Database Session vs. JWT Session Implications

Auth.js supports two session strategies:

- **Database sessions** (`session: { strategy: "database" }`): Auth.js stores sessions server-side and manages Account + User rows. The account-linking policy applies at row write time; `allowDangerousEmailAccountLinking` is the control.
- **JWT sessions** (`session: { strategy: "jwt" }`, the default): Auth.js encodes session state in a signed cookie. The `jwt` callback shapes what goes in; the `session` callback shapes what the app sees. Identity linking has to happen in userland because Auth.js does not maintain a link table.

Under JWT sessions, code in the `jwt` callback that does:

```ts
// bad
async jwt({ token, account, profile }) {
  if (account && profile?.email) {
    const existing = await db.user.findUnique({ where: { email: profile.email as string } });
    if (existing) token.userId = existing.id;
  }
  return token;
}
```

is the classic email-linking footgun at the JWT layer. The fix is identical: link by `(provider, providerAccountId)`, not by email; require a session-authenticated confirm step for first-time linking.

## Server Actions That Talk to IdPs Directly

Auth.js configuration is one surface. Another, increasingly common under App Router, is a Server Action that exchanges an IdP-issued token for a local session without going through Auth.js.

```ts
// app/actions/sso-exchange.ts
"use server";
export async function ssoExchange(idToken: string) {
  const claims = await verifyIdToken(idToken);
  const user = await db.user.findUnique({ where: { email: claims.email as string } });
  if (user) await signIn("credentials", { userId: user.id });
}
```

Treat any Server Action that calls `verifyIdToken` (or `jose.jwtVerify`, or decodes a SAML assertion) as a full SSO endpoint. The same two questions apply: is RESOLVE stable-subject or email-based, and is there a session-ownership check before the privileged write?

The Server Action itself must re-verify the session on every invocation. Server Actions are reachable by any client that can POST to the route, regardless of the page that rendered the form. See Next.js Server Actions auth hardening (CVE-2025-55182 class) for the adjacent concern.

## Bug Shapes

### 1. `allowDangerousEmailAccountLinking` on nOAuth-prone provider
```ts
AzureADProvider({ ..., allowDangerousEmailAccountLinking: true })
```

### 2. `signIn` callback returns `true` without claim checks
```ts
async signIn() { return true; }
```

### 3. Custom `signIn` links by email
```ts
async signIn({ user }) {
  const existing = await db.user.findUnique({ where: { email: user.email } });
  if (existing) { /* bind current account to existing */ }
  return true;
}
```

### 4. `jwt` callback links by email
```ts
async jwt({ token, profile }) {
  const existing = await db.user.findUnique({ where: { email: profile.email } });
  if (existing) token.userId = existing.id;
  return token;
}
```

### 5. Server Action SSO exchange by email
```ts
"use server";
export async function exchange(idToken: string) {
  const { email } = await verifyIdToken(idToken);
  const user = await db.user.findUnique({ where: { email } });
  // ...
}
```

### 6. Credentials provider that accepts an IdP token as the password
```ts
CredentialsProvider({
  async authorize(credentials) {
    const claims = await verifyIdToken(credentials?.idToken ?? "");
    return await db.user.findUnique({ where: { email: claims.email as string } });
  },
})
```

Credentials provider with an IdP token is a common way to bolt SSO onto an app that already uses Auth.js. Same trust rules apply; the `authorize` function is the `verify` callback under a different name.

## Safe Patterns

### Conservative Auth.js config
```ts
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_ID!,
      clientSecret: process.env.GOOGLE_SECRET!,
      // allowDangerousEmailAccountLinking left at default (false)
    }),
    AzureADProvider({
      clientId: process.env.AZURE_ID!,
      clientSecret: process.env.AZURE_SECRET!,
      tenantId: process.env.AZURE_TENANT_ID!,   // pin tenant, not "common"
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "google" && !(profile as any)?.email_verified) {
        return false;
      }
      if (account?.provider === "azure-ad") {
        const edov = (profile as any)?.xms_edov;
        if (!edov) return false;
      }
      return true;
    },
  },
};
```

### Session-authenticated first-time linking
Auth.js auto-linking is opt-in per provider. With it off, first-time linking for an email that matches an existing user throws `OAuthAccountNotLinked`. The correct UX response is to prompt the user to sign in with the original provider and then link the new one from their authenticated session.

Do not paper over the error by flipping `allowDangerousEmailAccountLinking`. The error is the security control.

## Verification Commands

```bash
# Auth.js config surface
rg -n 'NextAuth\(|getServerSession|authOptions' <project>
rg -n 'allowDangerousEmailAccountLinking' <project>

# Providers present
rg -n 'Provider\(' <project>/**/auth* <project>/**/[...nextauth]*

# signIn / jwt / session callbacks
rg -nA 20 'callbacks:\s*{' <project>

# Custom SSO Server Actions
rg -n '"use server"' <project> | xargs -I {} dirname {} | sort -u

# Server-side IdP token verification outside Auth.js
rg -n '(verifyIdToken|jwtVerify|jose\.)' <project>
```

## References

- Auth.js provider options. https://authjs.dev/reference/core/providers#allowdangerousemailaccountlinking
- Auth.js callbacks reference. https://authjs.dev/reference/core#callbacks
- Microsoft Entra claims validation (nOAuth mitigation). https://learn.microsoft.com/en-us/entra/identity-platform/claims-validation
- Descope nOAuth disclosure. https://www.descope.com/blog/post/noauth
