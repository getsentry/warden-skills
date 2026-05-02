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

const TreatsPullRequestTargetCheckoutAsBaseJudge = judge("TreatsPullRequestTargetCheckoutAsBaseJudge", async ({ criterion }) => {
  return criterion("Recognizes that default checkout under pull_request_target checks out base repository code, not PR code, and does not flag it as compromised.");
});

const DoesNotEscalatePullRequestJudge = judge("DoesNotEscalatePullRequestJudge", async ({ criterion }) => {
  return criterion("Does NOT flag the plain pull_request workflow as high-risk; treats it as intentionally less privileged with a read-only token.");
});

const ExplainsSafeBaseCheckoutJudge = judge("ExplainsSafeBaseCheckoutJudge", async ({ criterion }) => {
  return criterion("Explains that without an explicit ref override, the checkout pulls trusted base code rather than attacker PR code.");
});

describeEval(
  "apply-false-positive-controls",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "apply-false-positive-controls__pr-target-default-checkout",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("apply-false-positive-controls");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/label.yml <<'YAML'\nname: Label PR\non:\n  pull_request_target:\n    types: [opened, synchronize]\njobs:\n  label:\n    runs-on: ubuntu-latest\n    permissions:\n      pull-requests: write\n    steps:\n      - uses: actions/checkout@v4\n      - name: Read CODEOWNERS\n        run: cat .github/CODEOWNERS\nYAML");
        const result = await run("Is there a code-execution vulnerability in .github/workflows/label.yml? It uses pull_request_target and runs actions/checkout.");

        await expect(result).toSatisfyJudge(TreatsPullRequestTargetCheckoutAsBaseJudge);
        await expect(result).toSatisfyJudge(ExplainsSafeBaseCheckoutJudge);
      },
    );

    it(
      "apply-false-positive-controls__plain-pull-request",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("apply-false-positive-controls");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/test.yml <<'YAML'\nname: Test\non:\n  pull_request:\njobs:\n  test:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: read\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm ci && npm test\nYAML");
        const result = await run("Audit .github/workflows/test.yml. It runs untrusted PR code — is that a vulnerability?");

        await expect(result).toSatisfyJudge(DoesNotEscalatePullRequestJudge);
      },
    );
  },
);
