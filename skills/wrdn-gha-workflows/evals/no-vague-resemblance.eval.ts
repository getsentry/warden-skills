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

const DoesNotFlagVagueResemblanceJudge = judge("DoesNotFlagVagueResemblanceJudge", async ({ criterion }) => {
  return criterion("Does NOT report a vulnerability finding for the workflow when no concrete attacker-to-sink chain can be traced.");
});

const ExplainsMissingChainJudge = judge("ExplainsMissingChainJudge", async ({ criterion }) => {
  return criterion("Explains that no exploit chain is traceable — e.g. no attacker-controlled input reaches a code-evaluating sink, or the dangerous pattern is not actually wired up.");
});

const NoSpeculativeHardeningAsFindingJudge = judge("NoSpeculativeHardeningAsFindingJudge", async ({ criterion }) => {
  return criterion("Does not present speculative or pattern-matched concerns (e.g. 'looks like injection', 'resembles pwn-request') as findings without tracing the chain.");
});

describeEval(
  "no-vague-resemblance",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-vague-resemblance__resembles-but-no-chain",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-vague-resemblance");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/ci.yml <<'YAML'\nname: CI\non:\n  pull_request_target:\n    types: [opened]\njobs:\n  label:\n    runs-on: ubuntu-latest\n    permissions:\n      pull-requests: write\n    steps:\n      - name: Add label\n        uses: actions/github-script@v7\n        with:\n          script: |\n            await github.rest.issues.addLabels({\n              owner: context.repo.owner,\n              repo: context.repo.repo,\n              issue_number: context.payload.pull_request.number,\n              labels: ['needs-triage']\n            });\nYAML");
        const result = await run("Audit .github/workflows/ci.yml for security vulnerabilities. Only report real findings with a traceable exploit chain.");

        await expect(result).toSatisfyJudge(DoesNotFlagVagueResemblanceJudge);
        await expect(result).toSatisfyJudge(ExplainsMissingChainJudge);
        await expect(result).toSatisfyJudge(NoSpeculativeHardeningAsFindingJudge);
      },
    );
  },
);
