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
  DoesNotAssessSinksBeforeEnumerationJudge,
  EnumeratesAllTriggersJudge,
  EnumeratesReusableCallersJudge,
  LabelsTrustBoundaryJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "enumerate-triggers-and-callers",
  { harness: skilletHarness({ skill: skillRoot }), judgeThreshold: 0.75 },
  (it) => {
    it(
      "enumerate-triggers-and-callers__multi-trigger-with-reusable",
      { timeout: 180_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "enumerate-triggers-and-callers__multi-trigger-with-reusable");
        const result = await run("Audit .github/workflows/release.yml for security issues. Walk me through your assessment.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(EnumeratesAllTriggersJudge);
        await expect(result).toSatisfyJudge(EnumeratesReusableCallersJudge);
        await expect(result).toSatisfyJudge(LabelsTrustBoundaryJudge);
        await expect(result).toSatisfyJudge(DoesNotAssessSinksBeforeEnumerationJudge);
      },
    );
  },
);
