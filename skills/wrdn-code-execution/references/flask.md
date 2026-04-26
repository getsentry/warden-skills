# Flask Code-Execution Reference

Load when the diff touches Flask templates, the Werkzeug debugger, or config-loading paths. Ignore path traversal, error-page leakage, and request-body logging unless they reach code execution.

## SSTI — Flask Is the Canonical Shape

`render_template_string` with user input is the most-cited SSTI bug in any framework:

```python
# bad
@app.route("/preview")
def preview():
    return render_template_string(request.args["body"])
```

```python
# safe
return render_template("preview.html", body=request.args["body"])
```

Detection probe (PortSwigger): `{{7*'7'}}` returns `7777777` if Jinja2 evaluates it.

Sandbox escape history: CVE-2019-10906, CVE-2016-10745. `SandboxedEnvironment` is defense-in-depth, not prevention.

Any new `render_template_string(x)` or `jinja2.Template(x)` where `x` does not trace to a literal is a finding.

## Werkzeug Debugger: `/console` RCE

`DEBUG = True` or `app.run(debug=True)` exposes the Werkzeug debugger. The debugger's `/console` endpoint is a Python REPL — direct code execution as the application user.

The PIN protection has historically been bypassed given any file-read primitive (the PIN is derivable from a few server-local facts: machine ID, username, app path). Combined with a path-traversal in the same app, the debugger PIN drops in seconds.

```python
# bad (in prod)
app.run(debug=True)
app.config["DEBUG"] = True

# safe
app.config["DEBUG"] = os.environ.get("FLASK_ENV") == "development"
```

Verbose stack traces are not enough here; the RCE angle is `/console`.

## Config Loading

`app.config.from_pyfile(path)` and `app.config.from_envvar("CONFIG_PATH")` execute arbitrary Python if `path` (or the file pointed to by the env var) is attacker-influenceable. Treat these as `exec` sinks when the path is not a literal.

```python
# bad
app.config.from_pyfile(request.args["path"])         # Executes the file as Python.
app.config.from_envvar("CONFIG")                     # If $CONFIG is attacker-set, RCE.
```

`from_pyfile` reads the file and evaluates it in the config namespace; arbitrary code at module level runs.

## Detection Heuristics

1. New `render_template_string(x)` / `jinja2.Template(x)` with non-literal `x`.
2. `DEBUG = True` / `app.debug = True` / `app.run(debug=True)` in a production-reachable config path.
3. `app.config.from_pyfile(user_path)` / `from_envvar` with attacker-controlled environment.

## False-Positive Traps

- `render_template("file.html", ...)` with literal filename is safe.
- `Markup(user)` / `|safe` is XSS-adjacent (different skill), not SSTI.
- DEBUG behind a real prod-mode guard is safe.
- `from_pyfile` with a hardcoded path is safe.

## Verification Commands

```bash
rg -n 'render_template_string|jinja2\.Template\(' <project>
rg -n 'app\.debug|DEBUG\s*=\s*True|app\.run\(debug' <project>
rg -n 'from_pyfile|from_envvar' <project>
```
