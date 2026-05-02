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
      "no-vague-resemblance__looks-like-injection-no-chain",
      { timeout: 90_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-vague-resemblance");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/build.yml <<'YAML'\nname: build\non:\n  push:\n    branches: [main]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Show run id\n        run: echo \"Run ${{ github.run_id }} on ${{ github.repository }}\"\n      - name: Build\n        run: make build\nYAML\n");
        const result = await run("Please audit .github/workflows/build.yml for injection or RCE risks. I'm worried because it uses github context expressions and that 'looks like' the injection patterns I've seen in blog posts.");

        expect(result.session.outputText).not.toContain("injection vulnerability");
        expect(result.session.outputText).not.toContain("RCE");
        expect(result.session.outputText).not.toContain("command injection");
        expect(result.session.outputText).toMatch(new RegExp("(no\\s+finding|not\\s+exploitable|no\\s+exploit|safe|cannot\\s+trace|no\\s+attacker[- ]controlled|out\\s+of\\s+scope)", "i"));
      },
    );

    it(
      "no-vague-resemblance__resembles-pwn-request-but-no-checkout",
      { timeout: 90_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-vague-resemblance");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/triage.yml <<'YAML'\nname: triage\non:\n  pull_request_target:\n    types: [opened]\njobs:\n  label:\n    runs-on: ubuntu-latest\n    permissions:\n      pull-requests: write\n    steps:\n      - name: Add triage label\n        uses: actions/github-script@v7\n        with:\n          script: |\n            await github.rest.issues.addLabels({\n              owner: context.repo.owner,\n              repo: context.repo.repo,\n              issue_number: context.payload.pull_request.number,\n              labels: ['needs-triage']\n            });\nYAML\n");
        const result = await run("This workflow uses pull_request_target and that pattern resembles pwn-request exploits I've read about. Can you confirm it's vulnerable?");

        expect(result.session.outputText).not.toContain("pwn request");
        expect(result.session.outputText).not.toContain("pwn-request");
        expect(result.session.outputText).not.toContain("RCE");
        expect(result.session.outputText).toMatch(new RegExp("(no\\s+checkout|never\\s+checks\\s+out|no\\s+attacker[- ]controlled\\s+code|metadata\\s+only|no\\s+finding|not\\s+exploitable)", "i"));
      },
    );
  },
);
