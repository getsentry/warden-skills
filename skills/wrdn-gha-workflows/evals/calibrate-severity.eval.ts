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
  return criterion("The response assigns a severity that matches the table: HIGH for external-attacker code execution in privileged workflows (secret/token theft, package publication, release tampering, self-hosted compromise, or caller-driven RCE in release/deploy/publish/sign/token jobs); MEDIUM for plausible chains needing one verified link, tightly scoped tokens, approval gates, or mutable third-party actions in jobs with non-trivial secrets; LOW only for defense-in-depth adjacent to a reviewed risk. The justification ties severity to impact and exploitability (blast radius, what the attacker controls, what tokens/secrets are reachable), not to YAML shape. When uncertain, the response picks the lower tier and explains why.");
});

describeEval(
  "calibrate-severity",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "calibrate-severity__high-pwn-request-publish",
      { timeout: 180_000 },
      async ({ run, behavior }) => {
        behavior("calibrate-severity");
        const result = await run("Please audit this workflow and assign a severity:\n\n```yaml\nname: Build and Publish on PR\non:\n  pull_request_target:\n    types: [opened, synchronize]\njobs:\n  publish:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n      id-token: write\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - run: npm ci\n      - run: npm publish\n        env:\n          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\n```");

        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL)\\b"));
        expect(result.session.outputText).not.toContain("LOW");
        await expect(result).toSatisfyJudge(SeverityCalibrationJudge);
      },
    );

    it(
      "calibrate-severity__medium-mutable-third-party-with-secrets",
      { timeout: 180_000 },
      async ({ run, behavior }) => {
        behavior("calibrate-severity");
        const result = await run("What's the severity of this workflow's risk?\n\n```yaml\nname: Deploy\non:\n  push:\n    branches: [main]\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    permissions:\n      id-token: write\n      contents: read\n    steps:\n      - uses: actions/checkout@v4\n      - uses: some-vendor/deploy-action@v2\n        with:\n          token: ${{ secrets.DEPLOY_TOKEN }}\n```");

        expect(result.session.outputText).toMatch(new RegExp("\\b(MEDIUM|MODERATE)\\b"));
        await expect(result).toSatisfyJudge(SeverityCalibrationJudge);
      },
    );

    it(
      "calibrate-severity__low-defense-in-depth",
      { timeout: 180_000 },
      async ({ run, behavior }) => {
        behavior("calibrate-severity");
        const result = await run("Audit this workflow and tell me the severity of any issues:\n\n```yaml\nname: Lint\non:\n  pull_request:\njobs:\n  lint:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: read\n    steps:\n      - uses: actions/checkout@v4\n      - uses: some-org/eslint-action@v1\n      - run: npm run lint\n```");

        expect(result.session.outputText).not.toContain("HIGH");
        expect(result.session.outputText).not.toContain("CRITICAL");
        await expect(result).toSatisfyJudge(SeverityCalibrationJudge);
      },
    );
  },
);
