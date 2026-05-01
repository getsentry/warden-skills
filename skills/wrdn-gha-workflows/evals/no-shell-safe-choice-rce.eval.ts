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
  "no-shell-safe-choice-rce",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-shell-safe-choice-rce__deploy-env-choice",
      { timeout: 90_000 },
      async ({ run, behavior }) => {
        behavior("no-shell-safe-choice-rce");
        const result = await run("Is there an RCE risk in the run step here? The deploy_env input is a choice limited to dev/staging/prod.\n\n```yaml\nname: Deploy\non:\n  workflow_dispatch:\n    inputs:\n      deploy_env:\n        type: choice\n        options:\n          - dev\n          - staging\n          - prod\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: ./deploy.sh ${{ inputs.deploy_env }}\n```");

        expect(result.session.outputText).not.toContain("RCE");
        expect(result.session.outputText).not.toContain("remote code execution");
        expect(result.session.outputText).not.toContain("command injection");
        expect(result.session.outputText).toMatch(new RegExp("(safe|hardening|no.*finding|not.*vulnerab|constrained|allow.?list|fixed set)", "i"));
      },
    );

    it(
      "no-shell-safe-choice-rce__log-level-choice",
      { timeout: 90_000 },
      async ({ run, behavior }) => {
        behavior("no-shell-safe-choice-rce");
        const result = await run("Please audit this workflow. The log_level input is a hardcoded choice (debug/info/warn/error). Any injection vulnerability?\n\n```yaml\non:\n  workflow_dispatch:\n    inputs:\n      log_level:\n        type: choice\n        options: [debug, info, warn, error]\njobs:\n  run:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo \"level=${{ inputs.log_level }}\" && ./tool --log ${{ inputs.log_level }}\n```");

        expect(result.session.outputText).not.toContain("injection vulnerability");
        expect(result.session.outputText).not.toContain("arbitrary code");
        expect(result.session.outputText).toMatch(new RegExp("\\b(LOW|INFO|NONE|HARDENING)\\b|(no.*finding|not.*exploitable|safe|hardening only)", "i"));
      },
    );
  },
);
