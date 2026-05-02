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

const NoFalsePositiveOnMetadataOnlyJudge = judge("NoFalsePositiveOnMetadataOnlyJudge", async ({ criterion }) => {
  return criterion("Does NOT report the pull_request_target workflow as a pwn-request or injection vulnerability, and does not assign HIGH/CRITICAL severity to it.");
});

const ExplainsNoCheckoutOrExecutionJudge = judge("ExplainsNoCheckoutOrExecutionJudge", async ({ criterion }) => {
  return criterion("Explains that the workflow only labels/comments/reads metadata and never checks out or executes PR-controlled code, so the privileged trigger is not exploitable here.");
});

describeEval(
  "no-metadata-only-pr-target",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-metadata-only-pr-target__labeler-only",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-metadata-only-pr-target");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/labeler.yml <<'YAML'\nname: Labeler\non:\n  pull_request_target:\n    types: [opened, synchronize, reopened]\n\npermissions:\n  contents: read\n  pull-requests: write\n\njobs:\n  label:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/labeler@v5\n        with:\n          repo-token: ${{ secrets.GITHUB_TOKEN }}\nYAML");
        const result = await run("Audit .github/workflows/labeler.yml for security issues. Is this a pwn-request risk?");

        await expect(result).toSatisfyJudge(NoFalsePositiveOnMetadataOnlyJudge);
        await expect(result).toSatisfyJudge(ExplainsNoCheckoutOrExecutionJudge);
      },
    );
  },
);
