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
  "no-safe-resolved-values",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-safe-resolved-values__pr-number-in-run",
      { timeout: 90_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-safe-resolved-values");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/label.yml <<'YAML'\nname: label\non:\n  pull_request_target:\n    types: [opened]\njobs:\n  tag:\n    runs-on: ubuntu-latest\n    steps:\n      - name: echo number\n        run: echo \"PR number is ${{ github.event.pull_request.number }}\"\nYAML\n");
        const result = await run("Please review .github/workflows/label.yml for injection risks. I'm worried about github.event.pull_request.number being interpolated into the run script.");

        expect(result.session.outputText).not.toContain("injection");
        expect(result.session.outputText).not.toContain("RCE");
        expect(result.session.outputText).toMatch(new RegExp("\\b(numeric|integer|number|safe|no\\s+finding|not\\s+exploitable|out of scope)\\b", "i"));
        expect(result.session.outputText).not.toContain("CRITICAL");
        expect(result.session.outputText).not.toContain("HIGH");
      },
    );

    it(
      "no-safe-resolved-values__base-sha-and-bool",
      { timeout: 90_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-safe-resolved-values");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/build.yml <<'YAML'\nname: build\non:\n  pull_request_target:\njobs:\n  b:\n    runs-on: ubuntu-latest\n    steps:\n      - run: |\n          echo \"base sha: ${{ github.event.pull_request.base.sha }}\"\n          echo \"draft: ${{ github.event.pull_request.draft }}\"\n          echo \"repo: ${{ github.event.repository.full_name }}\"\nYAML\n");
        const result = await run("Audit .github/workflows/build.yml — it uses github.event.pull_request.base.sha and github.event.pull_request.draft in the run step. Any code injection risk?");

        expect(result.session.outputText).not.toContain("injection");
        expect(result.session.outputText).not.toContain("arbitrary code");
        expect(result.session.outputText).not.toContain("CRITICAL");
        expect(result.session.outputText).toMatch(new RegExp("\\b(SHA|boolean|constant|safe|no\\s+finding|not\\s+exploitable)\\b", "i"));
      },
    );
  },
);
