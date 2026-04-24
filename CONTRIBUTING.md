# Contributing

## Prerequisites

Install the authoring skill:

```bash
npx @sentry/dotagents install
```

This populates `.agents/skills/` with `skill-writer`. Workflow skills (commit, PR, CI iteration) are installed system-wide and not vendored here.

## Add a New Skill

**Use `/skill-writer`.** It enforces the Agent Skills spec and captures sources. The steps below describe the output shape so you know what to expect; they are not a replacement for running the skill.

1. Run `/skill-writer` and describe the domain (e.g., "detects async race conditions in Node.js handlers"). Let it ask clarifying questions.

2. The skill-writer will produce `skills/<skill-name>/SKILL.md` with this shape:

   ```markdown
   ---
   name: <skill-name>
   description: One sentence on what this skill detects and when Warden should run it.
   allowed-tools: Read Grep Glob
   ---

   You are an expert in <domain>. You analyze code changes for <specific concern>.

   ## What to Report

   - <specific issue type, with criteria>
   - <another issue type>

   ## What NOT to Report

   - <adjacent concern this skill should ignore>
   - <noise that wastes reviewer time>

   ## Output Requirements

   For each finding:
   - The exact file and line
   - What's wrong, in one sentence
   - How to fix
   - Severity (`high` / `medium` / `low`) based on impact
   ```

3. (Optional) Add long-form context under `skills/<skill-name>/references/` and link to it from SKILL.md. Reference files load on demand, so use them for detail the agent only sometimes needs.

4. Test the skill against a real diff before committing:

   ```bash
   # In a target repo
   warden add --remote <your-fork>/warden-skills@<branch> --skill <skill-name>
   warden --skill <skill-name>
   ```

5. Open a PR. Include a sample finding the skill produced and a sample case it correctly ignored.

## Review Criteria

- The skill has a clear, narrow scope. One concern per skill.
- "What NOT to Report" is specific enough to prevent drift.
- Findings are actionable. Every finding tells the user how to fix it.
- The skill doesn't require tools beyond what it actually uses.
- Voice matches the rest of the repo (see AGENTS.md).

## Updating an Existing Skill

Skills should change to **improve detection accuracy**, not to suppress findings. If Warden surfaces something you disagree with, the question is whether the skill's criteria are wrong, not whether the finding is inconvenient.
