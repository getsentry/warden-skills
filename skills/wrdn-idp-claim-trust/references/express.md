# Express / Passport IdP Claim Trust Reference

Load when the diff touches Express auth, Passport strategies (`passport-google-oauth20`, `passport-github2`, `passport-saml`, `passport-openidconnect`, `passport-local`, custom strategies), Mongoose/Prisma link tables, or hand-rolled OAuth callbacks in Express/Koa/Fastify/Hono.

## Contents
- The Passport `verify` Callback
- nOAuth Class in Passport Shape
- `profile.emails[0]` Is an Array For a Reason
- Bug Shapes
- Safe Patterns
- Verification Commands
- References

Passport's strategy model centralizes the dangerous decision in one callback: the `verify` function. Every strategy's `verify` fires after the IdP exchange succeeds, receives a `profile` object built from IdP claims, and returns the local user record that should be logged in. Mistakes here become all-routes-reachable bypasses.

## The Passport `verify` Callback

```ts
passport.use(new GoogleStrategy(
  opts,
  (accessToken, refreshToken, profile, done) => {
    // You are deciding, right here, which local user this IdP identity maps to.
    // Every trust decision in this file must be explicit.
  },
));
```

Four things must be true in the safe version:

1. Primary lookup is by `(providerName, profile.id)`, not by `profile.emails?.[0]?.value`.
2. If no match, either signal "needs linking" via `done(null, false, { message: "link_required" })` and redirect to a confirmation view, or (if you support auto-signup) create a new local user.
3. Never `upsert` on email.
4. For first-time linking, the confirmation view must re-resolve the user from `req.user`, not from any server-side state keyed off the IdP identity.

## nOAuth Class in Passport Shape

```ts
// bad
passport.use(new AzureAdStrategy(opts, async (_at, _rt, profile, done) => {
  const email = profile._json.email ?? profile._json.preferred_username;
  const user = await db.user.upsert({
    where: { email },
    update: { azureId: profile.oid },
    create: { email, azureId: profile.oid },
  });
  done(null, user);
}));
```

Azure AD's `email` claim is mutable, unverified, and settable by any tenant administrator (nOAuth). The `upsert` binds whoever controls an Azure tenant to whichever local user shares the email.

## `profile.emails[0]` Is an Array For a Reason

The OAuth profile's `emails` array can contain multiple entries. Passport strategies vary on which they populate: GitHub only includes verified emails when called with the right scope and `/user/emails` API plumbing; Google usually includes the primary; Azure sometimes includes none. Code that reaches into `profile.emails[0].value` with no regard for verification metadata treats "whatever came first" as authoritative.

Safe handling differs per provider:

- **GitHub:** Pass `{ scope: ["user:email"] }` *and* call `/user/emails` explicitly, filter `primary && verified`. `profile.emails[0]` alone is not trustworthy for linking.
- **Google:** Only one verified email is returned via OIDC; fine to use, but link by `sub`, not email.
- **Azure AD:** Do not trust `profile.emails[0]` for linking under any circumstance. Use `oid` as the stable subject.

## Bug Shapes

### 1. `findOrCreate` / `upsert` on email
```ts
// bad
passport.use(new GitHubStrategy(opts, async (at, rt, profile, done) => {
  const email = profile.emails?.[0]?.value;
  const user = await User.findOrCreate({ where: { email } });
  done(null, user);
}));
```

### 2. Email lookup when `profile.id` would work
```ts
// bad
const user = await db.user.findUnique({ where: { email: profile.emails?.[0]?.value } });
```

### 3. No verification of `profile.emails` entries
```ts
// bad
const emails = profile.emails ?? [];
const user = await db.user.findFirst({ where: { email: { in: emails.map(e => e.value) } } });
```

### 4. Custom strategy that trusts the IdP's claim wholesale
```ts
// bad
app.post("/sso/custom", async (req, res) => {
  const claims = await verifyIdToken(req.body.idToken);
  const user = await db.user.findFirst({ where: { email: claims.email } });
  req.login(user!, (err) => err ? res.status(500).end() : res.redirect("/"));
});
```

### 5. `req.login` without ownership proof during link
```ts
// bad
app.post("/link/confirm", async (req, res) => {
  const pending = req.session.pendingLink;   // bound earlier, possibly pre-auth
  const target = await db.user.findUnique({ where: { id: pending.userId } });
  req.login(target!, () => res.redirect("/"));
});
```

The `pendingLink` was bound during an earlier step that may have run before the session was authenticated. The confirm handler must re-resolve from `req.user`.

### 6. `passReqToCallback: false` on a strategy that needs the session
```ts
// bad
passport.use(new GoogleStrategy({ ...opts, passReqToCallback: false },
  (at, rt, profile, done) => {
    // No access to req.user, so the strategy can't make a session-owner check.
  },
));
```

Enable `passReqToCallback: true` when the strategy handles first-time linking; the `req` gives access to `req.user`.

### 7. Mongoose pre-save hooks that coerce link
```ts
// risky
UserSchema.pre("save", function (next) {
  if (this.isNew && this.email) {
    User.findOne({ email: this.email }).then((existing) => {
      if (existing) Object.assign(existing, this.toObject()); // link by email in a hook
      next();
    });
  } else next();
});
```

Rare, but once seen in production. Pre-save hooks are an awkward place to implement identity-linking policy; review any you find.

## Safe Patterns

### Baseline Passport strategy
```ts
passport.use(new GoogleStrategy(
  { ...opts, passReqToCallback: true },
  async (req, accessToken, refreshToken, profile, done) => {
    const existing = await db.linkedIdentity.findUnique({
      where: { provider_externalId: { provider: "google", externalId: profile.id } },
    });
    if (existing) return done(null, await db.user.findUnique({ where: { id: existing.userId } }));
    if (!req.user) return done(null, false, { message: "login_required" });
    // First-time linking for the session user only.
    await db.linkedIdentity.create({
      data: {
        userId: (req.user as User).id,
        provider: "google",
        externalId: profile.id,
        email: profile.emails?.[0]?.value,
      },
    });
    done(null, req.user);
  },
));
```

### First-time linking flow
```ts
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] }),
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login?reason=link_required",
  }),
  (req, res) => res.redirect("/"),
);

// failureRedirect pattern -- send unauthenticated first-time linkers to login.
app.get("/login", (req, res) => {
  if (req.query.reason === "link_required") {
    req.session.pendingLinkClaims = req.session.pendingLinkClaims;   // preserved
  }
  res.render("login");
});

// After login, re-run the OAuth flow. Strategy now sees req.user and links.
```

### SAML / OIDC confirm POST
```ts
app.post("/sso/confirm-link", requireSession, async (req, res) => {
  const claims = req.session.pendingSsoClaims;
  if (!claims) return res.status(400).send("no pending claims");
  await db.linkedIdentity.create({
    data: {
      userId: req.user.id,   // <-- session user, not pending state
      provider: claims.provider,
      externalId: claims.sub,
    },
  });
  delete req.session.pendingSsoClaims;
  res.redirect("/");
});
```

`req.user.id` is the only acceptable `userId` source in this handler. Reading `claims.localUserId` or any pre-bound state would reintroduce the bug.

## Verification Commands

```bash
# Passport strategy instantiation
rg -n 'new (Google|GitHub|Azure|Okta|OpenIDConnect|Saml)Strategy' <project>
rg -n "passport\.use\(" <project>

# upsert / findOrCreate on email in auth code
rg -nB 3 -A 5 'passport\.use|Strategy' <project> | rg -n 'upsert.*email|findOrCreate.*email|findUnique.*email'

# Profile email access
rg -n 'profile\.emails|profile\._json\.email|profile\.preferred_username' <project>

# req.login outside authenticated flow
rg -nB 5 -A 1 'req\.login\(' <project>

# passReqToCallback configuration
rg -n 'passReqToCallback' <project>
```

## References

- Passport.js strategy authoring. http://www.passportjs.org/docs/
- passport-saml. https://github.com/node-saml/passport-saml
- Descope nOAuth. https://www.descope.com/blog/post/noauth
- GitHub `/user/emails` endpoint. https://docs.github.com/en/rest/users/emails
