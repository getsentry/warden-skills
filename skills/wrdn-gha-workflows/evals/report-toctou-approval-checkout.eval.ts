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

describeEval("report-toctou-approval-checkout", {
  data: [
  {
    name: "report-toctou-approval-checkout__ok-to-test-head-sha",
    tests_behavior: "report-toctou-approval-checkout",
    input: "Please review this GitHub Actions workflow for security issues and tell me what's wrong:\n\n```yaml\nname: Integration tests\non:\n  repository_dispatch:\n    types: [ok-to-test-command]\n\njobs:\n  integration:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.client_payload.pull_request.head.sha }}\n          repository: ${{ github.event.client_payload.pull_request.head.repo.full_name }}\n      - run: npm ci && npm test\n        env:\n          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}\n```\n\nThe `/ok-to-test` slash command is used by maintainers to approve PRs from forks before running the integration suite with secrets.",
    criteria: "The response must identify a TOCTOU (time-of-check vs time-of-use) vulnerability between maintainer approval (the /ok-to-test command) and checkout. It must explain that resolving pull_request.head.sha at workflow execution time means the attacker can push new commits AFTER approval but BEFORE the privileged job checks out, so the secrets-bearing job runs unreviewed code. The fix it recommends must involve pinning/capturing the SHA at the time of approval (e.g., the slash-command dispatcher captures and passes the exact reviewed SHA, or the workflow validates against the SHA the maintainer reviewed) rather than re-resolving head.sha at run time. It should NOT merely complain about pull_request_target generally, missing input validation, YAML style, or mutable action refs as the primary issue.",
    timeout: 60000,
  },
  {
    name: "report-toctou-approval-checkout__label-trigger-head-ref",
    tests_behavior: "report-toctou-approval-checkout",
    input: "Security review please:\n\n```yaml\nname: e2e\non:\n  pull_request_target:\n    types: [labeled]\n\njobs:\n  e2e:\n    if: github.event.label.name == 'safe-to-test'\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.ref }}\n          repository: ${{ github.event.pull_request.head.repo.full_name }}\n      - run: ./scripts/e2e.sh\n        env:\n          AWS_ROLE: ${{ secrets.AWS_ROLE_ARN }}\n```",
    criteria: "The response must flag a TOCTOU vulnerability between the maintainer's 'safe-to-test' label approval and checkout. It must explain that head.ref is a mutable branch name resolved at execution time, so an attacker can push new commits to their fork branch after the label is applied and the privileged job will run that new code with secrets — not what the maintainer reviewed. The recommended fix must be to pin checkout to the exact commit SHA that was present (and reviewed) at the moment the label was applied, rather than re-resolving the branch ref. The response should treat the label-as-approval gating as insufficient on its own without SHA pinning.",
    timeout: 60000,
  },
  ],
  harness: skilletHarness({ skill: skillRoot }),
  judges: [SubstringJudge(), CriterionJudge()],
  threshold: 0.75,
  timeout: 180_000,
});
