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

const IncludesFileAndLineJudge = judge("IncludesFileAndLineJudge", async ({ criterion }) => {
  return criterion("Finding includes the workflow file path and a specific line number (or line range) for the vulnerable code.");
});

const IncludesTriggerAndInputJudge = judge("IncludesTriggerAndInputJudge", async ({ criterion }) => {
  return criterion("Finding names the entry point trigger (e.g. pull_request_target) AND the specific attacker-controlled input reaching the sink.");
});

const IncludesMechanismAndImpactJudge = judge("IncludesMechanismAndImpactJudge", async ({ criterion }) => {
  return criterion("Finding states the execution mechanism (how code runs) and the privileges/impact exposed (secrets, write token, etc).");
});

const IncludesConfidenceJudge = judge("IncludesConfidenceJudge", async ({ criterion }) => {
  return criterion("Finding states a confidence level of high or medium with a brief reason for that rating.");
});

const IncludesConcreteFixPatchJudge = judge("IncludesConcreteFixPatchJudge", async ({ criterion }) => {
  return criterion("Finding includes a concrete minimal workflow patch (diff or replacement YAML snippet), not just generic advice like 'pin actions' or 'use env'.");
});

describeEval(
  "output-finding-fields",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "output-finding-fields__pwn-request-full-fields",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("output-finding-fields");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/ci.yml <<'YAML'\nname: CI\non:\n  pull_request_target:\n    types: [opened, synchronize]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - run: |\n          npm ci\n          npm test\n        env:\n          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\n          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}\nYAML");
        const result = await run("Audit .github/workflows/ci.yml for security issues and report any findings.");

        await expect(result).toSatisfyJudge(IncludesFileAndLineJudge);
        await expect(result).toSatisfyJudge(IncludesTriggerAndInputJudge);
        await expect(result).toSatisfyJudge(IncludesMechanismAndImpactJudge);
        await expect(result).toSatisfyJudge(IncludesConfidenceJudge);
        await expect(result).toSatisfyJudge(IncludesConcreteFixPatchJudge);
      },
    );
  },
);
