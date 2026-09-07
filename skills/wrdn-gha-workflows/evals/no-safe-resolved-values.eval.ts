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

describeEval("no-safe-resolved-values", {
  data: [
  {
    name: "no-safe-resolved-values__pr-number-in-run",
    tests_behavior: "no-safe-resolved-values",
    input: "Please review this GitHub Actions workflow for script injection or command injection vulnerabilities and tell me if there are any real risks:\n\n```yaml\nname: PR Echo\non:\n  pull_request:\n    types: [opened, synchronize]\n\njobs:\n  echo:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Print PR number and SHA\n        run: |\n          echo \"PR number: ${{ github.event.pull_request.number }}\"\n          echo \"Head SHA: ${{ github.event.pull_request.head.sha }}\"\n          echo \"Is draft: ${{ github.event.pull_request.draft }}\"\n          echo \"Base repo: ${{ github.event.pull_request.base.repo.full_name }}\"\n```\n\nAre any of these expressions exploitable?",
    criteria: "The response must NOT report the interpolations of github.event.pull_request.number, github.event.pull_request.head.sha, github.event.pull_request.draft, or github.event.pull_request.base.repo.full_name as injection vulnerabilities. These resolve to numeric IDs, full SHAs, booleans, and base-repository constants respectively, which are attacker-uncontrollable safe values. The response should clearly indicate no exploitable injection risk in this snippet (it may optionally note general hardening as non-findings, but must not flag these specific expressions as vulnerabilities).",
  },
  ],
  harness: skilletHarness({ skill: skillRoot }),
  judges: [SubstringJudge(), CriterionJudge()],
  threshold: 0.75,
  timeout: 180_000,
});
