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

describeEval("recommend-remediations", {
  data: [
  {
    name: "recommend-remediations__script-injection-env-quoting",
    tests_behavior: "recommend-remediations",
    input: "Please review this GitHub Actions workflow for security issues and tell me how to fix anything you find:\n\n```yaml\nname: PR Title Check\non:\n  pull_request_target:\n    types: [opened, edited]\n\njobs:\n  check:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Validate title\n        run: |\n          echo \"Checking title: ${{ github.event.pull_request.title }}\"\n          if [[ \"${{ github.event.pull_request.title }}\" == *\"WIP\"* ]]; then\n            echo \"WIP detected\"\n            exit 1\n          fi\n```",
    criteria: "The response identifies the script injection via ${{ github.event.pull_request.title }} interpolated into a run: block, and recommends a concrete fix that passes the value through an env: mapping and uses shell-quoted expansion (e.g. env: TITLE: ${{ github.event.pull_request.title }} with the script using \"$TITLE\" or printf '%s\\n' \"$TITLE\"). The fix must be shown as a minimal patch, not just generic advice.",
  },
  {
    name: "recommend-remediations__unpinned-third-party-action",
    tests_behavior: "recommend-remediations",
    input: "Is there anything I should change about how this workflow uses third-party actions? It runs on PRs from forks and has access to a deploy token.\n\n```yaml\nname: Deploy Preview\non:\n  pull_request_target:\n    branches: [main]\n\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - uses: some-vendor/deploy-action@v2\n        with:\n          token: ${{ secrets.DEPLOY_TOKEN }}\n```",
    criteria: "The response recommends pinning the third-party action some-vendor/deploy-action to a full 40-character commit SHA (not a tag or major version), and shows the concrete replacement syntax (e.g. some-vendor/deploy-action@<40-hex-chars>). It should not demand pinning of actions/checkout (first-party actions/* are exempt).",
  },
  {
    name: "recommend-remediations__workflow-dispatch-input-validation",
    tests_behavior: "recommend-remediations",
    input: "Can you suggest a safer shape for this manually-triggered workflow? The `target` input is later used in a shell command that runs with repo write permissions.\n\n```yaml\nname: Manual Deploy\non:\n  workflow_dispatch:\n    inputs:\n      target:\n        description: 'Environment to deploy to'\n        required: true\n\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n    steps:\n      - run: ./scripts/deploy.sh ${{ inputs.target }}\n```",
    criteria: "The response recommends constraining the workflow_dispatch input using type: choice with an explicit options list (and/or server-side validation against an allowlist), AND recommends passing the value via env: with shell quoting rather than direct ${{ }} interpolation into the run: block. Both remediations should be shown concretely as YAML patches.",
  },
  ],
  harness: skilletHarness({ skill: skillRoot }),
  judges: [SubstringJudge(), CriterionJudge()],
  threshold: 0.75,
  timeout: 180_000,
});
