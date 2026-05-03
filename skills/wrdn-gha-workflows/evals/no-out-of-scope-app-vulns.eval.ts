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
  DoesNotFlagOutOfScopeAppVulnJudge,
  ExplainsScopeBoundaryJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-out-of-scope-app-vulns",
  { harness: skilletHarness({ skill: skillRoot }), judgeThreshold: 0.75 },
  (it) => {
    it(
      "no-out-of-scope-app-vulns__sql-injection-in-app-code",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "no-out-of-scope-app-vulns__sql-injection-in-app-code");
        const result = await run("Audit .github/workflows/lint.yml for any GitHub Actions security issues. The repo also contains src/db.py.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(DoesNotFlagOutOfScopeAppVulnJudge);
        await expect(result).toSatisfyJudge(ExplainsScopeBoundaryJudge);
      },
    );
  },
);
