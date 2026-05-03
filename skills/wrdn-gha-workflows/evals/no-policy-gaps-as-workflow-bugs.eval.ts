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
  DoesNotFlagPolicyGapJudge,
  ExplainsPolicyOutOfScopeJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-policy-gaps-as-workflow-bugs",
  { harness: skilletHarness({ skill: skillRoot }), judgeThreshold: 0.75 },
  (it) => {
    it(
      "no-policy-gaps-as-workflow-bugs__benign-ci-no-policy",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "no-policy-gaps-as-workflow-bugs__benign-ci-no-policy");
        const result = await run("Audit .github/workflows/ci.yml for security issues. Note: this repo has no branch protection rules and no CODEOWNERS file.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(DoesNotFlagPolicyGapJudge);
        await expect(result).toSatisfyJudge(ExplainsPolicyOutOfScopeJudge);
      },
    );
  },
);
