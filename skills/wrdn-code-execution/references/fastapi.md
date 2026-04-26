# FastAPI Code-Execution Reference

Load when the diff touches Jinja2 template rendering, `BackgroundTasks` invoking subprocess, WebSocket message handlers that deserialize, or any `eval`/`exec` reach. Ignore response-model leakage, file serving, and SSRF unless they reach code execution.

## Jinja2Templates

```python
from fastapi.templating import Jinja2Templates
templates = Jinja2Templates(directory="templates")

@app.get("/page")
async def page(request: Request):
    return templates.TemplateResponse("page.html", {"request": request})
```

Safe with a literal template name. Unsafe shapes:

- `templates.TemplateResponse(user_name, ...)` — template-name traversal; can render arbitrary `.html` files inside the templates dir or via `..` outside it.
- Raw `jinja2.Template(user_source).render(...)` outside the helper — full SSTI.
- `Jinja2Templates(directory=user_dir)` — loader scope from user input.

See `references/ssti.md` for the full SSTI treatment.

## BackgroundTasks With Subprocess

```python
@app.post("/run")
async def run(cmd: str, background_tasks: BackgroundTasks):
    background_tasks.add_task(subprocess.run, cmd, shell=True)   # Command injection, deferred.
```

`BackgroundTasks` defers the call; sink semantics are unchanged. Same rules as `references/command-injection.md`.

## WebSocket Handlers

WebSockets bypass HTTP-level body validation. Whatever the client sends arrives as a message string or bytes. If a WS handler `pickle.loads`, `yaml.load`, or `eval`s the message, it's RCE.

```python
@app.websocket("/ws")
async def ws(websocket: WebSocket):
    await websocket.accept()
    while True:
        data = await websocket.receive_text()
        result = eval(data)                       # RCE.
        await websocket.send_text(str(result))
```

## Dependency Injection With Sink

```python
async def get_handler_class(handler_name: str = Query(...)):
    return importlib.import_module(handler_name)        # Dynamic import; module top-level runs.
```

Module names from the request reach `import_module` and execute arbitrary code at import time.

## Detection Heuristics

1. `templates.TemplateResponse(user_value, ...)` — non-literal template name.
2. `jinja2.Template(user_source).render(...)` — raw template construction.
3. `BackgroundTasks.add_task(subprocess.*, shell=True, ...)` with user data.
4. WebSocket handler calling `eval`, `pickle.loads`, `yaml.load`, or other RCE sink on incoming data.
5. `importlib.import_module(...)` / `__import__(...)` with user-provided module name.

## False-Positive Traps

- `templates.TemplateResponse("literal.html", ...)` is safe.
- `BackgroundTasks.add_task(some_function, arg)` calling a normal Python function is fine — the issue is when the function is `subprocess.*` or another sink.
- WebSocket handler that uses `pydantic.BaseModel.parse_raw` (validating to a typed model) is safe.

## Verification Commands

```bash
rg -n 'templates\.TemplateResponse\(|jinja2\.Template\(' <project>
rg -n 'BackgroundTasks|background_tasks' <project>
rg -n '@app\.websocket\(|websocket\.receive_' <project>
rg -n 'importlib\.import_module|__import__' <project>
```
