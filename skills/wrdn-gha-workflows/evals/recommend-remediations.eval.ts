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

const RemediationQualityJudge = judge("RemediationQualityJudge", async ({ criterion }) => {
  return criterion("The response provides a concrete, minimal patch that matches the canonical safe pattern for the vulnerability shown (e.g. moving untrusted input into env: and quoting via printf '%s\\n' \"$VAR\" for shell injection; using process.env in actions/github-script; pinning third-party actions to a 40-char commit SHA; constraining workflow_dispatch inputs with type: choice; gating on author_association; pinning checkout to an approved SHA; declaring workflow_call.secrets explicitly). A vague suggestion like 'sanitize input' or 'be careful' does not satisfy the rubric — the fix must be specific and directly applicable.");
});

describeEval(
  "recommend-remediations",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "recommend-remediations__shell-injection-env-quoting",
      { timeout: 180_000 },
      async ({ run, behavior }) => {
        behavior("recommend-remediations");
        const result = await run("Please audit this workflow and tell me how to fix any issues:\n\n```yaml\nname: Issue Triage\non:\n  issues:\n    types: [opened]\njobs:\n  triage:\n    runs-on: ubuntu-latest\n    permissions:\n      issues: write\n    steps:\n      - run: |\n          echo \"Title: ${{ github.event.issue.title }}\"\n          gh issue comment ${{ github.event.issue.number }} --body \"Got: ${{ github.event.issue.title }}\"\n        env:\n          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}\n```");

        expect(result.session.outputText).toMatch(new RegExp("\\benv:\\b"));
        expect(result.session.outputText).toMatch(new RegExp("printf\\s+['\"]%s"));
        await expect(result).toSatisfyJudge(RemediationQualityJudge);
      },
    );

    it(
      "recommend-remediations__github-script-process-env",
      { timeout: 180_000 },
      async ({ run, behavior }) => {
        behavior("recommend-remediations");
        const result = await run("What's the right fix for this workflow?\n\n```yaml\nname: PR Comment Bot\non:\n  pull_request_target:\n    types: [opened]\njobs:\n  greet:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/github-script@v7\n        with:\n          script: |\n            const title = \"${{ github.event.pull_request.title }}\";\n            console.log(`PR title: ${title}`);\n```");

        expect(result.session.outputText).toMatch(new RegExp("process\\.env", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\benv:\\b"));
        await expect(result).toSatisfyJudge(RemediationQualityJudge);
      },
    );

    it(
      "recommend-remediations__third-party-action-sha-pin",
      { timeout: 180_000 },
      async ({ run, behavior }) => {
        behavior("recommend-remediations");
        const result = await run("How should I harden this workflow that uses a third-party action and handles a deploy token?\n\n```yaml\nname: Deploy\non:\n  push:\n    branches: [main]\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: some-vendor/deploy-action@v2\n        with:\n          token: ${{ secrets.DEPLOY_TOKEN }}\n```");

        expect(result.session.outputText).toMatch(new RegExp("(commit\\s+SHA|40[- ]char|full[- ]length\\s+SHA)", "i"));
        await expect(result).toSatisfyJudge(RemediationQualityJudge);
      },
    );
  },
);
