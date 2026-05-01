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

const CredentialExposureJudge = judge("CredentialExposureJudge", async ({ criterion }) => {
  return criterion("The response identifies the specific credential-exposure mechanism (e.g., persist-credentials checkout leak, derived-secret logging, ArtiPACKED .git/credential upload, broad OIDC trust, write-scoped token amplification) and ties it to a concrete exploit path showing how an attacker reaches the secret or token. A generic 'be careful with secrets' note does not satisfy the rubric.");
});

describeEval(
  "report-credential-exposure",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-credential-exposure__artipacked-git-upload",
      { timeout: 180_000 },
      async ({ run, behavior }) => {
        behavior("report-credential-exposure");
        const result = await run("Please audit this workflow for security issues:\n\n```yaml\nname: Build Artifacts\non:\n  pull_request_target:\n    types: [opened, synchronize]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - run: npm ci && npm run build\n      - uses: actions/upload-artifact@v4\n        with:\n          name: build-output\n          path: |\n            ./\n```");

        expect(result.session.outputText).toMatch(new RegExp("(ArtiPACKED|\\.git|persist-credentials|credential)", "i"));
        expect(result.session.outputText).toMatch(new RegExp("upload-artifact", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL|MEDIUM)\\b"));
        await expect(result).toSatisfyJudge(CredentialExposureJudge);
      },
    );

    it(
      "report-credential-exposure__derived-secret-in-logs",
      { timeout: 180_000 },
      async ({ run, behavior }) => {
        behavior("report-credential-exposure");
        const result = await run("Is there anything risky here?\n\n```yaml\nname: Deploy\non:\n  push:\n    branches: [main]\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Compute deploy key\n        run: |\n          echo \"hash=$(echo -n \"${{ secrets.DEPLOY_TOKEN }}\" | base64)\" >> $GITHUB_OUTPUT\n          echo \"Token prefix: $(echo \"${{ secrets.DEPLOY_TOKEN }}\" | cut -c1-4)\"\n```");

        expect(result.session.outputText).toMatch(new RegExp("(transform|derive|base64|mask|log)", "i"));
        expect(result.session.outputText).toMatch(new RegExp("secret", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL|MEDIUM)\\b"));
        await expect(result).toSatisfyJudge(CredentialExposureJudge);
      },
    );

    it(
      "report-credential-exposure__broad-oidc-trust",
      { timeout: 180_000 },
      async ({ run, behavior }) => {
        behavior("report-credential-exposure");
        const result = await run("Review this AWS role trust policy used by our GitHub OIDC workflow:\n\n```json\n{\n  \"Version\": \"2012-10-17\",\n  \"Statement\": [{\n    \"Effect\": \"Allow\",\n    \"Principal\": { \"Federated\": \"arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com\" },\n    \"Action\": \"sts:AssumeRoleWithWebIdentity\",\n    \"Condition\": {\n      \"StringLike\": { \"token.actions.githubusercontent.com:sub\": \"repo:my-org/*:*\" }\n    }\n  }]\n}\n```\n\nThe workflow uses aws-actions/configure-aws-credentials@v4 with role-to-assume.");

        expect(result.session.outputText).toMatch(new RegExp("(OIDC|trust policy|sub)", "i"));
        expect(result.session.outputText).toMatch(new RegExp("(broad|wildcard|repo:my-org/\\*|any repo)", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL|MEDIUM)\\b"));
        await expect(result).toSatisfyJudge(CredentialExposureJudge);
      },
    );
  },
);
