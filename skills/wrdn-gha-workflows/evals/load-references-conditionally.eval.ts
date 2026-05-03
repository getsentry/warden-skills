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
  toolCalls,
} from "@sentry/skillet/evals";
import {
  DoesNotLoadIrrelevantReferencesJudge,
  IdentifiesPrivilegedTriggerJudge,
  LoadsMatchingReferenceJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "load-references-conditionally",
  { harness: skilletHarness({ skill: skillRoot }), judgeThreshold: 0.75 },
  (it) => {
    it(
      "load-references-conditionally__pwn-request-loads-pwn-ref",
      { timeout: 180_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "load-references-conditionally__pwn-request-loads-pwn-ref");
        const result = await run("Audit .github/workflows/ci.yml in the current working directory for security issues.", { metadata: { cwd } });

        const toolNames = toolCalls(result.session).map((c) => c.name);
        expect(toolNames).toEqual(expect.arrayContaining(["Read"]));
        await expect(result).toSatisfyJudge(LoadsMatchingReferenceJudge);
        await expect(result).toSatisfyJudge(DoesNotLoadIrrelevantReferencesJudge);
        await expect(result).toSatisfyJudge(IdentifiesPrivilegedTriggerJudge);
      },
    );
  },
);
