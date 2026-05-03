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
  ConnectsPrivilegedContextJudge,
  DoesNotFlagSHAPinnedActionJudge,
  IdentifiesMutableActionPinJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "flag-mutable-third-party-actions",
  {
    harness: piAiHarness({
      createAgent: () => skilletAgent({ skillRoot }),
      tools: skilletTools({ skillRoot }),
    }),
    judgeThreshold: 0.75,
  },
  (it) => {
    it(
      "flag-mutable-third-party-actions__tag-pin-with-secrets",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-mutable-third-party-actions__tag-pin-with-secrets");
        const result = await run("Please review .github/workflows/release.yml for security issues.", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/release.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(IdentifiesMutableActionPinJudge);
        await expect(result).toSatisfyJudge(ConnectsPrivilegedContextJudge);
      },
    );

    it(
      "flag-mutable-third-party-actions__branch-pin-self-hosted",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-mutable-third-party-actions__branch-pin-self-hosted");
        const result = await run("Audit .github/workflows/deploy.yml — anything risky about the third-party actions?", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/deploy.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(IdentifiesMutableActionPinJudge);
        await expect(result).toSatisfyJudge(DoesNotFlagSHAPinnedActionJudge);
      },
    );
  },
);
