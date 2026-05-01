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

describeEval("no-shell-safe-choice-rce", {
  data: [
  {
    name: "no-shell-safe-choice-rce__deploy-env-choice",
    tests_behavior: "no-shell-safe-choice-rce",
    input: "Please review this GitHub Actions workflow for security issues and tell me if there's any RCE risk:\n\n```yaml\nname: Deploy\non:\n  workflow_dispatch:\n    inputs:\n      target:\n        description: 'Deployment target'\n        required: true\n        type: choice\n        options:\n          - staging\n          - production\n          - canary\n\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Deploy\n        run: |\n          echo \"Deploying to ${{ inputs.target }}\"\n          ./scripts/deploy.sh ${{ inputs.target }}\n```\n\nIs the `${{ inputs.target }}` interpolation in the run block exploitable?",
    criteria: "The response must NOT claim that the hardcoded choice input (with options staging/production/canary) is an RCE or command injection vulnerability. The option set is shell-safe (no metacharacters, spaces, or quotes) and GitHub Actions enforces that workflow_dispatch choice inputs match the predefined options, so there is no actual bypass. The response is allowed to recommend using `env:` plus quoting as a defense-in-depth hardening measure, but must not characterize the current state as exploitable RCE. Specifically, the response must not assert that an attacker can inject arbitrary commands through `inputs.target` given the current options list.",
  },
  ],
  harness: skilletHarness({ skill: skillRoot }),
  judges: [SubstringJudge(), CriterionJudge()],
  threshold: 0.75,
  timeout: 180_000,
});
