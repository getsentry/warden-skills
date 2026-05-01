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
  "no-vague-resemblance",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-vague-resemblance__looks-like-injection-but-static",
      async ({ run, behavior }) => {
        behavior("no-vague-resemblance");
        const result = await run("Audit this workflow. It looks similar to some pwn-request examples I've seen — should we flag it?\n\n```yaml\nname: CI\non:\n  push:\n    branches: [main]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: echo \"Building ${{ github.repository }} at ${{ github.sha }}\"\n      - run: npm test\n```");

        expect(result.session.outputText).not.toContain("injection vulnerability");
        expect(result.session.outputText).not.toContain("pwn-request");
        expect(result.session.outputText).not.toContain("RCE");
        expect(result.session.outputText).toMatch(new RegExp("(no.*finding|safe|not.*vulnerab|cannot.*trace|no.*exploitable|out of scope)", "i"));
      },
    );

    it(
      "no-vague-resemblance__resembles-script-injection-no-sink",
      async ({ run, behavior }) => {
        behavior("no-vague-resemblance");
        const result = await run("This workflow uses github.event context which I've heard is dangerous. Is there a real finding here?\n\n```yaml\nname: Label PR\non:\n  pull_request_target:\n    types: [opened]\njobs:\n  label:\n    runs-on: ubuntu-latest\n    permissions:\n      pull-requests: write\n    steps:\n      - uses: actions/labeler@v5\n        with:\n          repo-token: ${{ secrets.GITHUB_TOKEN }}\n```");

        expect(result.session.outputText).not.toContain("script injection");
        expect(result.session.outputText).not.toContain("code execution");
        expect(result.session.outputText).toMatch(new RegExp("(no.*finding|safe|not.*vulnerab|no.*sink|no.*exploitable|cannot.*trace)", "i"));
      },
    );
  },
);
