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
  ConnectsCacheToExecutionJudge,
  DoesNotFlagBenignCacheJudge,
  IdentifiesCachePoisoningPathJudge,
  RatesHighSeverityJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "flag-cache-poisoning-paths",
  { harness: skilletHarness({ skill: skillRoot }), judgeThreshold: 0.75 },
  (it) => {
    it(
      "flag-cache-poisoning-paths__pr-populates-cache-restored-by-privileged",
      { timeout: 180_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-cache-poisoning-paths__pr-populates-cache-restored-by-privileged");
        const result = await run("Audit the workflows in .github/workflows/ for security issues.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(IdentifiesCachePoisoningPathJudge);
        await expect(result).toSatisfyJudge(ConnectsCacheToExecutionJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );

    it(
      "flag-cache-poisoning-paths__same-context-cache-not-flagged",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-cache-poisoning-paths__same-context-cache-not-flagged");
        const result = await run("Audit .github/workflows/ci.yml for security issues.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(DoesNotFlagBenignCacheJudge);
      },
    );
  },
);
