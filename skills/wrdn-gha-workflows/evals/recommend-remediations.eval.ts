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

const RecommendsEnvWithQuotingJudge = judge("RecommendsEnvWithQuotingJudge", async ({ criterion }) => {
  return criterion("Recommends passing the untrusted PR title through env: and referencing it as a quoted shell variable (e.g. \"$TITLE\" or printf '%s\\n' \"$TITLE\"), not direct ${{ }} interpolation in run:.");
});

const ConcreteMinimalPatchJudge = judge("ConcreteMinimalPatchJudge", async ({ criterion }) => {
  return criterion("Provides a concrete minimal patch (code/yaml diff or replacement snippet) for the specific workflow shown, not just generic advice to 'sanitize input' or 'follow best practices'.");
});

const TiesFixToVulnerabilityJudge = judge("TiesFixToVulnerabilityJudge", async ({ criterion }) => {
  return criterion("Explains how the recommended fix prevents shell interpretation/injection of the attacker-controlled value, connecting the patch to the actual exploit mechanism.");
});

describeEval(
  "recommend-remediations",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "recommend-remediations__pr-title-in-run",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("recommend-remediations");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/greet.yml <<'YAML'\nname: Greet\non:\n  pull_request_target:\n    types: [opened]\njobs:\n  greet:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Echo title\n        run: echo \"PR title is ${{ github.event.pull_request.title }}\"\nYAML");
        const result = await run("Audit .github/workflows/greet.yml and tell me how to fix any security issues you find. Show the patched workflow.");

        await expect(result).toSatisfyJudge(RecommendsEnvWithQuotingJudge);
        await expect(result).toSatisfyJudge(ConcreteMinimalPatchJudge);
        await expect(result).toSatisfyJudge(TiesFixToVulnerabilityJudge);
      },
    );
  },
);
