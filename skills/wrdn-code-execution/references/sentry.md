# Sentry Code-Execution Reference

Load when the diff imports from `sentry.utils.yaml`, `sentry.runner`, integration parsers, or webhook handlers. Covers the code-execution angle of Sentry's sink surfaces. Ignore SSRF, response-field leakage, and XXE unless they reach code execution.

Sentry has hardened its RCE surface deliberately: YAML defaults to `SafeLoader`, pickle is confined to internal state, `eval` is CLI-only. Most live risk is new code that bypasses these conventions.

## YAML: Default Is Safe

`src/sentry/utils/yaml.py` defines `load = partial(yaml.load, Loader=SafeLoader)`. Every caller importing from this module is safe.

**Finding candidates** are diffs that:

- Import `yaml` directly and call `yaml.load(user_input)` without specifying `SafeLoader`.
- Switch from `safe_load` to `load` with a non-Safe loader on user data.
- Parse webhook payloads (Bitbucket, GitHub, GitLab, JIRA, Slack) through an unsafe loader.

## Pickle: Internal Only

Pickle usage in Sentry is confined to paths that do not accept untrusted input:

- `src/sentry/utils/arroyo.py` — worker pool initializers.
- `src/sentry/db/models/fields/gzippeddict.py` — ORM field round-trip.
- `src/sentry/buffer/redis.py` — Redis buffer values written by Sentry.

**Finding candidates** are diffs that:

- Introduce `pickle.loads(payload)` where `payload` traces to a request, webhook, user upload, or external integration.
- Store a pickled value in Redis under a key an attacker can influence and later load it.
- Use `cloudpickle`, `joblib.load`, or `dill` on an ML model from a user-controlled location.

Any new `pickle.loads` in a diff deserves a source trace. Internal state is safe; untrusted bytes are RCE.

## eval / exec: CLI Only

`src/sentry/runner/commands/run.py`, `exec.py`, `execfile.py`, and `importer.py` use `eval`/`exec` on CLI admin input. These are not HTTP-reachable.

**Finding candidates:**

- New `eval` / `exec` appearing in `src/sentry/api/`, `src/sentry/web/`, `src/sentry/integrations/`, or `src/sentry/sentry_apps/`.
- Config loading that `exec`s a file path that could be influenced by user input.

## Template Rendering: Literals Only

Sentry does not use `render_template_string` or `jinja2.Template(user_source)` with user input. `src/sentry/relocation/` uses `Template("... $var ...").substitute()` with hardcoded templates.

**Finding candidates:**

- New `render_template_string(x)` where `x` traces to a request.
- New `Template(x).render(ctx)` where `x` is attacker-controlled.
- Any diff that introduces Jinja2 `format_map` patterns on user strings — historical SSTI vector.

## Integration Webhooks: JWT and Signature Paths

Historical fix: commit `25433efc99a` ("KID validation to Bitbucket Connect installation webhook"). An incoming JWT's `kid` was used to pick a key without allowlist; attacker could point `kid` at an attacker-controlled JWKS endpoint. Not directly RCE but enables signature forgery and downstream code paths that assume "valid webhook."

**Finding candidates:**

- New webhook handler that parses a JWT and uses `kid` / `jwk` / `jku` from the token to resolve the verification key without allowlist.
- Signature comparison using `==` instead of `hmac.compare_digest` (timing-safe compare).
- Any "parse first, validate later" ordering — always validate signature/sender before parsing/dispatching on payload contents.

## Sentry-Specific Code-Execution Bug Shapes

Prioritized:

1. **`yaml.load` without `SafeLoader`** introduced in any integration parser or config loader.
2. **`pickle.loads` on a value whose source traces to external input** (webhook payload, Redis key with user portion, remote file, uploaded ML model).
3. **`eval` / `exec` / `render_template_string`** appearing anywhere in `src/sentry/api/`, `src/sentry/web/`, `src/sentry/integrations/`, `src/sentry/sentry_apps/`.
4. **JWT `kid`-based key lookup** without an allowlist or with URL fetches to `jku`/`x5u` without validation.
5. **`subprocess.run(..., shell=True)`** with any user-influenceable argument in an integration or admin action.
6. **Dynamic `importlib.import_module(user_name)`** or `__import__(user_name)` where the module name comes from config / request.

## Safe Idioms (Avoid False Positives)

- `sentry.utils.yaml.load` is `yaml.load(..., Loader=SafeLoader)` — safe.
- `ast.literal_eval` (used in `src/sentry/utils/strings.py`) is safe; restricts to literals.
- `Template("hardcoded $var").substitute()` with a literal template is safe.
- Pickle in `arroyo`, `buffer/redis`, `gzippeddict`, `nodestore` round-trips trusted internal data.
- `subprocess.run(["cmd", arg], shell=False)` is safe regardless of `arg` content (given a literal binary).

## Verification Commands

```bash
# Pickle usage outside known-safe locations
rg -n 'pickle\.loads' src/sentry/ | rg -v 'arroyo|buffer|gzippeddict|nodestore'

# eval/exec outside runner
rg -n '\beval\(|\bexec\(' src/sentry/ | rg -v 'runner/|tests/'

# yaml.load usage
rg -n 'yaml\.load\(' src/sentry/ | rg -v 'safe_load|SafeLoader'

# Shelled subprocess
rg -n 'subprocess\..*shell\s*=\s*True|os\.system\(|os\.popen\(' src/sentry/

# JWT kid usage
rg -n "kid|jwk|jku" src/sentry/integrations/ src/sentry/sentry_apps/

# History
git log --oneline --grep='pickle\|yaml\|eval\|exec\|deserializ\|template injection\|RCE' --since='1 year ago'
```
