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
  ConnectsPrivilegedContextJudge,
  DoesNotFlagFirstPartyActionsJudge,
  IdentifiesMutableActionPinJudge,
  RecommendsShaPinJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "flag-mutable-third-party-actions",
  { harness: skilletHarness({ skill: skillRoot }), judgeThreshold: 0.75 },
  (it) => {
    it(
      "flag-mutable-third-party-actions__publish-with-tag-pin",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-mutable-third-party-actions__publish-with-tag-pin");
        const result = await run("Audit .github/workflows/release.yml for security issues.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(IdentifiesMutableActionPinJudge);
        await expect(result).toSatisfyJudge(ConnectsPrivilegedContextJudge);
        await expect(result).toSatisfyJudge(RecommendsShaPinJudge);
        await expect(result).toSatisfyJudge(DoesNotFlagFirstPartyActionsJudge);
      },
    );
  },
);
