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

const CommentChatopsJudge = judge("CommentChatopsJudge", async ({ criterion }) => {
  return criterion("The response identifies that the comment/chatops/discussion/label-triggered workflow lacks a proper authorization gate (author_association check for MEMBER/OWNER/COLLABORATOR, team membership, or required approval) AND/OR that comment/body text is interpolated unsafely into a shell or script context. It must connect the external triggerability of the event to the privileged action or injection sink, not just flag formatting or generic hygiene.");
});

describeEval(
  "report-comment-chatops",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-comment-chatops__issue-comment-no-auth-gate-shell-injection",
      { timeout: 180_000 },
      async ({ run, behavior }) => {
        behavior("report-comment-chatops");
        const result = await run("Please audit this workflow for security issues:\n\n```yaml\nname: ChatOps\non:\n  issue_comment:\n    types: [created]\njobs:\n  deploy:\n    if: startsWith(github.event.comment.body, '/deploy')\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n      id-token: write\n    steps:\n      - uses: actions/checkout@v4\n      - name: Run deploy\n        run: |\n          echo \"Deploying based on: ${{ github.event.comment.body }}\"\n          ./scripts/deploy.sh ${{ github.event.comment.body }}\n        env:\n          DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}\n```");

        expect(result.session.outputText).toMatch(new RegExp("issue_comment", "i"));
        expect(result.session.outputText).toMatch(new RegExp("(author_association|authorization|MEMBER|OWNER|COLLABORATOR|approval|team)", "i"));
        expect(result.session.outputText).toMatch(new RegExp("(injection|interpolat|unsafe|shell)", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL)\\b"));
        await expect(result).toSatisfyJudge(CommentChatopsJudge);
      },
    );

    it(
      "report-comment-chatops__discussion-title-shell-injection",
      { timeout: 180_000 },
      async ({ run, behavior }) => {
        behavior("report-comment-chatops");
        const result = await run("Anything wrong with this discussion-triggered workflow?\n\n```yaml\nname: Discussion Indexer\non:\n  discussion:\n    types: [created, edited]\njobs:\n  index:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n    steps:\n      - uses: actions/checkout@v4\n      - name: Index discussion\n        run: |\n          echo \"New discussion: ${{ github.event.discussion.title }}\"\n          ./index.sh \"${{ github.event.discussion.title }}\"\n        env:\n          API_KEY: ${{ secrets.INDEX_API_KEY }}\n```");

        expect(result.session.outputText).toMatch(new RegExp("discussion", "i"));
        expect(result.session.outputText).toMatch(new RegExp("(injection|interpolat|unsafe|shell)", "i"));
        expect(result.session.outputText).toMatch(new RegExp("discussion\\.title", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL)\\b"));
        await expect(result).toSatisfyJudge(CommentChatopsJudge);
      },
    );
  },
);
