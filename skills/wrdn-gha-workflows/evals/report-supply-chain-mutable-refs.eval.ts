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

const MutableThirdPartyRefJudge = judge("MutableThirdPartyRefJudge", async ({ criterion }) => {
  return criterion("The response identifies the third-party action used by mutable ref (tag or branch, not 40-char SHA) in a privileged context (release/deploy/publish/signing/OIDC/write token), and explains the supply-chain risk by referencing tag rewrites or compromised upstream releases (e.g., tj-actions/changed-files or reviewdog/action-setup style). It must recommend pinning to a full commit SHA. Generic 'use latest version' or unrelated formatting advice does not satisfy the rubric.");
});

describeEval(
  "report-supply-chain-mutable-refs",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-supply-chain-mutable-refs__publish-with-tag-pin",
      { timeout: 180_000 },
      async ({ run, behavior }) => {
        behavior("report-supply-chain-mutable-refs");
        const result = await run("Please audit this release workflow:\n\n```yaml\nname: Publish\non:\n  push:\n    tags: ['v*']\njobs:\n  publish:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n      id-token: write\n    steps:\n      - uses: actions/checkout@v4\n      - uses: tj-actions/changed-files@v44\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n          registry-url: https://registry.npmjs.org\n      - run: npm ci\n      - run: npm publish\n        env:\n          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}\n```");

        expect(result.session.outputText).toContain("tj-actions/changed-files");
        expect(result.session.outputText).toMatch(new RegExp("\\b(SHA|commit\\s*SHA|pin)\\b", "i"));
        expect(result.session.outputText).not.toContain("actions/checkout");
        expect(result.session.outputText).not.toContain("actions/setup-node");
        await expect(result).toSatisfyJudge(MutableThirdPartyRefJudge);
      },
    );

    it(
      "report-supply-chain-mutable-refs__public-readonly-no-finding",
      { timeout: 180_000 },
      async ({ run, behavior }) => {
        behavior("report-supply-chain-mutable-refs");
        const result = await run("Any supply-chain concerns with this CI?\n\n```yaml\nname: Lint\non:\n  pull_request:\njobs:\n  lint:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: read\n    steps:\n      - uses: actions/checkout@v4\n      - uses: reviewdog/action-eslint@v1\n```");

        expect(result.session.outputText).not.toContain("supply chain");
        expect(result.session.outputText).not.toContain("supply-chain");
        expect(result.session.outputText).toMatch(new RegExp("(no.*finding|out of scope|safe|not.*vulnerab|read[- ]only)", "i"));
      },
    );
  },
);
