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

describeEval("report-cache-artifact-runner-abuse", {
  data: [
  {
    name: "report-cache-artifact-runner-abuse__poisoned-cache-restored-in-release",
    tests_behavior: "report-cache-artifact-runner-abuse",
    input: "Please review these two GitHub Actions workflows for security issues and tell me whether there's anything I should worry about.\n\n.github/workflows/ci.yml:\n```yaml\nname: CI\non:\n  pull_request:\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n      - uses: actions/cache@v4\n        with:\n          path: |\n            node_modules\n            .build-cache\n          key: build-cache-${{ github.ref }}\n      - run: npm ci\n      - run: npm run build\n      - run: cp -r .build-cache /tmp/saved || true\n```\n\n.github/workflows/release.yml:\n```yaml\nname: Release\non:\n  push:\n    branches: [main]\njobs:\n  release:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n      id-token: write\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n      - uses: actions/cache@v4\n        with:\n          path: |\n            node_modules\n            .build-cache\n          key: build-cache-refs/heads/main\n          restore-keys: |\n            build-cache-\n      - run: node .build-cache/postinstall.js || true\n      - run: npm publish\n        env:\n          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}\n```",
    criteria: "The response must identify cache poisoning as a real vulnerability: specifically that the pull_request CI workflow lets attacker PRs write into a cache namespace that the privileged release workflow later restores (via the shared key prefix and restore-keys fallback), and that the restored cache contents (e.g. node_modules or .build-cache/postinstall.js) are then executed in the release job which holds NPM_TOKEN / contents:write / id-token. It should connect this to GitHub Actions cache scoping (PRs can populate caches readable from the default branch) and treat it as a privileged-job compromise path, not a generic style issue.",
  },
  {
    name: "report-cache-artifact-runner-abuse__self-hosted-runner-pr",
    tests_behavior: "report-cache-artifact-runner-abuse",
    input: "Quick security check on this workflow please:\n\n```yaml\nname: e2e\non:\n  pull_request:\n    branches: [main]\njobs:\n  e2e:\n    runs-on: [self-hosted, linux, gpu-prod]\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - run: ./scripts/run-e2e.sh\n      - run: make bench\n```\n\nThe self-hosted runners are persistent VMs we maintain in our infra account; they also run nightly jobs for the main branch.",
    criteria: "The response must flag self-hosted runner abuse: specifically that a plain pull_request workflow checks out and executes PR-controlled code (./scripts/run-e2e.sh, make bench, plus arbitrary build/test scripts in the PR tree) on a persistent, non-ephemeral self-hosted runner that is shared with privileged main-branch jobs. It should explain the impact (runner compromise, persistence across jobs, lateral movement to nightly/main jobs and any cached credentials or tokens on the host) and recommend either restricting to ephemeral runners, gating on trusted contributors, or moving untrusted PR execution to GitHub-hosted runners. It must not dismiss this as a benign pull_request workflow.",
  },
  {
    name: "report-cache-artifact-runner-abuse__artifact-handoff-to-privileged",
    tests_behavior: "report-cache-artifact-runner-abuse",
    input: "Are these two workflows safe together?\n\n.github/workflows/build.yml:\n```yaml\nname: build\non:\n  pull_request:\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: ./build.sh\n      - uses: actions/upload-artifact@v4\n        with:\n          name: dist\n          path: dist/\n```\n\n.github/workflows/deploy-preview.yml:\n```yaml\nname: deploy-preview\non:\n  workflow_run:\n    workflows: [build]\n    types: [completed]\njobs:\n  deploy:\n    if: github.event.workflow_run.conclusion == 'success'\n    runs-on: ubuntu-latest\n    permissions:\n      id-token: write\n      contents: read\n    steps:\n      - uses: actions/download-artifact@v4\n        with:\n          name: dist\n          run-id: ${{ github.event.workflow_run.id }}\n          github-token: ${{ secrets.GITHUB_TOKEN }}\n      - run: ./dist/deploy.sh\n        env:\n          AWS_ROLE: ${{ secrets.AWS_DEPLOY_ROLE }}\n```",
    criteria: "The response must identify the artifact-handoff vulnerability: the unprivileged pull_request build job produces an attacker-controlled artifact (dist/, including dist/deploy.sh) which is then downloaded and executed by a privileged workflow_run job that holds OIDC id-token:write and AWS deploy credentials. It should describe this as artifact poisoning / unsafe artifact trust crossing a privilege boundary and explain that the deploy workflow effectively executes PR-controlled code with production credentials. Recommendations should involve validating/rebuilding the artifact in the trusted context or never executing downloaded artifact contents directly.",
  },
  ],
  harness: skilletHarness({ skill: skillRoot }),
  judges: [SubstringJudge(), CriterionJudge()],
  threshold: 0.75,
  timeout: 180_000,
});
