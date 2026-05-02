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

const NoFalsePositiveOnUnreachedSecretJudge = judge("NoFalsePositiveOnUnreachedSecretJudge", async ({ criterion }) => {
  return criterion("Does NOT flag the secret usage as a vulnerability or exfiltration risk, and does not recommend treating it as exploitable.");
});

const ExplainsSecretNotReachableJudge = judge("ExplainsSecretNotReachableJudge", async ({ criterion }) => {
  return criterion("Explains that the secret is used only in a job that does not run attacker-controlled code or consume attacker-controlled artifacts, so there is no exploitable path.");
});

describeEval(
  "no-unreached-secrets",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-unreached-secrets__push-main-deploy",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-unreached-secrets");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/deploy.yml <<'YAML'\nname: Deploy\non:\n  push:\n    branches: [main]\njobs:\n  publish:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: '20'\n      - run: npm ci\n      - run: npm publish\n        env:\n          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\nYAML");
        const result = await run("Audit .github/workflows/deploy.yml — is the use of NPM_TOKEN here a security issue?");

        await expect(result).toSatisfyJudge(NoFalsePositiveOnUnreachedSecretJudge);
        await expect(result).toSatisfyJudge(ExplainsSecretNotReachableJudge);
      },
    );
  },
);
