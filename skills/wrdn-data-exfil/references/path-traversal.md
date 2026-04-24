# Path Traversal and Archive-Extraction Reference

Load when the diff touches file I/O with paths derived from user input, static file serving, file downloads, uploads, or archive extraction (`tarfile`, `zipfile`, `jszip`, `adm-zip`, `node-tar`).

Two related classes:

1. **Path traversal**: `..` sequences or absolute paths escape an intended directory and read/write arbitrary files.
2. **Zip-slip / tar-slip**: archive entries with `..` or absolute paths extract outside the target directory.

Both reduce to the same validation: after constructing the target path, it must still be inside the intended base directory.

## The Core Rule

```
resolved_target = realpath(base + user_path)
if not resolved_target.startswith(realpath(base)):
    reject
```

`realpath` / `os.path.realpath` / `Path.resolve()` normalizes `..`, symlinks, and redundant separators. Comparing the normalized target against the normalized base is the only reliable check.

String-level checks (e.g., `".." not in user_path`) fail because:

- URL-encoded traversal: `%2e%2e%2f`.
- Double-encoded: `%252e%252e%252f`.
- Unicode normalization forms: `．．／`.
- Platform differences: `\` vs `/` vs backslash-escapes.
- Symlink targets that point outside the base.
- Absolute paths in `path.join(base, user)` replace the base entirely (Node `path.join`, Python `os.path.join`).

## Python

### Unsafe

```python
@app.get("/download")
def download(name: str):
    return send_file(os.path.join("/var/app/exports", name))
# ?name=../../etc/passwd escapes.
# ?name=/etc/passwd — os.path.join discards "/var/app/exports" entirely; returns /etc/passwd.
```

### Safe

```python
from pathlib import Path

BASE = Path("/var/app/exports").resolve()

@app.get("/download")
def download(name: str):
    target = (BASE / name).resolve()
    if not target.is_relative_to(BASE):   # Python 3.9+
        abort(403)
    if not target.is_file():
        abort(404)
    return send_file(target)
```

`Path.is_relative_to` is the clean check. Pre-3.9, use `str(target).startswith(str(BASE) + os.sep)`.

### tarfile / zipfile — CVE-2007-4559 is eighteen years old and still recurring

```python
# UNSAFE
with tarfile.open(user_upload) as tar:
    tar.extractall("/var/app/tmp")
```

tarfile does not sanitize `..` or absolute paths. Any member can write anywhere the process has permission. Python 3.12 added an extraction filter (`filter="data"`) that rejects unsafe members.

```python
# SAFE (3.12+)
with tarfile.open(user_upload) as tar:
    tar.extractall("/var/app/tmp", filter="data")
```

Older Python:

```python
def safe_extract(tar, target):
    target = Path(target).resolve()
    for member in tar.getmembers():
        member_path = (target / member.name).resolve()
        if not member_path.is_relative_to(target):
            raise RuntimeError(f"unsafe path in archive: {member.name}")
    tar.extractall(target)
```

`zipfile.extractall` sanitizes `..` as of Python 3.6.2 but still allows absolute paths on some platforms and does not defend against symlinks in the archive.

### send_from_directory (Flask)

```python
return send_from_directory("/var/app/exports", name)   # Flask does safe_join internally.
```

Flask's `send_from_directory` applies `safe_join`, which checks the target path after resolution. Generally safe, unless an earlier handler reshaped the filename.

### Static file serving

Serving static files is fine with the framework's default handler (`send_file`, `StaticFiles`, `express.static` with a fixed root). The bugs come from custom handlers that re-roll path construction.

## JavaScript / Node

### Unsafe

```ts
app.get('/download', (req, res) => {
  res.sendFile(path.join('/var/app/exports', req.query.name));
  // ?name=../../etc/passwd escapes.
  // ?name=/etc/passwd — path.join returns /etc/passwd on absolute.
});
```

### Safe

```ts
import path from 'path';

const BASE = path.resolve('/var/app/exports');

app.get('/download', (req, res) => {
  const target = path.resolve(BASE, String(req.query.name));
  if (!target.startsWith(BASE + path.sep)) return res.sendStatus(403);
  res.sendFile(target);
});
```

### Express `res.sendFile` options

`res.sendFile(name, { root })` with a `root` option and `name` that does not start with `/` or include `..` is safer than manual joining. But if `name` comes from the request unvalidated, the `..` check kicks in and rejects.

### Archive extraction

```ts
// UNSAFE
import AdmZip from 'adm-zip';
new AdmZip(userUpload).extractAllTo('/var/app/tmp');
```

`adm-zip` has had zip-slip CVEs. Use `node-tar` or `yauzl` with explicit entry-path validation.

```ts
// UNSAFE — jszip CVE-2022-48285
const zip = await JSZip.loadAsync(userBuffer);
for (const [name, entry] of Object.entries(zip.files)) {
  const target = path.join('/var/app/tmp', name);    // No validation.
  await fs.writeFile(target, await entry.async('nodebuffer'));
}
```

Same as Python: resolve and check.

### Static serving

`express.static(root)` with a fixed root applies path normalization. Safe if `root` is a literal.

`express.static('.')` or `express.static(rootDir)` with `rootDir` from config where the config could include `/` exposes the filesystem.

## Java

```java
File file = new File("/var/app/exports", userFilename);  // userFilename can escape.
File resolved = file.getCanonicalFile();
if (!resolved.toPath().startsWith(Paths.get("/var/app/exports"))) {
    throw new SecurityException();
}
```

## Incidents

- **CVE-2007-4559** — Python tarfile. Still exploitable in code using the pre-3.12 defaults. Affected pip, Django, many ML libraries.
- **CVE-2022-48285** — jszip zip-slip.
- **CVE-2023-26111 / 26152 / 26126** — node-static / static-server / m.static. Leaked `/etc/passwd`, `.env`.
- Werkzeug / Flask `safe_join` bypasses historically. Use framework helpers, verify version.

## Detection Heuristics

For every file I/O in a diff:

1. **Is any part of the path user-controlled?** Path param, query, body field, header (e.g., `Content-Disposition` filename from upload).
2. **Does the code use `realpath` / `resolve` / `getCanonicalFile` and check containment?** If no, almost certainly a finding.
3. **If it's `path.join` / `os.path.join`**: absolute user input wipes the base. `path.join('/base', '/etc/passwd')` returns `/etc/passwd`.
4. **If it's archive extraction**: is there per-entry path validation, or does the code trust the archive?

## False-Positive Traps

- `send_from_directory` (Flask) applies `safe_join`.
- `express.static(fixedRoot)` with a literal is safe for framework-served files.
- `os.path.join` followed by a canonical-path containment check is safe.
- Filenames derived from a server-side-generated UUID or hash are safe.
- Python 3.12+ `tarfile.extractall(..., filter="data")` is safe.
- `zipfile.extractall` in Python 3.6.2+ prevents `..` but not symlinks or absolute paths on some platforms; still flag for symlink awareness if the archive source is untrusted.

## Diff Heuristics

1. New `send_file(os.path.join(base, user_arg))` without resolution check.
2. New `res.sendFile(path.join(root, req.*))` without `startsWith(root)` check.
3. `open(user_path)` / `fs.readFile(user_path)` / `fopen($user_path)` / `File.ReadAllText(user)`.
4. `tarfile.extractall` without `filter="data"` on Python 3.12+ or without a manual containment check on older.
5. `zipfile.extractall` on an archive from an untrusted source without per-entry validation.
6. Use of `adm-zip`, `node-tar`, `jszip` to write files from archive entries without validation.
7. Custom static-file handler that does not delegate to the framework helper.
8. Upload handler that writes to a path derived from `Content-Disposition` filename.

## Verification Commands

```bash
# Python
rg -n 'os\.path\.join\(|Path\(.*\+|Path\(.*/|open\(.*user|send_file\(|send_from_directory\(' <file>
rg -n 'tarfile|zipfile' <file>

# Node
rg -n 'path\.join\(|path\.resolve\(|fs\.(readFile|readFileSync|writeFile|writeFileSync|createReadStream)\(|res\.sendFile\(' <file>
rg -n 'adm-zip|jszip|node-tar|yauzl' <file>

# Java / .NET
rg -n 'new File\(|Paths\.get\(|getCanonical|File\.ReadAllText|File\.Open' <file>

# Containment checks
rg -n 'is_relative_to|startsWith|getCanonicalPath|realpath' <file>
```
