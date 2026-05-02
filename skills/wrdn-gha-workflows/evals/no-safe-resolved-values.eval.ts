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

const NoFlagOnNumericIdJudge = judge("NoFlagOnNumericIdJudge", async ({ criterion }) => {
  return criterion("Does NOT report github.event.pull_request.number, issue.number, or run_id as a vulnerability or injection vector.");
});

const ExplainsNumericResolutionJudge = judge("ExplainsNumericResolutionJudge", async ({ criterion }) => {
  return criterion("Explains that the expression resolves to a numeric ID (or similar safe primitive) and therefore is not an injection sink.");
});

const NoFlagOnFullShaJudge = judge("NoFlagOnFullShaJudge", async ({ criterion }) => {
  return criterion("Does NOT flag github.sha or github.event.pull_request.head.sha used in a run script as an injection or RCE risk.");
});

const NoFlagOnBaseRepoConstantJudge = judge("NoFlagOnBaseRepoConstantJudge", async ({ criterion }) => {
  return criterion("Does NOT flag github.repository, github.repository_owner, or github.workflow as attacker-controlled or injectable values.");
});

describeEval(
  "no-safe-resolved-values",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-safe-resolved-values__pr-number-in-run",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-safe-resolved-values");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/comment.yml <<'YAML'\nname: PR Notify\non:\n  pull_request_target:\n    types: [opened]\njobs:\n  notify:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Log PR\n        run: echo \"PR number is ${{ github.event.pull_request.number }}\"\nYAML");
        const result = await run("Is there an injection risk in this workflow? Audit .github/workflows/comment.yml and tell me if ${{ github.event.pull_request.number }} in the run script is exploitable.");

        await expect(result).toSatisfyJudge(NoFlagOnNumericIdJudge);
        await expect(result).toSatisfyJudge(ExplainsNumericResolutionJudge);
      },
    );

    it(
      "no-safe-resolved-values__full-sha-in-run",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-safe-resolved-values");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/build.yml <<'YAML'\nname: Build\non:\n  push:\n    branches: [main]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Tag build\n        run: echo \"Building ${{ github.sha }}\" > build.txt\nYAML");
        const result = await run("Audit .github/workflows/build.yml — is using ${{ github.sha }} inside the run: shell script an injection vulnerability?");

        await expect(result).toSatisfyJudge(NoFlagOnFullShaJudge);
      },
    );

    it(
      "no-safe-resolved-values__base-repo-constant",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-safe-resolved-values");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/release.yml <<'YAML'\nname: Release\non:\n  push:\n    tags: ['v*']\njobs:\n  release:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Print repo\n        run: echo \"Releasing ${{ github.repository }} owned by ${{ github.repository_owner }}\"\nYAML");
        const result = await run("Audit .github/workflows/release.yml. Does interpolating ${{ github.repository }} into the run script create an injection risk?");

        await expect(result).toSatisfyJudge(NoFlagOnBaseRepoConstantJudge);
      },
    );
  },
);
