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
  FlagsAudienceSubjectClaimsJudge,
  IdentifiesOIDCMisuseJudge,
  RatesHighSeverityJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "flag-oidc-misuse",
  {
    harness: piAiHarness({
      createAgent: () => skilletAgent({ skillRoot }),
      tools: skilletTools({ skillRoot }),
    }),
    judgeThreshold: 0.75,
  },
  (it) => {
    it(
      "flag-oidc-misuse__pr-target-aws-oidc",
      { timeout: 180_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-oidc-misuse__pr-target-aws-oidc");
        const result = await run("Audit .github/workflows/deploy.yml for security issues.", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/deploy.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(IdentifiesOIDCMisuseJudge);
        await expect(result).toSatisfyJudge(FlagsAudienceSubjectClaimsJudge);
      },
    );

    it(
      "flag-oidc-misuse__chatops-unauth-gcp-oidc",
      { timeout: 180_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-oidc-misuse__chatops-unauth-gcp-oidc");
        const result = await run("Review .github/workflows/chatops.yml — anything concerning?", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/chatops.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(IdentifiesOIDCMisuseJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );
  },
);
