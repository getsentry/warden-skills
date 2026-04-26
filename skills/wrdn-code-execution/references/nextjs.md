# Next.js Code-Execution Reference

Load when the diff touches Server Actions or Server Components that reach `eval`/`Function`/`vm`, dynamic `require`/`import`, or any code-evaluation primitive on the server side. Ignore Server Actions SSRF, image proxy, and RSC field leakage unless they reach code execution.

## CVE-2025-55182 — React2Shell

Server-side `Function()` / `eval` reached from a data-binding path in a production Next.js app. Server Components inadvertently serialized function-like values from user data, which were then constructed as functions and invoked.

Detection:

- `new Function(...)` or `eval(...)` in a Server Component, Server Action, or `app/**/route.ts` handler with any path back to user data.
- React Server Component data paths that deserialize function expressions or template-literal strings into callables.

```ts
// bad — illustrative shape
'use server';
export async function compute(expr: string) {
  return new Function('return ' + expr)();
}
```

```ts
// safe
'use server';
export async function compute(expr: string) {
  // Use a dedicated expression parser with an explicit allowlist
  return safeEvaluator.evaluate(expr, { allow: ['+', '-', '*', '/'] });
}
```

## Server Actions: Code-Execution Sinks

Every Server Action is a POST endpoint. An attacker who knows the action's exported name can invoke it with any arguments. Treat every input as untrusted and every sink as reachable.

Patterns to flag:

- `'use server'` function calling `eval`, `new Function`, `vm.runInNewContext`, `subprocess.exec` (Node child_process), `pickle.loads` (when bridging to a Python sidecar), `node-serialize.unserialize`.
- Dynamic `import(userPath)` in a Server Action. Imports execute top-level code in the imported module.
- `require(userPath)` in a route handler.

## Route Handlers (`app/api/**/route.ts`)

Independent surface from Server Actions and middleware.

```ts
// app/api/run/route.ts — bad
export async function POST(req: Request) {
  const { code } = await req.json();
  return new Response(String(eval(code)));
}
```

## Server Components Returning Function Values

```tsx
// bad
export default async function Page() {
  const tools = await db.tool.findMany();
  return <ToolsView tools={tools} />;   // If `tools` includes function-like fields, RSC
                                         // serialization may turn them into client-callable handles.
}
```

The serialization boundary should reject function-like values. RSC libraries differ; verify the framework's behavior before relying on it.

## Dynamic Code via `eval` Polyfills

Some Next.js setups use Babel transforms or polyfills that re-introduce `eval` for dynamic features. Audit any custom `next.config.js` Webpack/SWC modifications that touch the `vm` module or enable `eval`-based source maps in production.

## Detection Heuristics

1. `new Function(...)` or `eval(...)` in any Server Component, Server Action, or route handler.
2. `'use server'` function reaching a code-exec sink in its body.
3. Dynamic `import(userValue)` / `require(userValue)` in a Server Action or route handler.
4. RSC components serializing function-typed values from DB.
5. `vm.runInNewContext(...)` in any server-side code.
6. Next.js version `< 14.x` with patches not applied for known Server Action vulns; check `package.json`.

## False-Positive Traps

- Hardcoded `eval` in `next.config.js` for build-time optimizations doesn't reach user input.
- Server Actions that validate inputs through Zod/Yup before reaching any sink are safe at the validator boundary.
- `new Function("return 1+1")()` with literal arg is fine.

## Verification Commands

```bash
# Server Actions with eval/Function
rg -n "'use server'" <project>
rg -n '\beval\(|new Function\(|new AsyncFunction\(' <project>/app

# Route handlers
find <project>/app -name 'route.ts' -o -name 'route.tsx' | xargs rg -n 'eval\|Function\|vm\.'

# Dynamic imports
rg -n '\bimport\s*\(|\brequire\s*\(' <project>/app

# Next.js version
jq '.dependencies.next' package.json
```
