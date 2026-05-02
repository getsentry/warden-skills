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

const EntryPointJustificationJudge = judge("EntryPointJustificationJudge", async ({ criterion }) => {
  return criterion("Names the entry point (external/workflow_dispatch caller/workflow_call caller) AND justifies caller-controlled RCE via a privilege delta or secret/PAT/OIDC/publish/deploy access.");
});

describeEval(
  "state-entry-point",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "state-entry-point__dispatch-privilege-delta",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("state-entry-point");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/release.yml <<'YAML'\nname: release\non:\n  workflow_dispatch:\n    inputs:\n      tag:\n        description: 'Tag to release'\n        required: true\n        type: string\njobs:\n  publish:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n      id-token: write\n    steps:\n      - uses: actions/checkout@v4\n      - name: Build and tag\n        run: |\n          echo \"Releasing ${{ github.event.inputs.tag }}\"\n          git tag \"${{ github.event.inputs.tag }}\"\n      - name: Publish to npm\n        env:\n          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\n        run: npm publish\nYAML");
        const result = await run("Review .github/workflows/release.yml for injection risks and tell me if any finding is caller-controlled RCE.");

        expect(result.session.outputText).toMatch(new RegExp("workflow_dispatch", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(NPM_TOKEN|OIDC|id-token|publish|release)\\b", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL|MEDIUM)\\b"));
        await expect(result).toSatisfyJudge(EntryPointJustificationJudge);
      },
    );

    it(
      "state-entry-point__external-pr-target",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("state-entry-point");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/ci.yml <<'YAML'\nname: ci\non:\n  pull_request_target:\n    types: [opened, synchronize]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n      pull-requests: write\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - name: Run tests\n        env:\n          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}\n        run: |\n          npm install\n          npm test\nYAML");
        const result = await run("Audit .github/workflows/ci.yml — what's the entry point and is this caller-controlled RCE?");

        expect(result.session.outputText).toMatch(new RegExp("pull_request_target", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\bexternal\\b", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL)\\b"));
        await expect(result).toSatisfyJudge(EntryPointJustificationJudge);
      },
    );

    it(
      "state-entry-point__workflow-call-no-delta",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("state-entry-point");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/lint.yml <<'YAML'\nname: lint\non:\n  workflow_call:\n    inputs:\n      message:\n        required: true\n        type: string\njobs:\n  echo:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: read\n    steps:\n      - name: Echo message\n        run: |\n          echo \"received: ${{ inputs.message }}\"\nYAML");
        const result = await run("Review .github/workflows/lint.yml. State the entry point clearly and whether caller-controlled RCE applies.");

        expect(result.session.outputText).toMatch(new RegExp("workflow_call", "i"));
        expect(result.session.outputText).toMatch(new RegExp("(caller|reusable)", "i"));
        await expect(result).toSatisfyJudge(EntryPointJustificationJudge);
        expect(result.session.outputText).toContain("lint.yml");
      },
    );
  },
);
