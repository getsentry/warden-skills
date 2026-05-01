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

const EntryPointJudge = judge("EntryPointJudge", async ({ criterion }) => {
  return criterion("The response explicitly identifies the entry point for each finding (external attacker via PR, manual workflow_dispatch caller, or reusable workflow_call caller) and, when claiming caller-controlled RCE for workflow_dispatch or workflow_call, justifies it by pointing to a privilege delta (job has secrets/PATs/OIDC/publishing/release/deploy access or sensitive runners that the caller would not ordinarily have). A finding that simply asserts 'attacker can run code' without naming the entry point or addressing privilege delta does not satisfy the rubric.");
});

describeEval(
  "state-entry-point",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "state-entry-point__dispatch-with-publish-secrets",
      { timeout: 180_000 },
      async ({ run, behavior }) => {
        behavior("state-entry-point");
        const result = await run("Audit this workflow and report any findings:\n\n```yaml\nname: Manual Publish\non:\n  workflow_dispatch:\n    inputs:\n      release_notes:\n        description: 'Release notes'\n        required: true\n        type: string\njobs:\n  publish:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n      id-token: write\n    steps:\n      - uses: actions/checkout@v4\n      - run: echo \"${{ github.event.inputs.release_notes }}\" > NOTES.md\n      - run: npm ci && npm publish\n        env:\n          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\n```");

        expect(result.session.outputText).toMatch(new RegExp("workflow_dispatch", "i"));
        expect(result.session.outputText).toMatch(new RegExp("(entry point|caller|trigger)", "i"));
        expect(result.session.outputText).toMatch(new RegExp("(NPM_TOKEN|publish|secret|OIDC|id-token)", "i"));
        await expect(result).toSatisfyJudge(EntryPointJudge);
      },
    );

    it(
      "state-entry-point__pr-target-external-checkout",
      { timeout: 180_000 },
      async ({ run, behavior }) => {
        behavior("state-entry-point");
        const result = await run("Please review:\n\n```yaml\nname: PR CI\non:\n  pull_request_target:\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - run: npm ci && npm test\n        env:\n          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}\n```");

        expect(result.session.outputText).toMatch(new RegExp("(external|attacker|pull request author|untrusted)", "i"));
        expect(result.session.outputText).toMatch(new RegExp("pull_request_target", "i"));
        await expect(result).toSatisfyJudge(EntryPointJudge);
      },
    );

    it(
      "state-entry-point__reusable-workflow-call-privilege-delta",
      { timeout: 180_000 },
      async ({ run, behavior }) => {
        behavior("state-entry-point");
        const result = await run("Audit this reusable workflow:\n\n```yaml\nname: Reusable Deploy\non:\n  workflow_call:\n    inputs:\n      target_env:\n        type: string\n        required: true\njobs:\n  deploy:\n    runs-on: self-hosted\n    permissions:\n      id-token: write\n      contents: read\n    steps:\n      - uses: actions/checkout@v4\n      - run: ./deploy.sh \"${{ inputs.target_env }}\"\n        env:\n          AWS_ROLE: ${{ secrets.AWS_DEPLOY_ROLE }}\n```");

        expect(result.session.outputText).toMatch(new RegExp("workflow_call", "i"));
        expect(result.session.outputText).toMatch(new RegExp("(caller|entry point)", "i"));
        await expect(result).toSatisfyJudge(EntryPointJudge);
      },
    );
  },
);
