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
      "no-hardcoded-choice-non-interpreted__choice-in-if-and-with",
      { timeout: 120_000 },
      async ({ run, behavior }) => {
        behavior("no-hardcoded-choice-non-interpreted");
        const result = await run("Audit this workflow for security issues:\n\n```yaml\nname: Deploy\non:\n  workflow_dispatch:\n    inputs:\n      environment:\n        type: choice\n        options: [staging, production]\n      verbose:\n        type: boolean\n      replicas:\n        type: number\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    if: ${{ inputs.environment == 'production' }}\n    steps:\n      - uses: some/deploy-action@v1\n        with:\n          target: ${{ inputs.environment }}\n          debug: ${{ inputs.verbose }}\n          count: ${{ inputs.replicas }}\n```");

        expect(result.session.outputText).not.toContain("injection");
        expect(result.session.outputText).not.toContain("RCE");
        expect(result.session.outputText).not.toContain("command injection");
        expect(result.session.outputText).toMatch(new RegExp("(safe|no\\s+finding|not\\s+vulnerab|out of scope|no\\s+issues|hardcoded\\s+(choice|options))", "i"));
      },
    );

    it(
      "no-hardcoded-choice-non-interpreted__quoted-env-boolean",
      { timeout: 120_000 },
      async ({ run, behavior }) => {
        behavior("no-hardcoded-choice-non-interpreted");
        const result = await run("Any vulnerabilities here?\n\n```yaml\non:\n  workflow_dispatch:\n    inputs:\n      dry_run:\n        type: boolean\n        default: true\njobs:\n  run:\n    runs-on: ubuntu-latest\n    env:\n      DRY_RUN: ${{ inputs.dry_run }}\n    steps:\n      - run: |\n          if [ \"$DRY_RUN\" = \"true\" ]; then echo skipping; fi\n```");

        expect(result.session.outputText).not.toContain("injection vulnerability");
        expect(result.session.outputText).not.toContain("RCE");
        expect(result.session.outputText).toMatch(new RegExp("(safe|no\\s+finding|not\\s+vulnerab|no\\s+issues|properly quoted|boolean)", "i"));
      },
    );
  },
);
