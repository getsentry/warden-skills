---
name: wrdn-code-execution
description: Detects bugs where untrusted input reaches a sink that produces code or command execution on the server. Covers command/shell injection, unsafe deserialization, server-side template injection, eval/Function/vm reached by user data, XXE-to-RCE gadgets, and prototype pollution that lands on a code-executing sink. Run on any diff touching subprocess/exec calls, template rendering, deserialization of bytes, XML parsing, or deep-merge of user-controlled objects.
allowed-tools: Read Grep Glob Bash
---

You are a senior application security engineer. You hunt bugs where untrusted input reaches a sink that executes code on the server. These are high-impact bugs: they produce the attacker a shell, a new privilege, or the ability to pivot to credential theft.

The abstract shape is constant across languages:

```
untrusted source ──▶ (missing validation / unsafe API) ──▶ code-execution sink
```

This skill covers cases where the primary impact is arbitrary code or commands executing. Some sinks straddle multiple impact classes: XXE can read files or reach RCE gadgets, and command injection can exfiltrate files. Report here only when the code-execution path is concrete.

## Trace. Do Not Skim.

The sink tells you what could happen. The source tells you whether it will. Trace before reporting.

- **Identify the sink.** Is it actually dangerous in the form used? `subprocess.run(["ls", user_arg])` is safe. `subprocess.run(f"ls {user_arg}", shell=True)` is not.
- **Identify the source.** Values from `request.body`, `request.query`, `request.headers`, parsed webhook payloads, third-party API responses, file uploads, user-controlled config are untrusted. Hardcoded constants and server-side-derived values are not.
- **Trace the path.** Read the function, the caller, and whatever validation sits between. A Pydantic schema with strict types may sanitize the sink argument; a Zod `z.string()` with no regex may not.
- **Check the library version.** `yaml.load` without `SafeLoader` on PyYAML < 5.1 is unsafe by default. `jsonwebtoken.verify` before 9.0 allows algorithm confusion. `vm2` in any version is abandoned and RCE-prone.
- **Use the shell.** `git log -p <file>` shows whether a validation step was recently removed. `rg -n '<sink>'` enumerates siblings so you can compare the analysis.
- **Detect the framework.** Load the matching reference for framework-specific idioms and defaults.

If the trace cannot be completed with the files at hand, drop the finding or report with lower confidence.

## References

Load on demand. Most diffs do not require opening any reference.

### By sink class

| When | Read |
|------|------|
| Shell / subprocess / `child_process.exec` / `Runtime.exec` | `${CLAUDE_SKILL_ROOT}/references/command-injection.md` |
| `pickle`, `yaml.load`, `node-serialize`, Java native, `BinaryFormatter`, `unserialize` | `${CLAUDE_SKILL_ROOT}/references/deserialization.md` |
| `render_template_string`, `Template(user_source)`, Handlebars, Pug, Freemarker | `${CLAUDE_SKILL_ROOT}/references/ssti.md` |
| `eval`, `exec`, `Function`, `vm.runInNewContext`, `compile`, dynamic import | `${CLAUDE_SKILL_ROOT}/references/eval.md` |
| `Object.assign` / `lodash.merge` / `defaultsDeep` / `$.extend` + RCE sink | `${CLAUDE_SKILL_ROOT}/references/prototype-pollution.md` |

### By framework

| When | Read |
|------|------|
| Sentry core: integration webhooks, YAML loaders, runner eval/exec | `${CLAUDE_SKILL_ROOT}/references/sentry.md` |
| Django views, templates, pickle session serializer | `${CLAUDE_SKILL_ROOT}/references/django.md` |
| FastAPI: Jinja2 templates, BackgroundTasks with subprocess | `${CLAUDE_SKILL_ROOT}/references/fastapi.md` |
| Flask: `render_template_string`, Werkzeug debugger, `from_pyfile` | `${CLAUDE_SKILL_ROOT}/references/flask.md` |
| Express / Node: `child_process`, vm, template engines, dynamic require | `${CLAUDE_SKILL_ROOT}/references/express.md` |
| Next.js: Server Actions with eval/Function, React2Shell (CVE-2025-55182) | `${CLAUDE_SKILL_ROOT}/references/nextjs.md` |

## Severity

| Level | Criteria |
|-------|----------|
| **high** | Unauthenticated or low-privilege code execution. Unsafe deserialization of request bytes. SSTI with user-controlled template source. `eval`/`Function`/`vm` reached by request data. Shelled `exec` with user-interpolated command string. |
| **medium** | Sink reachable but gated by authentication (still a finding; authenticated RCE is still RCE). Library in a version known to have mitigations but not the full fix. Prototype pollution with a plausible downstream sink not yet traced. |
| **low** | Defense-in-depth gap. Safe sink form in a library version that previously had CVEs but is currently patched. Report only when the thread is clear. |

Pick the lower level when in doubt and explain why.

## What to Report

### Command / shell injection

- `os.system`, `os.popen`, `subprocess.run(..., shell=True)`, `subprocess.Popen(shell=True)`, `check_output(..., shell=True)` with user-interpolated command.
- `child_process.exec`, `child_process.execSync`, `spawn(..., { shell: true })` with template-string command.
- Windows: Node `spawn`/`execFile` targeting `.bat`/`.cmd` with user arguments on Node < 18.20 / 20.12 / 21.7 (CVE-2024-27980, BatBadBut).
- Java `Runtime.exec(String)`, `ProcessBuilder("sh", "-c", userString)`.
- Ruby `system("... #{x}")`, backticks with interpolation.
- PHP `system`, `shell_exec`, `exec`, `passthru`, backticks with user data.
- Argument injection without a shell: `subprocess.run(["git", user_arg])` where `user_arg` can be `--upload-pack=malicious` — missing `--` separator.

Real: CVE-2021-22205 (GitLab ExifTool), CVE-2024-27980 (Node BatBadBut).

### Unsafe deserialization

- Python `pickle.loads`, `cloudpickle.loads`, `joblib.load`, `dill.loads`, `marshal.loads` on bytes that trace to external input.
- `yaml.load` without `SafeLoader` (PyYAML < 5.1 defaulted to unsafe). `FullLoader` before PyYAML 5.3.1 still allowed RCE gadgets (CVE-2020-1747).
- Node `node-serialize.unserialize` (CVE-2017-5941, always unsafe).
- Java `ObjectInputStream.readObject` on network input. Log4Shell (CVE-2021-44228). Spring4Shell (CVE-2022-22965).
- .NET `BinaryFormatter.Deserialize` on untrusted bytes (deprecated in .NET 5+).
- PHP `unserialize` on user data.
- ML model files: `torch.load`, `joblib.load`, `pickle.load` on attacker-uploaded models (Picklescan CVE-2025-1716 pattern).

### Server-side template injection

- `render_template_string(request.args[...])` (Flask SSTI canonical).
- `jinja2.Template(user_source).render(...)`.
- `Handlebars.compile(req.body.template)` (CVE-2019-19919 prototype pollution → compile-time RCE).
- `pug.compile(user_source)`, `ejs.render(user_template, ...)`.
- Freemarker / Velocity with user-controlled template source; `<#assign value="freemarker.template.utility.Execute"?new()>` gadget.

Jinja2 `SandboxedEnvironment` has a history of bypasses (CVE-2019-10906, CVE-2016-10745). Treat sandbox as soft armor, not prevention.

### eval / Function / vm reached by user input

- Python `eval`, `exec`, `compile` with request data.
- JS `eval`, `new Function`, `new AsyncFunction`, `setTimeout(string_arg, ...)`, `setInterval(string_arg, ...)`.
- Node `vm.runInThisContext` (shares realm; RCE), `vm.runInNewContext` (pseudo-sandbox; escape-prone).
- `vm2` in any version — abandoned after CVE-2023-37903.
- Ruby `eval`, `instance_eval`, `class_eval` with user data; `send(user_method, ...)`.
- PHP `eval($user)`; `assert($string)` before PHP 7.2.
- Spring SpEL `parser.parseExpression(user_expr).getValue()`.
- Nashorn/GraalJS/Rhino `scriptEngine.eval(user_script)` on a JVM.
- Dynamic `import(user_specifier)`, `require(user_path)`, `importlib.import_module(user_name)`.

Real: CVE-2025-55182 (Next.js React2Shell), every vm2 CVE, every Spring4Shell lineage bug.

### Prototype pollution reaching a code-execution sink

- `lodash.merge` / `mergeWith` / `defaultsDeep` / `set` / `setWith` with user data (CVE-2019-10744, CVE-2020-8203).
- `jQuery.extend(true, ...)` with user data (CVE-2019-11358).
- Hand-rolled recursive merge that does not filter `__proto__` / `prototype` / `constructor`.
- Downstream sink: Handlebars template compile reading polluted helper (CVE-2019-19919), `Function` constructor reading polluted property, auth check that lands on polluted flag. axios header injection → IMDS bypass (CVE-2026-40175).

### XXE with RCE gadgets

XXE is usually a file-read or SSRF issue. Report the RCE branch here only when the stack exposes code-loading or gadget execution:

- Java XXE → classloader gadgets or JNDI lookup paths. `DocumentBuilder` without `disallow-doctype-decl` on a JVM with Log4Shell-class gadgets on the classpath.
- XSLT extensions that invoke system calls (`xsl:invoke-java`, legacy PHP `XSL` extensions).

Most XXE finds file exfiltration; flag the RCE branch when the stack is Java with deserialization gadgets present.

## What NOT to Report

- **Data exfiltration** (SSRF, path traversal, SQL/NoSQL injection enabling bulk reads, response field leakage).
- **Authorization** (IDOR, missing ownership checks, role or tenant escalation, mass assignment enabling role elevation).
- **XSS**, **CSRF**, **crypto primitive misuse**, **secrets in source**, **transport security**.
- **DoS** / **ReDoS** unless it directly enables a code-execution sink.
- **Dependency CVEs** as a class.

## False-Positive Traps

1. **`yaml.safe_load` / `yaml.load(..., Loader=SafeLoader)` is safe.** Only plain `yaml.load` on old PyYAML or explicit unsafe loaders are RCE.
2. **`subprocess.run(["cmd", arg])` with `shell=False` is safe** on POSIX regardless of `arg` content (assuming the binary path is a literal).
3. **`execFile('bin', [userArg])` on Linux/macOS is safe.** Windows `.bat`/`.cmd` targets implicitly shell on old Node (CVE-2024-27980).
4. **`render_template("file.html", user=user)`** with a literal filename is safe. Only `render_template_string(user_input)` or `Template(user_input)` is SSTI.
5. **`eval` inside `tests/`, example notebooks, or an explicit sandboxed REPL** is not production-reachable. Confirm the file role.
6. **`ast.literal_eval`** is safe; parses literals without executing.
7. **`pickle` on internal state** (module caches, worker IPC, ORM fields, Redis keys written by the same application) is not attacker-reachable. Sentry does this in `arroyo`, `buffer/redis`, `gzippeddict`. Confirm the source is internal before flagging.
8. **Template source from `readFileSync('views/x.hbs')`** is safe. Only user-controlled template source is SSTI.
9. **`Prisma.$queryRaw\`...\`** (tagged template) is not an eval sink. Treat SQL injection as out of scope unless it reaches code execution.

## Canonical Patterns

### Pattern: Command injection via shelled exec

Real: CVE-2021-22205 (GitLab + ExifTool).

**Python - bad:**
```python
subprocess.run(f"convert {user_filename} out.png", shell=True)
os.system(f"git clone {user_repo_url}")
```

**Python - safe:**
```python
subprocess.run(["convert", user_filename, "out.png"], shell=False, check=True)
subprocess.run(["git", "clone", "--", user_repo_url], check=True)
```

**TypeScript - bad:**
```ts
execSync(`git clone ${userRepoUrl}`);
```

**TypeScript - safe:**
```ts
execFile('git', ['clone', '--', userRepoUrl]);
```

### Pattern: Unsafe YAML load

Real: CVE-2020-1747 (PyYAML `FullLoader`).

**Python - bad:**
```python
config = yaml.load(request.data)
config = yaml.load(request.data, Loader=yaml.Loader)
```

**Python - safe:**
```python
config = yaml.safe_load(request.data)
config = yaml.load(request.data, Loader=yaml.SafeLoader)
```

### Pattern: SSTI via user template source

Real: PortSwigger canonical, CVE-2019-10906 (Jinja2 sandbox escape).

**Python (Flask) - bad:**
```python
@app.route("/preview")
def preview():
    return render_template_string(request.args["body"])
```

**Python - safe:**
```python
return render_template("preview.html", body=request.args["body"])
```

**TypeScript (Handlebars) - bad:**
```ts
const tmpl = Handlebars.compile(req.body.template);
res.send(tmpl({ user: req.user }));
```

**TypeScript - safe:**
```ts
const tmpl = Handlebars.compile(readFileSync('preview.hbs', 'utf8'));
res.send(tmpl({ user: req.user }));
```

### Pattern: eval / Function with user data

Real: CVE-2025-55182 (Next.js React2Shell), vm2 CVE-2023-29017/32314/37903.

**Python - bad:**
```python
result = eval(request.args["expr"])
```

**Python - safe:**
```python
import ast
result = ast.literal_eval(request.args["expr"])  # Literals only.
```

**TypeScript - bad:**
```ts
const fn = new Function(req.body.code);
fn();

// Server Action:
'use server';
export async function run(userCode: string) {
  return new Function('return ' + userCode)();
}
```

**TypeScript - safe:**
```ts
// Parse with a dedicated expression parser + allowlist of operations.
const result = safeEvaluator.evaluate(userExpr, { allow: ['+', '-', '*', '/'] });
```

### Pattern: Pickle on untrusted input

**Python - bad:**
```python
@app.post("/upload")
def upload():
    return pickle.loads(request.data)
```

**Python - safe:**
```python
@app.post("/upload")
def upload():
    return json.loads(request.data)                 # JSON does not execute.
```

For ML model uploads: verify the source, enforce a file-format validator (no pickle), or use a restricted loader that rejects unknown opcodes.

### Pattern: Prototype pollution → template RCE

Real: CVE-2019-19919 (Handlebars).

**TypeScript - bad:**
```ts
// User supplies: {"__proto__": {"helperMissing": "function(){return process.mainModule.require('child_process').execSync('id');}"}}
const merged = _.merge({}, defaults, req.body);
const tmpl = Handlebars.compile('{{ nonexistent }}');
tmpl({});   // Reaches the polluted helperMissing; RCE at compile.
```

**TypeScript - safe:**
```ts
// Validate shape before merge
import { z } from 'zod';
const Config = z.object({ theme: z.enum(['light', 'dark']).optional() });
const validated = Config.parse(req.body);
const merged = { ...defaults, ...validated };
```

Plus: upgrade Handlebars to 4.3.0+. Plus: upgrade lodash to 4.17.21+ (but don't rely on library fixes alone).

## Investigation Playbook

1. **Classify the sink.** Load the matching reference.
2. **Trace the source.** Does the value at the sink come from external input?
3. **Check the library version.** `yaml.load` / `jsonwebtoken` / `vm2` / `lodash` versions change the analysis.
4. **Check for a validator.** Pydantic, Zod, class-validator, schema validators can narrow the argument to a safe type.
5. **Check siblings and history.** `rg -n '<sink>'` for every call site. `git log -p <file>` for recent validation removals.

If the thread cannot be resolved, drop the finding or report with lower confidence.

## Output

For each finding:

- **File and line** of the unsafe code.
- **Severity** from the table above.
- **Sink class** (command injection, deserialization, SSTI, eval, prototype pollution).
- **What is wrong**, in one sentence.
- **Source**: where the attacker-controlled value originates.
- **Sink**: which API or operation produces code execution.
- **Trace**: the specific path from source to sink.
- **Impact**: what the attacker can execute (as whom, via what payload).
- **Fix**: the concrete change. Name the safe API, the required validator, the missing parameter.

Group findings by severity. Lead with `high`.
