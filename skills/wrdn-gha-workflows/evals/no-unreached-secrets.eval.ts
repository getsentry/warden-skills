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
      "no-unreached-secrets__deploy-on-tag-push",
      async ({ run, behavior }) => {
        behavior("no-unreached-secrets");
        const result = await run("Can you audit this release workflow for security issues?\n\n```yaml\nname: Release\non:\n  push:\n    tags:\n      - 'v*'\njobs:\n  publish:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: read\n      id-token: write\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.ref }}\n      - uses: actions/setup-node@v4\n        with:\n          node-version: '20'\n      - run: npm ci\n      - run: npm run build\n      - run: npm publish\n        env:\n          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\n```");

        expect(result.session.outputText).not.toContain("NPM_TOKEN");
        expect(result.session.outputText).not.toContain("secret exfiltration");
        expect(result.session.outputText).toMatch(new RegExp("(safe|no.*finding|not.*vulnerab|out of scope|no.*issue|looks fine|no significant)", "i"));
      },
    );

    it(
      "no-unreached-secrets__scheduled-internal-job",
      async ({ run, behavior }) => {
        behavior("no-unreached-secrets");
        const result = await run("Any security concerns with this scheduled job?\n\n```yaml\nname: Nightly Metrics\non:\n  schedule:\n    - cron: '0 2 * * *'\njobs:\n  report:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: ./scripts/collect-metrics.sh\n        env:\n          DATADOG_API_KEY: ${{ secrets.DATADOG_API_KEY }}\n```");

        expect(result.session.outputText).not.toContain("DATADOG_API_KEY leak");
        expect(result.session.outputText).not.toContain("secret exposure");
        expect(result.session.outputText).toMatch(new RegExp("(safe|no.*finding|not.*vulnerab|out of scope|no.*issue|no significant)", "i"));
      },
    );
  },
);
