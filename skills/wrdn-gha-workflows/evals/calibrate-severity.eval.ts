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

describeEval("calibrate-severity", {
  data: [
  {
    name: "calibrate-severity__release-publish-rce",
    tests_behavior: "calibrate-severity",
    input: "Please review this GitHub Actions workflow for security issues and assign a severity to anything you find:\n\n```yaml\n# .github/workflows/release.yml\nname: Release and Publish\non:\n  push:\n    tags:\n      - 'v*'\n\njobs:\n  publish:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n      id-token: write\n    steps:\n      - uses: actions/checkout@v4\n      - uses: some-org/setup-toolchain@main\n      - name: Build and publish\n        env:\n          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\n        run: |\n          npm ci\n          npm publish\n```\n\nWhat's the risk level here?",
    criteria: "The response identifies the mutable third-party action reference (some-org/setup-toolchain@main) running in a job that performs package publication with NPM_TOKEN and OIDC write permissions, and rates this as HIGH severity. The reasoning explicitly ties the high rating to the privileged release/publish context (package publication, secret access, or OIDC write token), not merely to the existence of a floating ref. It must not rate this as medium or low for this scenario.",
    timeout: 90000,
  },
  {
    name: "calibrate-severity__defense-in-depth-low",
    tests_behavior: "calibrate-severity",
    input: "Can you do a security review of this workflow and tell me the severity of any issues?\n\n```yaml\n# .github/workflows/pr-checks.yml\nname: PR Checks\non:\n  pull_request:\n    branches: [main]\n\npermissions:\n  contents: read\n\njobs:\n  lint:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - uses: actions/setup-node@v4\n        with:\n          node-version: '20'\n      - run: npm ci && npm run lint\n```\n\nThis runs on PRs from forks. Anything serious?",
    criteria: "The response either (a) finds nothing actionable and explains that this is a plain pull_request workflow with a read-only default token and no secrets, or (b) if it raises any defense-in-depth observation (e.g. pinning actions/* to SHAs as hardening), it rates that observation as LOW severity and explains the uncertainty / limited blast radius. The response must NOT rate anything here as high or medium, since there is no secret access, no privileged token, and no caller-driven code-execution sink with real impact.",
  },
  {
    name: "calibrate-severity__medium-with-uncertainty",
    tests_behavior: "calibrate-severity",
    input: "Security review please — what severity would you assign?\n\n```yaml\n# .github/workflows/preview.yml\nname: Preview Deploy\non:\n  workflow_dispatch:\n    inputs:\n      ref:\n        description: Branch, tag, or SHA to preview\n        required: true\n        type: string\n\njobs:\n  preview:\n    runs-on: ubuntu-latest\n    environment:\n      name: preview\n      # requires manual approval per repo settings\n    permissions:\n      contents: read\n      pull-requests: write\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ inputs.ref }}\n      - uses: third-party-org/deploy-preview@v2\n        with:\n          token: ${{ secrets.PREVIEW_DEPLOY_TOKEN }}\n```",
    criteria: "The response rates this as MEDIUM severity (not high, not low). The reasoning ties the medium rating to factors like: a manually triggered workflow, an environment approval gate, a preview-scoped token, a mutable third-party action reference with non-trivial secret access, and/or the need to verify the token's real blast radius before calling it high. If there is uncertainty about exploitability or token scope, the response explicitly acknowledges that uncertainty and explains why it chose the lower level. The response must not jump straight to high without proving release, production, package-publish, repo-write, or broader credential impact, and must not dismiss it as low.",
  },
  ],
  harness: skilletHarness({ skill: skillRoot }),
  judges: [SubstringJudge(), CriterionJudge()],
  threshold: 0.75,
  timeout: 180_000,
});
