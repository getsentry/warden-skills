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

describeEval("report-expression-injection", {
  data: [
  {
    name: "report-expression-injection__pr-title-in-run",
    tests_behavior: "report-expression-injection",
    input: "Please review this GitHub Actions workflow for security issues:\n\n```yaml\nname: PR Check\non:\n  pull_request_target:\n    types: [opened, edited]\n\njobs:\n  check:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - name: Greet PR\n        run: |\n          echo \"Processing PR titled: ${{ github.event.pull_request.title }}\"\n          echo \"From branch: ${{ github.event.pull_request.head.ref }}\"\n```",
    criteria: "The response must flag expression injection via attacker-controlled GitHub context interpolated directly into a run: block. It must specifically identify github.event.pull_request.title (and/or head.ref) being expanded into the shell as the vulnerability. It should explain that a malicious PR title/branch name can break out of the echo and execute arbitrary commands. It should not be a generic YAML/style critique.",
  },
  {
    name: "report-expression-injection__github-script-comment-body",
    tests_behavior: "report-expression-injection",
    input: "Is there anything risky in this workflow?\n\n```yaml\nname: Triage\non:\n  issue_comment:\n    types: [created]\n\njobs:\n  triage:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/github-script@v7\n        with:\n          script: |\n            const body = `${{ github.event.comment.body }}`;\n            if (body.includes('/triage')) {\n              console.log('triaging');\n            }\n```",
    criteria: "The response must report expression injection: the comment body (attacker-controlled) is interpolated directly into the actions/github-script script body, where it is evaluated as JavaScript. It should explain the code-evaluating sink (github-script) and that an attacker can break out of the template literal to execute arbitrary JS with the workflow's token. It must not merely complain about formatting or names.",
  },
  {
    name: "report-expression-injection__write-to-github-env",
    tests_behavior: "report-expression-injection",
    input: "Quick security review on this step please:\n\n```yaml\n      - name: Capture branch\n        run: |\n          echo \"BRANCH=${{ github.head_ref }}\" >> $GITHUB_ENV\n          echo \"TITLE=${{ github.event.pull_request.title }}\" >> $GITHUB_OUTPUT\n```",
    criteria: "The response must flag expression injection into $GITHUB_ENV and/or $GITHUB_OUTPUT writes, identifying github.head_ref and github.event.pull_request.title as attacker-controlled values being interpolated into a code-evaluating shell sink that also writes to environment files. It should note that a crafted branch name or PR title can both execute shell commands and inject arbitrary env vars/outputs consumed by later steps.",
  },
  ],
  harness: skilletHarness({ skill: skillRoot }),
  judges: [SubstringJudge(), CriterionJudge()],
  threshold: 0.75,
  timeout: 180_000,
});
