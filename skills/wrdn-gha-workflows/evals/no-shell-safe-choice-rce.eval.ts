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

const NoRceClaimOnShellSafeChoiceJudge = judge("NoRceClaimOnShellSafeChoiceJudge", async ({ criterion }) => {
  return criterion("Does NOT claim the choice input enables command injection or RCE, and does NOT label it HIGH/CRITICAL severity.");
});

const FramesEnvQuotingAsHardeningJudge = judge("FramesEnvQuotingAsHardeningJudge", async ({ criterion }) => {
  return criterion("If env: with quoting is mentioned, it is framed as defense-in-depth or hardening, not as fixing an actual exploitable bypass.");
});

const ExplainsChoiceConstraintJudge = judge("ExplainsChoiceConstraintJudge", async ({ criterion }) => {
  return criterion("Explains that the choice input is constrained to a hardcoded shell-safe option set, so no attacker-controlled value can reach the shell.");
});

describeEval(
  "no-shell-safe-choice-rce",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-shell-safe-choice-rce__hardcoded-options-in-run",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-shell-safe-choice-rce");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/deploy.yml <<'YAML'\nname: Deploy\non:\n  workflow_dispatch:\n    inputs:\n      env:\n        description: 'Target environment'\n        type: choice\n        required: true\n        options:\n          - dev\n          - staging\n          - prod\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Deploy\n        run: ./scripts/deploy.sh ${{ inputs.env }}\nYAML");
        const result = await run("Is there a command injection vulnerability in this workflow's use of the env input? Audit .github/workflows/deploy.yml.");

        await expect(result).toSatisfyJudge(NoRceClaimOnShellSafeChoiceJudge);
        await expect(result).toSatisfyJudge(FramesEnvQuotingAsHardeningJudge);
        await expect(result).toSatisfyJudge(ExplainsChoiceConstraintJudge);
      },
    );
  },
);
