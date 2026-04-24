# Testing Skills Locally

How to work on a skill in this repo and run it against another codebase without pushing or publishing.

## Prerequisites

One-time setup:

```bash
pnpm install                    # Installs @sentry/warden, pinned
pnpx @sentry/dotagents install  # Authoring skills (skill-writer)
```

Authenticate Warden once, either:

- Export `WARDEN_ANTHROPIC_API_KEY`, or
- Sign in with Claude Code: `claude login`.

Pick one way to invoke Warden from anywhere:

- **Pinned (recommended while iterating):** run this repo's copy via an alias.
  ```bash
  alias warden-dev='pnpm --dir ~/src/warden-skills exec warden'
  ```
- **Global:** `pnpm add -g @sentry/warden`, then `warden` works anywhere. Version drift is on you.
- **Ad-hoc:** `pnpx @sentry/warden ...`. Slower; fetches each run.

Below assumes `warden` resolves to a working binary.

## The Local Dev Loop

Warden's `--skill` flag accepts a path. If the value contains `/` or `\` or starts with `.`, Warden loads that directory as the skill. No symlinks, no copies, no modifications to the target repo.

Work on `skills/<name>/SKILL.md` in this repo. Then, in the target repo:

```bash
cd ~/src/sentry

# Analyze uncommitted changes
warden --skill ~/src/warden-skills/skills/wrdn-access-control

# Analyze a ref range
warden --skill ~/src/warden-skills/skills/wrdn-access-control HEAD~1..HEAD
warden --skill ~/src/warden-skills/skills/wrdn-access-control main..HEAD

# Analyze specific files or globs
warden --skill ~/src/warden-skills/skills/wrdn-access-control src/sentry/api/bases/organization.py
warden --skill ~/src/warden-skills/skills/wrdn-access-control 'src/sentry/api/**/*.py'
```

Edits to SKILL.md and `references/*.md` in this repo are live on the next run.

**Verbosity:** add `-v` for real-time findings during analysis, `-vv` for token and latency debug.

## Regression Test Against a Known Fix

Every skill should be able to re-detect at least one real historical bug. This is the most valuable test you own: if an edit to the skill makes it miss a bug the skill used to catch, the skill is worse, regardless of what a synthetic fixture says.

Pick a known access-control fix in Sentry (for example, `cf341c9c950` — "fix(releases): Validate project access in release details"), check out the commit *before* the fix, and run the skill:

```bash
cd ~/src/sentry

# The pre-fix state contains the IDOR
git checkout cf341c9c950~1 -- src/sentry/releases/endpoints/organization_release_details.py

warden --skill ~/src/warden-skills/skills/wrdn-access-control \
  src/sentry/releases/endpoints/organization_release_details.py

# Expect: high-severity finding describing the unscoped project lookup.

# Put the file back when done
git checkout HEAD -- src/sentry/releases/endpoints/organization_release_details.py
```

Keep a small list of these "ground truth" commits in your head (or in a scratch file alongside the skill). Run the full set after any non-trivial SKILL.md edit.

Good candidates for `wrdn-access-control`: `cf341c9c950`, `681d46fef66`, `fb21d886a08`, `b9ea4f87297`. The `references/sentry.md` file lists more, each with a one-line summary of the bug the fix closed.

## Single-File Mode From Anywhere

You don't strictly have to `cd` to the target. Absolute or relative paths outside the CWD work:

```bash
cd ~/src/warden-skills
warden --skill ./skills/wrdn-access-control \
  ~/src/sentry/src/sentry/api/bases/organization.py
```

**Caveat:** git context (diffs, `git log`, ref ranges) binds to the CWD's repo. From `~/src/warden-skills`, `HEAD~1..HEAD` resolves to this repo's history, not Sentry's. Use this mode only for specific-file analysis. For ref ranges or uncommitted diff in a target repo, `cd` to the target.

## Watching the Skill's Own File Reads

Warden passes the skill's directory to the agent via `skill.rootDir`. Inside SKILL.md, reference files are loaded on demand:

```markdown
See `${CLAUDE_SKILL_ROOT}/references/sentry.md` when the diff touches sentry.api.
```

The agent resolves `${CLAUDE_SKILL_ROOT}` to the directory containing SKILL.md. When you `--skill <path>`, this resolves to your path. References load correctly without any extra setup.

If the agent does not open a reference you expected it to, the reference table in SKILL.md is not precise enough. Tighten the "when to read" column.

## Verifying the Consumer Path Before a PR

Local testing proves the skill runs correctly through a filesystem path. It does not prove the consumer's `warden add --remote` path works (cache, ref pinning, the `skills/` discovery layout). Before opening a PR:

```bash
git push -u origin <branch>

cd /some/target/repo
warden add --remote <your-fork>/warden-skills@<branch> --skill wrdn-<name>
warden --skill wrdn-<name>
```

This should produce the same findings as the local `--skill <path>` run. If it doesn't, the remote layout or a reference path is wrong.

## Debugging

- **Skill not found:** Warden reports `Skill not found at path: ...`. Confirm the path contains a `SKILL.md`. Relative paths resolve from the CWD where `warden` runs.
- **Reference not opened:** the agent decides when to read references based on SKILL.md's reference table. If it's skipping a reference you expected to be loaded, the trigger wording ("when") is too vague.
- **Frontmatter errors:** `allowed-tools` must be space-separated, not a YAML list. `name` must match the directory exactly (including the `wrdn-` prefix).
- **No output:** run with `-v` to see per-file progress. If files match nothing, your glob is wrong or `.gitignore` excludes them (add `--no-gitignore` to override).
