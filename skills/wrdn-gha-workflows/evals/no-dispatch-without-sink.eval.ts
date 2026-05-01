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

describeEval("no-dispatch-without-sink", {
  data: [
  {
    name: "no-dispatch-without-sink__benign-workflow-dispatch",
    tests_behavior: "no-dispatch-without-sink",
    input: "Please review this GitHub Actions workflow for security issues:\n\n```yaml\n# .github/workflows/deploy.yml\nname: Manual Deploy\non:\n  workflow_dispatch:\n    inputs:\n      environment:\n        type: choice\n        options: [staging, production]\n        required: true\n\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Print environment\n        run: echo \"Deploying to ${{ inputs.environment }}\"\n      - name: Run deploy script\n        env:\n          TARGET: ${{ inputs.environment }}\n        run: ./scripts/deploy.sh\n```\n\nIs there anything risky here?",
    criteria: "The response must NOT report a security vulnerability tied to the workflow_dispatch trigger, the choice input, or the ${{ inputs.environment }} expression. The input is a hardcoded choice type used only in echo and as an env: var, with no caller-controlled value reaching a code-evaluating sink. The response should either say there are no exploitable issues, or limit itself to non-vulnerability hardening notes (e.g., pinning actions) without claiming the dispatch trigger or input creates a security risk. Reporting workflow_dispatch itself, the choice input, or the env-passed value as a vulnerability is a failure.",
  },
  {
    name: "no-dispatch-without-sink__scheduled-public-fetch",
    tests_behavior: "no-dispatch-without-sink",
    input: "Can you do a security review of this scheduled workflow?\n\n```yaml\n# .github/workflows/nightly-report.yml\nname: Nightly Public Stats\non:\n  schedule:\n    - cron: '0 3 * * *'\n\njobs:\n  report:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: read\n    steps:\n      - uses: actions/checkout@v4\n      - name: Fetch public stats\n        run: curl -sSL https://api.example.com/public/stats > stats.json\n      - name: Summarize\n        run: node scripts/summarize.js stats.json\n```\n\nAny vulnerabilities?",
    criteria: "The response must NOT report a security vulnerability based solely on the schedule trigger. There is no caller-controlled input, no secrets, no write-scoped token, and no attacker-controlled data reaching a code-evaluating sink. The response should conclude there is no exploitable workflow vulnerability, or limit itself to general hygiene notes without framing the schedule trigger as a security finding.",
  },
  ],
  harness: skilletHarness({ skill: skillRoot }),
  judges: [SubstringJudge(), CriterionJudge()],
  threshold: 0.75,
  timeout: 180_000,
});
