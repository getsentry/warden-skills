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

const NoFalsePositiveOnDispatchJudge = judge("NoFalsePositiveOnDispatchJudge", async ({ criterion }) => {
  return criterion("Does NOT report the workflow_dispatch trigger as a vulnerability and does NOT claim it enables RCE, injection, or privilege escalation as written.");
});

const ExplainsNoSinkJudge = judge("ExplainsNoSinkJudge", async ({ criterion }) => {
  return criterion("Explains that no caller-controlled input reaches a code-evaluating sink and there is no privileged impact, so the trigger alone is not a finding.");
});

describeEval(
  "no-dispatch-without-sink",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-dispatch-without-sink__manual-deploy-no-inputs",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-dispatch-without-sink");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/deploy.yml <<'YAML'\nname: Manual Deploy\non:\n  workflow_dispatch:\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: ./scripts/deploy.sh\nYAML");
        const result = await run("Audit .github/workflows/deploy.yml for security issues. Is the workflow_dispatch trigger a problem here?");

        await expect(result).toSatisfyJudge(NoFalsePositiveOnDispatchJudge);
        await expect(result).toSatisfyJudge(ExplainsNoSinkJudge);
      },
    );

    it(
      "no-dispatch-without-sink__scheduled-cache-warm",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-dispatch-without-sink");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/nightly.yml <<'YAML'\nname: Nightly Cache Warm\non:\n  schedule:\n    - cron: '0 3 * * *'\njobs:\n  warm:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm ci\nYAML");
        const result = await run("Anything exploitable in this scheduled workflow?");

        await expect(result).toSatisfyJudge(NoFalsePositiveOnDispatchJudge);
        await expect(result).toSatisfyJudge(ExplainsNoSinkJudge);
      },
    );
  },
);
