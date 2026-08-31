# Django / DRF IdP Claim Trust Reference

Load when the diff touches Django auth, `django-allauth`, `python-social-auth` / `social-auth-app-django`, DRF custom SSO endpoints, `djangosaml2`, or hand-rolled Django OAuth callbacks.

## Contents
- python-social-auth: `associate_by_email`
- django-allauth: `SOCIALACCOUNT_AUTO_SIGNUP` and `pre_social_login`
- `populate_user` vs. `pre_social_login`
- DRF custom SSO endpoints
- Staff impersonation / "log in as"
- `UserEmail.is_verified`
- Bug Shapes Summary
- Safe Patterns
- Verification Commands
- References

Django's ecosystem has three well-trodden integration points where IdP claim trust goes wrong. Each has a documented footgun and a documented fix; the trick is to recognize which is in play.

## python-social-auth: `associate_by_email`

`python-social-auth` (now `social-auth-app-django`) implements authentication as a pipeline of steps. The default pipeline contains `social_core.pipeline.social_auth.social_user` (which looks up by `(provider, uid)`, the stable-subject anchor) but **not** `social_core.pipeline.social_auth.associate_by_email`. The latter is opt-in and documented as: *"Associates the current social details with another user account with a similar email address. Disabled by default."*

A project that adds `associate_by_email` after `social_user` is telling the library: if the stable-subject lookup fails, bind this new IdP identity to any existing local user that shares the email claim. Every nOAuth-class bug fits in this one line of config.

Trigger: changes to `SOCIAL_AUTH_PIPELINE` (or per-backend pipeline) adding `associate_by_email` for any backend whose email is not cryptographically verified.

```python
# risky
SOCIAL_AUTH_PIPELINE = (
    "social_core.pipeline.social_auth.social_details",
    "social_core.pipeline.social_auth.social_uid",
    "social_core.pipeline.social_auth.auth_allowed",
    "social_core.pipeline.social_auth.social_user",
    "social_core.pipeline.user.get_username",
    "social_core.pipeline.social_auth.associate_by_email",   # <--
    "social_core.pipeline.user.create_user",
    "social_core.pipeline.social_auth.associate_user",
    "social_core.pipeline.social_auth.load_extra_data",
    "social_core.pipeline.user.user_details",
)
```

Safe variants:

- Drop `associate_by_email` entirely. First-time linking flows through a session-authenticated confirmation view.
- Or replace with a custom pipeline step that requires `strategy.request.user.is_authenticated and strategy.request.user.email == details["email"]` before associating.

The library ships `social_core.pipeline.partial.partial` for exactly this "pause, confirm, resume" flow. `@partial` a step that redirects to a confirmation page, have the confirm POST handler call `strategy.complete(...)` only when `request.user` owns the target account.

## django-allauth: `SOCIALACCOUNT_AUTO_SIGNUP` and `pre_social_login`

`django-allauth` has a more opinionated model. Defaults are reasonable; specific settings weaken them:

- `SOCIALACCOUNT_EMAIL_AUTHENTICATION = True`. When an existing allauth `EmailAddress` is verified and matches the IdP email, allauth auto-links. Safe only when the allauth `EmailAddress` row was itself confirmed through a mailbox round-trip; unsafe if the row was created from an IdP claim without one.
- `SOCIALACCOUNT_EMAIL_AUTHENTICATION_AUTO_CONNECT = True`. Forces the auto-link even when the user has an existing social connection. This is the NextAuth `allowDangerousEmailAccountLinking` equivalent.
- Custom `SocialAccountAdapter.pre_social_login(request, sociallogin)`. A hook where a project can call `sociallogin.connect(request, User.objects.get(email=...))`. This is the common home-grown version of the same bug.

Trigger shapes:

```python
# risky
class MySocialAccountAdapter(DefaultSocialAccountAdapter):
    def pre_social_login(self, request, sociallogin):
        if sociallogin.is_existing:
            return
        try:
            user = User.objects.get(email=sociallogin.user.email)
        except User.DoesNotExist:
            return
        sociallogin.connect(request, user)
```

The shape: look up local user by the IdP email, connect without asking the session user.

Safe: `sociallogin.connect` only when `request.user.is_authenticated and request.user.pk == user.pk`, otherwise redirect to the confirmation flow.

## `populate_user` vs. `pre_social_login`

`populate_user` runs when a brand-new local user is being created from a social login. That path is new-user signup and does not need a session confirmation. Do not flag logic in `populate_user` unless it mutates an *existing* user.

`pre_social_login` runs on every login, before the adapter decides how to handle the identity. Mutations here that bind a social account to an existing user need a session-ownership check before the write.

## DRF custom SSO endpoints

Hand-rolled DRF views that implement "exchange IdP token for Django session" are the richest hunting ground. The shape:

```python
# bad
class SSOExchangeView(APIView):
    authentication_classes = []   # public
    permission_classes = [AllowAny]

    def post(self, request):
        id_token = request.data["id_token"]
        claims = verify_id_token(id_token)
        user, _ = User.objects.get_or_create(email=claims["email"])
        request.session["_auth_user_id"] = user.id
        return Response({"ok": True})
```

Variants:

- `get_or_create` silently creates a new local user on first IdP assertion. That part is fine (signup path).
- But if an existing user already matches the email, `get_or_create` binds this IdP identity to them without asking. Finding.
- The session direct-write `request.session["_auth_user_id"] = user.id` is the WRITE; `auth.login(request, user)` has the same meaning.

Safe: look up by `(provider, sub)` first; fall through to a session-authenticated confirmation view if no existing link matches.

## Staff impersonation / "log in as"

A separate but adjacent shape: staff tools that use `login(request, target_user)` without a staff-role gate, session binding, or audit logging. Not strictly IdP claim trust, but appears in the same auth code and is worth flagging when you see it. Defer the deep review to a separate access-control skill.

## `UserEmail.is_verified`

Django projects that implement their own email-verified tracking (often in a separate `UserEmail` model) need to distinguish two sources of truth:

- A row marked verified because the user clicked a link in an email sent by this project is safe to trust.
- A row marked verified because an IdP asserted `email_verified: true` at login is only as trustworthy as the IdP's verification semantics (see `oidc-oauth.md` per-provider table).

Flag code paths that flip `is_verified = True` from an IdP claim without a mailbox round-trip. Once set, the flag is typically checked across the whole system as if it were a mailbox proof, so corrupting it corrupts many downstream decisions.

## Bug Shapes Summary

### 1. `associate_by_email` in pipeline
```python
# risky -- trigger on diff adding this string
"social_core.pipeline.social_auth.associate_by_email"
```

### 2. `pre_social_login` connects by email
```python
sociallogin.connect(request, User.objects.get(email=...))  # without request.user check
```

### 3. DRF SSO exchange `get_or_create(email=...)`
```python
User.objects.get_or_create(email=claims["email"])   # bind to existing by email
```

### 4. Email-verified flag set from IdP claim
```python
UserEmail.objects.update_or_create(
    email=claims["email"],
    defaults={"is_verified": bool(claims.get("email_verified"))},
)
```

### 5. `auth.login` downstream of email resolution
```python
user = User.objects.get(email=claims["email"])
auth.login(request, user)
```

## Safe Patterns

### Custom python-social-auth step for confirmed linking
```python
def require_session_owner(strategy, details, user=None, *args, **kwargs):
    """Replace associate_by_email with a session-owner check."""
    if user:
        return {"user": user}
    existing = User.objects.filter(email__iexact=details.get("email")).first()
    if existing is None:
        return None
    request = strategy.request
    if request.user.is_authenticated and request.user.pk == existing.pk:
        return {"user": existing}
    return strategy.redirect(reverse("social:confirm-link"))
```

### allauth adapter that never auto-connects
```python
class SafeSocialAccountAdapter(DefaultSocialAccountAdapter):
    def pre_social_login(self, request, sociallogin):
        if sociallogin.is_existing:
            return
        # Do NOT auto-connect. Let allauth render the signup/confirm UI.
        return
```

### DRF SSO exchange keyed by (provider, sub)
```python
class SSOExchangeView(APIView):
    authentication_classes = [SessionAuthentication]
    permission_classes = [AllowAny]

    def post(self, request):
        claims = verify_id_token(request.data["id_token"])
        link = LinkedIdentity.objects.filter(
            issuer=claims["iss"], subject=claims["sub"],
        ).first()
        if link:
            auth.login(request, link.user)
            return Response({"ok": True})
        if not request.user.is_authenticated:
            return Response({"next": reverse("confirm-link")}, status=401)
        return Response({"next": reverse("confirm-link")}, status=200)
```

## Verification Commands

```bash
# python-social-auth pipeline inspection
rg -n 'SOCIAL_AUTH_PIPELINE|associate_by_email' <project>

# allauth risky settings
rg -n 'SOCIALACCOUNT_EMAIL_AUTHENTICATION|SOCIALACCOUNT_AUTO_SIGNUP' <project>
rg -n 'pre_social_login|sociallogin\.connect' <project>

# DRF SSO endpoints
rg -nB 2 -A 8 'class.*APIView' <project> | rg -n 'id_token|saml|oauth|get_or_create.*email'

# UserEmail.is_verified flipped from claim
rg -nB 3 -A 1 'is_verified\s*=\s*True' <project>

# Session / login writes
rg -n 'auth\.login\(|session\[.*_auth_user_id.*\]' <project>
```

## References

- python-social-auth pipeline. https://python-social-auth.readthedocs.io/en/latest/pipeline.html
- django-allauth SocialAccount providers. https://docs.allauth.org/en/latest/socialaccount/configuration.html
- django-allauth `pre_social_login`. https://docs.allauth.org/en/latest/socialaccount/adapter.html
- Auth0 verified email guidance applies equally to Django integrations. https://auth0.com/docs/manage-users/user-accounts/user-profiles/verified-email-usage
