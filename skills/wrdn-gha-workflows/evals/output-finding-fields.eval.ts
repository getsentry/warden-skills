// ──────────────────────────────────────────────────────────
// Generated initially from spec.yaml; durable after that. Edit
// freely to refine prompts, setup, and assertions for this
// behavior. Add or remove behaviors via spec.yaml — skillet only
// regenerates eval files for behaviors that don't have one yet.
// ──────────────────────────────────────────────────────────
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import {
  describeEval,
  CriterionJudge,
  SubstringJudge,
  skilletHarness,
} from "@sentry/skillet/evals";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval("output-finding-fields", {
  data: [
  {
    name: "output-finding-fields__pr-target-checkout-script",
    tests_behavior: "output-finding-fields",
    input: "Please review the workflow at .github/workflows/ci.yml for GitHub Actions security issues and report any findings.",
    criteria: "The response reports at least one finding for the pull_request_target workflow that checks out and executes PR-controlled code. For that finding, the response must include ALL of the following fields (named or clearly labeled): (1) file and line reference (e.g. .github/workflows/ci.yml with a line number or range), (2) the trigger / entry point (pull_request_target), (3) the controlled input (PR head ref / PR-controlled code), (4) the execution mechanism (checkout of PR ref followed by npm install/build running attacker code), (5) the privileges exposed (write contents/pull-requests permissions and/or NPM_TOKEN secret), (6) the impact (e.g. secret exfiltration, repo write, supply chain), (7) a confidence level of high or medium with a brief reason, and (8) a concrete fix expressed as a minimal patch or diff to the workflow YAML (for example switching to pull_request, removing the head.sha checkout, or splitting privileged steps). Missing any of these fields should fail the case.",
    setup: "mkdir -p .github/workflows\ncat > .github/workflows/ci.yml <<'YAML'\nname: CI\non:\n  pull_request_target:\n    types: [opened, synchronize]\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n      pull-requests: write\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - name: Run build script from PR\n        run: |\n          npm install\n          npm run build\n        env:\n          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\nYAML",
    timeout: 120000,
  },
  {
    name: "output-finding-fields__no-findings-lists-reviewed",
    tests_behavior: "output-finding-fields",
    input: "Audit the workflows in .github/workflows for GitHub Actions security issues and tell me what you found.",
    criteria: "The response should state that there are no exploitable findings (or equivalent: nothing to report, no actionable issues). It must also enumerate which workflows or paths were reviewed, specifically referencing both .github/workflows/lint.yml and .github/workflows/test.yml (by filename or path). The response must not invent findings about YAML style, missing names, or generic hardening for these benign workflows.",
    setup: "mkdir -p .github/workflows\ncat > .github/workflows/lint.yml <<'YAML'\nname: Lint\non:\n  push:\n    branches: [main]\n\npermissions:\n  contents: read\n\njobs:\n  lint:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: echo \"linting\"\nYAML\ncat > .github/workflows/test.yml <<'YAML'\nname: Test\non:\n  pull_request:\n\npermissions:\n  contents: read\n\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: echo \"running tests\"\nYAML",
    timeout: 120000,
  },
  ],
  harness: skilletHarness({ skill: skillRoot }),
  judges: [SubstringJudge(), CriterionJudge()],
  threshold: 0.75,
  timeout: 180_000,
});
