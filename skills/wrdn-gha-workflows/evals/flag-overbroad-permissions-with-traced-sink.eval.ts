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
} from "@sentry/skillet/evals";
import {
  ConnectsExploitChainJudge,
  DoesNotFlagBroadPermissionsAloneJudge,
  ExplainsNoExploitablePathJudge,
  FlagsOverbroadPermissionWithPathJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "flag-overbroad-permissions-with-traced-sink",
  { harness: skilletHarness({ skill: skillRoot }), judgeThreshold: 0.75 },
  (it) => {
    it(
      "flag-overbroad-permissions-with-traced-sink__pr-target-with-write",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-overbroad-permissions-with-traced-sink__pr-target-with-write");
        const result = await run("Audit .github/workflows/ci.yml for security issues.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(FlagsOverbroadPermissionWithPathJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
      },
    );

    it(
      "flag-overbroad-permissions-with-traced-sink__broad-perms-no-path",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-overbroad-permissions-with-traced-sink__broad-perms-no-path");
        const result = await run("Audit .github/workflows/release.yml for security issues.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(DoesNotFlagBroadPermissionsAloneJudge);
        await expect(result).toSatisfyJudge(ExplainsNoExploitablePathJudge);
      },
    );
  },
);
