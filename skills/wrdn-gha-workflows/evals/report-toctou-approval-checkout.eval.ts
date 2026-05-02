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

const IdentifiesToctouJudge = judge("IdentifiesToctouJudge", async ({ criterion }) => {
  return criterion("Identifies the TOCTOU gap: maintainer approval (e.g. /ok-to-test or label) does not pin a SHA, so checkout resolves to whatever the attacker pushed last.");
});

const NamesMutableRefJudge = judge("NamesMutableRefJudge", async ({ criterion }) => {
  return criterion("Names the mutable ref being checked out (pull_request.head.sha resolved at run time, head_ref, or refs/pull/N/head) as the root cause.");
});

const RecommendsApprovalShaPinJudge = judge("RecommendsApprovalShaPinJudge", async ({ criterion }) => {
  return criterion("Recommends pinning checkout to the exact SHA captured at approval time, not just 'pin actions' or generic hardening.");
});

describeEval(
  "report-toctou-approval-checkout",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-toctou-approval-checkout__ok-to-test-label",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-toctou-approval-checkout");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/integration.yml <<'YAML'\nname: Integration Tests\non:\n  issue_comment:\n    types: [created]\njobs:\n  ok-to-test:\n    if: github.event.issue.pull_request && contains(github.event.comment.body, '/ok-to-test')\n    runs-on: ubuntu-latest\n    steps:\n      - name: Check maintainer\n        if: contains(fromJSON('[\"OWNER\",\"MEMBER\"]'), github.event.comment.author_association)\n        run: echo approved\n      - name: Get PR\n        id: pr\n        uses: actions/github-script@v7\n        with:\n          script: |\n            const pr = await github.rest.pulls.get({\n              owner: context.repo.owner,\n              repo: context.repo.repo,\n              pull_number: context.issue.number\n            });\n            core.setOutput('ref', pr.data.head.ref);\n            core.setOutput('sha', pr.data.head.sha);\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ steps.pr.outputs.sha }}\n      - name: Run integration\n        env:\n          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}\n          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\n        run: npm ci && npm run integration\nYAML");
        const result = await run("Review .github/workflows/integration.yml for security issues.");

        await expect(result).toSatisfyJudge(IdentifiesToctouJudge);
        await expect(result).toSatisfyJudge(NamesMutableRefJudge);
        await expect(result).toSatisfyJudge(RecommendsApprovalShaPinJudge);
      },
    );
  },
);
