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

describeEval("report-pwn-request", {
  data: [
  {
    name: "report-pwn-request__checkout-pr-head-build",
    tests_behavior: "report-pwn-request",
    input: "Please review this GitHub Actions workflow for security issues:\n\n```yaml\nname: PR Build\non:\n  pull_request_target:\n    types: [opened, synchronize]\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n      pull-requests: write\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n          repository: ${{ github.event.pull_request.head.repo.full_name }}\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n      - run: npm ci\n      - run: npm run build\n        env:\n          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\n          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}\n```",
    criteria: "The response must identify this as a pwn-request vulnerability. It should explicitly call out that pull_request_target runs in a privileged context with access to secrets and write permissions, AND that the workflow checks out and builds (npm ci / npm run build executes attacker-controlled package.json scripts and build scripts) PR-controlled code. The finding must connect the privileged trigger to the execution of untrusted PR code with secrets available. It should not be a generic 'use pinned actions' or YAML-style critique.",
  },
  {
    name: "report-pwn-request__workflow-run-download-execute",
    tests_behavior: "report-pwn-request",
    input: "Is there a security problem with this workflow?\n\n```yaml\nname: Process PR Artifact\non:\n  workflow_run:\n    workflows: [\"PR CI\"]\n    types: [completed]\n\njobs:\n  process:\n    runs-on: ubuntu-latest\n    permissions:\n      pull-requests: write\n      contents: write\n    steps:\n      - name: Download artifact\n        uses: actions/github-script@v7\n        with:\n          script: |\n            const artifacts = await github.rest.actions.listWorkflowRunArtifacts({\n              owner: context.repo.owner,\n              repo: context.repo.repo,\n              run_id: context.payload.workflow_run.id,\n            });\n            const matchArtifact = artifacts.data.artifacts[0];\n            const download = await github.rest.actions.downloadArtifact({\n              owner: context.repo.owner,\n              repo: context.repo.repo,\n              artifact_id: matchArtifact.id,\n              archive_format: 'zip',\n            });\n            require('fs').writeFileSync('artifact.zip', Buffer.from(download.data));\n      - run: unzip artifact.zip\n      - run: node ./pr-script.js\n        env:\n          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}\n          API_KEY: ${{ secrets.API_KEY }}\n```",
    criteria: "The response must flag this as a pwn-request / privileged workflow_run vulnerability. It should explain that workflow_run executes in a trusted context with secrets and write tokens, and that this workflow downloads a PR-produced artifact and then executes code from it (node ./pr-script.js) — i.e. attacker-controlled content is loaded/executed in a privileged context. The connection between the privileged workflow_run trigger, the PR-controlled artifact, and the code execution sink with secrets must be made explicit.",
  },
  ],
  harness: skilletHarness({ skill: skillRoot }),
  judges: [SubstringJudge(), CriterionJudge()],
  threshold: 0.75,
  timeout: 180_000,
});
