# Command Injection Reference

Load when the diff touches `subprocess`, `os.system`, `os.popen`, `child_process`, `Runtime.exec`, `ProcessBuilder`, backticks, `shell_exec`, `system()` (PHP/C), or any API that invokes a shell or spawns a process with untrusted input.

## The Core Rule

A shell is invoked when:

- The API explicitly enables one (`shell=True` in Python, `{ shell: true }` in Node, `bash -c "..."` in any runtime, backticks in Ruby/Perl/shell).
- The API implicitly invokes one on certain OS targets. The big modern footgun: **Node.js on Windows with `.bat` or `.cmd`** targets (CVE-2024-27980, "BatBadBut") implicitly goes through `cmd.exe` even with `shell: false`.

When a shell is involved, **argument strings are interpreted as shell syntax**. Metacharacters (`;`, `|`, `&`, `$()`, backticks, `>`, newlines) are interpreted, and the attacker can chain commands.

When no shell is involved, `execFile("cmd", ["arg1", "arg2"])` passes each arg to the target binary as a single argv entry. The argv entries are not parsed; no injection.

## Python

### Unsafe shapes

```python
import os, subprocess

os.system(f"git clone {user_url}")
os.system("convert " + user_name + " out.png")

subprocess.run(f"git clone {user_url}", shell=True)
subprocess.Popen(f"ls {user_dir}", shell=True)
subprocess.call(f"convert {user_in} {user_out}", shell=True)

# check_output has the same shell=True trap:
subprocess.check_output(f"echo {user_input}", shell=True)

# os.popen runs through a shell.
os.popen(f"cat {user_file}")
```

### Safe shapes

```python
subprocess.run(["git", "clone", "--", user_url], check=True)
subprocess.run(["convert", user_name, "out.png"], check=True)
subprocess.Popen(["ls", user_dir])
```

Pass args as a list; leave `shell=False` (the default); always include `--` when the user input could start with `-` (prevents argument injection even without a shell).

### Edge cases

- `shlex.split(user_string)` followed by `subprocess.run(args_list)` is **not safe** if the goal is shell-like parsing. The attacker-controlled tokens can still include `-e`/`--exec` style flags that the target binary honors. Example: `git clone --upload-pack="..."`.
- `argument injection without a shell`: `subprocess.run(["git", user_arg])` where `user_arg = "--upload-pack=malicious-cmd"` is still exploitation. Hence the `--` separator.

### pexpect, fabric, invoke, paramiko

`pexpect.spawn("bash -c \"...\"")` and friends pass a string that is interpreted. Same rules as `subprocess(shell=True)`.

Remote-exec libraries (`fabric.connection.Connection.run(user_cmd)`, `paramiko.SSHClient.exec_command(user_cmd)`) invoke a shell on the remote side. The fact that it's remote doesn't save you; injection is injection.

## Node.js

### Unsafe shapes

```ts
import { exec, execSync, spawn } from 'child_process';

exec(`git clone ${userUrl}`, (err, stdout) => {});
execSync(`convert ${userIn} out.png`);

// spawn with shell: true
spawn('git', ['clone', userUrl], { shell: true });

// backtick-like with sh/bash
exec(`bash -c "do something with ${userInput}"`);
```

### Safe shapes

```ts
import { execFile, execFileSync, spawn } from 'child_process';

execFile('git', ['clone', '--', userUrl]);
execFileSync('convert', [userIn, 'out.png']);
spawn('convert', [userIn, 'out.png']);  // default { shell: false }
```

### Windows footgun (CVE-2024-27980, BatBadBut)

On Windows, Node's `spawn`/`spawnSync`/`execFile` detect `.bat`/`.cmd` targets and route through `cmd.exe` **regardless of the `shell` option**. This implicit shell does not quote arguments the same way POSIX does. A crafted argv element like `"a\" & calc & \""` injects commands.

Fixed in Node 18.20.0 / 20.12.0 / 21.7.0 with a `shell: true` requirement for `.bat`/`.cmd` on Windows. If the project pins to older Node, or calls a `.bat` script with user data, flag it.

### Platform differences

`execFile("/usr/bin/ls", [userInput])` on Linux/macOS is safe regardless of `userInput` content.
`execFile("something.bat", [userInput])` on Windows is unsafe on old Node.

## Java

```java
Runtime.getRuntime().exec(userString);   // Ambiguous: parses on whitespace; injection surface.
Runtime.getRuntime().exec(new String[]{"git", "clone", userUrl});   // Safer.
new ProcessBuilder("git", "clone", userUrl).start();   // No shell; safer.
new ProcessBuilder("sh", "-c", userString).start();   // Shell; unsafe.
```

`Runtime.exec(String)` uses StringTokenizer which is neither safe parsing nor a shell — it's a surprise third option. Prefer `ProcessBuilder` with an argv list.

## PHP

```php
system("git clone $url");         // Shell; unsafe.
shell_exec("git clone $url");     // Shell; unsafe.
exec("git clone $url");           // Shell; unsafe.
`git clone $url`;                 // Backtick = shell; unsafe.
passthru("git clone $url");       // Shell; unsafe.

// proc_open with argv:
proc_open(["git", "clone", $url], ...);   // Safer (PHP 7.4+ supports argv form).
```

## Ruby

```ruby
system("git clone #{url}")        # String form; shell. Unsafe.
`git clone #{url}`                # Backticks; shell. Unsafe.
exec("git clone #{url}")          # Same.
Kernel.spawn("git clone #{url}")  # String; shell.

system("git", "clone", "--", url) # Array; no shell. Safe.
Kernel.spawn("git", "clone", "--", url)  # Array; safe.
```

## Canonical Incidents

- **CVE-2021-22205 — GitLab + ExifTool, CVSS 10.0**: image uploads piped to ExifTool; DjVu annotation metadata was eval'd via Perl reachable from a shelled invocation. Unauthenticated RCE as `git`.
- **CVE-2024-27980 — Node.js BatBadBut**: Windows `.bat`/`.cmd` argument-quoting bypass. Affected every Node HTTP server on Windows that shelled out to a batch file with user input.
- **Classic `interactive-git-checkout` / `ggit` shape**: branch name concatenated into `exec("git fetch " + tag)`.

## Detection Heuristics

For every match:

1. **Is a shell invoked?** `shell=True` / `{ shell: true }` / `bash -c` / `sh -c` / backticks / `Runtime.exec(String)` / `system("..."$...")`.
2. **Is an argument untrusted?** Request data, webhook payload, DB field user-written, filename from a user upload, integration config value.
3. **On Node and the target is `.bat`/`.cmd`**: implicit shell; same as `shell: true`.
4. **On Ruby/Perl using string form of `system`/`exec`**: shell.
5. **On PHP, anything except argv-form `proc_open`**: shell.

## False-Positive Traps

- `subprocess.run(["cmd", userArg])` with `shell=False` (default) is safe on POSIX.
- `execFile('bin', [userArg])` on Linux/macOS is safe regardless of content.
- Hardcoded command strings with no user-data interpolation are safe.
- A command whose user-provided portion has been validated against an allowlist of exact values is safe.
- `shlex.quote(user_arg)` before inclusion in a shelled command is a valid escape on POSIX, but adds risk (encoding bugs, non-POSIX targets). Prefer argv.

## Diff Heuristics

1. New `subprocess.*(shell=True)` with any non-literal argument.
2. New `os.system(...)` / `os.popen(...)` with any non-literal argument.
3. New `exec(...)` / `execSync(...)` in Node (these always shell).
4. New `spawn(...)` with `{ shell: true }`.
5. New `Runtime.exec(String)` in Java (prefer argv form).
6. New `system("...#{x}...")` or backtick-string in Ruby.
7. New PHP `system`/`shell_exec`/`exec`/`passthru`/`` ` ` `` with user data.
8. Node project targeting `.bat`/`.cmd` files with user arguments, on a Node version below 18.20 / 20.12 / 21.7.
9. Argument without `--` separator where the target binary has flags that could be abused (`git`, `ssh`, `curl`, `scp`, `rsync`).

## Verification Commands

```bash
# Python
rg -n 'subprocess\.(run|call|Popen|check_call|check_output).*shell\s*=\s*True|os\.system\(|os\.popen\(' <file>

# Node
rg -n 'child_process|execSync|\bexec\(|spawn\(|spawnSync\(' <file>
rg -n 'shell:\s*true' <file>

# Java
rg -n 'Runtime\.getRuntime\(\)\.exec\(|ProcessBuilder' <file>

# Ruby
rg -n '\bsystem\(|\bexec\(|`[^`]*\#\{' <file>

# PHP
rg -n '\bsystem\(|shell_exec\(|\bexec\(|passthru\(|proc_open\(' <file>

# Node version check (for Windows .bat footgun)
jq '.engines.node' package.json
```
