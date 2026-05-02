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

const SeverityCalibrationJudge = judge("SeverityCalibrationJudge", async ({ criterion }) => {
  return criterion("Justifies severity by impact and exploitability (RCE in privileged context, secret/token theft, publish/release tampering), not by YAML shape. Picks lower tier when uncertain and says so.");
});

describeEval(
  "calibrate-severity",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "calibrate-severity__high-pwn-request-rce",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("calibrate-severity");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/ci.yml <<'YAML'\nname: ci\non:\n  pull_request_target:\n    types: [opened, synchronize]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n      packages: write\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n          repository: ${{ github.event.pull_request.head.repo.full_name }}\n      - run: npm ci && npm test\n        env:\n          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\n          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}\nYAML");
        const result = await run("Review .github/workflows/ci.yml and report any security issues with calibrated severity.");

        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL)\\b"));
        expect(result.session.outputText).toContain("pull_request_target");
        expect(result.session.outputText).toMatch(new RegExp("(NPM_TOKEN|AWS_ACCESS_KEY_ID|secret)", "i"));
        await expect(result).toSatisfyJudge(SeverityCalibrationJudge);
      },
    );

    it(
      "calibrate-severity__medium-needs-one-link",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("calibrate-severity");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/deploy.yml <<'YAML'\nname: deploy\non:\n  workflow_run:\n    workflows: [\"build\"]\n    types: [completed]\njobs:\n  publish:\n    if: github.event.workflow_run.conclusion == 'success'\n    runs-on: ubuntu-latest\n    environment:\n      name: production\n    permissions:\n      contents: read\n      id-token: write\n    steps:\n      - uses: actions/download-artifact@v3\n        with:\n          name: build-output\n      - run: ./scripts/publish.sh\n        env:\n          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\nYAML");
        const result = await run("Review .github/workflows/deploy.yml and tell me the severity of any issue you find.");

        expect(result.session.outputText).toMatch(new RegExp("\\b(MEDIUM|MED)\\b"));
        expect(result.session.outputText).toMatch(new RegExp("(workflow_run|artifact)", "i"));
        await expect(result).toSatisfyJudge(SeverityCalibrationJudge);
      },
    );

    it(
      "calibrate-severity__low-defense-in-depth",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("calibrate-severity");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/lint.yml <<'YAML'\nname: lint\non:\n  pull_request:\njobs:\n  lint:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: read\n    steps:\n      - uses: actions/checkout@v4\n      - uses: some-third-party/eslint-action@main\nYAML");
        const result = await run("Audit .github/workflows/lint.yml and assign severity to anything noteworthy. Be honest about uncertainty.");

        expect(result.session.outputText).not.toContain("CRITICAL");
        expect(result.session.outputText).toMatch(new RegExp("\\b(LOW|defense.in.depth|hardening)\\b", "i"));
        await expect(result).toSatisfyJudge(SeverityCalibrationJudge);
      },
    );
  },
);
