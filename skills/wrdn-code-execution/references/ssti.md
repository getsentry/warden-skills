# Server-Side Template Injection Reference

Load when the diff touches template rendering where the template *source* (not just the template *data*) could include user input: Jinja2 `render_template_string`, `jinja2.Template`, Handlebars `compile`, Pug `compile`, Freemarker, Velocity, Mustache with unsafe helpers, EJS, Twig.

The distinction is critical:

- `render_template("page.html", user=user)` — template file is on disk, values come from the request. **Safe.**
- `render_template_string(request.args["body"])` — template string comes from the request. **SSTI.**

## Detection Probe

PortSwigger's canonical probe: `{{7*'7'}}`. Returns `7777777` in Jinja2; `49` in a language that does numeric multiplication; unchanged in a non-template context. `{{7*7}}` tells you rendering is happening; `{{7*'7'}}` narrows the engine.

## Canonical CVEs and Real Incidents

- **CVE-2019-10906 — Jinja2 sandbox escape**: `str.format_map` bypassed the SandboxedEnvironment. `render_template_string("{{ ''.__class__.__mro__[1].__subclasses__() }}")` chains to `os.popen` or `subprocess.Popen`. Fixed in 2.10.1, but the sandbox has a history of bypasses; treat `SandboxedEnvironment` as soft armor, not prevention.
- **CVE-2016-10745 — Jinja2 older sandbox escape**.
- **CVE-2019-19919 — Handlebars prototype pollution to RCE**: direct invocation of internal helpers `helperMissing`/`blockHelperMissing` allowed pollution of `Object.prototype`, reachable during compile. Fixed in 4.3.0.
- **PortSwigger SSTI primer**: <https://portswigger.net/research/server-side-template-injection>

## Jinja2 (Python)

### Unsafe shapes

```python
from flask import render_template_string, Flask
app = Flask(__name__)

@app.route("/preview")
def preview():
    return render_template_string(request.args["body"])
```

```python
from jinja2 import Template
html = Template(user_submitted_template).render(data=data)
```

### Safe shapes

```python
# Fixed template on disk; user values passed as context.
return render_template("preview.html", body=request.args["body"])
```

```python
# Template file loaded from disk, not from the request.
from jinja2 import Environment, FileSystemLoader
env = Environment(loader=FileSystemLoader("templates"))
tmpl = env.get_template("preview.html")
return tmpl.render(body=request.args["body"])
```

### Sandbox caveats

`SandboxedEnvironment` restricts attribute access, but history shows repeated bypasses via format strings, attribute chains through `__class__`, and gadget chains. It's defense-in-depth, not prevention. Don't render user-submitted template source with it as your only line of defense.

### Flask `Markup` misuse

```python
return Markup(user_input)  # Disables autoescape. Not SSTI but XSS; parallel concern.
```

Not this skill's concern directly; ignore unless it reaches server-side template execution.

## Handlebars (Node)

### Unsafe

```ts
const tmpl = Handlebars.compile(req.body.template);
res.send(tmpl({ user: req.user }));
```

```ts
// Dynamic partial registration from user data
Handlebars.registerPartial(req.body.name, req.body.source);
```

### Safe

```ts
import { readFileSync } from 'fs';
const tmpl = Handlebars.compile(readFileSync('views/preview.hbs', 'utf8'));
res.send(tmpl({ user: req.user }));
```

Template source from disk; user values in the data object only.

### Prototype pollution vector

Pre-4.3.0, an attacker could register a "helper" via prototype pollution on `Object.prototype`. Combined with template compilation, produced RCE. Upgrade to 4.3.0+ and still avoid deep-merging untrusted input into config objects that Handlebars reads.

## Pug / Jade

### Unsafe

```ts
const pug = require('pug');
const html = pug.compile(req.body.src)({ user: req.user });
const html = pug.render(req.body.src);
```

### Safe

```ts
const html = pug.renderFile('views/preview.pug', { user: req.user });
```

### Sandbox

Pug has no sandbox. User-controlled template source is RCE. Full stop.

## EJS

### Unsafe

```ts
const ejs = require('ejs');
const html = ejs.render(req.body.template, { user: req.user });
```

EJS allows arbitrary JS in `<% %>` tags by default. No sandbox.

### Safe

```ts
const html = await ejs.renderFile('views/preview.ejs', { user: req.user });
```

## Freemarker / Velocity (Java)

Both engines have historical RCE via template source. `<#assign value="freemarker.template.utility.Execute"?new()>` chains are classic. In Spring applications, avoid passing user content through the template source path.

## Mustache / Handlebars "no-logic" claims

Mustache is "logic-less" and generally safer, but Handlebars and some other engines advertise as logic-less while still supporting helpers that can reach dangerous APIs. Read the engine's helper registration path before trusting the claim.

## Detection Heuristics

For every template-render call in a diff:

1. **Where does the template source come from?** Hardcoded string → safe. File on disk loaded by path → safe (unless the path is user-controlled; see `references/path-traversal.md`). Request body / query / DB field user-written → SSTI.
2. **Is the engine sandboxed?** Jinja2 `SandboxedEnvironment` is soft. Pug, EJS, Handlebars have none by default. Treat sandbox as defense-in-depth.
3. **Is the template-loader scope fixed?** `FileSystemLoader("templates")` is fine; `FileSystemLoader(user_dir)` is not.
4. **Does a helper registration path accept user data?** Handlebars `registerHelper`/`registerPartial` with user input is effectively template injection.

## False-Positive Traps

- `render_template("file.html", user=user)` with literal filename is safe.
- Template source from a hardcoded `readFileSync('views/x.hbs')` is safe.
- User values inside `<% %>` tags with `<%- escape(x) %>` (escaped interpolation) is XSS-adjacent, not SSTI (different skill).
- Mustache with no `registerHelper` use is genuinely logic-less and safe even with user data in values.

## Diff Heuristics

1. New `render_template_string(...)` with any argument that isn't a literal string.
2. New `jinja2.Template(x).render(...)` where `x` isn't a hardcoded literal.
3. New `Handlebars.compile(x)` where `x` isn't from `readFileSync`/`fs` of a fixed path.
4. New `pug.compile(x)` / `pug.render(x)` with non-literal `x`.
5. New `ejs.render(x, ...)` (prefer `renderFile` always).
6. `registerHelper` / `registerPartial` with user-influenceable name or source.
7. `FileSystemLoader(user_path)` or equivalent loader with dynamic root.

## Verification Commands

```bash
rg -n 'render_template_string|jinja2\.Template\(|Environment\(.*loader' <file>
rg -n 'Handlebars\.compile|pug\.compile|pug\.render|ejs\.render\(' <file>
rg -n 'registerHelper|registerPartial' <file>

# Jinja version (if sandbox is load-bearing)
grep -r 'jinja2' <project>/requirements.txt <project>/pyproject.toml 2>/dev/null
```
