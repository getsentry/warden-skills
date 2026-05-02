// ──────────────────────────────────────────────────────────
// Generated initially from spec.yaml; durable after that. Edit
// freely to refine prompts, setup, and assertions for this
// behavior. Add or remove behaviors via spec.yaml — skillet only
// regenerates eval files for behaviors that don't have one yet.
// ──────────────────────────────────────────────────────────
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { expect } from "vitest";
import {
  describeEval,
  judge,
  skilletHarness,
} from "@sentry/skillet/evals";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

const NoFalsePositiveOnIfExpressionJudge = judge("NoFalsePositiveOnIfExpressionJudge", async ({ criterion }) => {
  return criterion("Does NOT report the ${{ }} expression in the if: condition as an injection vulnerability or template-injection finding.");
});

const NoFalsePositiveOnEnvExpressionJudge = judge("NoFalsePositiveOnEnvExpressionJudge", async ({ criterion }) => {
  return criterion("Does NOT report the ${{ }} expression assigned to a job- or step-level env: variable as injectable when nothing later reinterprets it as code.");
});

const ExplainsNonInterpretingContextJudge = judge("ExplainsNonInterpretingContextJudge", async ({ criterion }) => {
  return criterion("Explains that if:, with:, and env: contexts do not reinterpret the resolved value as shell or code, so the expression is not an injection sink here.");
});

describeEval(
  "no-non-interpreting-expressions",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-non-interpreting-expressions__if-and-env",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-non-interpreting-expressions");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/gate.yml <<'YAML'\nname: Gate\non:\n  pull_request:\njobs:\n  check:\n    runs-on: ubuntu-latest\n    if: ${{ github.event.pull_request.title != '' }}\n    env:\n      PR_TITLE: ${{ github.event.pull_request.title }}\n    steps:\n      - uses: actions/checkout@v4\n      - name: Print length\n        run: echo \"title length is ${#PR_TITLE}\"\nYAML");
        const result = await run("Audit .github/workflows/gate.yml — is the use of github.event.pull_request.title in the if: condition and the env: variable a script injection risk?");

        await expect(result).toSatisfyJudge(NoFalsePositiveOnIfExpressionJudge);
        await expect(result).toSatisfyJudge(NoFalsePositiveOnEnvExpressionJudge);
        await expect(result).toSatisfyJudge(ExplainsNonInterpretingContextJudge);
      },
    );
  },
);
