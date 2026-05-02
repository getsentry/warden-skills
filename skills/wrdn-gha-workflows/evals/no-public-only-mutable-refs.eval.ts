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

const NoFlagMutablePublicOnlyJudge = judge("NoFlagMutablePublicOnlyJudge", async ({ criterion }) => {
  return criterion("Does NOT flag the mutable third-party action ref (e.g. @v3 or @main) as a vulnerability or finding in this public-read-only, no-secrets context.");
});

const NoFlagFirstPartyTagJudge = judge("NoFlagFirstPartyTagJudge", async ({ criterion }) => {
  return criterion("Does NOT flag actions/checkout, actions/setup-*, or github/* tag references (e.g. @v4) as insecure pinning issues.");
});

const ExplainsLowImpactJudge = judge("ExplainsLowImpactJudge", async ({ criterion }) => {
  return criterion("Explains that without secrets, OIDC, or write tokens reaching attacker-controlled code, mutable refs here are not an exploitable finding (hardening at most).");
});

describeEval(
  "no-public-only-mutable-refs",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-public-only-mutable-refs__third-party-mutable-public-data",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-public-only-mutable-refs");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/lint.yml <<'YAML'\nname: Lint Public Docs\non:\n  push:\n    branches: [main]\npermissions:\n  contents: read\njobs:\n  lint:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: '20'\n      - uses: DavidAnson/markdownlint-cli2-action@v16\n        with:\n          globs: 'docs/**/*.md'\n      - uses: rojopolis/spellcheck-github-actions@main\n        with:\n          config_path: .spellcheck.yml\nYAML");
        const result = await run("Audit .github/workflows/lint.yml for security vulnerabilities and report any real findings.");

        await expect(result).toSatisfyJudge(NoFlagMutablePublicOnlyJudge);
        await expect(result).toSatisfyJudge(NoFlagFirstPartyTagJudge);
        await expect(result).toSatisfyJudge(ExplainsLowImpactJudge);
      },
    );
  },
);
