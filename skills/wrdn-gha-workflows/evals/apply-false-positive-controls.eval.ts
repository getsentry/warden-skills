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

const FalsePositiveControlsJudge = judge("FalsePositiveControlsJudge", async ({ criterion }) => {
  return criterion("Correctly applies the named false-positive trap: explains why the pattern is not exploitable as-is and refuses to flag it, citing the specific control (e.g. default checkout is base code, choice input narrows surface).");
});

describeEval(
  "apply-false-positive-controls",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "apply-false-positive-controls__pr-target-default-checkout-is-base",
      { timeout: 90_000 },
      async ({ run, behavior, harness }) => {
        behavior("apply-false-positive-controls");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/label.yml <<'YAML'\nname: label\non:\n  pull_request_target:\n    types: [opened]\njobs:\n  label:\n    runs-on: ubuntu-latest\n    permissions:\n      pull-requests: write\n    steps:\n      - uses: actions/checkout@v4\n      - run: echo \"hello from base\"\nYAML\n");
        const result = await run("Review .github/workflows/label.yml for pwn-request risk and tell me if the checkout is dangerous.");

        expect(result.session.outputText).toMatch(new RegExp("\\bbase\\b", "i"));
        expect(result.session.outputText).toContain("pull_request_target");
        expect(result.session.outputText).not.toContain("RCE");
        expect(result.session.outputText).toMatch(new RegExp("(no\\s+finding|not\\s+exploitable|false\\s+positive|safe)", "i"));
        await expect(result).toSatisfyJudge(FalsePositiveControlsJudge);
      },
    );

    it(
      "apply-false-positive-controls__choice-input-narrows-surface",
      { timeout: 90_000 },
      async ({ run, behavior, harness }) => {
        behavior("apply-false-positive-controls");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/deploy.yml <<'YAML'\nname: deploy\non:\n  workflow_dispatch:\n    inputs:\n      mode:\n        type: choice\n        options: [staging, production]\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo \"deploying ${{ inputs.mode }}\"\nYAML\n");
        const result = await run("Is the `mode` input in deploy.yml an injection risk? It's used in a run: step.");

        expect(result.session.outputText).toMatch(new RegExp("\\bchoice\\b", "i"));
        expect(result.session.outputText).toMatch(new RegExp("(staging|production)"));
        expect(result.session.outputText).not.toContain("command injection");
        expect(result.session.outputText).toMatch(new RegExp("(no\\s+finding|not\\s+exploitable|narrow|hardcoded)", "i"));
        await expect(result).toSatisfyJudge(FalsePositiveControlsJudge);
      },
    );

    it(
      "apply-false-positive-controls__persist-credentials-false-not-sufficient",
      { timeout: 90_000 },
      async ({ run, behavior, harness }) => {
        behavior("apply-false-positive-controls");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/build.yml <<'YAML'\nname: build\non:\n  pull_request_target:\njobs:\n  build:\n    runs-on: ubuntu-latest\n    env:\n      AWS_TOKEN: ${{ secrets.AWS_TOKEN }}\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n          persist-credentials: false\n      - run: npm install && npm run build\nYAML\n");
        const result = await run("This workflow uses persist-credentials: false on checkout, then runs an attacker-controlled npm script with AWS_TOKEN in env. Is persist-credentials: false enough to make it safe?");

        expect(result.session.outputText).toContain("persist-credentials");
        expect(result.session.outputText).toContain("AWS_TOKEN");
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL)\\b"));
        expect(result.session.outputText).toMatch(new RegExp("(other\\s+secrets|does\\s+not\\s+erase|still\\s+exposed|env)", "i"));
        await expect(result).toSatisfyJudge(FalsePositiveControlsJudge);
      },
    );
  },
);
