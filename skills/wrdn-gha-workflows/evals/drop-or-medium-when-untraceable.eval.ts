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

const UntraceableChainJudge = judge("UntraceableChainJudge", async ({ criterion }) => {
  return criterion("The response either declines to report the finding (because the chain cannot be traced with the files available) OR reports it as medium confidence and explicitly names the missing link (e.g. the unseen composite action, referenced reusable workflow, or external script) needed to confirm the chain. A high-confidence finding asserted without the missing artifact fails the rubric.");
});

describeEval(
  "drop-or-medium-when-untraceable",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "drop-or-medium-when-untraceable__missing-composite-action",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("drop-or-medium-when-untraceable");
        await harness.setup("mkdir -p .github/workflows .github/actions/process-pr\ncat > .github/workflows/pr.yml <<'YAML'\nname: PR Processor\non:\n  pull_request_target:\n    types: [opened, synchronize]\njobs:\n  process:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - uses: ./.github/actions/process-pr\n        with:\n          title: ${{ github.event.pull_request.title }}\n        env:\n          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}\nYAML");
        const result = await run("Please audit this workflow. The composite action at ./.github/actions/process-pr is referenced but I haven't included its contents.\n\n```yaml\nname: PR Processor\non:\n  pull_request_target:\n    types: [opened, synchronize]\njobs:\n  process:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - uses: ./.github/actions/process-pr\n        with:\n          title: ${{ github.event.pull_request.title }}\n        env:\n          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}\n```");

        expect(result.session.outputText).toMatch(new RegExp("(composite action|process-pr|missing|cannot.*trace|unable.*trace|not.*available|medium confidence|drop)", "i"));
        await expect(result).toSatisfyJudge(UntraceableChainJudge);
      },
    );

    it(
      "drop-or-medium-when-untraceable__reusable-workflow-not-shown",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("drop-or-medium-when-untraceable");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/build.yml <<'YAML'\nname: Build\non:\n  pull_request_target:\njobs:\n  call:\n    uses: other-org/shared/.github/workflows/build.yml@main\n    secrets:\n      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\n    with:\n      pr_title: ${{ github.event.pull_request.title }}\nYAML");
        const result = await run("Audit this. The called reusable workflow lives in another repo I don't have access to here.\n\n```yaml\nname: Build\non:\n  pull_request_target:\njobs:\n  call:\n    uses: other-org/shared/.github/workflows/build.yml@main\n    secrets:\n      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\n    with:\n      pr_title: ${{ github.event.pull_request.title }}\n```");

        expect(result.session.outputText).toMatch(new RegExp("(reusable workflow|other-org/shared|build\\.yml|cannot.*trace|unable.*confirm|medium confidence|missing)", "i"));
        expect(result.session.outputText).not.toContain("CRITICAL");
        await expect(result).toSatisfyJudge(UntraceableChainJudge);
      },
    );
  },
);
