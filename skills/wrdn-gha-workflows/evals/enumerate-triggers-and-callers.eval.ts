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
  EnumeratesAllTriggersJudge,
  EnumeratesCallersJudge,
  LabelsTriggerTrustJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "enumerate-triggers-and-callers",
  {
    harness: piAiHarness({ agent: skilletAgent({ skillRoot }) }),
    judgeThreshold: 0.75,
  },
  (it) => {
    it(
      "enumerate-triggers-and-callers__multi-trigger-workflow",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "enumerate-triggers-and-callers__multi-trigger-workflow");
        const result = await run("Review .github/workflows/ci.yml for security issues. Start by mapping the attack surface.", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/ci.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(EnumeratesAllTriggersJudge);
        await expect(result).toSatisfyJudge(LabelsTriggerTrustJudge);
      },
    );

    it(
      "enumerate-triggers-and-callers__reusable-with-callers",
      { timeout: 150_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "enumerate-triggers-and-callers__reusable-with-callers");
        const result = await run("Audit .github/workflows/reusable-deploy.yml. Map the full attack surface including who can invoke it.", { metadata: { cwd } });

        const toolNames = toolCalls(result.session).map((c) => c.name);
        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/reusable-deploy.yml"}) }),
          ]),
        );
        expect(toolNames).toEqual(expect.arrayContaining(["grep"]));
        await expect(result).toSatisfyJudge(EnumeratesCallersJudge);
        await expect(result).toSatisfyJudge(LabelsTriggerTrustJudge);
      },
    );
  },
);
