# Comment and Chatops Commands

Use this reference for `issue_comment`, `discussion`, `discussion_comment`, slash commands, labels, review comments, and any workflow that executes commands based on public repository activity.

## Core Rule

Public comments, discussions, and labels are attacker input. A workflow may parse them, but privileged command execution needs an authorization gate, safe data handling, and a checkout ref the attacker cannot replace after approval. CVE-2025-53104 (gluestack-ui) used a discussion title to inject shell. Treat `discussion.title`, `discussion.body`, `discussion_comment.body`, and label names exactly like comment bodies.

## High-Signal Indicators

- `on: issue_comment` with `contains(github.event.comment.body, '/command')`.
- Comment body passed directly to `run:`, a deployment script, `gh`, `curl`, or a package publishing command.
- No `author_association` check, team membership check, or maintainer approval.
- Commands run with `contents: write`, `pull-requests: write`, `packages: write`, cloud credentials, or deployment secrets.
- Workflow checks out PR code after a comment command without verifying the commenter is trusted.
- Checkout of `refs/pull/${{ github.event.issue.number }}/merge` or PR head after a public comment command, followed by build, test, version, release, or deploy scripts.

## Acceptable Authorization Gates

- `github.event.comment.author_association` restricted to `OWNER`, `MEMBER`, or `COLLABORATOR`.
- GitHub API lookup that verifies team membership or repository write permission.
- Required maintainer approval before privileged command execution.
- A bot command that only performs read-only metadata work with minimal permissions.

## False-Positive Controls

- Do not flag commands that only add a harmless reaction or comment with read-only token scope.
- Do not treat string matching on comments as a bug unless it triggers meaningful execution or privileged state change.
- Do not flag commands restricted to trusted associations unless the authorization check is wrong or bypassable.
- Treat `CONTRIBUTOR` as partially trusted, not equivalent to `MEMBER`; prior merged code does not prove current command intent.

## TOCTOU Between Approval and Checkout

A common chatops shape: maintainer comments `/ok-to-test` or applies a `safe-to-test` label, the workflow then resolves `pull_request.head.sha` (or `head_ref`) and runs a privileged build. Between the approval and the workflow's checkout, the attacker pushes a new commit. The privileged job runs the new commit, not the reviewed one.

Detection signals:

- privileged checkout ref derives from `github.event.pull_request.head.sha`, `github.event.pull_request.head.ref`, `github.head_ref`, or a runtime `gh pr view` lookup, after a comment/label gate
- approval gate uses `author_association`, label name, or comment text but does not pin the SHA the maintainer reviewed
- workflow re-resolves the head ref with `gh api` or `git fetch` after the comment event

Acceptable mitigations:

- pin the checkout to a SHA captured at approval time, for example by encoding the SHA in the comment (`/ok-to-test <sha>`) or label, or by writing the SHA into a deployment, environment variable, or check-run before the privileged job runs
- require re-approval on every push to the PR head
- do the privileged work on the merge commit produced by the maintainer, not on the PR head

## Fix Patterns

- Gate commands on trusted author association or explicit permission lookup.
- Keep token permissions minimal for comment workflows.
- Avoid passing the whole comment body to shell. Parse command arguments with a strict allowlist.
- Use environment variables and quote them if text must reach a shell.
- Pin the privileged checkout to the SHA the maintainer actually approved.
- Separate untrusted PR checkout from privileged commenting or deployment.
