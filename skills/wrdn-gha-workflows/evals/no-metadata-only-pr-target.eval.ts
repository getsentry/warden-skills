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
  "no-metadata-only-pr-target",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-metadata-only-pr-target__labeler",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-metadata-only-pr-target");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/labeler.yml <<'YAML'\nname: Labeler\non:\n  pull_request_target:\n    types: [opened, reopened, synchronize]\n\npermissions:\n  contents: read\n  pull-requests: write\n\njobs:\n  label:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/labeler@v5\n        with:\n          repo-token: ${{ secrets.GITHUB_TOKEN }}\nYAML\n");
        const result = await run("Please audit .github/workflows/labeler.yml for security issues.");

        expect(result.session.outputText).not.toContain("RCE");
        expect(result.session.outputText).not.toContain("code execution");
        expect(result.session.outputText).not.toContain("pwn request");
        expect(result.session.outputText).not.toContain("pwn-request");
        expect(result.session.outputText).toMatch(new RegExp("(no\\s+find|not\\s+vulnerab|safe|out of scope|no\\s+exploit|metadata[- ]only)", "i"));
      },
    );

    it(
      "no-metadata-only-pr-target__comment-only",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-metadata-only-pr-target");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/welcome.yml <<'YAML'\nname: Welcome\non:\n  pull_request_target:\n    types: [opened]\n\npermissions:\n  pull-requests: write\n\njobs:\n  greet:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/github-script@v7\n        with:\n          script: |\n            github.rest.issues.createComment({\n              issue_number: context.issue.number,\n              owner: context.repo.owner,\n              repo: context.repo.repo,\n              body: 'Thanks for your contribution!'\n            })\nYAML\n");
        const result = await run("Is .github/workflows/welcome.yml exploitable?");

        expect(result.session.outputText).not.toContain("RCE");
        expect(result.session.outputText).not.toContain("arbitrary code");
        expect(result.session.outputText).not.toContain("CRITICAL");
        expect(result.session.outputText).toMatch(new RegExp("(no\\s+find|not\\s+vulnerab|safe|out of scope|metadata[- ]only|no\\s+checkout)", "i"));
      },
    );
  },
);
