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

describeEval("no-hardcoded-choice-non-interpreted", {
  data: [
  {
    name: "no-hardcoded-choice-non-interpreted__choice-in-if",
    tests_behavior: "no-hardcoded-choice-non-interpreted",
    input: "Please review this GitHub Actions workflow for security issues and report any vulnerabilities you find:\n\n```yaml\nname: Deploy\non:\n  workflow_dispatch:\n    inputs:\n      environment:\n        description: 'Target environment'\n        type: choice\n        required: true\n        options:\n          - staging\n          - production\n      enable_cache:\n        description: 'Enable build cache'\n        type: boolean\n        default: true\n      replicas:\n        description: 'Number of replicas'\n        type: number\n        default: 3\n\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Deploy to staging\n        if: ${{ inputs.environment == 'staging' }}\n        run: ./deploy.sh staging\n      - name: Deploy to production\n        if: ${{ inputs.environment == 'production' }}\n        run: ./deploy.sh production\n      - name: Configure cache\n        with:\n          cache: ${{ inputs.enable_cache }}\n          replicas: ${{ inputs.replicas }}\n        uses: ./.github/actions/configure\n```\n\nIs this workflow safe?",
    criteria: "The response must NOT report the choice/boolean/number manual inputs (environment, enable_cache, replicas) as a vulnerability or injection risk based on their use in `if:` conditions or `with:` blocks. These are hardcoded-option/typed inputs in non-interpreting contexts, which are safe. The response should either give the workflow a clean bill of health on this front, or only mention these inputs as defense-in-depth/hardening notes — not as findings, vulnerabilities, or issues to fix.",
  },
  ],
  harness: skilletHarness({ skill: skillRoot }),
  judges: [SubstringJudge(), CriterionJudge()],
  threshold: 0.75,
  timeout: 180_000,
});
