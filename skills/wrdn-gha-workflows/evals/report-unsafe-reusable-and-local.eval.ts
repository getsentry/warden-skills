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

const UnsafeReusableCalleeJudge = judge("UnsafeReusableCalleeJudge", async ({ criterion }) => {
  return criterion("The response identifies the callee-side hazard in a reusable workflow or local/composite action chain. It must explicitly tie the danger to the callee: PR-controlled input reaching a code-evaluating sink inside the callee, action files loaded from an attacker-controlled checkout, runtime download of mutable code, undeclared secrets under workflow_call.secrets while secrets.X is referenced, or a callee without a permissions block running with the caller's broader grant. A finding limited to the caller's trigger without analysis of the callee does not satisfy the rubric.");
});

describeEval(
  "report-unsafe-reusable-and-local",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-unsafe-reusable-and-local__reusable-callee-executes-pr-title",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-unsafe-reusable-and-local");
        await harness.setup("mkdir -p .github/workflows scripts\ncat > .github/workflows/caller.yml <<'YAML'\nname: caller\non:\n  pull_request_target:\n    types: [opened, synchronize]\njobs:\n  call:\n    uses: ./.github/workflows/reusable-build.yml\n    secrets: inherit\n    with:\n      pr_title: ${{ github.event.pull_request.title }}\nYAML\ncat > .github/workflows/reusable-build.yml <<'YAML'\nname: reusable-build\non:\n  workflow_call:\n    inputs:\n      pr_title:\n        type: string\n        required: true\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo \"Building ${{ inputs.pr_title }}\"\n      - run: ./scripts/release.sh\n        env:\n          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\nYAML\necho '#!/bin/sh' > scripts/release.sh\nchmod +x scripts/release.sh\n");
        const result = await run("Please audit this caller/callee pair. The caller runs on pull_request_target and inherits secrets to the reusable workflow.\n\n.github/workflows/caller.yml:\n```yaml\nname: caller\non:\n  pull_request_target:\n    types: [opened, synchronize]\njobs:\n  call:\n    uses: ./.github/workflows/reusable-build.yml\n    secrets: inherit\n    with:\n      pr_title: ${{ github.event.pull_request.title }}\n```\n\n.github/workflows/reusable-build.yml:\n```yaml\nname: reusable-build\non:\n  workflow_call:\n    inputs:\n      pr_title:\n        type: string\n        required: true\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo \"Building ${{ inputs.pr_title }}\"\n      - run: ./scripts/release.sh\n        env:\n          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\n```");

        expect(result.session.outputText).toMatch(new RegExp("(reusable|callee|workflow_call)", "i"));
        expect(result.session.outputText).toMatch(new RegExp("inputs\\.pr_title|pull_request\\.title", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL)\\b"));
        await expect(result).toSatisfyJudge(UnsafeReusableCalleeJudge);
      },
    );

    it(
      "report-unsafe-reusable-and-local__local-action-from-pr-checkout",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-unsafe-reusable-and-local");
        await harness.setup("mkdir -p .github/workflows .github/actions/setup scripts\ncat > .github/workflows/ci.yml <<'YAML'\nname: ci\non:\n  pull_request_target:\njobs:\n  test:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n      id-token: write\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - uses: ./.github/actions/setup\nYAML\ncat > .github/actions/setup/action.yml <<'YAML'\nname: setup\nruns:\n  using: composite\n  steps:\n    - run: ./scripts/setup.sh\n      shell: bash\nYAML\necho '#!/bin/bash' > scripts/setup.sh\nchmod +x scripts/setup.sh\n");
        const result = await run("Anything wrong with this workflow that uses a local composite action after checking out the PR head?\n\n.github/workflows/ci.yml:\n```yaml\nname: ci\non:\n  pull_request_target:\njobs:\n  test:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n      id-token: write\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - uses: ./.github/actions/setup\n```\n\n.github/actions/setup/action.yml:\n```yaml\nname: setup\nruns:\n  using: composite\n  steps:\n    - run: ./scripts/setup.sh\n      shell: bash\n```");

        expect(result.session.outputText).toMatch(new RegExp("(local|composite) action", "i"));
        expect(result.session.outputText).toMatch(new RegExp("(checkout|attacker-controlled|PR.*(head|code))", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL)\\b"));
        await expect(result).toSatisfyJudge(UnsafeReusableCalleeJudge);
      },
    );

    it(
      "report-unsafe-reusable-and-local__callee-no-permissions-block",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-unsafe-reusable-and-local");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/release-callee.yml <<'YAML'\nname: release-callee\non:\n  workflow_call:\n    inputs:\n      ref:\n        type: string\njobs:\n  publish:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ inputs.ref }}\n      - run: npm ci && npm publish\n        env:\n          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\nYAML\n");
        const result = await run("Review this reusable workflow. The caller grants contents: write and id-token: write and passes the PR ref. Is the callee structured safely?\n\n.github/workflows/release-callee.yml:\n```yaml\nname: release-callee\non:\n  workflow_call:\n    inputs:\n      ref:\n        type: string\njobs:\n  publish:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ inputs.ref }}\n      - run: npm ci && npm publish\n        env:\n          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\n```");

        expect(result.session.outputText).toMatch(new RegExp("permissions", "i"));
        expect(result.session.outputText).toMatch(new RegExp("(callee|reusable|workflow_call)", "i"));
        await expect(result).toSatisfyJudge(UnsafeReusableCalleeJudge);
      },
    );
  },
);
