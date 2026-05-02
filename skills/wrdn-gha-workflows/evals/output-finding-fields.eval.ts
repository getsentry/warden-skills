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
  return criterion("Finding includes file/line, entry point, controlled input, execution mechanism, privileges, impact, confidence with reason, and a concrete minimal patch fix.");
});

describeEval(
  "output-finding-fields",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "output-finding-fields__pwn-request-full-report",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("output-finding-fields");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/ci.yml <<'YAML'\nname: ci\non:\n  pull_request_target:\n    types: [opened, synchronize]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n      pull-requests: write\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n          repository: ${{ github.event.pull_request.head.repo.full_name }}\n      - run: npm install\n      - run: npm test\n        env:\n          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\nYAML\n");
        const result = await run("Audit the workflows in .github/workflows for code execution risks and produce findings.");

        expect(result.session.outputText).toContain(".github/workflows/ci.yml");
        expect(result.session.outputText).toMatch(new RegExp("pull_request_target"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(confidence|Confidence)\\b\\s*[:=-]?\\s*(high|medium|HIGH|MEDIUM)"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(line|Line|L)\\s*[:#]?\\s*\\d+"));
        expect(result.session.outputText).toMatch(new RegExp("(fix|Fix|patch|Patch|remediation)"));
        expect(result.session.outputText).toMatch(new RegExp("(impact|Impact)"));
        await expect(result).toSatisfyJudge(FindingFieldsJudge);
      },
    );

    it(
      "output-finding-fields__no-findings-lists-reviewed",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("output-finding-fields");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/label.yml <<'YAML'\nname: label\non:\n  pull_request_target:\n    types: [opened]\njobs:\n  label:\n    runs-on: ubuntu-latest\n    permissions:\n      pull-requests: write\n    steps:\n      - uses: actions/labeler@v5\nYAML\ncat > .github/workflows/release.yml <<'YAML'\nname: release\non:\n  push:\n    tags: ['v*']\njobs:\n  publish:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: echo release\nYAML\n");
        const result = await run("Review the workflows under .github/workflows for pwn-request style RCE risks and report findings.");

        expect(result.session.outputText).toMatch(new RegExp("(no findings|no issues found|nothing to report|no exploitable)", "i"));
        expect(result.session.outputText).toContain("label.yml");
        expect(result.session.outputText).toContain("release.yml");
      },
    );
  },
);
