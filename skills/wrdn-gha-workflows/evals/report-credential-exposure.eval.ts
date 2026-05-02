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

const CredentialExposureJudge = judge("CredentialExposureJudge", async ({ criterion }) => {
  return criterion("Explanation connects the untrusted execution path to the specific credential exposed (token scope, persisted checkout creds, OIDC trust, or .git/home dir in artifact). Generic 'don't leak secrets' fails.");
});

describeEval(
  "report-credential-exposure",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-credential-exposure__artipacked-upload",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-credential-exposure");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/release.yml <<'YAML'\nname: release\non:\n  push:\n    branches: [main]\npermissions:\n  contents: write\n  id-token: write\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm ci && npm run build\n      - uses: actions/upload-artifact@v4\n        with:\n          name: build-output\n          path: |\n            ./\nYAML\n");
        const result = await run("Please review .github/workflows/release.yml for any security issues with how it handles credentials or artifacts.");

        expect(result.session.outputText).toContain("upload-artifact");
        expect(result.session.outputText).toMatch(new RegExp("\\.git\\b|persisted.{0,20}credential", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL|MEDIUM)\\b"));
        await expect(result).toSatisfyJudge(CredentialExposureJudge);
      },
    );

    it(
      "report-credential-exposure__write-token-pwn-request",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-credential-exposure");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/triage.yml <<'YAML'\nname: triage\non:\n  pull_request_target:\n    types: [opened, synchronize]\npermissions:\n  contents: write\n  pull-requests: write\n  id-token: write\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n          persist-credentials: true\n      - run: npm install && npm test\n        env:\n          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\nYAML\n");
        const result = await run("Audit .github/workflows/triage.yml — what's the impact if an attacker can influence what runs?");

        expect(result.session.outputText).toContain("GITHUB_TOKEN");
        expect(result.session.outputText).toMatch(new RegExp("\\bcontents:\\s*write\\b|write-scoped|persist-credentials", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\bsecrets\\.NPM_TOKEN\\b"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL)\\b"));
        await expect(result).toSatisfyJudge(CredentialExposureJudge);
      },
    );
  },
);
