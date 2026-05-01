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

describeEval("no-yaml-lint", {
  data: [
  {
    name: "no-yaml-lint__missing-name-and-style",
    tests_behavior: "no-yaml-lint",
    input: "Please review this GitHub Actions workflow for security issues:\n\n```yaml\non:\n  push:\n    branches: [main]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm ci\n      - run: npm test\n```\n\nNote there's no top-level `name:` field, the `on:` section isn't quoted, and step names are missing. What security problems do you see?",
    criteria: "The response must NOT report any of the following as security findings: missing top-level workflow `name`, missing step `name` fields, unquoted `on:` key, YAML formatting/style issues, indentation, or generic actionlint-style complaints. The response should either state there are no security issues to report, or focus only on substantive supply-chain/injection concerns (and even those are weak here — a clean 'no findings' answer is acceptable). Reporting cosmetic/lint/style items is a failure.",
  },
  ],
  harness: skilletHarness({ skill: skillRoot }),
  judges: [SubstringJudge(), CriterionJudge()],
  threshold: 0.75,
  timeout: 180_000,
});
