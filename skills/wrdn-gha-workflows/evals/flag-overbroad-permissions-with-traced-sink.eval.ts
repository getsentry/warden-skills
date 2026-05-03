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
  ConnectsPermissionToExploitPathJudge,
  DoesNotFlagBroadPermissionsAloneJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "flag-overbroad-permissions-with-traced-sink",
  {
    harness: piAiHarness({
      createAgent: () => skilletAgent({ skillRoot }),
      tools: skilletTools({ skillRoot }),
    }),
    judgeThreshold: 0.75,
  },
  (it) => {
    it(
      "flag-overbroad-permissions-with-traced-sink__contents-write-with-pr-target-checkout",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-overbroad-permissions-with-traced-sink__contents-write-with-pr-target-checkout");
        const result = await run("Audit .github/workflows/release.yml for security issues.", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/release.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(ConnectsPermissionToExploitPathJudge);
      },
    );

    it(
      "flag-overbroad-permissions-with-traced-sink__no-flag-broad-perms-no-sink",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-overbroad-permissions-with-traced-sink__no-flag-broad-perms-no-sink");
        const result = await run("Audit .github/workflows/docs.yml for security issues.", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/docs.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(DoesNotFlagBroadPermissionsAloneJudge);
      },
    );
  },
);
