# vercel-deepsec

This Warden skill adapts the Vercel Labs DeepSec default processor prompt into `SKILL.md` form.

It is used to benchmark broad security-review behavior against the DeepSec prompt. It is intentionally wider than most production Warden skills, so focused skills such as authz, code execution, data exfiltration, GitHub Actions, or PII should remain preferred when the review target is narrower.

## Upstream

- Repository: https://github.com/vercel-labs/deepsec
- Source prompt: `packages/processor/src/index.ts`
- Retrieved commit: `cf8bae9ad37e22a4f23c675493c4c553c6379162`

The upstream Apache 2.0 `LICENSE` is included intact. The upstream `NOTICE` is included because DeepSec ships one.
