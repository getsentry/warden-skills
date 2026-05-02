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

const IdentifiesArtiPACKEDExposureJudge = judge("IdentifiesArtiPACKEDExposureJudge", async ({ criterion }) => {
  return criterion("Identifies that uploading the entire workspace or .git directory as an artifact exposes the persisted GITHUB_TOKEN or git credentials.");
});

const ConnectsPersistedCredentialsJudge = judge("ConnectsPersistedCredentialsJudge", async ({ criterion }) => {
  return criterion("Explains that actions/checkout persists credentials in .git/config by default, making them harvestable from the artifact.");
});

const RecommendsScopingArtifactJudge = judge("RecommendsScopingArtifactJudge", async ({ criterion }) => {
  return criterion("Recommends excluding .git or scoping the upload path, or disabling persist-credentials, rather than only generic 'review permissions' advice.");
});

describeEval(
  "report-credential-exposure",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-credential-exposure__artipacked-git-upload",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-credential-exposure");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/build.yml <<'YAML'\nname: Build\non:\n  push:\n    branches: [main]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n    steps:\n      - uses: actions/checkout@v4\n      - run: make build\n      - uses: actions/upload-artifact@v4\n        with:\n          name: workspace\n          path: .\nYAML");
        const result = await run("Review .github/workflows/build.yml for security issues that could leak credentials.");

        await expect(result).toSatisfyJudge(IdentifiesArtiPACKEDExposureJudge);
        await expect(result).toSatisfyJudge(ConnectsPersistedCredentialsJudge);
        await expect(result).toSatisfyJudge(RecommendsScopingArtifactJudge);
      },
    );
  },
);
