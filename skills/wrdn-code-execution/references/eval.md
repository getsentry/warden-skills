# eval / exec / Function / vm Reference

Load when the diff introduces dynamic code evaluation: `eval`, `exec`, `compile`, `Function`, `AsyncFunction`, `vm.runInNewContext`, `vm.runInThisContext`, `vm2`, `isolated-vm`, `import()` with dynamic paths, Ruby `eval` / `instance_eval`, PHP `assert` / `eval`.

The rule: every one of these APIs, with any path from an untrusted source to its argument, is RCE.

## Python

### Sinks

```python
eval(user_expr)                  # RCE.
exec(user_code)                  # RCE.
compile(user_code, ...)          # Not direct RCE, but paired with exec() it is.
```

### Safe alternatives

```python
import ast
value = ast.literal_eval(user_expr)   # Literals only: numbers, strings, tuples, lists, dicts, booleans, None.
```

`ast.literal_eval` parses but does not execute. Safe for user-supplied configs that are primitive structures.

### Where eval is legitimate

CLI admin tools, test harnesses, REPL. Sentry's `src/sentry/runner/commands/run.py` uses `eval(args)` as a CLI-only interface. Confirm the file role before flagging.

### Dynamic import

```python
import importlib
mod = importlib.import_module(user_modname)   # RCE if user_modname is attacker-controlled.
```

Module names from config/request can import arbitrary modules and their top-level code runs. Allowlist or skip.

## JavaScript / Node

### Sinks

```ts
eval(userCode);                              // RCE.
new Function(userCode)();                    // RCE.
new AsyncFunction(userCode)();               // RCE (via async iteration).
setTimeout(userCode, 0);                     // String arg → eval behavior. RCE.
setInterval(userCode, 0);                    // Same.
```

```ts
import vm from 'vm';
vm.runInNewContext(userCode);                // Pseudo-sandbox; see below.
vm.runInThisContext(userCode);               // RCE (same context).
```

```ts
// Dynamic import of user-controlled specifier
await import(userSpecifier);                 // RCE on many shapes (local path, HTTP URL w/ loaders).
```

### vm module is not a sandbox

Node's built-in `vm` module "isolates" variable scope but shares the same JavaScript realm. Objects leaked into the "sandbox" context via outer-scope references provide escape paths. Not suitable for untrusted code.

### vm2 — abandoned

vm2 promised a real sandbox. History of sandbox escape CVEs:

- CVE-2023-29017 — `Error.prepareStackTrace` got a host-realm object for unhandled async errors.
- CVE-2023-32314 — crafted `Proxy` spec constructed host `Function`.
- CVE-2023-37903 — final break; project abandoned.

**Any code using vm2 is a finding.** The library cannot be patched to be safe.

### isolated-vm — safer, with care

isolated-vm runs a separate V8 isolate. Much harder to escape than vm2. Still has footguns:

- `Reference.copy()` / `Reference.applySync()` on untrusted input can deserialize host objects if misused.
- Large output buffers can leak data out of the isolate.
- Requires careful bridging; a wrong bridge gives the isolate a path back to host.

Not automatically a finding, but any use warrants review of the bridge surface.

### Next.js React2Shell — CVE-2025-55182

Server-side `Function()`/`eval` reached from a data-binding path in a production Next.js app. See `references/nextjs.md` for the Server Action angle.

### setTimeout / setInterval string form

```ts
setTimeout("doSomething(" + userInput + ")", 0);  // String argument evaluated like eval.
```

Any call that passes a string (rather than a function) to `setTimeout` or `setInterval` is an eval-equivalent sink.

## Ruby

```ruby
eval(user_code)                  # RCE.
instance_eval(user_code)         # RCE.
class_eval(user_code)            # RCE.
send(user_method, *args)         # Method-name injection; attacker picks the method.
```

`send` with a user-controlled method name is a weaker eval but can still reach `system`, `exec`, `eval`, `instance_eval` if the symbol resolves to any of them.

## PHP

```php
eval($user_code);               // RCE.
assert($user_code);             // assert with a string argument pre-PHP 7.2 evaluates as code.
```

`assert` is deprecated in PHP 7.2 for strings, removed in 8.0. Legacy code still has it.

## Java / JVM

```java
// Nashorn / GraalJS / Rhino
ScriptEngine engine = new ScriptEngineManager().getEngineByName("nashorn");
engine.eval(userScript);          // RCE (Nashorn deprecated but still shipped).
```

```java
// Spring SpEL
ExpressionParser parser = new SpelExpressionParser();
parser.parseExpression(userExpr).getValue();   // RCE via SpEL.
```

SpEL injection is the Spring4Shell neighbor. User-controlled SpEL expressions reach `T(java.lang.Runtime).getRuntime().exec(...)`.

## Detection Heuristics

For every match:

1. **Is the argument trace to an untrusted source?** Request body / query / headers / webhook payload / DB field user-written.
2. **Is there a validator in between?** A schema validator that restricts the input to primitives makes the sink uninteresting.
3. **Is the sink in a legitimate context?** CLI admin tools, test harnesses, developer REPLs, offline batch jobs. Confirm file role.
4. **Library version?** vm2 any version is RCE. Nashorn deprecated but present in older JDKs.

## False-Positive Traps

- `ast.literal_eval` in Python is safe.
- `JSON.parse` and `json.loads` are not eval.
- `eval` inside `tests/`, `spec/`, notebooks, or an explicit sandboxed REPL is not production-reachable.
- `setTimeout(fn, ms)` with a function argument (not a string) is fine.
- `new Function("return 1+1")()` with a literal argument is fine.
- Dynamic imports where the specifier comes from a hardcoded allowlist are safe.
- Spring SpEL with a hardcoded template expression is safe.

## Diff Heuristics

1. New `eval(`, `exec(`, `compile(` with any non-literal argument in production code.
2. New `Function(` / `new Function(` with attacker-reachable arguments.
3. Any use of `vm2` (deprecated and RCE-prone).
4. `vm.runInNewContext` / `vm.runInThisContext` with user data.
5. Dynamic `import(user_value)` or `require(user_value)`.
6. `setTimeout`/`setInterval` with a string first argument.
7. Ruby `eval`/`instance_eval`/`class_eval` with request data.
8. PHP `eval($user_*)` or `assert($user_*)`.
9. Spring `parser.parseExpression(user_*)`.
10. Nashorn / GraalJS / Rhino `engine.eval(user_*)`.

## Verification Commands

```bash
# Python
rg -n '\beval\(|\bexec\(|\bcompile\(' <file> | rg -v 'test|spec'

# JavaScript/TypeScript
rg -n '\beval\(|new Function\(|new AsyncFunction\(|vm\.runInNewContext|vm\.runInThisContext|vm2' <file>

# Ruby
rg -n '\beval\(|instance_eval|class_eval|\.send\(' <file>

# PHP
rg -n '\beval\(|\bassert\(' <file>

# Java / Spring
rg -n 'scriptEngine\.eval|parser\.parseExpression|SpelExpressionParser' <file>

# Dynamic imports
rg -n '\bimport\s*\(' <file>
rg -n 'importlib\.import_module|__import__' <file>
```
