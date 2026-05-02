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
  judge,
  skilletHarness,
} from "@sentry/skillet/evals";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

const IdentifiesCommentTriggerJudge = judge("IdentifiesCommentTriggerJudge", async ({ criterion }) => {
  return criterion("Identifies issue_comment (or discussion/label) as an externally-triggerable event that runs without an authorization gate.");
});

const FlagsMissingAuthGateJudge = judge("FlagsMissingAuthGateJudge", async ({ criterion }) => {
  return criterion("Notes the absence of an author_association / team / approval check before the command executes.");
});

const IdentifiesCommentBodyInjectionJudge = judge("IdentifiesCommentBodyInjectionJudge", async ({ criterion }) => {
  return criterion("Identifies that comment body text is interpolated into a shell run step without safe quoting (env: + quoted expansion).");
});

const RatesHighSeverityJudge = judge("RatesHighSeverityJudge", async ({ criterion }) => {
  return criterion("Rates the finding HIGH or CRITICAL severity given the externally-triggerable shell injection with privileged token.");
});

describeEval(
  "report-comment-chatops",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-comment-chatops__issue-comment-shell-injection",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-comment-chatops");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/chatops.yml <<'YAML'\nname: ChatOps\non:\n  issue_comment:\n    types: [created]\njobs:\n  run-command:\n    if: startsWith(github.event.comment.body, '/deploy')\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n      pull-requests: write\n    steps:\n      - uses: actions/checkout@v4\n      - name: Execute command\n        run: |\n          echo \"Running: ${{ github.event.comment.body }}\"\n          ./scripts/deploy.sh ${{ github.event.comment.body }}\n        env:\n          DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}\nYAML");
        const result = await run("Please audit .github/workflows/chatops.yml for security issues.");

        await expect(result).toSatisfyJudge(IdentifiesCommentTriggerJudge);
        await expect(result).toSatisfyJudge(FlagsMissingAuthGateJudge);
        await expect(result).toSatisfyJudge(IdentifiesCommentBodyInjectionJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );
  },
);
