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
  skilletHarness,
} from "@sentry/skillet/evals";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-dispatch-without-sink",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-dispatch-without-sink__manual-deploy-bool-input",
      { timeout: 90_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-dispatch-without-sink");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/deploy.yml <<'YAML'\nname: Deploy\non:\n  workflow_dispatch:\n    inputs:\n      dry_run:\n        type: boolean\n        default: true\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Echo flag\n        run: echo \"dry_run=${{ inputs.dry_run }}\"\nYAML\n");
        const result = await run("Review .github/workflows/deploy.yml for any GitHub Actions security issues.");

        expect(result.session.outputText).not.toContain("RCE");
        expect(result.session.outputText).not.toContain("command injection");
        expect(result.session.outputText).toMatch(new RegExp("(no\\s+finding|not\\s+exploit|out of scope|safe|no\\s+sink)", "i"));
      },
    );

    it(
      "no-dispatch-without-sink__schedule-readonly",
      { timeout: 90_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-dispatch-without-sink");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/nightly.yml <<'YAML'\nname: Nightly\non:\n  schedule:\n    - cron: '0 3 * * *'\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm ci && npm test\nYAML\n");
        const result = await run("Any security issues with .github/workflows/nightly.yml?");

        expect(result.session.outputText).not.toContain("injection");
        expect(result.session.outputText).toMatch(new RegExp("\\b(schedule|cron)\\b", "i"));
        expect(result.session.outputText).toMatch(new RegExp("(no\\s+finding|not\\s+exploit|out of scope|safe|no\\s+caller-controlled)", "i"));
      },
    );

    it(
      "no-dispatch-without-sink__protected-push-no-sink",
      { timeout: 90_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-dispatch-without-sink");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/release.yml <<'YAML'\nname: Release\non:\n  push:\n    branches: [main]\njobs:\n  release:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: ./scripts/release.sh\nYAML\n");
        const result = await run("Look at .github/workflows/release.yml and tell me if there is any RCE or injection risk.");

        expect(result.session.outputText).not.toContain("RCE");
        expect(result.session.outputText).not.toContain("command injection");
        expect(result.session.outputText).toMatch(new RegExp("(no\\s+finding|not\\s+exploit|out of scope|safe|no\\s+sink|no\\s+caller-controlled)", "i"));
      },
    );
  },
);
