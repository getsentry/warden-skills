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
  toolCalls,
} from "@sentry/skillet/evals";
import {
  DoesNotFlagAppCodeOutsideCIJudge,
  ScopesReviewToWorkflowJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-app-vulns-out-of-ci",
  {
    harness: piAiHarness({ agent: skilletAgent({ skillRoot }) }),
    judgeThreshold: 0.75,
  },
  (it) => {
    it(
      "no-app-vulns-out-of-ci__sql-injection-in-unused-app-code",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "no-app-vulns-out-of-ci__sql-injection-in-unused-app-code");
        const result = await run("Please do a security review of .github/workflows/lint.yml in this repo.", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/lint.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(DoesNotFlagAppCodeOutsideCIJudge);
        await expect(result).toSatisfyJudge(ScopesReviewToWorkflowJudge);
      },
    );
  },
);
