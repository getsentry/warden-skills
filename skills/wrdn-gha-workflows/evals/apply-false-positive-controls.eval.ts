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

describeEval("apply-false-positive-controls", {
  data: [
  {
    name: "apply-false-positive-controls__pr-target-default-checkout",
    tests_behavior: "apply-false-positive-controls",
    input: "Please audit this workflow for security issues:\n\n```yaml\nname: Label PRs\non:\n  pull_request_target:\n    types: [opened]\n\njobs:\n  label:\n    runs-on: ubuntu-latest\n    permissions:\n      pull-requests: write\n    steps:\n      - uses: actions/checkout@v4\n      - run: ./scripts/apply-labels.sh\n        env:\n          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}\n```\n\nThe checkout has no `ref:` so it pulls PR code into a privileged context, right? That's a critical pwn_request, correct?",
    criteria: "The response must correctly explain that `actions/checkout@v4` with NO `ref:` parameter under `pull_request_target` defaults to the BASE branch (the target repo's default ref), NOT the PR head. Therefore this is not a pwn_request by virtue of the checkout alone — the base code is trusted. The response should decline to flag this as a critical vulnerability based on the checkout default. It is acceptable for the response to note that if the script later fetches/checks out PR content it would become exploitable, but it must not claim the unmodified default checkout pulls attacker code.",
    timeout: 90000,
  },
  {
    name: "apply-false-positive-controls__persist-credentials-not-cleanse",
    tests_behavior: "apply-false-positive-controls",
    input: "Does setting `persist-credentials: false` on actions/checkout protect this workflow from secret exfiltration?\n\n```yaml\non:\n  pull_request_target:\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n          persist-credentials: false\n      - run: npm install && npm test\n        env:\n          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\n          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}\n```",
    criteria: "The response must explain that `persist-credentials: false` only prevents the GITHUB_TOKEN from being persisted in the local git config — it does NOT remove or mask other secrets exposed via env (NPM_TOKEN, DEPLOY_KEY here). The workflow remains exploitable because PR-controlled code runs (`npm install` executes lifecycle scripts from attacker code checked out at `head.sha`) with those secrets in the environment. The response should not treat `persist-credentials: false` as a general mitigation against secret theft.",
    timeout: 90000,
  },
  {
    name: "apply-false-positive-controls__masking-not-transform-safe",
    tests_behavior: "apply-false-positive-controls",
    input: "A teammate argues that since GitHub automatically masks secrets in logs, this step is safe — the secret can't leak even if the PR controls the script:\n\n```yaml\non: pull_request_target\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - run: bash ./ci/run.sh\n        env:\n          API_KEY: ${{ secrets.API_KEY }}\n```\n\nIs the masking argument correct?",
    criteria: "The response must reject the masking argument by explaining that GitHub only masks the literal secret value in logs — it does NOT mask transformations of the secret (e.g. base64-encoded, hex-encoded, reversed, char-by-char, exfiltrated over the network, written to an artifact). Attacker-controlled code running with the secret in env can trivially transform or exfiltrate it. The response should confirm this is exploitable, not safe.",
    timeout: 90000,
  },
  ],
  harness: skilletHarness({ skill: skillRoot }),
  judges: [SubstringJudge(), CriterionJudge()],
  threshold: 0.75,
  timeout: 180_000,
});
