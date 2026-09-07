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

describeEval("state-entry-point", {
  data: [
  {
    name: "state-entry-point__dispatch-with-secrets",
    tests_behavior: "state-entry-point",
    input: "Please review .github/workflows/release.yml and report any security issues you find.",
    criteria: "The response identifies the injection through the `version` input reaching the `git tag` shell step. For that finding, it explicitly names the entry point as workflow_dispatch (a manual caller, not an external attacker by default) and justifies the RCE severity by pointing to the elevated job privileges — secrets like NPM_TOKEN, OIDC id-token: write, contents: write, or publishing — that exceed an ordinary caller's rights. It does not describe the attacker as 'external' or 'anonymous' without qualification.",
    setup: "mkdir -p .github/workflows\ncat > .github/workflows/release.yml <<'EOF'\nname: Release\non:\n  workflow_dispatch:\n    inputs:\n      version:\n        description: 'Version to release'\n        required: true\n        type: string\n\njobs:\n  publish:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n      id-token: write\n    steps:\n      - uses: actions/checkout@v4\n      - name: Tag release\n        run: |\n          echo \"Releasing ${{ github.event.inputs.version }}\"\n          git tag \"v${{ github.event.inputs.version }}\"\n      - name: Publish to npm\n        env:\n          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\n        run: npm publish\nEOF",
  },
  {
    name: "state-entry-point__reusable-workflow-call",
    tests_behavior: "state-entry-point",
    input: "Audit .github/workflows/deploy-shared.yml for security issues.",
    criteria: "The response flags the `target_env` input being interpolated into the shell `./deploy.sh` step. The finding explicitly identifies the entry point as a workflow_call (reusable workflow) caller, not an external attacker. If it characterizes this as caller-controlled RCE, it justifies that label by citing the job's stronger privileges relative to an ordinary caller — the production environment, DEPLOY_KEY secret, or deployment side effects. It does not conflate the workflow_call caller with an external/anonymous attacker.",
    setup: "mkdir -p .github/workflows\ncat > .github/workflows/deploy-shared.yml <<'EOF'\nname: Shared Deploy\non:\n  workflow_call:\n    inputs:\n      target_env:\n        required: true\n        type: string\n    secrets:\n      DEPLOY_KEY:\n        required: true\n\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    environment: production\n    steps:\n      - uses: actions/checkout@v4\n      - name: Deploy\n        env:\n          KEY: ${{ secrets.DEPLOY_KEY }}\n        run: |\n          echo \"Deploying to ${{ inputs.target_env }}\"\n          ./deploy.sh ${{ inputs.target_env }}\nEOF",
  },
  ],
  harness: skilletHarness({ skill: skillRoot }),
  judges: [SubstringJudge(), CriterionJudge()],
  threshold: 0.75,
  timeout: 180_000,
});
