# FastAPI Data-Exfiltration Reference

Load when the diff touches Pydantic response models, FastAPI endpoints returning ORM data, file responses, static-file mounting, or outbound HTTP calls. Ignore Jinja2 templates, BackgroundTasks-with-subprocess, and WebSocket sinks unless they expose data.

## Missing `response_model`

FastAPI returns whatever the handler produces. Without `response_model`, an ORM row with every column reaches the response.

```python
# bad
@app.get("/users/{id}")
async def get_user(id: int):
    return await db.fetch_one("SELECT * FROM users WHERE id = :id", {"id": id})

# safe
class UserPublic(BaseModel):
    id: int
    display_name: str

@app.get("/users/{id}", response_model=UserPublic)
async def get_user(id: int):
    return await db.fetch_one("SELECT * FROM users WHERE id = :id", {"id": id})
```

`response_model` filters output against declared fields. Every new endpoint returning DB data should declare one.

## Pydantic `extra = "allow"` on Response DTOs

Real: Sentry commit `0c0aae90ac1`. A DTO with `extra = "allow"` passes arbitrary posted fields through to the response.

```python
# bad
class SeerState(BaseModel):
    class Config:
        extra = "allow"
    user_query: str

# safe
class SeerState(BaseModel):
    class Config:
        extra = "ignore"
    user_query: str
    internal_trace: str = Field(exclude=True)
```

Pydantic v2: `model_config = ConfigDict(extra="ignore")`.

## File Responses

```python
from fastapi.responses import FileResponse

@app.get("/download")
async def download(name: str):
    return FileResponse(f"exports/{name}")        # Path traversal.
```

```python
# safe
from pathlib import Path
BASE = Path("exports").resolve()

@app.get("/download")
async def download(name: str):
    target = (BASE / name).resolve()
    if not target.is_relative_to(BASE):
        raise HTTPException(403)
    return FileResponse(target)
```

`StaticFiles(directory=user_config_dir)` is the same risk at the mount layer. Mounting a literal directory is safe.

## Query / Path Parameter Validation

```python
async def get_report(report_name: str = Query(...)):
    return FileResponse(f"reports/{report_name}")    # Anything goes.
```

```python
async def get_report(report_name: str = Query(..., regex="^[a-z0-9_]+$")):
    ...
```

## Outbound HTTP

FastAPI has no built-in HTTP client. Applications use `httpx` / `requests`. SSRF rules from `references/ssrf.md` apply unchanged.

## Error Handlers

Default 500 handler returns generic. Custom error handlers can leak:

```python
# bad
@app.exception_handler(Exception)
async def handler(req: Request, exc: Exception):
    return JSONResponse({"error": str(exc), "trace": traceback.format_exc()})
```

## Detection Heuristics

1. Endpoint returning DB data without `response_model`.
2. Pydantic Config with `extra = "allow"` on a response DTO (v1 `Config` or v2 `model_config`).
3. `FileResponse(f"{base}/{user}")` without containment check.
4. `StaticFiles(directory=variable)` where variable is not a literal.
5. `Query(...)` / `Path(...)` param feeding a sink without regex/enum narrowing.
6. Custom exception handler returning `traceback.format_exc()` or `str(exc)` with internal detail.
7. `httpx.get(user_url)` without SSRF guard — see `references/ssrf.md`.

## False-Positive Traps

- `response_model=SomeModel` is a defense.
- `Jinja2Templates` with literal filename is safe (template path traversal); the SSTI angle is in the sibling skill.
- `FileResponse(Path)` with prior containment check is safe.
- `Query(..., regex=...)` constrains the value.

## Verification Commands

```bash
rg -n '@app\.(get|post|put|delete|patch)\(' <project> | rg -v 'response_model'
rg -n "extra\s*=\s*['\"]allow['\"]|model_config\s*=.*extra" <project>
rg -n 'FileResponse\(' <project>
rg -n 'StaticFiles\(directory' <project>
rg -n '@app\.exception_handler' <project>
```
