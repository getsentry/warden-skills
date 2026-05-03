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
  ConnectsExploitChainJudge,
  DoesNotFlagAuthorizedChatopsJudge,
  IdentifiesChatopsTriggerJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "flag-chatops-without-authorization",
  {
    harness: piAiHarness({
      createAgent: () => skilletAgent({ skillRoot }),
      tools: skilletTools({ skillRoot }),
    }),
    judgeThreshold: 0.75,
  },
  (it) => {
    it(
      "flag-chatops-without-authorization__issue-comment-shell",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-chatops-without-authorization__issue-comment-shell");
        const result = await run("Audit .github/workflows/chatops.yml for security issues.", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/chatops.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(IdentifiesChatopsTriggerJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
      },
    );

    it(
      "flag-chatops-without-authorization__label-dispatch-no-gate",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-chatops-without-authorization__label-dispatch-no-gate");
        const result = await run("Review .github/workflows/label-run.yml — anything risky?", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/label-run.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(IdentifiesChatopsTriggerJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
      },
    );

    it(
      "flag-chatops-without-authorization__gated-no-flag",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-chatops-without-authorization__gated-no-flag");
        const result = await run("Audit .github/workflows/gated-chatops.yml for chatops authorization issues.", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/gated-chatops.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(DoesNotFlagAuthorizedChatopsJudge);
      },
    );
  },
);
