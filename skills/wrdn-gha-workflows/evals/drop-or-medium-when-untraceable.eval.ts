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

const DropsOrMediumConfidenceJudge = judge("DropsOrMediumConfidenceJudge", async ({ criterion }) => {
  return criterion("Either drops the finding entirely or reports it explicitly as medium (or lower) confidence — does not assert a high-confidence vulnerability.");
});

const NamesMissingLinkJudge = judge("NamesMissingLinkJudge", async ({ criterion }) => {
  return criterion("If reporting the finding, names the specific missing link (e.g. the unseen reusable workflow, called action, or downstream consumer) needed to confirm the chain.");
});

const DoesNotFabricateChainJudge = judge("DoesNotFabricateChainJudge", async ({ criterion }) => {
  return criterion("Does not assert an exploit chain that requires inspecting files not present in the workspace, and does not invent the contents of the missing artifact.");
});

describeEval(
  "drop-or-medium-when-untraceable",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "drop-or-medium-when-untraceable__missing-reusable-workflow",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("drop-or-medium-when-untraceable");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/ci.yml <<'YAML'\nname: CI\non:\n  pull_request_target:\n    types: [opened, synchronize]\njobs:\n  call-shared:\n    uses: my-org/shared-ci/.github/workflows/build.yml@main\n    with:\n      pr_title: ${{ github.event.pull_request.title }}\n      pr_ref: ${{ github.event.pull_request.head.ref }}\n    secrets:\n      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\nYAML");
        const result = await run("Audit .github/workflows/ci.yml. Tell me if there is a real vulnerability here.");

        await expect(result).toSatisfyJudge(DropsOrMediumConfidenceJudge);
        await expect(result).toSatisfyJudge(NamesMissingLinkJudge);
        await expect(result).toSatisfyJudge(DoesNotFabricateChainJudge);
      },
    );
  },
);
