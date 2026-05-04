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
  IdentifiesCommentBodyInjectionJudge,
  IdentifiesMissingAuthorizationJudge,
  RatesHighSeverityJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "flag-chatops-without-authorization",
  {
    harness: piAiHarness({ agent: skilletAgent({ skillRoot }) }),
    judgeThreshold: 0.75,
  },
  (it) => {
    it(
      "flag-chatops-without-authorization__comment-shell-injection",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-chatops-without-authorization__comment-shell-injection");
        const result = await run("Please audit .github/workflows/chatops.yml for security issues.", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "Read", arguments: expect.objectContaining({"file_path":".github/workflows/chatops.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(IdentifiesMissingAuthorizationJudge);
        await expect(result).toSatisfyJudge(IdentifiesCommentBodyInjectionJudge);
      },
    );

    it(
      "flag-chatops-without-authorization__label-mutation-no-authz",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-chatops-without-authorization__label-mutation-no-authz");
        const result = await run("Review .github/workflows/label-handler.yml — anything risky?", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "Read", arguments: expect.objectContaining({"file_path":".github/workflows/label-handler.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(IdentifiesMissingAuthorizationJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );
  },
);
