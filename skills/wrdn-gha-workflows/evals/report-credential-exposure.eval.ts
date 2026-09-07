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

describeEval("report-credential-exposure", {
  data: [
  {
    name: "report-credential-exposure__artipacked-git-upload",
    tests_behavior: "report-credential-exposure",
    input: "Please review this GitHub Actions workflow for security issues:\n\n```yaml\nname: Build and Archive\non:\n  push:\n    branches: [main]\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: make build\n      - uses: actions/upload-artifact@v4\n        with:\n          name: build-output\n          path: .\n```",
    criteria: "The response must flag that uploading the entire working directory (path: .) includes the .git directory, which contains the persisted checkout credential (the GITHUB_TOKEN written to .git/config by actions/checkout). It should identify this as the ArtiPACKED-style credential exposure pattern where the token leaks via the uploaded artifact. A correct answer ties the persisted-credentials default of actions/checkout to the broad upload path.",
  },
  {
    name: "report-credential-exposure__derived-secret-in-logs",
    tests_behavior: "report-credential-exposure",
    input: "Is there anything risky about this workflow step?\n\n```yaml\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Compute deploy hash\n        env:\n          API_KEY: ${{ secrets.API_KEY }}\n        run: |\n          HASH=$(echo -n \"$API_KEY\" | base64)\n          echo \"deploy-hash=$HASH\" >> $GITHUB_STEP_SUMMARY\n          echo \"Derived: $HASH\"\n```",
    criteria: "The response must report that a transformation of the secret (base64 of API_KEY) is written to the step summary and the log. It should explain that GitHub's secret masking only matches the exact secret value, not derivations/encodings, so the base64-encoded form is not masked and effectively exposes the credential. A correct answer names the masking-bypass-via-transformation issue.",
  },
  {
    name: "report-credential-exposure__broad-oidc-trust",
    tests_behavior: "report-credential-exposure",
    input: "We configured an AWS IAM role for GitHub OIDC with this trust policy condition:\n\n```json\n{\n  \"Condition\": {\n    \"StringLike\": {\n      \"token.actions.githubusercontent.com:sub\": \"repo:*\"\n    }\n  }\n}\n```\n\nThe role has full S3 and Lambda permissions. Any concerns?",
    criteria: "The response must report the OIDC trust policy as overly broad — the sub claim pattern `repo:*` allows any GitHub repository (across all of GitHub) to assume the role. It should explain this lets attacker-controlled workflows in unrelated repos obtain the role's credentials. A correct answer recommends pinning sub to a specific org/repo (and ideally branch/environment).",
  },
  ],
  harness: skilletHarness({ skill: skillRoot }),
  judges: [SubstringJudge(), CriterionJudge()],
  threshold: 0.75,
  timeout: 180_000,
});
