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
  skilletHarness,
} from "@sentry/skillet/evals";
import {
  ConnectsExploitChainJudge,
  IdentifiesCredentialExposureJudge,
  RatesHighSeverityJudge,
  RecommendsRemediationJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "report-credential-exposure",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-credential-exposure__artipacked-git-upload",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-credential-exposure");
        await harness.useFixture("report-credential-exposure__artipacked-git-upload");
        const result = await run("Audit .github/workflows/release.yml for security issues.");

        await expect(result).toSatisfyJudge(IdentifiesCredentialExposureJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
        await expect(result).toSatisfyJudge(RecommendsRemediationJudge);
      },
    );

    it(
      "report-credential-exposure__derived-secret-in-logs",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-credential-exposure");
        await harness.useFixture("report-credential-exposure__derived-secret-in-logs");
        const result = await run("Review .github/workflows/deploy.yml — anything risky?");

        await expect(result).toSatisfyJudge(IdentifiesCredentialExposureJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
        await expect(result).toSatisfyJudge(RecommendsRemediationJudge);
      },
    );
  },
);
