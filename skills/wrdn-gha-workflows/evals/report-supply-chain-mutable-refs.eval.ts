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

const FlagsMutableThirdPartyRefJudge = judge("FlagsMutableThirdPartyRefJudge", async ({ criterion }) => {
  return criterion("Flags the third-party action used by tag/branch (not a 40-char SHA) as a supply-chain pinning risk.");
});

const TiesToPrivilegedContextJudge = judge("TiesToPrivilegedContextJudge", async ({ criterion }) => {
  return criterion("Connects the unpinned ref to a privileged context (release, deploy, publish, signing, OIDC, or write-scoped token/secrets).");
});

const RecommendsShaPinningJudge = judge("RecommendsShaPinningJudge", async ({ criterion }) => {
  return criterion("Recommends pinning to a full 40-character commit SHA as the remediation.");
});

const DoesNotFlagFirstPartyJudge = judge("DoesNotFlagFirstPartyJudge", async ({ criterion }) => {
  return criterion("Does NOT flag actions/checkout, actions/setup-node, or other actions/* and github/* tag references as supply-chain findings.");
});

const NoFindingOnPublicReadOnlyJudge = judge("NoFindingOnPublicReadOnlyJudge", async ({ criterion }) => {
  return criterion("Does NOT report the unpinned third-party action as a supply-chain finding given the workflow handles no secrets, no OIDC, no write tokens, and only reads public data.");
});

describeEval(
  "report-supply-chain-mutable-refs",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-supply-chain-mutable-refs__publish-job-tag-ref",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-supply-chain-mutable-refs");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/release.yml <<'YAML'\nname: Release\non:\n  push:\n    tags: ['v*']\njobs:\n  publish:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n      id-token: write\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n      - uses: tj-actions/changed-files@v44\n      - uses: reviewdog/action-setup@v1\n      - run: npm publish\n        env:\n          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\nYAML");
        const result = await run("Review .github/workflows/release.yml for supply-chain risks.");

        await expect(result).toSatisfyJudge(FlagsMutableThirdPartyRefJudge);
        await expect(result).toSatisfyJudge(TiesToPrivilegedContextJudge);
        await expect(result).toSatisfyJudge(RecommendsShaPinningJudge);
        await expect(result).toSatisfyJudge(DoesNotFlagFirstPartyJudge);
      },
    );

    it(
      "report-supply-chain-mutable-refs__public-readonly-no-finding",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-supply-chain-mutable-refs");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/lint.yml <<'YAML'\nname: Lint\non:\n  push:\n    branches: [main]\npermissions:\n  contents: read\njobs:\n  lint:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: some-org/eslint-action@v2\n      - run: echo done\nYAML");
        const result = await run("Any supply-chain pinning issues in .github/workflows/lint.yml?");

        await expect(result).toSatisfyJudge(NoFindingOnPublicReadOnlyJudge);
      },
    );
  },
);
