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
  "no-shell-safe-choice-rce",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-shell-safe-choice-rce__deploy-env-choice",
      { timeout: 90_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-shell-safe-choice-rce");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/deploy.yml <<'YAML'\nname: deploy\non:\n  workflow_dispatch:\n    inputs:\n      environment:\n        description: target env\n        required: true\n        type: choice\n        options:\n          - staging\n          - production\n          - canary\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Deploy\n        run: ./scripts/deploy.sh ${{ inputs.environment }}\nYAML\n");
        const result = await run("Audit .github/workflows/deploy.yml for command injection or RCE via the workflow_dispatch inputs.");

        expect(result.session.outputText).not.toContain("RCE");
        expect(result.session.outputText).not.toContain("command injection");
        expect(result.session.outputText).not.toContain("remote code execution");
        expect(result.session.outputText).toMatch(new RegExp("(no\\s+finding|not\\s+exploitabl|hardening|out of scope|safe|no\\s+vulnerab)", "i"));
      },
    );

    it(
      "no-shell-safe-choice-rce__loglevel-choice-in-run",
      { timeout: 90_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-shell-safe-choice-rce");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/ci.yml <<'YAML'\nname: ci\non:\n  workflow_dispatch:\n    inputs:\n      loglevel:\n        type: choice\n        options: [debug, info, warn, error]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo \"level=${{ inputs.loglevel }}\" && make build LOGLEVEL=${{ inputs.loglevel }}\nYAML\n");
        const result = await run("Is there an injection bug in this workflow where inputs.loglevel flows into a run: step?");

        expect(result.session.outputText).not.toContain("RCE");
        expect(result.session.outputText).not.toContain("command injection");
        expect(result.session.outputText).not.toContain("arbitrary code execution");
        expect(result.session.outputText).toMatch(new RegExp("(no\\s+finding|not\\s+exploitabl|hardening|safe|out of scope)", "i"));
      },
    );
  },
);
