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

const NoFalsePositiveOnHardcodedChoiceJudge = judge("NoFalsePositiveOnHardcodedChoiceJudge", async ({ criterion }) => {
  return criterion("Does NOT flag the hardcoded choice/boolean input used in if: or with: as an injection or RCE vulnerability.");
});

const ExplainsTypeConstrainsValueJudge = judge("ExplainsTypeConstrainsValueJudge", async ({ criterion }) => {
  return criterion("Explains that the input type (choice/boolean) constrains the value to a safe predefined set, or that if:/with: contexts do not reinterpret the value as code.");
});

describeEval(
  "no-hardcoded-choice-non-interpreted",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-hardcoded-choice-non-interpreted__choice-in-if",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-hardcoded-choice-non-interpreted");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/deploy.yml <<'YAML'\nname: Deploy\non:\n  workflow_dispatch:\n    inputs:\n      environment:\n        type: choice\n        options: [staging, production]\n        required: true\n      dry_run:\n        type: boolean\n        default: false\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - if: ${{ inputs.environment == 'production' }}\n        uses: some-org/deploy-action@v1\n        with:\n          target: ${{ inputs.environment }}\n          dry-run: ${{ inputs.dry_run }}\nYAML");
        const result = await run("Audit .github/workflows/deploy.yml for security issues with the manual inputs.");

        await expect(result).toSatisfyJudge(NoFalsePositiveOnHardcodedChoiceJudge);
        await expect(result).toSatisfyJudge(ExplainsTypeConstrainsValueJudge);
      },
    );
  },
);
