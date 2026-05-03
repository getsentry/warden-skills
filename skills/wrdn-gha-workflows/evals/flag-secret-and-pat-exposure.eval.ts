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
  ConnectsSecretToSinkJudge,
  IdentifiesSecretExfiltrationJudge,
  RatesHighSeverityJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "flag-secret-and-pat-exposure",
  {
    harness: piAiHarness({
      createAgent: () => skilletAgent({ skillRoot }),
      tools: skilletTools({ skillRoot }),
    }),
    judgeThreshold: 0.75,
  },
  (it) => {
    it(
      "flag-secret-and-pat-exposure__secret-echoed-to-logs",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-secret-and-pat-exposure__secret-echoed-to-logs");
        const result = await run("Audit .github/workflows/deploy.yml for security issues involving secrets.", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "Read", arguments: expect.objectContaining({"file_path":".github/workflows/deploy.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(IdentifiesSecretExfiltrationJudge);
        await expect(result).toSatisfyJudge(ConnectsSecretToSinkJudge);
      },
    );

    it(
      "flag-secret-and-pat-exposure__secret-written-to-artifact",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-secret-and-pat-exposure__secret-written-to-artifact");
        const result = await run("Review .github/workflows/build.yml for secret exposure risks.", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "Read", arguments: expect.objectContaining({"file_path":".github/workflows/build.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(ConnectsSecretToSinkJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );

    it(
      "flag-secret-and-pat-exposure__secret-passed-to-untrusted-pr-code",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-secret-and-pat-exposure__secret-passed-to-untrusted-pr-code");
        const result = await run("Check .github/workflows/pr.yml for secret exposure to untrusted code.", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "Read", arguments: expect.objectContaining({"file_path":".github/workflows/pr.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(IdentifiesSecretExfiltrationJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );
  },
);
