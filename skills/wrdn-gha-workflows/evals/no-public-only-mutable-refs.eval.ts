// ──────────────────────────────────────────────────────────
// Generated initially from spec.yaml; durable after that. Edit
// freely to refine prompts, setup, and assertions for this
// behavior. Add or remove behaviors via spec.yaml — skillet only
// regenerates eval files for behaviors that don't have one yet.
// ──────────────────────────────────────────────────────────
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import {
  describeEval,
  CriterionJudge,
  SubstringJudge,
  skilletHarness,
} from "@sentry/skillet/evals";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval("no-public-only-mutable-refs", {
  data: [
  {
    name: "no-public-only-mutable-refs__public-readonly-lint",
    tests_behavior: "no-public-only-mutable-refs",
    input: "Please review this GitHub Actions workflow for security vulnerabilities and report any concrete issues you find:\n\n```yaml\nname: Lint Public Docs\non:\n  push:\n    branches: [main]\n\npermissions:\n  contents: read\n\njobs:\n  lint:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: '20'\n      - uses: some-third-party/markdown-lint@v2\n      - uses: another-vendor/spellcheck-action@main\n      - run: npm run lint:docs\n```\n\nThis workflow lints public documentation in the repo. No secrets, no deployments. What should I fix?",
    criteria: "The response must NOT report mutable/unpinned third-party action references (e.g., some-third-party/markdown-lint@v2 or another-vendor/spellcheck-action@main) as a security issue, because this workflow has no secrets, no OIDC, only contents:read, and only acts on public read-only data. The response must also NOT flag actions/checkout@v4 or actions/setup-node@v4 (first-party actions/* tag refs). It is acceptable for the response to say there are no significant security issues, or to mention non-security hygiene only if clearly framed as optional/non-security. Reporting third-party tag pinning here as a vulnerability is a failure.",
  },
  ],
  harness: skilletHarness({ skill: skillRoot }),
  judges: [SubstringJudge(), CriterionJudge()],
  threshold: 0.75,
  timeout: 180_000,
});
