# Express / Node Code-Execution Reference

Load when the diff touches `child_process`, `vm`, `Function`, template engines, dynamic `require`, or deep merges of user-controlled objects in Express, Koa, Fastify, Hono, or Elysia handlers. Ignore SSRF, file serving, and response leaks unless they reach code execution.

## Subprocess

See `references/command-injection.md`. Express-typical:

```ts
// bad
app.post('/run', (req, res) => {
  exec(`git clone ${req.body.url}`, (err, stdout) => {});
});
// or
spawn('sh', ['-c', `convert ${req.body.file} out.png`]);

// safe
execFile('git', ['clone', '--', req.body.url]);
```

Windows `.bat`/`.cmd` CVE-2024-27980 applies; pin Node `>= 18.20.0 / 20.12.0 / 21.7.0`.

## Template Engines

```ts
// bad
const tmpl = Handlebars.compile(req.body.template);
res.send(tmpl({ user: req.user }));

const tmpl = pug.compile(req.body.src);
ejs.render(req.body.template, { user: req.user });

// also bad: view name from request
res.render(String(req.query.view));      // View resolves under `app.set('views', ...)`; may traverse.

// safe
const tmpl = Handlebars.compile(readFileSync('views/preview.hbs', 'utf8'));
res.render('view-literal', { user: req.user });
```

Handlebars CVE-2019-19919 (prototype pollution → compile-time RCE) means even compiling a literal template can be RCE if `Object.prototype` is polluted before compile. See `references/prototype-pollution.md`.

## vm / Function / eval

```ts
import vm from 'vm';
vm.runInNewContext(req.body.code);     // Not a sandbox; escapes are well-known.
vm.runInThisContext(req.body.code);    // Same realm; direct RCE.

new Function(req.body.code);           // RCE.
new AsyncFunction(req.body.code);      // RCE.

eval(req.body.code);                   // RCE.

setTimeout(req.body.code, 0);          // String form = eval. RCE.
```

`vm2` in any version is RCE-prone (CVE-2023-29017, 32314, 37903; project abandoned). Flag every use.

`isolated-vm` is safer but `Reference.copy()` / `Reference.applySync()` on untrusted input can still leak host objects. Review the bridge surface.

## Deserialization

```ts
import unserialize from 'node-serialize';
const obj = unserialize(req.body);     // CVE-2017-5941. Always RCE.
```

`node-serialize` cannot be used safely. Drop the dependency; migrate to `JSON.parse`.

## Prototype Pollution → Sink

The body-parser → deep-merge → template-engine chain:

```ts
// User POSTs: {"__proto__": {"helperMissing": "...attack..."}}
const merged = _.merge({}, defaults, req.body);
// Later:
const tmpl = Handlebars.compile('{{ doesNotExist }}');
tmpl({});   // helperMissing prototype lookup hits the polluted property.
```

See `references/prototype-pollution.md` for full coverage. Same chain reaches:

- axios config polluted to inject IMDS-bypass headers (CVE-2026-40175).
- Express settings if merged from user data and read by middleware.
- Auth flags read off shared objects.

## Dynamic require / import

```ts
const handler = require(req.query.handler);   // Loads attacker-named module; top-level code runs.
const mod = await import(req.query.module);
```

## Detection Heuristics

1. `child_process.exec` / `execSync` / `spawn` with `{ shell: true }` and user data.
2. Template-engine `compile`/`render` with non-literal source.
3. Any `vm`, `vm2`, `new Function`, `new AsyncFunction`, `eval`, string-form `setTimeout`/`setInterval`.
4. `node-serialize` import or use.
5. Deep-merge of `req.body` into objects subsequently read by template engines or HTTP clients.
6. `require(req.*)` / dynamic `import(req.*)`.

## False-Positive Traps

- `execFile('bin', [userArg])` on POSIX is safe.
- `Handlebars.compile(readFileSync('view.hbs'))` is safe template loading.
- `res.render('view-literal', data)` with literal view name is safe.
- `new Function("return 1+1")()` with literal arg is fine.
- `setTimeout(fn, ms)` with a function arg (not string) is safe.
- Validated input (Zod/Yup/class-validator with `forbidNonWhitelisted`) before any merge is a defense.

## Verification Commands

```bash
rg -n 'child_process|exec\(|execSync\(|spawn\(' <project>
rg -n 'shell:\s*true' <project>
rg -n 'Handlebars\.compile|pug\.compile|pug\.render|ejs\.render|res\.render\(' <project>
rg -n '\bvm\.runIn|vm2|new Function\(|new AsyncFunction\(|\beval\(' <project>
rg -n "node-serialize" <project>
rg -n '_\.(merge|defaultsDeep|set|setWith)\(.*req\.' <project>
rg -n '\brequire\(.*req\.|\bimport\(.*req\.' <project>
```
