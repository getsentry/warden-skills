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
  DoesNotFabricateExploitChainJudge,
  DoesNotFlagBroadPermissionsAloneJudge,
  ExplainsNoExploitablePathJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-broad-permissions-without-path",
  { harness: skilletHarness({ skill: skillRoot }), judgeThreshold: 0.75 },
  (it) => {
    it(
      "no-broad-permissions-without-path__write-all-no-untrusted-input",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "no-broad-permissions-without-path__write-all-no-untrusted-input");
        const result = await run("Please audit .github/workflows/release.yml for security issues and report any vulnerabilities you find.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(DoesNotFlagBroadPermissionsAloneJudge);
        await expect(result).toSatisfyJudge(ExplainsNoExploitablePathJudge);
        await expect(result).toSatisfyJudge(DoesNotFabricateExploitChainJudge);
      },
    );

    it(
      "no-broad-permissions-without-path__pr-target-no-checkout",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "no-broad-permissions-without-path__pr-target-no-checkout");
        const result = await run("Audit this workflow file at .github/workflows/label.yml and tell me about any security vulnerabilities.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(DoesNotFlagBroadPermissionsAloneJudge);
        await expect(result).toSatisfyJudge(ExplainsNoExploitablePathJudge);
        await expect(result).toSatisfyJudge(DoesNotFabricateExploitChainJudge);
      },
    );
  },
);
