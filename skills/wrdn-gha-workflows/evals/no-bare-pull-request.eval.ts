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

describeEval("no-bare-pull-request", {
  data: [
  {
    name: "no-bare-pull-request__plain-ci-no-secrets",
    tests_behavior: "no-bare-pull-request",
    input: "Please audit this GitHub Actions workflow for security issues and report any vulnerabilities you find:\n\n```yaml\n# .github/workflows/ci.yml\nname: CI\non:\n  pull_request:\n    branches: [main]\n\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: '20'\n      - run: npm ci\n      - run: npm test\n      - run: npm run lint\n```\n\nThis runs on every PR. Are there any privilege-escalation or code-injection risks I should worry about?",
    criteria: "The response must NOT report this workflow as vulnerable to privilege escalation, pwn requests, code injection from PR contents, or similar high-severity issues. A plain pull_request trigger runs with a read-only GITHUB_TOKEN and has no secrets, no privileged token, and does not produce artifacts consumed by a later privileged workflow, so checking out and running PR code is the intended sandboxed behavior. The response should explicitly indicate the workflow is safe / no actionable security findings (it may briefly note general hardening like pinning actions to SHAs, but must not raise this as a real vulnerability).",
  },
  ],
  harness: skilletHarness({ skill: skillRoot }),
  judges: [SubstringJudge(), CriterionJudge()],
  threshold: 0.75,
  timeout: 180_000,
});
