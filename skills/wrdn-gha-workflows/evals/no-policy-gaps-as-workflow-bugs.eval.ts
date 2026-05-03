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
  piAiHarness,
  skilletAgent,
  skilletTools,
  toolCalls,
} from "@sentry/skillet/evals";
import {
  DoesNotFlagPolicyGapJudge,
  ScopesToWorkflowFindingsJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-policy-gaps-as-workflow-bugs",
  {
    harness: piAiHarness({
      createAgent: () => skilletAgent({ skillRoot }),
      tools: skilletTools({ skillRoot }),
    }),
    judgeThreshold: 0.75,
  },
  (it) => {
    it(
      "no-policy-gaps-as-workflow-bugs__benign-push-workflow",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "no-policy-gaps-as-workflow-bugs__benign-push-workflow");
        const result = await run("Audit .github/workflows/release.yml for security issues. Note that this repo has no branch protection on main and no CODEOWNERS file.", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/release.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(DoesNotFlagPolicyGapJudge);
        await expect(result).toSatisfyJudge(ScopesToWorkflowFindingsJudge);
      },
    );
  },
);
