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
  judge,
  skilletHarness,
} from "@sentry/skillet/evals";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

const MutableRefSupplyChainJudge = judge("MutableRefSupplyChainJudge", async ({ criterion }) => {
  return criterion("Explanation ties the mutable third-party ref (tag/branch) to supply-chain risk in a privileged context (secrets, OIDC, deploy/publish/sign) and recommends pinning to a 40-char commit SHA.");
});

describeEval(
  "report-supply-chain-mutable-refs",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-supply-chain-mutable-refs__tag-pinned-publish",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-supply-chain-mutable-refs");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/release.yml <<'YAML'\nname: release\non:\n  push:\n    tags: ['v*']\njobs:\n  publish:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n      id-token: write\n    steps:\n      - uses: actions/checkout@v4\n      - uses: tj-actions/changed-files@v44\n      - uses: reviewdog/action-setup@v1\n      - name: Publish to npm\n        run: npm publish\n        env:\n          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\nYAML\n");
        const result = await run("Audit .github/workflows/release.yml for supply-chain risks. Are the third-party actions pinned safely?");

        expect(result.session.outputText).toContain("tj-actions/changed-files");
        expect(result.session.outputText).toContain("reviewdog/action-setup");
        expect(result.session.outputText).toMatch(new RegExp("\\b(SHA|commit\\s+SHA|40[- ]char)\\b", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL|MEDIUM)\\b"));
        await expect(result).toSatisfyJudge(MutableRefSupplyChainJudge);
      },
    );

    it(
      "report-supply-chain-mutable-refs__skip-first-party",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-supply-chain-mutable-refs");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/deploy.yml <<'YAML'\nname: deploy\non:\n  push:\n    branches: [main]\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    permissions:\n      id-token: write\n      contents: read\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n      - uses: github/codeql-action/init@v3\n      - uses: aws-actions/configure-aws-credentials@v4\n        with:\n          role-to-assume: ${{ secrets.AWS_ROLE }}\n          aws-region: us-east-1\n      - run: ./deploy.sh\nYAML\n");
        const result = await run("Review .github/workflows/deploy.yml. Flag any unpinned third-party actions in privileged jobs.");

        expect(result.session.outputText).toContain("aws-actions/configure-aws-credentials");
        expect(result.session.outputText).not.toContain("actions/checkout");
        expect(result.session.outputText).not.toContain("actions/setup-node");
        expect(result.session.outputText).not.toContain("github/codeql-action");
        expect(result.session.outputText).toMatch(new RegExp("\\b(SHA|pin)\\b", "i"));
      },
    );
  },
);
