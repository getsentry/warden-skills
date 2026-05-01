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

describeEval("report-supply-chain-mutable-refs", {
  data: [
  {
    name: "report-supply-chain-mutable-refs__release-uses-tag",
    tests_behavior: "report-supply-chain-mutable-refs",
    input: "Please review .github/workflows/release.yml for security issues and tell me what to fix.",
    criteria: "The response must flag that the third-party actions some-vendor/publish-action@v2 and another-vendor/sigstore-sign@main are pinned to mutable refs (a tag and a branch) in a privileged release/publish job that handles secrets, OIDC, and write-scoped tokens, and recommend pinning to a full 40-character commit SHA. The response must NOT flag actions/checkout@v4 or actions/setup-node@v4 as supply-chain risks (those are first-party actions/* and excluded by the rule).",
    setup: "mkdir -p .github/workflows\ncat > .github/workflows/release.yml <<'YAML'\nname: Release\non:\n  push:\n    tags:\n      - 'v*'\n\npermissions:\n  contents: write\n  id-token: write\n  packages: write\n\njobs:\n  publish:\n    runs-on: ubuntu-latest\n    environment: production\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n          registry-url: 'https://registry.npmjs.org'\n      - name: Install\n        run: npm ci\n      - name: Build\n        run: npm run build\n      - name: Sign and publish\n        uses: some-vendor/publish-action@v2\n        env:\n          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}\n      - name: Upload signed artifact\n        uses: another-vendor/sigstore-sign@main\n        with:\n          token: ${{ secrets.GITHUB_TOKEN }}\nYAML",
  },
  {
    name: "report-supply-chain-mutable-refs__ci-public-readonly-skipped",
    tests_behavior: "report-supply-chain-mutable-refs",
    input: "Audit .github/workflows/ci.yml for supply-chain and privileged-job risks.",
    criteria: "The response must NOT flag some-vendor/lint-action@v1 as a mutable-ref supply-chain finding here, because the workflow has read-only token, no secrets, no OIDC, no write-scoped tokens, and only acts on public read-only data. It should also not flag actions/checkout or actions/setup-python tag pinning. If the response reports no supply-chain mutable-ref issues for this workflow (or explicitly notes the third-party action is not in a privileged context), that is correct.",
    setup: "mkdir -p .github/workflows\ncat > .github/workflows/ci.yml <<'YAML'\nname: CI\non:\n  pull_request:\n  push:\n    branches: [main]\n\npermissions:\n  contents: read\n\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-python@v5\n        with:\n          python-version: '3.12'\n      - uses: some-vendor/lint-action@v1\n      - run: pytest\nYAML",
  },
  ],
  harness: skilletHarness({ skill: skillRoot }),
  judges: [SubstringJudge(), CriterionJudge()],
  threshold: 0.75,
  timeout: 180_000,
});
