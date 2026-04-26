# Comment and Chatops Commands

Use this reference for `issue_comment`, slash commands, labels, review comments, and workflows that execute commands based on public repository activity.

## Core Rule

Public comments and labels are attacker input. A workflow may parse them, but privileged command execution needs an authorization gate and safe data handling.

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

## Fix Patterns

- Gate commands on trusted author association or explicit permission lookup.
- Keep token permissions minimal for comment workflows.
- Avoid passing the whole comment body to shell. Parse command arguments with a strict allowlist.
- Use environment variables and quote them if text must reach a shell.
- Separate untrusted PR checkout from privileged commenting or deployment.
