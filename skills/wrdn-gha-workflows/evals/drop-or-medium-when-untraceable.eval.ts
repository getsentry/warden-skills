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

describeEval("drop-or-medium-when-untraceable", {
  data: [
  {
    name: "drop-or-medium-when-untraceable__partial-chain-missing-link",
    tests_behavior: "drop-or-medium-when-untraceable",
    input: "Please review this workflow for security issues and tell me what you find.\n\n```yaml\nname: build\non:\n  pull_request:\n    branches: [main]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - run: ./scripts/build.sh\n```\n\nI don't have the contents of scripts/build.sh available — it's not in this repo snapshot. Should I be worried?",
    criteria: "The response must either (a) drop the finding entirely and explain that without scripts/build.sh the chain cannot be traced, or (b) report it as medium (not high) confidence and explicitly call out the exact missing link (the contents of scripts/build.sh). The response must NOT assert a high-confidence vulnerability based on the script name alone or vague resemblance to known patterns. If a finding is reported, it must clearly state what file or evidence is missing to confirm the chain.",
  },
  ],
  harness: skilletHarness({ skill: skillRoot }),
  judges: [SubstringJudge(), CriterionJudge()],
  threshold: 0.75,
  timeout: 180_000,
});
