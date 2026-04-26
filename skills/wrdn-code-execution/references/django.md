# Django Code-Execution Reference

Load when the diff touches Django templates, session/cache config, or admin-facing config loading. Ignore raw SQL, DRF serializer leakage, and file/path concerns unless they reach code execution.

## Templates

Django auto-escapes by default and has no `render_template_string` analog reachable through the standard view path. The risk surface is narrow:

```python
from django.template import Template, Context
html = Template(user_source).render(Context(data))   # SSTI if user_source is attacker-controlled.
```

Any new `Template(x).render(...)` where `x` does not trace to a literal or trusted disk file is a finding.

`format_html` / `mark_safe` / `|safe` misuse is XSS-adjacent (different skill); not SSTI in the template-source-injection sense.

## Session and Cache: Pickle as a Reachable Sink

Django uses pickle for cache values by default, and previously for sessions. Two shapes matter:

```python
# settings.py
SESSION_SERIALIZER = "django.contrib.sessions.serializers.PickleSerializer"
```

A diff that switches the session serializer to `PickleSerializer` re-introduces a deserialization sink. Django defaults to `JSONSerializer` since 1.6 specifically because of this. Unless the session cookie is signed *and* the server-side store is fully trusted, this is RCE-prone.

Cache backends use pickle. If the cache (Redis/Memcached) is exposed to untrusted tenants on the same network, cache reads become deserialization of untrusted bytes. Flag any cache configuration that points at an unauthenticated, multi-tenant cache server.

## Config Loading

```python
# Not standard Django, but seen in custom config layers:
exec(open(path).read())                       # If `path` is influenceable: RCE.
importlib.import_module(user_modname)         # Module top-level code runs on import.
```

## Detection Heuristics

1. New `Template(x).render(...)` with `x` not a literal.
2. `SESSION_SERIALIZER` switched to `PickleSerializer`.
3. Cache backend pointing at an untrusted multi-tenant server.
4. `exec(open(path).read())` or equivalent dynamic Python loading where `path` is not a literal.
5. `importlib.import_module(user_input)` / `__import__(user_input)`.

## False-Positive Traps

- `render_template("file.html", ...)` with literal filename is safe. Django does not have a `render_template_string` equivalent reachable from request data.
- `Template("hardcoded $var").render(...)` with literal source is safe.
- Pickle-based session config behind a sealed deployment (single-tenant, encrypted-at-rest cache, signed cookies) is acceptable; flag for review rather than as a high.
- Auto-escaped `{{ x }}` in templates is safe.

## Verification Commands

```bash
# Template constructions with non-literal sources
rg -n 'Template\(' <project> --type py | rg -v '"\$|\bTemplate\("[^"]*"\)'

# Session/cache config
rg -n 'SESSION_SERIALIZER|CACHES\s*=' <project>/settings*.py

# Dynamic imports / exec
rg -n 'importlib\.import_module|__import__|exec\(open' <project> --type py
```
