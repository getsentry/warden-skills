# Prototype Pollution Reference

Load when the diff deep-merges, copies, or assigns user-controlled objects into other objects: `lodash.merge` / `defaultsDeep` / `set` / `setWith`, `jQuery.extend(true, ...)`, `Object.assign` loops over user keys, hand-rolled merge helpers, `body-parser` / `qs` piped into merge, `mongoose.Query` filter merging, any util called `deepMerge` / `extend` / `assignDeep`.

Prototype pollution is only interesting in this skill when the polluted prototype is read by a downstream sink:

- Template engine that picks up the polluted property as a "helper" (Handlebars CVE-2019-19919).
- Auth middleware that checks `req.user.role` and the upstream middleware reads `role` from a merged object.
- HTTP client whose config object is polluted (axios CVE-2026-40175, IMDS bypass).
- `Function` constructor / `eval` / `require` that reads a polluted property.

Without a sink, it's still a finding, but the severity drops to medium/low.

## The Core Rule

Two things make prototype pollution possible:

1. **Recursive assignment that walks keys without filtering** `__proto__`, `prototype`, or `constructor`.
2. **An attacker-controlled object** (parsed request body, query string, YAML/JSON config written by a user).

Either one alone is manageable. Both together is the primitive.

## Canonical CVEs

- **CVE-2019-10744 — lodash `defaultsDeep`**: `{"constructor":{"prototype":{"isAdmin":true}}}` merged into `Object.prototype`. Fixed in 4.17.12.
- **CVE-2020-8203 — lodash `zipObjectDeep`/`set`/`setWith`/`merge`**: more pollution paths.
- **CVE-2019-11358 — jQuery `$.extend(true, {}, ...)`** with attacker-supplied JSON. Impacted Drupal, Backdrop, many SaaS apps.
- **CVE-2019-19919 — Handlebars**: compile-time helpers looked up on the prototype. Template compilation became RCE.
- **CVE-2026-40175 — axios header injection via pollution**: polluted `X-aws-ec2-metadata-token-ttl-seconds` bypassed IMDSv2, stole IAM creds. Fresh example of pollution → sink.

## JavaScript / Node

### Unsafe sinks

```ts
import _ from 'lodash';

function mergeConfig(userOverrides: unknown) {
  return _.merge({}, defaultConfig, userOverrides);   // Pre-patched lodash: pollution.
}

// User POSTs: {"__proto__":{"isAdmin":true}}
```

```ts
// jQuery $.extend with deep=true and user-supplied object
$.extend(true, {}, JSON.parse(userJson));
```

```ts
// Hand-rolled deep merge
function merge(target: any, source: any) {
  for (const key of Object.keys(source)) {
    if (typeof source[key] === 'object' && source[key] !== null) {
      target[key] = target[key] ?? {};
      merge(target[key], source[key]);           // Walks __proto__ if not guarded.
    } else {
      target[key] = source[key];
    }
  }
}
```

```ts
// Object.assign loop from user keys
for (const key of Object.keys(req.body)) {
  obj[key] = req.body[key];                      // Including obj["__proto__"] = ...
}
```

### Safe

```ts
// Current lodash with { __proto__: false } guards is safer, but still prefer explicit shapes.
import _ from 'lodash';  // 4.17.21+
const safe = _.merge({}, defaultConfig, userOverrides);

// Validate shape first
import { z } from 'zod';
const Config = z.object({ theme: z.enum(['light', 'dark']).optional() });
const validated = Config.parse(userOverrides);
const merged = { ...defaultConfig, ...validated };

// Use Map when keys are user-controlled
const byKey = new Map<string, any>();
for (const [key, value] of Object.entries(userKV)) {
  byKey.set(key, value);
}

// Use Object.create(null) for pure-map objects
const obj = Object.create(null);
```

### Express body-parser / qs / bodyParser.urlencoded

Express's `qs` library parses `a[b][c]=1` into nested objects. Combined with prototype pollution:

```
?a[__proto__][isAdmin]=true
```

If any downstream code merges this into an object, pollution lands. Mitigations:

- `qs.parse` with `{ parseArrays: false, allowPrototypes: false }` (default is `allowPrototypes: false` in recent versions).
- `body-parser` json with `strict: true`.
- Validate body with Zod/Yup before any merge/assign.

### Mongoose / Mongo query pollution

```ts
await User.findOne(req.body);   // {"__proto__":{...}} pollutes mongoose internals in some versions.
```

See `references/sql-injection.md` for operator-injection (`$where`, `$ne`) which is a different but co-located class.

## Python

Python has no prototype concept in the JavaScript sense. The equivalent class is **class-attribute pollution** via `setattr(obj, user_key, value)` or `obj.__class__.something`. Rare in practice but surfaces in:

- Mass assignment into ORM models unless polluted fields reach a code-execution sink.
- `setattr(django.conf.settings, user_key, value)` — never do this.

Treat this file as JS-primary.

## Ruby / PHP

Ruby has `Object#instance_variable_set(user_key, value)` as an analog but rarely reached. PHP has `__set`/`__get` magic with similar class-attribute concerns.

## Detection Heuristics

For every deep-merge / assign-loop match in a Node diff:

1. **Is the source object user-controlled?** Parsed body, query, webhook payload.
2. **Does the merge filter `__proto__`, `prototype`, `constructor`?** If not, pollution is possible.
3. **Is there a downstream sink that reads properties off shared objects?** Handlebars template compile, axios config, Function construction, auth-check objects.
4. **Library version**? lodash < 4.17.21, jQuery < 3.4.0 are vulnerable to the known pollution paths.

## False-Positive Traps

- `_.merge` in lodash 4.17.21+ defends against the classic payloads (not all, but the common ones). Still prefer explicit shapes.
- Shallow spread `{ ...obj }` does not trigger pollution by itself. The risk is recursive merges.
- Validated input (Zod/Yup/Joi/class-validator with `forbidNonWhitelisted`) before any merge is a defense.
- `JSON.parse` by itself does not pollute. Pollution happens when the parsed object is merged into something else.
- Assigning to a specific known key (`obj.name = userValue`) does not pollute.

## Diff Heuristics

1. New `_.merge(x, y, userData)` / `_.mergeWith` / `_.defaultsDeep` / `_.set` / `_.setWith` with user data.
2. New `$.extend(true, x, userData)` with user data.
3. Hand-rolled recursive merge that does not filter `__proto__` / `constructor` / `prototype`.
4. `Object.assign(x, userData)` with user data (shallow is fine; the risk is the keys).
5. `for (const k of Object.keys(userData)) x[k] = userData[k]` loop.
6. Adding the classic attack payload to a downstream sink's config object.
7. `qs.parse(req.url)` with `allowPrototypes: true` or on an old version.
8. Lodash version pin `< 4.17.21`, jQuery `< 3.4.0`.

## Verification Commands

```bash
# Lodash merge family
rg -n "_\.(merge|mergeWith|defaultsDeep|set|setWith|zipObjectDeep)\(" <project>

# jQuery extend
rg -n "\$\.extend\(\s*true," <project>

# Hand-rolled merges
rg -n 'function\s+(deep|merge|extend|assign)' <project> --type ts --type js

# Key-loop assignment
rg -n 'for\s*\(.*Object\.keys\(.*req\.' <project>

# qs settings
rg -n 'allowPrototypes|parseArrays' <project>

# Versions
jq '.dependencies.lodash, .dependencies.jquery' package.json
```
