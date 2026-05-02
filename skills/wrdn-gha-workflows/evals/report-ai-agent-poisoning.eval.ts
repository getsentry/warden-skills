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
  describeEval,
  skilletHarness,
} from "@sentry/skillet/evals";
import {
  ConnectsExploitChainJudge,
  IdentifiesAIAgentPoisoningJudge,
  RatesHighSeverityJudge,
  RecommendsAgentPoisoningHardeningJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "report-ai-agent-poisoning",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-ai-agent-poisoning__claude-md-on-pr-target",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-ai-agent-poisoning");
        await harness.useFixture("report-ai-agent-poisoning__claude-md-on-pr-target");
        const result = await run("Please audit .github/workflows/claude-review.yml for security issues.");

        await expect(result).toSatisfyJudge(IdentifiesAIAgentPoisoningJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
        await expect(result).toSatisfyJudge(RecommendsAgentPoisoningHardeningJudge);
      },
    );
  },
);
