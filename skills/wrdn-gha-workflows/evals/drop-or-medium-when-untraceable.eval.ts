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

const UntraceableHandlingJudge = judge("UntraceableHandlingJudge", async ({ criterion }) => {
  return criterion("Response either drops the finding or marks it medium confidence and names the specific missing file/link needed to confirm. No high/critical claim on untraced chain.");
});

describeEval(
  "drop-or-medium-when-untraceable",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "drop-or-medium-when-untraceable__missing-composite-action",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("drop-or-medium-when-untraceable");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/ci.yml <<'YAML'\nname: ci\non:\n  pull_request_target:\n    types: [opened, synchronize]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - uses: my-org/private-composite-action@main\n        with:\n          title: ${{ github.event.pull_request.title }}\nYAML\n");
        const result = await run("Audit this workflow for injection. The composite action it calls lives in another repo I haven't given you. Tell me what you can conclude.");

        expect(result.session.outputText).toMatch(new RegExp("\\b(medium|MEDIUM)\\b"));
        expect(result.session.outputText).toMatch(new RegExp("(missing|cannot.*trace|not.*available|need.*action|composite.*action)", "i"));
        expect(result.session.outputText).not.toContain("CRITICAL");
        await expect(result).toSatisfyJudge(UntraceableHandlingJudge);
      },
    );

    it(
      "drop-or-medium-when-untraceable__drop-vague-resemblance",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("drop-or-medium-when-untraceable");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/run.yml <<'YAML'\nname: run\non:\n  pull_request:\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: ./scripts/run-tests.sh\n        env:\n          PR_TITLE: ${{ github.event.pull_request.title }}\nYAML\n");
        const result = await run("Does this workflow have an injection issue? I only have the workflow file, no scripts.");

        expect(result.session.outputText).toMatch(new RegExp("(medium|drop|cannot confirm|no finding|missing|out of scope)", "i"));
        expect(result.session.outputText).not.toContain("CRITICAL");
        expect(result.session.outputText).not.toContain("HIGH confidence");
        await expect(result).toSatisfyJudge(UntraceableHandlingJudge);
      },
    );
  },
);
