# Agent Instructions

This repository hosts generalized [Warden](https://warden.sentry.dev) skills consumed remotely by other projects.

## Layout

```
skills/
└── <skill-name>/
    ├── SKILL.md           # Required. Frontmatter + analysis instructions
    ├── references/        # Optional. Long-form context loaded on demand
    └── scripts/           # Optional. Helper scripts the skill invokes
```

Warden discovers skills at `skills/<name>/SKILL.md` automatically. No registry file or build step.

## Tooling

This repo uses [`@sentry/dotagents`](https://github.com/getsentry/dotagents) to pull in shared authoring skills from `getsentry/skills`. Declared in `agents.toml`; installed under `.agents/skills/` (gitignored).

```bash
npx @sentry/dotagents install        # Sync after pulling
npx @sentry/dotagents add <src> <skill>   # Add a new skill
npx @sentry/dotagents list           # Show what's installed
```

## Skills

- `/skill-writer` — **Always** use when creating or updating a skill in `skills/`. It enforces the Agent Skills spec (frontmatter, depth gates, source capture, validation).

Commit, PR, and iteration skills are installed system-wide; they aren't vendored here.

## Authoring Workflow

When adding or editing a skill, start with `/skill-writer`. Don't write SKILL.md by hand. The skill-writer enforces the spec, captures sources, and validates the output.

## Commit Attribution

AI commits MUST include:

```
Co-Authored-By: <model name> <noreply@anthropic.com>
```

Example: `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`

## SKILL.md Format

```markdown
---
name: skill-name
description: One sentence on what this skill detects and when Warden should run it.
allowed-tools: Read Grep Glob
---

[Analysis instructions for the agent]

## What to Report
- Specific issue type with clear criteria

## What NOT to Report
- Out-of-scope concerns this skill should ignore

## Output Requirements
- File and line, what's wrong, how to fix
```

`name` must match the directory. `description` is what Warden shows users when they list or pick a skill, so be specific.

`allowed-tools` is space-separated. Most review skills only need `Read Grep Glob`. Add `Bash`, `WebFetch`, etc. only when the skill genuinely needs them.

For deeper detail on the format, see [`skills/warden/references/creating-skills.md` in the Warden repo](https://github.com/getsentry/warden/blob/main/skills/warden/references/creating-skills.md).

## Skill Authoring Rules

- **One skill, one concern.** "SQL injection" is a skill. "Code quality" is not.
- **Skills define what to look for, not how to react.** When findings are wrong, fix detection criteria, not the response template.
- **Be explicit about non-goals.** A "What NOT to Report" section keeps skills from drifting into adjacent domains.
- **Calibrate confidence.** If the skill should require strong evidence before reporting, say so. Vague resemblance is not a finding.
- **Severity is domain-agnostic.** Don't redefine `high` / `medium` / `low`. Decide which findings in your domain warrant each level.

## Adding a Skill

Run `/skill-writer` and point it at the domain. See [CONTRIBUTING.md](CONTRIBUTING.md) for repo-specific conventions and the review checklist.

## Voice

Match Warden's voice in skill prose: brief, dry, slightly ominous. Security guard who's seen everything. No fluff, no hype, no em-dashes.
