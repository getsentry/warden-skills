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
  "no-non-interpreting-expressions",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-non-interpreting-expressions__if-condition",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-non-interpreting-expressions");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/gate.yml <<'YAML'\nname: gate\non:\n  pull_request:\n    types: [opened, synchronize]\njobs:\n  check:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Skip drafts from forks\n        if: ${{ github.event.pull_request.head.ref != 'main' && github.event.pull_request.draft == false }}\n        run: echo \"proceeding\"\n      - name: Echo a static value\n        run: echo \"hello\"\nYAML\n");
        const result = await run("Audit .github/workflows/gate.yml for injection risks. Focus on the if: condition that uses github.event.pull_request.head.ref.");

        expect(result.session.outputText).not.toContain("injection");
        expect(result.session.outputText).not.toContain("RCE");
        expect(result.session.outputText).toMatch(new RegExp("(no\\s+finding|not\\s+exploitabl|out of scope|no\\s+injection|safe\\s+context|does not (re)?interpret)", "i"));
      },
    );

    it(
      "no-non-interpreting-expressions__with-input-passthrough",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-non-interpreting-expressions");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/label.yml <<'YAML'\nname: label\non:\n  pull_request:\n    types: [opened]\njobs:\n  label:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/labeler@v5\n        with:\n          repo-token: ${{ secrets.GITHUB_TOKEN }}\n          configuration-path: .github/labeler.yml\n      - uses: actions/github-script@v7\n        with:\n          github-token: ${{ secrets.GITHUB_TOKEN }}\n          script: |\n            core.info('static script, no expression interpolation here');\nYAML\n");
        const result = await run("Review .github/workflows/label.yml. The with: block passes github.event.pull_request.title to actions/github-script's github-token input. Is that an injection sink?");

        expect(result.session.outputText).not.toContain("command injection");
        expect(result.session.outputText).not.toContain("arbitrary code execution");
        expect(result.session.outputText).toMatch(new RegExp("(no\\s+finding|not\\s+a\\s+sink|does not (re)?interpret|out of scope|no\\s+injection)", "i"));
      },
    );
  },
);
