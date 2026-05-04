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
  ConnectsCallerToCalleeSinkJudge,
  DoesNotFlagSafeCallerJudge,
  IdentifiesCallerForwardedInjectionJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "review-workflow-call-inputs",
  {
    harness: piAiHarness({ agent: skilletAgent({ skillRoot }) }),
    judgeThreshold: 0.75,
  },
  (it) => {
    it(
      "review-workflow-call-inputs__caller-forwards-pr-title",
      { timeout: 180_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "review-workflow-call-inputs__caller-forwards-pr-title");
        const result = await run("Audit the workflows in .github/workflows/ for security issues. There's a reusable workflow and a caller — please review both.", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/caller.yml"}) }),
          ]),
        );
        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/reusable-build.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(IdentifiesCallerForwardedInjectionJudge);
        await expect(result).toSatisfyJudge(ConnectsCallerToCalleeSinkJudge);
      },
    );

    it(
      "review-workflow-call-inputs__safe-caller-constant",
      { timeout: 180_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "review-workflow-call-inputs__safe-caller-constant");
        const result = await run("Review .github/workflows/ — is there a security issue with how the caller invokes the reusable workflow?", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/caller-safe.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(DoesNotFlagSafeCallerJudge);
      },
    );
  },
);
