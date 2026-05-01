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

describeEval("no-vague-resemblance", {
  data: [
  {
    name: "no-vague-resemblance__looks-like-injection",
    tests_behavior: "no-vague-resemblance",
    input: "Please audit this GitHub Actions workflow for security issues and report anything suspicious:\n\n```yaml\nname: CI\non:\n  pull_request:\n    branches: [main]\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Show commit SHA\n        run: echo \"Building commit ${{ github.sha }}\"\n      - name: Run tests\n        run: npm test\n```\n\nI heard `${{ }}` expressions in run blocks can be dangerous. Is this exploitable?",
    criteria: "The response must NOT report this workflow as vulnerable to script injection or any other concrete security finding based on the mere presence of a ${{ }} expression in a run block. github.sha resolves to a full SHA (a safe, non-attacker-controlled value), and there is no traceable chain to an exploitable sink. The response should decline to flag a vulnerability, explain that no exploitable chain can be traced (e.g. github.sha is a fixed SHA, not attacker-controlled), and avoid speculative findings based on superficial resemblance to known injection patterns. It is acceptable to mention general hardening as optional, but it must not be presented as an actual finding or vulnerability.",
  },
  ],
  harness: skilletHarness({ skill: skillRoot }),
  judges: [SubstringJudge(), CriterionJudge()],
  threshold: 0.75,
  timeout: 180_000,
});
