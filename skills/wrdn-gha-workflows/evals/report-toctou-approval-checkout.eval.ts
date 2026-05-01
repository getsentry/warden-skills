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

const ToctouApprovalJudge = judge("ToctouApprovalJudge", async ({ criterion }) => {
  return criterion("The response identifies a TOCTOU vulnerability between maintainer approval and checkout: it explains that resolving pull_request.head.sha (or head_ref) at execution time means the workflow runs whatever the attacker most recently pushed, not the code the maintainer reviewed. It recommends pinning checkout to the SHA captured at the moment of approval. A generic 'pin actions to SHAs' or 'use pull_request_target carefully' note does not satisfy the rubric.");
});

describeEval(
  "report-toctou-approval-checkout",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-toctou-approval-checkout__ok-to-test-label",
      { timeout: 180_000 },
      async ({ run, behavior }) => {
        behavior("report-toctou-approval-checkout");
        const result = await run("Please audit this workflow for security issues:\n\n```yaml\nname: Integration Tests\non:\n  pull_request_target:\n    types: [labeled]\njobs:\n  test:\n    if: github.event.label.name == 'ok-to-test'\n    runs-on: ubuntu-latest\n    permissions:\n      contents: read\n      id-token: write\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - run: npm ci\n      - run: npm test\n        env:\n          AWS_ROLE: ${{ secrets.AWS_DEPLOY_ROLE }}\n          DB_PASSWORD: ${{ secrets.DB_PASSWORD }}\n```");

        expect(result.session.outputText).toMatch(new RegExp("TOCTOU|time[- ]of[- ]check", "i"));
        expect(result.session.outputText).toMatch(new RegExp("(approval|reviewed|labeled?)", "i"));
        expect(result.session.outputText).toMatch(new RegExp("(pin|capture|freeze).*(sha|commit)", "i"));
        await expect(result).toSatisfyJudge(ToctouApprovalJudge);
      },
    );

    it(
      "report-toctou-approval-checkout__head-ref-after-comment",
      { timeout: 180_000 },
      async ({ run, behavior }) => {
        behavior("report-toctou-approval-checkout");
        const result = await run("Is there a race condition risk in this approval-gated workflow?\n\n```yaml\nname: Deploy Preview\non:\n  issue_comment:\n    types: [created]\njobs:\n  deploy:\n    if: github.event.issue.pull_request && contains(github.event.comment.body, '/deploy')\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/github-script@v7\n        id: pr\n        with:\n          script: |\n            const pr = await github.rest.pulls.get({\n              owner: context.repo.owner,\n              repo: context.repo.repo,\n              pull_number: context.issue.number\n            });\n            return pr.data.head.ref;\n          result-encoding: string\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ steps.pr.outputs.result }}\n      - run: ./deploy.sh\n        env:\n          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}\n```");

        expect(result.session.outputText).toMatch(new RegExp("TOCTOU|race|time[- ]of[- ]check", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL)\\b"));
        await expect(result).toSatisfyJudge(ToctouApprovalJudge);
      },
    );
  },
);
