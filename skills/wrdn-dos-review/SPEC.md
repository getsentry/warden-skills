# DoS Review Skill Specification

## Intent

The `wrdn-dos-review` skill is Warden's availability / denial-of-service reviewer. It owns the resource-exhaustion class that the `security-review` (AppSec) and `code-review` (correctness-in-changes) skills leave uncovered: a single small crafted input that drives unbounded resource use, a hang, or a process-killing abort.

It targets code that parses or processes untrusted, attacker-controlled bytes, and it audits the whole file for latent sinks rather than only diff-scoped regressions.

## Scope

In scope:

- Unbounded memory allocation pre-sized from an attacker-controlled length/size/count field.
- Unbounded decompression (compression bombs) with no output cap.
- Uncontrolled recursion (no depth limit or visited-set) reaching a stack-overflow abort.
- Non-terminating loops following input-controlled pointer/offset chains with no cycle guard.
- Unbounded delegation of untrusted input to third-party parsers/decoders/decompressors that apply no caller-side depth/size/time bound (the unbounded sink lives inside the dependency).
- Resource leaks and panics on untrusted input (missing RAII/finally release, `.unwrap()`/index on input-derived values).
- Super-linear output amplification (missing memoization on a DAG/shared structure, clone-per-element, dedup/intern defeated by an attacker-varied key) where a small input materializes a much larger output.
- Algorithmic-complexity / CPU exhaustion (O(n²) per-element re-scan, ReDoS/backtracking with no step budget, expensive per-byte processing) that saturates a shared bounded worker pool with no crash.
- ReDoS via catastrophic regex backtracking: a regex with nested quantifiers, quantified overlapping alternation, or adjacent overlapping quantifiers, applied to an attacker-controlled subject (or an attacker-supplied pattern) on a backtracking engine (JS, Python `re`, Java, PCRE, Ruby, .NET). Explicitly NOT in scope on linear-time engines (Go `regexp`, Rust `regex`, RE2).
- Present-but-ineffective bounds: a cap/quota/limit that bounds the wrong dimension (depth not width, count not bytes, input-size not compute-cost), is enforced after the cost is paid, under-counts true cost, or is dead/defaulted-off.
- General guidance across native (Rust/C/C++/Go), JVM, and service code that handles untrusted bytes.

Out of scope:

- AppSec exploitability (injection, XSS, SSRF, auth, secrets) — routed to `security-review`.
- Non-security correctness bugs without a resource-exhaustion or crash impact — routed to `code-review`.
- Performance tuning with no attacker-driven unbounded path.
- Sinks that already have an *effective* bound on the reachable path — where effective means it bounds the cost-driving dimension, runs before the cost is paid, counts real resource use, and is live in the shipped config. A bound failing any of those is in scope (present-but-ineffective).

## Users And Trigger Context

- Primary users: coding agents and Warden runs auditing parsers, format/codec decoders, deserialization, and request-handling code.
- Should trigger for: "DoS review", "resource exhaustion", "decompression bomb", "compression bomb", "uncontrolled recursion", "stack overflow on input", "unbounded allocation", "denial of service", "crash safety", "memory-safety review of untrusted input".
- Should not trigger for: AppSec/OWASP review, generic correctness review, style/architecture review, or Warden CLI usage.

## Runtime Contract

- Required first actions:
  - Identify the untrusted source fields (length/size/count/depth/offset) in the target file.
  - Trace each value to its sink across functions, files, and crates; read the surrounding guards and any sibling path that caps the same primitive.
- Required finding evidence:
  - attacker-controlled source field
  - unbounded sink, OR a present-but-ineffective bound (states which axis it fails: dimension / timing / accounting / liveness)
  - reachability of the sink from untrusted input
  - impact (allocator/stack abort, hang, OOM, disk fill, persistent limiter leak, or shared-worker-pool CPU saturation), noting whether the crash is an uncatchable process-wide abort and whether the cost is paid before any quota/rate-limit decision
- Required outputs:
  - One finding per distinct root-cause sink; additional reachable paths listed in `verification`, not as separate findings.
  - Severity calibrated: persistent/unrecoverable or core-pipeline = high; recoverable shared worker = medium; bounded = low.
  - Empty findings when no attacker-controlled unbounded path is proven.
- Non-negotiable constraints:
  - Do not report sinks that already have an effective bound.
  - Do not emit one finding per format/call site for the same sink.
  - Do not report AppSec issues here.

## Reference Architecture

- `SKILL.md` contains the review contract, sink-class table, investigation method, dedup rule, severity rubric, and exclusions.
- Add `references/<language>.md` only when recurring findings need language-specific calibration (e.g. Rust allocator-abort vs panic semantics, Go slice make, JVM array pre-sizing).

## Evaluation

- Lightweight validation:
  - Run the skill validator against `src/builtin-skills/dos-review`.
  - Run init command tests that install bundled skills.
- Deeper evaluation:
  - Eval cases per class: unbounded `with_capacity`, decompression bomb, uncontrolled recursion, self-referential pointer-chain loop, RAII/limiter leak on panic, super-linear output amplification (DAG re-walk with no memoization; clone-per-element defeating dedup), O(n²) per-element re-scan / backtracking match, plus safe counterexamples that already carry a cap, depth limit, visited-set, or guard.
  - Present-but-ineffective-bound cases (each must be reported, with a matching safe counterexample where the bound is effective): a size check applied *after* full materialization (timing); a depth cap on an output-width blow-up (dimension); a count cap on a per-element byte amplification (dimension); a cost ledger that ignores per-object overhead (accounting); a complexity cap defaulted to `u64::MAX` (liveness).
  - Memory-cap-≠-CPU-cap case (must be reported): a decompression whose output size IS bounded (bounded-reader / max-output cap) but whose capped-but-large output is then scrubbed / transcoded / parsed at a per-byte cost on a shared worker pool, so a tiny compressed request drives seconds of CPU (dimension: the size cap bounds memory, not the CPU of processing the output; a per-item count quota does not bound per-item cost). Safe counterexamples that must NOT be reported: the same pipeline where the processing step carries a time/CPU budget, where the expensive work runs *after* a rate-limit / load-shed / quota-on-cost decision, or where the decompressed output is streamed/bounded such that per-request compute is capped.
  - ReDoS cases: a nested-quantifier / overlapping-alternation / adjacent-quantifier regex on an attacker-controlled subject on a backtracking engine (must be reported, with a pump string), each paired with safe counterexamples that must NOT be reported: the same pattern on a linear engine (Rust `regex` / Go `regexp` / RE2), a subject that is not attacker-influenced, and a match guarded by an input-length cap.
  - Confirm dedup: one sink reachable via N formats yields one finding.
- Acceptance gates:
  - `SKILL.md` stays concise.
  - Findings require a proven attacker-controlled unbounded path, not keyword matches.
  - Severity matches the recoverable-vs-persistent rubric.

## Maintenance Notes

- Add a language reference only when recurring findings need language-specific calibration.
- Keep examples minimal and transformed; do not store proprietary code.
- Origin: restores the DoS/resource-exhaustion coverage dropped when the `find-bugs` skill was removed (warden #195); that class was not migrated into `security-review` (AppSec-only) or `code-review` (correctness-in-changes), leaving it unowned.
