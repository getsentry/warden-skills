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

const ChatopsAuthGateJudge = judge("ChatopsAuthGateJudge", async ({ criterion }) => {
  return criterion("Explanation ties the comment/discussion trigger to command execution without an author_association/team/approval gate, or to unsafe interpolation of body text into shell.");
});

describeEval(
  "report-comment-chatops",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-comment-chatops__issue-comment-no-auth-gate",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-comment-chatops");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/chatops.yml <<'YAML'\nname: chatops\non:\n  issue_comment:\n    types: [created]\njobs:\n  run-cmd:\n    if: startsWith(github.event.comment.body, '/deploy')\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n      pull-requests: write\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: refs/pull/${{ github.event.issue.number }}/head\n      - name: Run command\n        env:\n          TOKEN: ${{ secrets.DEPLOY_TOKEN }}\n        run: |\n          echo \"Running: ${{ github.event.comment.body }}\"\n          bash -c \"${{ github.event.comment.body }}\"\nYAML\n");
        const result = await run("Audit .github/workflows/chatops.yml for security issues related to the comment trigger and command handling.");

        expect(result.session.outputText).toContain("issue_comment");
        expect(result.session.outputText).toMatch(new RegExp("author_association|MEMBER|OWNER|COLLABORATOR|authorization", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL)\\b"));
        expect(result.session.outputText).toMatch(new RegExp("github\\.event\\.comment\\.body"));
        await expect(result).toSatisfyJudge(ChatopsAuthGateJudge);
      },
    );

    it(
      "report-comment-chatops__discussion-title-shell-injection",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-comment-chatops");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/discussion.yml <<'YAML'\nname: discussion-handler\non:\n  discussion:\n    types: [created]\njobs:\n  greet:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n    steps:\n      - name: Echo title\n        run: echo \"New discussion: ${{ github.event.discussion.title }}\"\nYAML\n");
        const result = await run("Review .github/workflows/discussion.yml — anything exploitable about how the discussion title is used?");

        expect(result.session.outputText).toContain("github.event.discussion.title");
        expect(result.session.outputText).toMatch(new RegExp("shell\\s+injection|command\\s+injection|script\\s+injection", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL)\\b"));
        await expect(result).toSatisfyJudge(ChatopsAuthGateJudge);
      },
    );
  },
);
