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
  skilletHarness,
} from "@sentry/skillet/evals";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-hardcoded-choice-non-interpreted",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-hardcoded-choice-non-interpreted__choice-in-if",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-hardcoded-choice-non-interpreted");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/deploy.yml <<'YAML'\nname: deploy\non:\n  workflow_dispatch:\n    inputs:\n      target:\n        description: 'Deploy target'\n        type: choice\n        required: true\n        options:\n          - staging\n          - production\n      dry_run:\n        type: boolean\n        default: true\n      replicas:\n        type: number\n        default: 3\n      env_name:\n        type: environment\n        required: true\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    environment: ${{ inputs.env_name }}\n    if: ${{ inputs.target == 'production' && !inputs.dry_run }}\n    steps:\n      - uses: actions/checkout@v4\n      - name: Configure\n        with:\n          target: ${{ inputs.target }}\n          replicas: ${{ inputs.replicas }}\n        uses: ./.github/actions/configure\nYAML\n");
        const result = await run("Please review .github/workflows/deploy.yml for injection risks in the manual input handling.");

        expect(result.session.outputText).not.toContain("injection");
        expect(result.session.outputText).not.toContain("RCE");
        expect(result.session.outputText).not.toContain("command injection");
        expect(result.session.outputText).toMatch(new RegExp("(no\\s+finding|out\\s+of\\s+scope|no\\s+exploit|hardcoded\\s+(choice|options)|non-interpret)", "i"));
      },
    );
  },
);
