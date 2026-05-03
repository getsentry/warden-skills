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
  IdentifiesScriptActionInjectionJudge,
  RecommendsEnvOrContextForScriptJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "flag-script-action-injection",
  {
    harness: piAiHarness({
      createAgent: () => skilletAgent({ skillRoot }),
      tools: skilletTools({ skillRoot }),
    }),
    judgeThreshold: 0.75,
  },
  (it) => {
    it(
      "flag-script-action-injection__pr-title-in-github-script",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-script-action-injection__pr-title-in-github-script");
        const result = await run("Please review .github/workflows/triage.yml for security issues.", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "Read", arguments: expect.objectContaining({"file_path":".github/workflows/triage.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(IdentifiesScriptActionInjectionJudge);
        await expect(result).toSatisfyJudge(RecommendsEnvOrContextForScriptJudge);
      },
    );
  },
);
