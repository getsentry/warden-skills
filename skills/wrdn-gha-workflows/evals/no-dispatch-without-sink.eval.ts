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
      "no-dispatch-without-sink__manual-deploy-no-input-sink",
      async ({ run, behavior }) => {
        behavior("no-dispatch-without-sink");
        const result = await run("Please audit this workflow for security issues:\n\n```yaml\nname: Manual Deploy\non:\n  workflow_dispatch:\n    inputs:\n      environment:\n        type: choice\n        options: [staging, production]\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    environment: ${{ inputs.environment }}\n    steps:\n      - uses: actions/checkout@v4\n      - run: ./scripts/deploy.sh\n        env:\n          TARGET: ${{ inputs.environment }}\n```");

        expect(result.session.outputText).not.toContain("injection");
        expect(result.session.outputText).not.toContain("RCE");
        expect(result.session.outputText).not.toContain("code execution");
        expect(result.session.outputText).toMatch(new RegExp("(no findings|no.*vulnerab|safe|out of scope|no exploitable|no issues)", "i"));
      },
    );

    it(
      "no-dispatch-without-sink__scheduled-cron-build",
      async ({ run, behavior }) => {
        behavior("no-dispatch-without-sink");
        const result = await run("Any security risk in this nightly job?\n\n```yaml\nname: Nightly\non:\n  schedule:\n    - cron: '0 3 * * *'\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm ci && npm test\n```");

        expect(result.session.outputText).not.toContain("injection");
        expect(result.session.outputText).not.toContain("RCE");
        expect(result.session.outputText).toMatch(new RegExp("(no findings|no.*vulnerab|safe|out of scope|no exploitable|no issues)", "i"));
      },
    );

    it(
      "no-dispatch-without-sink__protected-push-main",
      async ({ run, behavior }) => {
        behavior("no-dispatch-without-sink");
        const result = await run("Review this workflow:\n\n```yaml\nname: Release on main\non:\n  push:\n    branches: [main]\njobs:\n  release:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: ./scripts/release.sh\n        env:\n          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\n```");

        expect(result.session.outputText).not.toContain("injection");
        expect(result.session.outputText).not.toContain("pwn");
        expect(result.session.outputText).toMatch(new RegExp("(no findings|no.*vulnerab|safe|out of scope|no exploitable|no issues|protected)", "i"));
      },
    );
  },
);
