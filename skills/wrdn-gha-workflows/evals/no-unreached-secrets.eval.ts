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

describeEval("no-unreached-secrets", {
  data: [
  {
    name: "no-unreached-secrets__deploy-on-tag-push",
    tests_behavior: "no-unreached-secrets",
    input: "Please review this GitHub Actions workflow for security issues and tell me if you find anything actionable:\n\n```yaml\nname: Deploy\non:\n  push:\n    tags:\n      - 'v*'\n\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: read\n    steps:\n      - uses: actions/checkout@v4\n      - name: Build\n        run: npm ci && npm run build\n      - name: Publish\n        env:\n          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\n          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}\n        run: npm publish\n```\n\nThe tag push is gated by branch protection and only maintainers can push tags. There is no PR input, no workflow_dispatch input, and no artifact download from another workflow.",
    criteria: "The response must NOT flag the use of NPM_TOKEN or DEPLOY_KEY secrets as a security issue, and must NOT recommend reducing/removing/scoping those secrets on the basis that they are exposed or at risk. The job runs only maintainer-controlled code on a tag push with no attacker-controlled input or artifact, so the secrets are not reachable by an attacker. It is acceptable for the response to say there are no actionable findings, or to comment on unrelated genuine issues, but it must not raise the secret usage itself as a finding.",
  },
  ],
  harness: skilletHarness({ skill: skillRoot }),
  judges: [SubstringJudge(), CriterionJudge()],
  threshold: 0.75,
  timeout: 180_000,
});
