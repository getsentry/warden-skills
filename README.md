# warden-skills

Generalized skills for [Warden](https://warden.sentry.dev). Each skill defines what to look for; Warden runs them against your code.

## Available Skills

Skills live in [`skills/`](skills/). Each skill is a directory with a `SKILL.md` defining its scope.

## Using a Skill

Add a skill to your project's `warden.toml` as a remote skill:

```bash
warden add --remote getsentry/warden-skills --skill <skill-name>
```

Or pin to a specific ref:

```bash
warden add --remote getsentry/warden-skills@<ref> --skill <skill-name>
```

List every skill in this repo:

```bash
warden add --remote getsentry/warden-skills --list
```

Update cached copies:

```bash
warden sync getsentry/warden-skills
```

See the [Warden docs](https://warden.sentry.dev/) for the full remote skill workflow.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

FSL-1.1-ALv2
