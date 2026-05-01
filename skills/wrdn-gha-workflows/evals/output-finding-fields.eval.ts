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

const FindingFieldsJudge = judge("FindingFieldsJudge", async ({ criterion }) => {
  return criterion("The response, for each finding, includes ALL of: file and line reference, entry point (workflow trigger), controlled input source, execution mechanism (how the input reaches code execution), privileges exposed (tokens/secrets/permissions), impact, confidence rating (high or medium with a reason), and a concrete fix presented as a minimal workflow patch (diff or replacement YAML snippet). A finding missing any of these fields fails the rubric. Generic prose advice without a patch fails.");
});

const NoFindingsDisclosureJudge = judge("NoFindingsDisclosureJudge", async ({ criterion }) => {
  return criterion("When the agent reports no findings, it explicitly states that no findings were identified AND enumerates which workflow files or paths it reviewed. Simply saying 'looks good' or 'no issues' without listing the reviewed scope fails the rubric.");
});

describeEval(
  "output-finding-fields",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "output-finding-fields__pwn-request-full-fields",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("output-finding-fields");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/pr-build.yml <<'EOF'\nname: PR Build\non:\n  pull_request_target:\n    types: [opened, synchronize]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n      pull-requests: write\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - run: npm ci\n      - run: npm run build\n        env:\n          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\n          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}\nEOF\n");
        const result = await run("Audit the workflows in this repo for GitHub Actions security issues and report findings.");

        expect(result.session.outputText).toContain("pr-build.yml");
        expect(result.session.outputText).toMatch(new RegExp("\\bline\\b|:\\d+", "i"));
        expect(result.session.outputText).toMatch(new RegExp("pull_request_target", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(confidence|high|medium)\\b", "i"));
        expect(result.session.outputText).toMatch(new RegExp("(```|diff|patch|---|\\+\\+\\+)", "i"));
        expect(result.session.outputText).toMatch(new RegExp("(impact|privilege|secret|token)", "i"));
        await expect(result).toSatisfyJudge(FindingFieldsJudge);
      },
    );

    it(
      "output-finding-fields__no-findings-lists-reviewed",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("output-finding-fields");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/ci.yml <<'EOF'\nname: CI\non:\n  push:\n    branches: [main]\n  pull_request:\njobs:\n  test:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: read\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: '20'\n      - run: npm ci\n      - run: npm test\nEOF\ncat > .github/workflows/release.yml <<'EOF'\nname: Release\non:\n  push:\n    tags: ['v*']\njobs:\n  release:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n    steps:\n      - uses: actions/checkout@v4\n      - run: echo \"Releasing $GITHUB_REF_NAME\"\nEOF\n");
        const result = await run("Audit the workflows in this repository for GitHub Actions security vulnerabilities.");

        expect(result.session.outputText).toMatch(new RegExp("(no findings|no issues|no vulnerabilities|nothing to report)", "i"));
        expect(result.session.outputText).toContain("ci.yml");
        expect(result.session.outputText).toContain("release.yml");
        await expect(result).toSatisfyJudge(NoFindingsDisclosureJudge);
      },
    );
  },
);
