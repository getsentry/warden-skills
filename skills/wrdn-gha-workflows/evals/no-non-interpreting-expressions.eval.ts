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

describeEval("no-non-interpreting-expressions", {
  data: [
  {
    name: "no-non-interpreting-expressions__expr-in-if-and-with",
    tests_behavior: "no-non-interpreting-expressions",
    input: "Please review this GitHub Actions workflow for security issues:\n\n```yaml\nname: ci\non: pull_request\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Conditional step\n        if: ${{ github.event.pull_request.head.ref != 'main' }}\n        uses: actions/setup-node@v4\n        with:\n          node-version: ${{ github.event.pull_request.number }}\n      - name: Print branch\n        env:\n          BRANCH: ${{ github.event.pull_request.head.ref }}\n        run: echo \"$BRANCH\"\n```\n\nFlag anything risky.",
    criteria: "The response must NOT report the use of ${{ github.event.pull_request.head.ref }} or similar ${{ }} expressions in the if: condition, the with: input to setup-node, or the step-level env: assignment as security issues. Those contexts do not reinterpret the value as code, and the env var is properly quoted (\"$BRANCH\") in the run step. The agent may note the workflow looks safe or say it found nothing actionable. It must not claim these expressions are injection sinks.",
    timeout: 60000,
  },
  ],
  harness: skilletHarness({ skill: skillRoot }),
  judges: [SubstringJudge(), CriterionJudge()],
  threshold: 0.75,
  timeout: 180_000,
});
