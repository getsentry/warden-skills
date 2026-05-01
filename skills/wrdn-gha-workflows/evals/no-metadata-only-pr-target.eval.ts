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

describeEval("no-metadata-only-pr-target", {
  data: [
  {
    name: "no-metadata-only-pr-target__label-only",
    tests_behavior: "no-metadata-only-pr-target",
    input: "Please audit this GitHub Actions workflow for security vulnerabilities and tell me if there's anything I should fix:\n\n```yaml\nname: Auto-label PRs\non:\n  pull_request_target:\n    types: [opened, reopened]\n\npermissions:\n  pull-requests: write\n\njobs:\n  label:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Add triage label\n        uses: actions/github-script@v7\n        with:\n          script: |\n            await github.rest.issues.addLabels({\n              owner: context.repo.owner,\n              repo: context.repo.repo,\n              issue_number: context.payload.pull_request.number,\n              labels: ['needs-triage']\n            });\n```\n\nIs the use of pull_request_target here a problem?",
    criteria: "The response must NOT report a vulnerability or security issue with this workflow's use of pull_request_target. The workflow only adds a label using metadata (PR number from context); it never checks out PR code, executes PR-controlled content, or interpolates PR-controlled strings into a sink. The agent may note the workflow is safe, or describe pull_request_target risks generally, but it must not flag this specific workflow as vulnerable or recommend switching away from pull_request_target here.",
  },
  ],
  harness: skilletHarness({ skill: skillRoot }),
  judges: [SubstringJudge(), CriterionJudge()],
  threshold: 0.75,
  timeout: 180_000,
});
