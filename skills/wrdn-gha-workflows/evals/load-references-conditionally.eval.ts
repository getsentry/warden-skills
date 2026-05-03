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
  DoesNotLoadIrrelevantReferenceJudge,
  LoadsMatchingReferenceJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "load-references-conditionally",
  {
    harness: piAiHarness({
      createAgent: () => skilletAgent({ skillRoot }),
      tools: skilletTools({ skillRoot }),
    }),
    judgeThreshold: 0.75,
  },
  (it) => {
    it(
      "load-references-conditionally__pwn-request-pattern",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "load-references-conditionally__pwn-request-pattern");
        const result = await run("Audit .github/workflows/ci.yml for security issues.", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/ci.yml"}) }),
          ]),
        );
        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":"references/pwn-requests.md"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(LoadsMatchingReferenceJudge);
      },
    );

    it(
      "load-references-conditionally__chatops-only",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "load-references-conditionally__chatops-only");
        const result = await run("Review .github/workflows/triage.yml for security issues.", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":"references/chatops.md"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(LoadsMatchingReferenceJudge);
        await expect(result).toSatisfyJudge(DoesNotLoadIrrelevantReferenceJudge);
      },
    );
  },
);
