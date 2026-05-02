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
  skilletHarness,
} from "@sentry/skillet/evals";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-unreached-secrets",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-unreached-secrets__deploy-job-no-pr-input",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-unreached-secrets");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/deploy.yml <<'YAML'\nname: deploy\non:\n  push:\n    branches: [main]\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.sha }}\n      - name: Deploy\n        env:\n          DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}\n          AWS_KEY: ${{ secrets.AWS_ACCESS_KEY_ID }}\n        run: ./scripts/deploy.sh\nYAML\nmkdir -p scripts\ncat > scripts/deploy.sh <<'SH'\n#!/bin/bash\necho \"deploying commit $GITHUB_SHA\"\nSH\nchmod +x scripts/deploy.sh\n");
        const result = await run("Audit .github/workflows/deploy.yml for security issues. Are the secrets referenced in this workflow at risk?");

        expect(result.session.outputText).not.toContain("secret exfiltration");
        expect(result.session.outputText).not.toContain("secret leak");
        expect(result.session.outputText).toMatch(new RegExp("(no\\s+finding|not\\s+exploitable|no\\s+attacker[- ]controlled|out\\s+of\\s+scope|no\\s+exploitable\\s+path|safe)", "i"));
      },
    );
  },
);
