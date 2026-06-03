# Remediation

Concrete before/after fixes per rule, Python and TypeScript. Recommend the fix that matches the code already in the file. Do not impose `ModelSerializer` on a codebase that uses function-based serializers, or vice versa.

## Identifier emitted as a number

Python, Sentry function-based serializer:
```diff
 def serialize(self, obj, attrs, user, **kwargs):
-    return {"id": obj.id, "projectId": obj.project_id, "name": obj.name}
+    return {"id": str(obj.id), "projectId": str(obj.project_id), "name": obj.name}
```

Python, DRF, when the codebase uses `ModelSerializer`:
```diff
 class WidgetSerializer(serializers.ModelSerializer):
+    id = serializers.CharField(source="id", read_only=True)
+    project_id = serializers.CharField(source="project_id", read_only=True)
     class Meta:
         model = Widget
         fields = ["id", "name", "project_id"]
```

TypeScript, Express:
```diff
 const widget = await getWidget(req.params.id);
-res.json({ widget });
+res.json({ widget: { ...widget, id: String(widget.id), projectId: String(widget.projectId) } });
```

TypeScript, NestJS DTO:
```diff
+import { Transform } from "class-transformer";
 export class WidgetDto {
+  @Transform(({ value }) => String(value))
   id: number;
   name: string;
 }
```

## Decimal or float emitted as a number

Python:
```diff
-    return {"errorRate": obj.error_rate, "p95": obj.p95}   # floats
+    return {"errorRate": str(obj.error_rate), "p95": str(obj.p95)}
```
DRF:
```diff
-    amount = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=False)
+    amount = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=True)
```
TypeScript, Express:
```diff
-res.json({ stats: { errorRate: tx.errorRate, amount: tx.amount } });
+res.json({ stats: { errorRate: String(tx.errorRate), amount: tx.amount.toFixed(2) } });
```

## snake_case response key

Python (rename the emitted key; keep `source=` pointing at the column):
```diff
-    return {"date_created": obj.date_added, "ip_address": obj.ip}
+    return {"dateCreated": obj.date_added, "ipAddress": obj.ip}
```
DRF:
```diff
-    created_at = serializers.DateTimeField()
+    createdAt = serializers.DateTimeField(source="created_at")
```
TypeScript:
```diff
-res.json({ user: { date_created: row.created_at, ip_address: row.ip } });
+res.json({ user: { dateCreated: row.created_at, ipAddress: row.ip } });
```

## Path param casing and collection naming

```diff
-path("organizations/<organizationId>/api_key/", ...)
+path("organizations/<organization_id_or_slug>/api-keys/", ...)
```

## Tenant key as a query param

Python:
```diff
-# GET /api/0/widgets/?organization=acme
-class WidgetsEndpoint(Endpoint):
-    def get(self, request):
-        org = request.GET["organization"]
+# GET /api/0/organizations/{org}/widgets/
+class OrganizationWidgetsEndpoint(OrganizationEndpoint):
+    def get(self, request, organization):
+        ...
```
TypeScript:
```diff
-router.get("/widgets", (req, res) => { const org = req.query.organization; });
+router.get("/organizations/:org/widgets", (req, res) => { const { org } = req.params; });
```

## Over-nesting (more than three levels)

```diff
-# orgs / teams / members / permissions  (four nouns)
-path("organizations/<org>/teams/<team>/members/<member>/permissions/", ...)
+# collapse the leaf into the member resource, or expose a sibling endpoint
+path("organizations/<org>/teams/<team>/members/<member>/", ...)   # returns permissions inline or via ?expand=
```

## Dedicated sort or filter route

```diff
-path("organizations/<org>/events/sorted/", SortedEventsEndpoint.as_view())
+# GET /api/0/organizations/{org}/events/?orderBy=-date
```

## PATCH verb

Python:
```diff
-    def patch(self, request, organization, widget_id):
+    def put(self, request, organization, widget_id):
         ...
```
TypeScript:
```diff
-router.patch("/widgets/:id", updateWidget);
+router.put("/widgets/:id", updateWidget);
```

## Response shape

Unwrapped single resource:
```diff
-return Response(serialize(widget, request.user))
+return Response({"widget": serialize(widget, request.user)})
```
Singular collection key:
```diff
-return Response({"widget": serialize(list(qs), request.user)})
+return Response({"widgets": serialize(list(qs), request.user)})
```
Unbounded inline relationship:
```diff
 class UserSerializer(Serializer):
     def serialize(self, obj, attrs, user, **kwargs):
-        return {"id": str(obj.id), "projects": serialize(list(obj.projects.all()), user)}
+        return {"id": str(obj.id)}   # expose projects at /users/{id}/projects/ with pagination
```
HTML error page:
```diff
-        return render(request, "404.html", status=404)
+        return Response({"detail": "Not found"}, status=404)
```
