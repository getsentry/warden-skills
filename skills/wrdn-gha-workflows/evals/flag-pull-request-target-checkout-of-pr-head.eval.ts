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
  ConnectsExploitChainJudge,
  IdentifiesPRHeadCheckoutJudge,
  IdentifiesPrivilegedTriggerJudge,
  RatesHighSeverityJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "flag-pull-request-target-checkout-of-pr-head",
  { harness: skilletHarness({ skill: skillRoot }), judgeThreshold: 0.75 },
  (it) => {
    it(
      "flag-pull-request-target-checkout-of-pr-head__npm-test",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-pull-request-target-checkout-of-pr-head__npm-test");
        const result = await run("Audit .github/workflows/ci.yml for security issues.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(IdentifiesPrivilegedTriggerJudge);
        await expect(result).toSatisfyJudge(IdentifiesPRHeadCheckoutJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );
  },
);
