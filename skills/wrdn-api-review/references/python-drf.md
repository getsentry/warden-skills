# Resolving the Emitted Shape, Python / Django / DRF

Load when a finding depends on the JSON a field actually emits, not what the model stores. Most false positives come from guessing the emitted type.

## Sentry's serializer pattern

The dominant pattern is the registered `serialize()` function plus a `Serializer` subclass (`src/sentry/api/serializers/base.py`), not DRF `ModelSerializer`:

```python
@register(Widget)
class WidgetSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs): ...   # batch fetch
    def serialize(self, obj, attrs, user, **kwargs) -> dict:
        return {"id": str(obj.id), "name": obj.name}       # the emitted contract
```

The dict returned by `serialize()` is the contract. The keys are the response keys. The Python expression decides the JSON type.

## DRF field types, when the code uses ModelSerializer

Sentry uses function-based serializers most of the time, but some endpoints use DRF `ModelSerializer`. For those, the field class decides the JSON type:

| DRF field | JSON output | Note |
|---|---|---|
| `CharField` | string | safe |
| `IntegerField`, `BigIntegerField` | number | violation on an identifier unless `coerce_to_string=True` |
| `DecimalField` | string by default (`coerce_to_string=True`), number if set False | a plain `DecimalField` is usually safe |
| `FloatField` | number | violation on a precision-sensitive value |
| `SerializerMethodField` | depends on the `get_*` return | trace the method |

A `ModelSerializer` with `fields = [...]` and no explicit override emits each field at its model-derived default, so an `AutoField`/`ForeignKey` id emits a number. That is the violation. The fix is an explicit `CharField(source=...)` or a `to_representation` override.

## Identifier type

| Expression | Emits | Verdict |
|---|---|---|
| `obj.id`, `obj.project_id` | number | defect, wrap in `str()` |
| `str(obj.id)`, `f"{obj.id}"` | string | correct |
| `serializers.IntegerField()` for an id | number | defect |
| `serializers.CharField(source="id")` | string | correct |
| Response annotated `id: str` and the value is stringified | string | correct, confirm the runtime value |

The `*_id` foreign-key integer is the most common miss. `obj.project_id` is an int column. Emitting it raw is a defect even though it looks harmless.

## Casing

The response key is the dict key string, independent of the attribute. `{"dateCreated": obj.date_added}` is correct. `{"date_created": ...}` is a defect. Do not infer casing from the column name.

## Floats and decimals

A `Decimal` or `float` placed directly in the dict serializes as a JSON number. The rule wants decimals as strings and no floats. Look at rate, percentage, duration, money, and aggregation outputs. Safe form: `str(value)` or a quantized string.

## Named-resource envelope

The wrapping is the handler's `Response(...)`, not the serializer:

```python
return Response({"widget": serialize(widget, request.user)})       # named
return Response({"widgets": serialize(list(qs), request.user)})    # plural
```

`self.paginate(...)` returns a top-level array. A paginated list endpoint returning a bare array is not a named-resource violation. Flag only bare single-object responses or new non-paginated collections.

## drf-spectacular signals

- `@extend_schema`, `inline_serializer`, or explicit response serializers mean the author engaged the generator. Their declared types land in OpenAPI. An `id` declared `OpenApiTypes.INT` is a real defect.
- An endpoint with no resolvable response serializer and a raw `Response(some_dict)` yields a weak `object` schema. That is the unstructured-response finding. The events surface (`organization_events*`) returns rows whose shape varies by the `field=` and `dataset=` selection, which is why its schema degrades to untyped data. Recommend a named envelope with typed columns for new endpoints of this kind. Do not re-litigate the existing events endpoints.
- `ApiPublishStatus.PUBLIC` controls documentation inclusion only. It does not exempt an endpoint from conventions. `PRIVATE` is not a free pass.

## Checklist before reporting

1. Open the serializer. Copy the returned dict.
2. Per key: right JSON type (ids and decimals as strings, no floats), camelCase key.
3. Open the handler. Named resource, or a paginated array.
4. Open the route. Scoping, nesting, verb, path-param casing.
5. If the emitted value comes from a base class, a shared helper, or a dynamic dict you cannot see, say so and lower confidence. Do not guess.
