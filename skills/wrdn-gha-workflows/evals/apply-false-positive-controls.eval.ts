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
  return criterion("The response correctly applies the relevant false-positive trap: it recognizes the pattern as a known non-finding, explains why it is safe (e.g., default checkout under pull_request_target uses base code, persist-credentials only affects GITHUB_TOKEN not other secrets, choice inputs with shell-safe options are not RCE without a bypass), and does NOT escalate it to a vulnerability finding. Generic 'looks fine' answers without naming the specific control do not satisfy the rubric.");
});

describeEval(
  "apply-false-positive-controls",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "apply-false-positive-controls__pr-target-default-checkout",
      { timeout: 180_000 },
      async ({ run, behavior }) => {
        behavior("apply-false-positive-controls");
        const result = await run("Is this workflow vulnerable to pwn-request? It uses pull_request_target.\n\n```yaml\nname: Label PRs\non:\n  pull_request_target:\n    types: [opened]\njobs:\n  label:\n    runs-on: ubuntu-latest\n    permissions:\n      pull-requests: write\n    steps:\n      - uses: actions/checkout@v4\n      - run: ./scripts/label.sh\n        env:\n          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}\n```");

        expect(result.session.outputText).toMatch(new RegExp("(base|default).{0,40}(checkout|ref|code)", "i"));
        expect(result.session.outputText).not.toContain("pwn-request");
        expect(result.session.outputText).toMatch(new RegExp("(safe|not.*vulnerab|no.*finding|false.positive|not.*exploitable)", "i"));
        await expect(result).toSatisfyJudge(FalsePositiveControlsJudge);
      },
    );

    it(
      "apply-false-positive-controls__persist-credentials-false-other-secrets",
      { timeout: 180_000 },
      async ({ run, behavior }) => {
        behavior("apply-false-positive-controls");
        const result = await run("We added persist-credentials: false to checkout. Does that fully mitigate the secret-exposure risk in this pull_request_target build?\n\n```yaml\non:\n  pull_request_target:\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n          persist-credentials: false\n      - run: npm ci && npm run build\n        env:\n          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\n          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}\n```");

        expect(result.session.outputText).toMatch(new RegExp("persist-credentials", "i"));
        expect(result.session.outputText).toMatch(new RegExp("(NPM_TOKEN|AWS_ACCESS_KEY_ID|other secrets|still exposed|does not.*(erase|remove|protect))", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL|MEDIUM)\\b"));
        await expect(result).toSatisfyJudge(FalsePositiveControlsJudge);
      },
    );

    it(
      "apply-false-positive-controls__choice-input-shell-safe",
      { timeout: 180_000 },
      async ({ run, behavior }) => {
        behavior("apply-false-positive-controls");
        const result = await run("Is this workflow_dispatch input an RCE risk?\n\n```yaml\non:\n  workflow_dispatch:\n    inputs:\n      env:\n        type: choice\n        options: [staging, production]\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n      - run: ./deploy.sh ${{ inputs.env }}\n```");

        expect(result.session.outputText).toMatch(new RegExp("choice", "i"));
        expect(result.session.outputText).not.toContain("RCE");
        expect(result.session.outputText).toMatch(new RegExp("(safe|narrow|hardcoded options|not.*exploitable|hardening)", "i"));
        await expect(result).toSatisfyJudge(FalsePositiveControlsJudge);
      },
    );
  },
);
