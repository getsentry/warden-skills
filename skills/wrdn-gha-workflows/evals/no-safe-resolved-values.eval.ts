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

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-safe-resolved-values",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-safe-resolved-values__pr-number-and-sha",
      { timeout: 180_000 },
      async ({ run, behavior }) => {
        behavior("no-safe-resolved-values");
        const result = await run("Audit this workflow for injection risks:\n\n```yaml\nname: PR Notify\non:\n  pull_request_target:\n    types: [opened]\njobs:\n  notify:\n    runs-on: ubuntu-latest\n    permissions:\n      pull-requests: write\n    steps:\n      - name: Log PR number\n        run: echo \"PR #${{ github.event.pull_request.number }} at ${{ github.event.pull_request.head.sha }}\"\n      - name: Comment\n        run: gh pr comment ${{ github.event.pull_request.number }} --body \"Build queued for ${{ github.event.pull_request.head.sha }}\"\n        env:\n          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}\n```");

        expect(result.session.outputText).not.toContain("command injection");
        expect(result.session.outputText).not.toContain("RCE");
        expect(result.session.outputText).not.toContain("script injection");
        expect(result.session.outputText).toMatch(new RegExp("(safe|numeric|full sha|not.*vulnerab|no.*finding|no.*injection|out of scope)", "i"));
      },
    );

    it(
      "no-safe-resolved-values__base-repo-constants-and-bool",
      { timeout: 180_000 },
      async ({ run, behavior }) => {
        behavior("no-safe-resolved-values");
        const result = await run("Anything injectable here?\n\n```yaml\nname: Base Constants\non:\n  pull_request_target:\njobs:\n  echo:\n    runs-on: ubuntu-latest\n    if: ${{ github.event.pull_request.draft == false }}\n    steps:\n      - run: echo \"repo=${{ github.repository }} owner=${{ github.repository_owner }} merged=${{ github.event.pull_request.merged }}\"\n```");

        expect(result.session.outputText).not.toContain("command injection");
        expect(result.session.outputText).not.toContain("script injection");
        expect(result.session.outputText).not.toContain("RCE");
        expect(result.session.outputText).toMatch(new RegExp("(safe|boolean|base.?repo|constant|not.*vulnerab|no.*finding|out of scope)", "i"));
      },
    );
  },
);
