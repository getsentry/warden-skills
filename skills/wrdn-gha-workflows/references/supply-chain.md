# Supply-Chain Risk in Action References

Use this reference when a workflow uses a third-party action by tag, branch, partial SHA, or floating ref, when it pulls a third-party reusable workflow, or when it executes content fetched at runtime by an otherwise-trusted action.

## Core Rule

Every `uses:` is a delegation. The workflow runs whatever code the resolved ref points to at the moment GitHub fetches it. A tag is a pointer; pointers move. Treat any non-SHA ref as "the action's owner can replace this code at any time, retroactively."

## What Has Already Happened

- **CVE-2025-30066, tj-actions/changed-files (March 2025).** The attacker rewrote multiple version tags (including `v1` through `v45`) to point at a malicious commit. The injected code dumped runner process memory, base64-encoded the result, and printed it to the workflow log. Around 23,000 repositories ran the compromise; CISA issued an advisory and a remediation deadline.
- **CVE-2025-30154, reviewdog/action-setup (March 2025).** Same wave. The compromise of `reviewdog/action-setup@v1` is the suspected initial vector for the tj-actions takeover, demonstrating how a single popular dependency cascades through unrelated maintainers.
- **ArtiPACKED (Unit 42, August 2024).** Repeatedly compromised maintainers via persisted `GITHUB_TOKEN` written to artifacts, harvested from public repository workflow runs.

The pattern is established. Mutable third-party action references in jobs that hold secrets or write tokens are a live bug shape, not a hypothetical.

## High-Signal Indicators

- `uses: <owner>/<repo>@<tag>`, `@main`, `@master`, `@latest`, `@stable`, `@<short-sha>`, or `@<branch-name>` for a third-party owner, in a job that holds:
  - any `secrets.*` other than `GITHUB_TOKEN`
  - `id-token: write`
  - `contents: write`, `packages: write`, `deployments: write`, `pull-requests: write`, `issues: write`, or `write-all`
  - cloud or registry credentials reached through OIDC, AWS access keys, GCP service account keys, npm tokens, PyPI tokens, Docker registry tokens, or signing keys
- a third-party action whose `runs:` invokes `curl ... | bash`, `wget ... | sh`, fetches a release tarball from a mutable URL, runs `npm install -g <unpinned>`, runs `pip install <unpinned>` or `pip install -r requirements.txt` from a mutable list, or otherwise executes content the action's SHA does not pin
- a composite or JavaScript action whose `runs:` references files inside the workspace (`./scripts/...`, `${{ github.workspace }}/...`) when the workspace can be populated by an attacker-controlled checkout, an attacker-controlled artifact download, or a poisoned cache restore
- external reusable workflow `uses: owner/repo/.github/workflows/file.yml@<mutable>`

## What Is Not a Finding

- first-party `actions/*` and `github/*` references on a tag (these refs are governed under GitHub's organization, not a third-party maintainer)
- third-party actions on a 40-character commit SHA, even when the comment names a tag
- third-party actions in workflows that hold no secrets, no OIDC, no write-scoped tokens, and operate only on public read-only data
- third-party actions vendored into the same repository under the same protected-branch policy as the rest of the workflow

## Severity

| Shape | Severity |
|-------|----------|
| Mutable third-party ref in a job that publishes packages, signs releases, or pushes to protected branches | high |
| Mutable third-party ref with secrets, OIDC, or non-trivial `GITHUB_TOKEN` write scopes | medium |
| Pinned action that downloads remote scripts at runtime in a privileged job | medium (high if the download executes during the privileged step itself) |
| Mutable third-party ref in a public-read-only flow with no secrets and no write scopes | low or no finding |
| First-party `actions/*` or `github/*` on a tag | not a finding |

## Verification Steps

1. List every `uses:` value in scope.
2. For each, classify owner: first-party (`actions/*`, `github/*`), same-repo, vendored, or external third-party.
3. For external third-party: read the ref. A 40-character hex string is a SHA pin. Anything else is mutable.
4. Read the workflow's `permissions:` and `secrets:` reachable from the job using the action.
5. Read the action's `action.yml` if vendored or fetched. If the action shells out to mutable URLs at runtime, SHA pinning of the action does not pin the payload. Note the residual exposure.
6. For external reusable workflows, the same rules apply to `uses: owner/repo/.github/workflows/file.yml@<ref>`.

## Fix Patterns

- Pin third-party actions to a 40-character commit SHA. Comment with the tag for human readers:
  ```yaml
  - uses: tj-actions/changed-files@a4ca7c0a052d49bbf8e69ddca9a3f53dac15c95e # v45.0.10
  ```
- Use Dependabot or a similar tool to bump the SHA and update the comment together.
- For actions that fetch payloads at runtime, prefer alternatives that ship the payload inside the action, or vendor the payload into the repository and pass it in.
- For the highest-trust steps (release signing, package publishing, OIDC role assumption), run only first-party or vendored actions and forbid network access.
- Treat external reusable workflows the same way: pin to a SHA, not a tag.

## References

- https://www.cisa.gov/news-events/alerts/2025/03/18/supply-chain-compromise-third-party-tj-actionschanged-files-cve-2025-30066-and-reviewdogaction
- https://semgrep.dev/blog/2025/popular-github-action-tj-actionschanged-files-is-compromised/
- https://www.wiz.io/blog/github-action-tj-actions-changed-files-supply-chain-attack-cve-2025-30066
- https://unit42.paloaltonetworks.com/github-actions-supply-chain-attack/
- https://unit42.paloaltonetworks.com/github-repo-artifacts-leak-tokens/
- https://adnanthekhan.com/2024/05/06/the-monsters-in-your-build-cache-github-actions-cache-poisoning/
- https://adnanthekhan.com/posts/angular-compromise-through-dev-infra/
- https://securitylab.github.com/resources/github-actions-preventing-pwn-requests/
- https://securitylab.github.com/resources/github-actions-new-patterns-and-mitigations/
