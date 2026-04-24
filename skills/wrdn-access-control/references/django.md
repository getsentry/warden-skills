# Django + Django REST Framework Access-Control Reference

Load when the diff touches Django views, DRF viewsets, serializers, or permissions outside the Sentry/getsentry codebases. If the code is in Sentry or getsentry, read `sentry.md` or `getsentry.md` first; those repos layer specific conventions on top of raw Django/DRF.

Django is deny-by-default-ish but almost every default is defeatable by writing less code.

## Authentication Surfaces

### Django (plain views)

- `AuthenticationMiddleware` populates `request.user`. It is always populated — it defaults to `AnonymousUser`, which is truthy-ish depending on context. `user.is_authenticated` is the real check.
- `@login_required` decorator on function views.
- `LoginRequiredMixin` on class-based views.
- Django 5.1+: `LoginRequiredMiddleware` (added 2024) gives deny-by-default across the project. Detect by grepping `settings.py` / `MIDDLEWARE` for `django.contrib.auth.middleware.LoginRequiredMiddleware`. If present, routes are protected by default and `@login_not_required` is the opt-out.

### DRF

- `authentication_classes` on the view (session, token, etc.).
- `permission_classes` on the view or globally via `DEFAULT_PERMISSION_CLASSES` in `REST_FRAMEWORK` settings.
- Default permission is `AllowAny` unless `DEFAULT_PERMISSION_CLASSES` sets otherwise.

**Check settings first.** If `DEFAULT_PERMISSION_CLASSES` is `['rest_framework.permissions.AllowAny']` (or omitted), every view that does not set its own `permission_classes` is public.

## The Canonical DRF IDOR

The #1 DRF bug shape:

```python
class InvoiceViewSet(ModelViewSet):
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated]
```

Authenticated, but the default queryset returns every invoice. Any logged-in user can read any invoice by ID.

**Safe:**

```python
class InvoiceViewSet(ModelViewSet):
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Invoice.objects.filter(organization=self.request.user.organization)
```

`get_queryset` is the enforcement point for tenant/ownership scoping, not `permission_classes`. `IsAuthenticated` only proves identity; it does not scope data.

Real incidents: Shopify H1 #2207248 (`BillingInvoice` lookup without shop scoping), SingleStore H1 #3219944 (`GetNotebookScheduledPaginatedJobs` without project-member check).

## `has_object_permission` vs `get_queryset`

- `has_object_permission` runs inside `check_object_permissions`, which is called by `get_object()` on generic views.
- If the view bypasses `get_object()` (custom lookup, `filter().first()`), `has_object_permission` never runs.
- `get_queryset` is the only scoping path that works regardless.

**Bug shape**: permission class with a well-written `has_object_permission`, paired with a view that looks up by `Model.objects.get(pk=...)` instead of `self.get_object()`. Scoping is bypassed.

## Mass Assignment in DRF

`ModelSerializer` with `fields = '__all__'` is the canonical shape.

```python
class UserSerializer(ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'  # Includes is_staff, is_superuser, groups, organization_id.
```

POST or PATCH against this serializer accepts any field on the model, including sensitive ones. A new migration adding `is_admin = BooleanField(default=False)` silently opens the elevation.

**Safe:**

```python
class UserProfileSerializer(ModelSerializer):
    class Meta:
        model = User
        fields = ['display_name', 'avatar_url', 'timezone']
```

Or, equivalently, explicit `read_only_fields` containing every sensitive field. The allowlist approach is better because additive-by-default is hostile.

**Read-only false positive**: `fields = '__all__'` on a `ReadOnlyModelViewSet` or a GET-only endpoint is not mass assignment. Check the HTTP method surface before flagging.

## Writable Related Fields

```python
class OrderSerializer(ModelSerializer):
    customer = PrimaryKeyRelatedField(queryset=Customer.objects.all())  # Unsafe.
```

Writable, and any Customer ID is accepted — including customers the caller doesn't own.

**Safe:**

```python
def get_customer_queryset(self):
    return Customer.objects.filter(organization=self.request.user.organization)

class OrderSerializer(ModelSerializer):
    customer = PrimaryKeyRelatedField(queryset=None)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        self.fields["customer"].queryset = Customer.objects.filter(
            organization=request.user.organization
        )
```

Or scope via `HyperlinkedRelatedField` with a filtered queryset.

## Permission Classes: Fail-Open Patterns

```python
class IsOrgMember(BasePermission):
    def has_permission(self, request, view):
        try:
            return request.user.organizations.filter(id=view.kwargs["org_id"]).exists()
        except Exception:
            return True  # "Be lenient during rollouts." No. This is a bypass.
```

Any check that returns truthy from an exception path is a fail-open. Same for `return user.role != 'banned'` style defaults (seen in Apollo Router CVE-2025-64347 shape on the GraphQL side).

## Django Admin

- `ModelAdmin` requires staff status via `AdminSite`.
- Custom admin views (`admin_view` wrapper) inherit the staff check.
- Unwrapped custom URLs added via `get_urls` without going through `self.admin_site.admin_view` bypass the staff check.

**Bug shape**: new admin dashboard route added via `get_urls` without the `admin_view` wrapper. The URL is accessible to anyone, not just staff.

## Session Handling

- `request.session.cycle_key()` rotates the session ID. Call on login.
- Django does NOT rotate automatically on login. Omission is session fixation.
- Logout: `logout(request)` or `request.session.flush()` clears server-side state.

See `sessions.md` for cross-framework session guidance.

## Common Bug Shapes (Diff Heuristics)

1. **`queryset = Model.objects.all()` on a new `ModelViewSet` with no `get_queryset` override.** IDOR by default.
2. **Serializer with `fields = '__all__'` on a write endpoint.** Mass assignment.
3. **`permission_classes = [IsAuthenticated]` without tenant scoping elsewhere.** IsAuthenticated is identity, not authorization.
4. **`Model.objects.get(id=kwargs['id'])` in a view that also has `permission_classes`.** The object fetch bypasses object-level permissions; only queryset scoping works.
5. **`DEFAULT_PERMISSION_CLASSES` removed or set to `AllowAny` in settings.** Every view without explicit override is now public.
6. **`@csrf_exempt` plus no custom auth on a state-changing view.** When CSRF was the only thing stopping a cross-origin forged submission.
7. **Custom permission class that catches all exceptions and returns `True`.** Fail-open.
8. **Admin URL added via `get_urls` without `admin_view` wrapper.** Unprotected admin.
9. **Login view that does not call `cycle_key()` or uses `login(request, user)` without verifying Django's version rotates automatically.** Session fixation.
10. **`PrimaryKeyRelatedField(queryset=Model.objects.all())` writable from an unscoped endpoint.** Assignment across tenants.

## Verification Commands

```bash
# Global permission default
rg -n "DEFAULT_PERMISSION_CLASSES" <project>

# Every ViewSet definition
rg -n "class \w+\(ModelViewSet\)" <project> --type py

# Every serializer with __all__
rg -n "fields = '__all__'" <project> --type py

# Admin URLs
rg -n "get_urls|admin_view" <project> --type py

# Middleware stack
rg -n "^MIDDLEWARE" <project>/settings*.py
```
