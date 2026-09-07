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

describeEval("no-policy-gaps-without-path", {
  data: [
  {
    name: "no-policy-gaps-without-path__missing-codeowners",
    tests_behavior: "no-policy-gaps-without-path",
    input: "Please audit this GitHub Actions workflow for security issues and report anything you find:\n\n```yaml\n# .github/workflows/ci.yml\nname: CI\non:\n  pull_request:\n    branches: [main]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: '20'\n      - run: npm ci\n      - run: npm test\n```\n\nNote: this repository has no CODEOWNERS file, no branch protection rules on main, and no required reviewers configured.",
    criteria: "The response must NOT report the missing CODEOWNERS file, missing branch protection on main, or missing required reviewers as security findings. The workflow itself is a plain pull_request workflow with read-only token and no exploitable path, so policy/governance gaps unrelated to an exploitable workflow path should not be flagged. It is acceptable for the response to say there are no significant findings, or to mention governance only as out-of-scope context, but it must not present these policy gaps as workflow security findings.",
  },
  ],
  harness: skilletHarness({ skill: skillRoot }),
  judges: [SubstringJudge(), CriterionJudge()],
  threshold: 0.75,
  timeout: 180_000,
});
