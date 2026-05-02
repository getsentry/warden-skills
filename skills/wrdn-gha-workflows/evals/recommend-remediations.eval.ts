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

const RemediationConcreteJudge = judge("RemediationConcreteJudge", async ({ criterion }) => {
  return criterion("Recommends a concrete safe patch matching the bad shape (e.g. env: + quoted $VAR for run, process.env for github-script). Generic 'sanitize input' advice does not satisfy.");
});

describeEval(
  "recommend-remediations",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "recommend-remediations__run-script-injection",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("recommend-remediations");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/triage.yml <<'YAML'\nname: triage\non:\n  issue_comment:\n    types: [created]\njobs:\n  echo:\n    runs-on: ubuntu-latest\n    steps:\n      - name: greet\n        run: echo \"hello ${{ github.event.comment.body }}\"\nYAML\n");
        const result = await run("Review .github/workflows/triage.yml and tell me how to fix any injection issues you find.");

        expect(result.session.outputText).toContain("env:");
        expect(result.session.outputText).toMatch(new RegExp("printf\\s+'%s"));
        expect(result.session.outputText).toMatch(new RegExp("\\$\\{?[A-Z_]+\\}?|\"\\$[A-Z_]+\""));
        await expect(result).toSatisfyJudge(RemediationConcreteJudge);
      },
    );

    it(
      "recommend-remediations__github-script-process-env",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("recommend-remediations");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/comment.yml <<'YAML'\nname: comment\non:\n  issues:\n    types: [opened]\njobs:\n  reply:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/github-script@v7\n        with:\n          script: |\n            const title = `${{ github.event.issue.title }}`;\n            console.log(title);\nYAML\n");
        const result = await run("How should I fix the actions/github-script step in .github/workflows/comment.yml that interpolates the issue title?");

        expect(result.session.outputText).toContain("process.env");
        expect(result.session.outputText).toContain("env:");
        await expect(result).toSatisfyJudge(RemediationConcreteJudge);
      },
    );

    it(
      "recommend-remediations__pin-action-sha",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("recommend-remediations");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/deploy.yml <<'YAML'\nname: deploy\non: [push]\npermissions:\n  id-token: write\n  contents: write\njobs:\n  release:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: some-vendor/deploy-action@v1\n        env:\n          AWS_ROLE: ${{ secrets.AWS_ROLE }}\nYAML\n");
        const result = await run("The deploy workflow uses a third-party action by tag and has access to AWS OIDC + write tokens. What's the fix?");

        expect(result.session.outputText).toMatch(new RegExp("\\b[0-9a-f]{40}\\b|40[- ]char(acter)?\\s+(commit\\s+)?SHA", "i"));
        expect(result.session.outputText).toMatch(new RegExp("some-vendor/deploy-action@"));
        await expect(result).toSatisfyJudge(RemediationConcreteJudge);
      },
    );
  },
);
