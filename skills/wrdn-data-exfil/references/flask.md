# Flask Data-Exfiltration Reference

Load when the diff touches Flask file serving, error handlers, request-body logging, or static-file delivery. Ignore SSTI, Werkzeug debugger RCE, and `from_pyfile` unless they expose data.

## File Serving

### `send_file`

```python
# bad
@app.route("/download")
def download():
    return send_file(os.path.join("exports", request.args["name"]))
```

Path traversal. See `references/path-traversal.md`.

### `send_from_directory`

```python
return send_from_directory("exports", name)
```

Applies `safe_join` internally. Safer than manual `send_file`. Still flag if `name` includes scheme prefixes or absolute paths — `safe_join` rejects the obvious cases, but some Flask versions had bypasses; check the version.

## Error Handlers and DEBUG Stacks

`DEBUG = True` exposes:

- Full stack traces on 500 pages with local variable values.
- Loaded settings / config.
- Template source.
- The Werkzeug debugger (RCE; covered in the code-exec sibling).

The exfil angle is the stack/config leak.

```python
# bad
@app.errorhandler(Exception)
def handle(e):
    return jsonify({"error": str(e), "stack": traceback.format_exc()})
```

Exception messages often include SQL fragments, internal paths, config snippets. Return generic `{"error": "internal"}` and log details server-side.

## Request Logging

```python
@app.before_request
def log_request():
    app.logger.info("request %s %s: %s", request.method, request.path, request.get_data())
```

Every auth payload, every upload body, every webhook secret lands in logs. See `references/data-leakage.md`.

## Detection Heuristics

1. `send_file(os.path.join(base, user))` without containment check.
2. `send_from_directory(base, user)` on Flask versions with known `safe_join` bypasses.
3. `errorhandler` returning `str(e)`, `traceback.format_exc()`, or `repr()` in the response body.
4. `before_request` / `after_request` hook logging request bodies, headers, or full payloads.
5. `DEBUG = True` (Werkzeug debugger is RCE; this skill flags the stack-leak shape).

## False-Positive Traps

- `send_from_directory` applies `safe_join`; generally safe in current Flask.
- `errorhandler` returning a generic string is safe.
- `logger.debug(...)` behind a production-disabled level is acceptable, though scrub PII regardless.

## Verification Commands

```bash
rg -n 'send_file\(|send_from_directory\(' <project>
rg -n 'errorhandler|traceback\.format' <project>
rg -n 'before_request|after_request' <project>
rg -n 'DEBUG\s*=\s*True|app\.debug' <project>
```
