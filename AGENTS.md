# Agent Instructions

This repository hosts generalized [Warden](https://warden.sentry.dev) skills consumed remotely by other projects.

## Layout

```
skills/
└── wrdn-<skill-name>/
    ├── SKILL.md           # Required. Frontmatter + analysis instructions
    ├── references/        # Optional. Long-form context loaded on demand
    └── scripts/           # Optional. Helper scripts the skill invokes
```

Warden discovers skills at `skills/<name>/SKILL.md` automatically. No registry file or build step.

## Naming

Every skill in this repo MUST be prefixed `wrdn-`. The prefix keeps these skills identifiable when mixed with skills from other sources in a consumer's `warden.toml` (e.g., `wrdn-access-control`, `wrdn-dependency-audit`). The frontmatter `name` must match the directory exactly, prefix included.

## Tooling

Install once after cloning:

```bash
pnpm install                          # Installs @sentry/warden (pinned in package.json)
pnpx @sentry/dotagents install         # Installs authoring skills into .agents/skills/
```

The `warden` CLI is a `devDependency`. Run it via `pnpm exec warden ...` or `./node_modules/.bin/warden ...`. Authoring skills from `getsentry/skills` are declared in `agents.toml`; installed under `.agents/skills/` (gitignored).

```bash
pnpx @sentry/dotagents add <src> <skill>    # Add a new authoring skill
pnpx @sentry/dotagents list                 # Show what's installed
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
name: wrdn-skill-name
description: One sentence on what this skill detects and when Warden should run it.
allowed-tools: Read Grep Glob Bash
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

`allowed-tools` is space-separated. Default to `Read Grep Glob Bash`. Agents use the shell to verify findings accurately: `git log`/`git blame` for history, `rg` for precise cross-file searches, type checkers and linters to confirm a pattern actually triggers. Drop `Bash` only when you're certain the skill can finish without any shell verification, which is rare. Add `WebFetch`/`WebSearch` only when the skill genuinely needs external lookup.

For deeper detail on the format, see [`skills/warden/references/creating-skills.md` in the Warden repo](https://github.com/getsentry/warden/blob/main/skills/warden/references/creating-skills.md).

## Skill Authoring Rules

- **One skill, one concern.** "SQL injection" is a skill. "Code quality" is not.
- **Skills define what to look for, not how to react.** When findings are wrong, fix detection criteria, not the response template.
- **Be explicit about non-goals.** A "What NOT to Report" section keeps skills from drifting into adjacent domains.
- **Calibrate confidence.** If the skill should require strong evidence before reporting, say so. Vague resemblance is not a finding.
- **Severity is domain-agnostic.** Don't redefine `high` / `medium` / `low`. Decide which findings in your domain warrant each level.
- **Multi-language examples required.** Every skill must include example patterns in both Python and JavaScript/TypeScript. Show a bad case and a safe case for each language. Prefer shapes drawn from real code over synthesized toys.
- **Trace, don't skim.** Skills analyze, not pattern-match. Anything that resembles the skill's concern must be evaluated thoroughly: read surrounding code, follow data flow, verify the pattern actually holds in context. Don't report on vague resemblance. Don't drop an investigation because the surface looks benign. State this expectation explicitly in the skill's prose so the agent running it knows to keep pulling threads.
- **Progressive disclosure in references.** Don't make the agent load context it won't use. SKILL.md stays tight. Put anything conditional in `references/`, with one concern per file (one framework per file, one ecosystem per file, one auth mechanism per file). SKILL.md links to references via a table keyed on when to read each one. The agent should finish most diffs without opening any reference at all.
- **Ground skills in evidence, not vibes.** Before authoring a bug-hunting or security skill, gather prior art:
  1. **Online**: recent CVEs, HackerOne public reports, GitHub Security Advisories, vendor security blogs, OWASP cheat sheets. Look for *specific bug shapes* that keep recurring, not general categories.
  2. **Sentry codebases**: scan `~/src/sentry` and `~/src/getsentry` for how the concern manifests in a real Django/DRF monorepo. Look at historical fixes via `git log --grep`, internal decorators/permissions, custom base classes. If a pattern is the dominant idiom there, your skill must recognize it.
  Patterns in the skill should point to observed bugs with citations in comments or references where useful. Generic OWASP-style lists are not enough.

## Adding a Skill

Run `/skill-writer` and point it at the domain. See [CONTRIBUTING.md](CONTRIBUTING.md) for repo-specific conventions and the review checklist.

## Testing a Skill

See [TESTING.md](TESTING.md). The short version: `warden --skill <path>` accepts a filesystem path, so iterate here and run from inside any target repo against the in-repo skill directory. No symlinks, no copies.

## Voice

Match Warden's voice in skill prose: brief, dry, slightly ominous. Security guard who's seen everything. No fluff, no hype, no em-dashes.
