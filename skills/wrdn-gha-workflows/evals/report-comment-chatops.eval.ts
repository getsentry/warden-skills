// ──────────────────────────────────────────────────────────
// Generated initially from spec.yaml; durable after that. Edit
// freely to refine prompts, setup, and assertions for this
// behavior. Add or remove behaviors via spec.yaml — skillet only
// regenerates eval files for behaviors that don't have one yet.
// ──────────────────────────────────────────────────────────
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import {
  describeEval,
  CriterionJudge,
  SubstringJudge,
  skilletHarness,
} from "@sentry/skillet/evals";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval("report-comment-chatops", {
  data: [
  {
    name: "report-comment-chatops__issue-comment-shell-injection",
    tests_behavior: "report-comment-chatops",
    input: "Please review this GitHub Actions workflow for security issues and tell me if there's anything exploitable:\n\n```yaml\nname: ChatOps\non:\n  issue_comment:\n    types: [created]\n\njobs:\n  run-command:\n    runs-on: ubuntu-latest\n    if: startsWith(github.event.comment.body, '/deploy')\n    steps:\n      - uses: actions/checkout@v4\n      - name: Execute deploy command\n        run: |\n          echo \"Running: ${{ github.event.comment.body }}\"\n          ./scripts/deploy.sh ${{ github.event.comment.body }}\n        env:\n          DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}\n```",
    criteria: "The response must flag this workflow as vulnerable. It must identify BOTH (a) the lack of an authorization gate (no check on github.event.comment.user author_association for MEMBER/OWNER/COLLABORATOR, no team membership check, no required approval) meaning any external user commenting on an issue can trigger it, AND (b) the unsafe interpolation of github.event.comment.body directly into the run: shell script, which allows shell command injection. The response should recommend gating on author_association and moving the comment body into an env: var with proper quoting (or avoiding shell interpolation entirely).",
  },
  {
    name: "report-comment-chatops__discussion-title-injection",
    tests_behavior: "report-comment-chatops",
    input: "Is this discussion-triggered workflow safe? It just echoes the title for logging.\n\n```yaml\nname: Discussion Notifier\non:\n  discussion:\n    types: [created]\n\njobs:\n  notify:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Log new discussion\n        run: echo \"New discussion: ${{ github.event.discussion.title }}\"\n      - name: Post to webhook\n        run: curl -X POST https://internal.example.com/hook -d \"title=${{ github.event.discussion.title }}\"\n        env:\n          HOOK_TOKEN: ${{ secrets.HOOK_TOKEN }}\n```",
    criteria: "The response must flag this as a shell injection vulnerability via github.event.discussion.title interpolated directly into run: steps. It should reference that discussion events are externally triggerable by any user (no authorization gate) and that the title is attacker-controlled. Bonus if it references CVE-2025-53104 or the general class of discussion-title shell injection. It must recommend using env: with the value bound and then referencing $TITLE inside double quotes, or otherwise avoiding the unsafe interpolation.",
  },
  ],
  harness: skilletHarness({ skill: skillRoot }),
  judges: [SubstringJudge(), CriterionJudge()],
  threshold: 0.75,
  timeout: 180_000,
});
