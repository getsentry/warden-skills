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
  return criterion("Explains that resolving head.sha/head_ref at run time after approval lets an attacker push new commits post-approval, and recommends pinning checkout to the SHA captured at approval time.");
});

describeEval(
  "report-toctou-approval-checkout",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-toctou-approval-checkout__ok-to-test-head-ref",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-toctou-approval-checkout");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/ok-to-test.yml <<'YAML'\nname: ok-to-test\non:\n  issue_comment:\n    types: [created]\njobs:\n  integration:\n    if: github.event.issue.pull_request && contains(github.event.comment.body, '/ok-to-test')\n    runs-on: ubuntu-latest\n    permissions:\n      contents: read\n      pull-requests: write\n    steps:\n      - name: Get PR head\n        id: pr\n        uses: actions/github-script@v7\n        with:\n          script: |\n            const pr = await github.rest.pulls.get({\n              owner: context.repo.owner,\n              repo: context.repo.repo,\n              pull_number: context.issue.number,\n            });\n            core.setOutput('ref', pr.data.head.ref);\n            core.setOutput('sha', pr.data.head.sha);\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ steps.pr.outputs.ref }}\n      - run: npm ci && npm test\n        env:\n          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\n          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}\nYAML\n");
        const result = await run("Please review .github/workflows/ok-to-test.yml for security issues and report any vulnerabilities with severity.");

        expect(result.session.outputText).toMatch(new RegExp("\\bTOCTOU\\b|time[- ]of[- ]check", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL)\\b"));
        expect(result.session.outputText).toContain("head.ref");
        expect(result.session.outputText).toMatch(new RegExp("pin.*\\b(sha|commit)\\b|capture.*sha.*approval", "i"));
        await expect(result).toSatisfyJudge(ToctouApprovalJudge);
      },
    );

    it(
      "report-toctou-approval-checkout__label-approved-head-sha",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-toctou-approval-checkout");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/approved-e2e.yml <<'YAML'\nname: approved-e2e\non:\n  pull_request_target:\n    types: [labeled]\njobs:\n  e2e:\n    if: github.event.label.name == 'safe-to-test'\n    runs-on: ubuntu-latest\n    permissions:\n      contents: read\n      id-token: write\n    steps:\n      - name: Resolve head\n        id: head\n        run: |\n          echo \"sha=$(gh api repos/${{ github.repository }}/pulls/${{ github.event.pull_request.number }} --jq .head.sha)\" >> $GITHUB_OUTPUT\n        env:\n          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ steps.head.outputs.sha }}\n      - run: ./scripts/e2e.sh\n        env:\n          AWS_ROLE: ${{ secrets.AWS_ROLE_ARN }}\nYAML\n");
        const result = await run("Audit .github/workflows/approved-e2e.yml — does the label-gated job have any race or TOCTOU concerns? Give severity.");

        expect(result.session.outputText).toMatch(new RegExp("\\bTOCTOU\\b|race|after approval", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL)\\b"));
        expect(result.session.outputText).toMatch(new RegExp("head\\.sha|head_ref|head\\.ref", "i"));
        expect(result.session.outputText).toMatch(new RegExp("push.*after|new commits?|latest commit|attacker.*push", "i"));
        await expect(result).toSatisfyJudge(ToctouApprovalJudge);
      },
    );
  },
);
