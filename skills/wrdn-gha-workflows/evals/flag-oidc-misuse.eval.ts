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
  createWorkspace,
  describeEval,
  skilletHarness,
} from "@sentry/skillet/evals";
import {
  ConnectsUntrustedTriggerToOIDCJudge,
  DoesNotFlagOIDCInTrustedJobJudge,
  FlagsAudienceOrSubjectClaimJudge,
  IdentifiesOIDCTokenMintingJudge,
  RatesHighSeverityJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "flag-oidc-misuse",
  { harness: skilletHarness({ skill: skillRoot }), judgeThreshold: 0.75 },
  (it) => {
    it(
      "flag-oidc-misuse__pr-target-mints-aws-token",
      { timeout: 180_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-oidc-misuse__pr-target-mints-aws-token");
        const result = await run("Audit .github/workflows/deploy.yml for security issues.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(IdentifiesOIDCTokenMintingJudge);
        await expect(result).toSatisfyJudge(ConnectsUntrustedTriggerToOIDCJudge);
        await expect(result).toSatisfyJudge(FlagsAudienceOrSubjectClaimJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );

    it(
      "flag-oidc-misuse__trusted-push-no-finding",
      { timeout: 180_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-oidc-misuse__trusted-push-no-finding");
        const result = await run("Audit .github/workflows/release.yml for security issues.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(DoesNotFlagOIDCInTrustedJobJudge);
      },
    );
  },
);
