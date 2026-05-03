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
  ConnectsSecretExfilChainJudge,
  DoesNotFlagStyleJudge,
  IdentifiesSecretSinkJudge,
  RatesHighSeverityJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "flag-secret-and-pat-exposure",
  { harness: skilletHarness({ skill: skillRoot }), judgeThreshold: 0.75 },
  (it) => {
    it(
      "flag-secret-and-pat-exposure__npm-token-to-pr-code",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-secret-and-pat-exposure__npm-token-to-pr-code");
        const result = await run("Audit .github/workflows/release.yml for security issues.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(IdentifiesSecretSinkJudge);
        await expect(result).toSatisfyJudge(ConnectsSecretExfilChainJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
        await expect(result).toSatisfyJudge(DoesNotFlagStyleJudge);
      },
    );

    it(
      "flag-secret-and-pat-exposure__pat-echoed-to-logs",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-secret-and-pat-exposure__pat-echoed-to-logs");
        const result = await run("Review .github/workflows/sync.yml and report any security issues.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(IdentifiesSecretSinkJudge);
        await expect(result).toSatisfyJudge(ConnectsSecretExfilChainJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
        await expect(result).toSatisfyJudge(DoesNotFlagStyleJudge);
      },
    );
  },
);
