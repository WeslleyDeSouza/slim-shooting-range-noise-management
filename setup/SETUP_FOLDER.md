# Creating a `setup/` folder

## What is `@app-galaxy/setup-api`?

**A "get this project running" wizard, in a box.**

Every project accumulates the same tribal knowledge: copy `.env.example`, point
npm at the private registry, install, seed the database, check the API is up. It
usually lives in a README nobody reads and a teammate's memory.

`@app-galaxy/setup-api` turns that into a desktop app. A developer clones your
repo and runs one command:

```bash
npx @app-galaxy/setup-api
```

An Electron window opens and works through your checklist: it **runs** each
check, **heals** what it can without asking, and **stops only** when something
genuinely needs a human decision. Everything is logged; nothing is written until
a check runs.

Three things worth knowing up front:

- **The package ships no steps.** It is an engine plus a UI. Every step comes
  from the *host* project — the `setup/` folder described below. That is what
  makes one package work for any application.
- **Steps are plain `.js` files** running in Node with full filesystem and shell
  access. No build step, no TypeScript required, no framework.
- **It is also a library.** `apps/api` can call `launchSetup()` when it detects
  an unconfigured install. Electron is an *optional* dependency, so importing the
  package on a server costs nothing.

The rest of this document is how to write the `setup/` folder.

---

The wizard has no steps of its own. Every step comes from the **host** project — a
`setup/` folder in your repo root. Drop files in, run `npx @app-galaxy/setup-api`,
and they become the timeline.

```
your-project/
  setup/
    01-npmrc.actions.js
    02-dependencies.commands.js
    03-environment.actions.js
    03-environment.view.form.html
    04-seeds.seeds.js
    04-seeds.view.picker.html
    05-health.actions.js
    05-health.view.report.html
    06-workspace.actions.js
```

## What a real flow looks like

These are the steps shipped in this repo's own [`setup/`](../../../../setup)
folder. They are ordinary files — copy them, delete them, reorder them.

| # | Step | Kind | Check | Heals by | Escalates with |
| --- | --- | --- | --- | --- | --- |
| 01 | Configure `.npmrc` | `actions` | `@app-galaxy:registry` present | writing the registry lines | "I fixed it" / skip |
| 02 | Install dependencies | `commands` | `node_modules/.package-lock.json` exists | `npm install` | — (a failure stops the run) |
| 03 | Set up environment | `actions` | `APP_SECRET` + `DB_TYPE` set | generating `APP_SECRET` | SQLite / a **form view** / skip |
| 04 | Load seed data | `seeds` | `count()` > 0 | running `*.seed.js` | a **file picker view** / skip |
| 05 | Check API health | `actions` | `/api/health/*` answer | waiting 15s for boot | retry / a **report view** / skip |
| 06 | Verify the Nx workspace | `actions` | `nx show projects` resolves | `nx reset` | retry / skip |

Read top to bottom, that is a story:

1. **01 heals silently.** No `.npmrc`, so the wizard writes one and moves on. The
   badge reads *Passed · auto-healed*. The user never had to do anything.

2. **02 is just shell.** `check` exits non-zero, `heal` runs `npm install`, output
   streams into the step's log live. No JavaScript was written to make that work.
   It has no `escalate`, so if npm truly fails the step goes red and **the run
   stops** — every later step assumes `node_modules` exists.

3. **03 heals *half* the problem.** It generates `APP_SECRET` on its own, because
   a secret can be invented. It cannot invent a database, so `check` fails a
   second time and the wizard escalates: *Use SQLite*, *Configure a server…*, or
   *Skip*. Choosing "Configure" opens `03-environment.view.form.html` as a modal
   second screen, prefilled with the current `.env`. Saving hands those values
   back to `onChoice` as the payload, which writes them and re-checks.

   Note what 03 does when `DB_TYPE` is *already* set: it asks whether to replace
   it, rather than clobbering. See [Never clobber](#never-clobber-what-you-did-not-write).

4. **04 cannot know it succeeded.** With no `count()`, there is nothing to
   re-check, so `onChoice` returns `{ accept: true }` after running the file the
   user picked — or `{ skip: true }` if they skipped. Both are honest; neither
   pretends a check passed.

5. **05 waits, then asks.** `nx serve` is often still booting, so `heal` polls
   `/api/health/alive` for 15 seconds. It deliberately does **not** start the
   server: a process spawned here would outlive the wizard and nobody would own
   it. If the API is still down, it escalates with the command to run.

   It reads `API_PORT` from the *project's* `.env` via `ctx.readEnv()`, not from
   `process.env` — the wizard's own environment knows nothing about the project.

6. **06 is the sign-off.** It resolves the Nx project graph, and on success logs
   the URLs and demo credentials into its own step log. `heal` runs `nx reset`,
   because a half-written cache from an interrupted install is the usual cause.

The whole run is *auto-run → self-heal → escalate*. The user is interrupted
exactly twice — once for a decision only they can make (the database) and once
for something the wizard cannot do for them (start the API). Everything else
either heals itself or ends with a green badge and a copy-pasteable command.

## The rules

**A step is a filename stem.** `03-environment.actions.js` and
`03-environment.view.form.html` are one step with one view named `form`.

**Leading digits set the order.** Stems without them sort last, alphabetically.

**One definition file per stem.** Two (`x.actions.js` + `x.commands.js`) is an
error, not a merge. A view whose stem has no definition file is also an error —
that is nearly always a typo in the stem.

## The lifecycle

Every step runs the same loop. This is the whole model:

```
check() ──ok──────────────────────────────────► passed
   │
  fail
   │
heal() ──► check() ──ok────────────────────────► passed (auto-healed)
   │                │
   │               fail
   │                │
   └──────────► escalate() ──► user picks ──► onChoice() ──► check() ──► passed
                                                                 │
                                                          3 tries │ failed
```

A failing step stops the run. Later steps almost always depend on earlier ones.

## `*.actions.js` — full control

```js
const { randomBytes } = require('node:crypto');

/** @type {import('@app-galaxy/setup-api').StepDefinition} */
module.exports = {
  title: 'Set up environment',
  description: 'Create the root <code>.env</code>.', // trusted markup

  async check(ctx) {
    const env = await ctx.readEnv();
    return env['APP_SECRET'] ? { ok: true, note: 'secret present' } : { ok: false };
  },

  async heal(ctx) {
    await ctx.writeEnv({ APP_SECRET: randomBytes(32).toString('hex') });
    ctx.log('heal', 'generated APP_SECRET');
  },

  // Only reached if check() still fails after heal(). Throwing in heal() is fine.
  async escalate(ctx) {
    return {
      title: 'Which database?',
      message: 'Pick a driver. <code>sqlite</code> needs no server.',
      docsUrl: 'https://example.com/db',
      choices: [
        { id: 'sqlite', label: 'Use SQLite', kind: 'primary' },
        { id: 'server', label: 'Configure…', kind: 'line', view: 'form', viewData: { hint: 1 } },
        { id: 'skip', label: 'Skip for now', kind: 'soft' },
      ],
    };
  },

  async onChoice(choiceId, payload, ctx) {
    if (choiceId === 'skip') return { skip: true };
    if (choiceId === 'sqlite') await ctx.writeEnv({ DB_TYPE: 'sqlite' });
    // return nothing -> the runner re-runs check(). The user must really have fixed it.
  },
};
```

`onChoice` return values:

| Return | Meaning |
| --- | --- |
| *nothing* | Re-run `check()`. The default, and the honest one. |
| `{ skip: true }` | User opted out. Counted as skipped, run continues. |
| `{ accept: true }` | Pass without re-checking. For success you cannot observe. |

## `*.commands.js` — declarative shell

No JavaScript. Exit code `0` from `check` means satisfied.

```js
/** @type {import('@app-galaxy/setup-api').CommandsModule} */
module.exports = {
  title: 'Install dependencies',
  description: 'Pull every package into <code>node_modules</code>.',
  check: "node -e \"require('fs').accessSync('node_modules/.package-lock.json')\"",
  heal: 'npm install --legacy-peer-deps',
};
```

Both fields accept a string or an array of strings; every command must succeed.
Commands run in `projectDir` with output streamed live into the step's log.

## `*.seeds.js` — seed runner

```js
/** @type {import('@app-galaxy/setup-api').SeedsModule} */
module.exports = {
  title: 'Load seed data',
  dir: 'apps/api/src/seeds',   // files matching *.seed.js
  view: 'picker',              // <stem>.view.picker.html
  async count(ctx) { return countRows(); },   // optional
};
```

Without `count()` the step can never report itself satisfied, so it always tries
to seed and escalates when no file resolves. Add a `count()` that queries your
database and the step passes silently once data exists. Each seed file should
export a function; it receives the `ctx`.

## `*.view.<name>.html` — the second screen

A choice with `view: 'form'` opens `<stem>.view.form.html` as a **modal window**.
It is a plain, self-contained HTML file. It gets one global, `window.galaxyView`:

```html
<script>
  const view = window.galaxyView;

  view.data;              // whatever the choice's `viewData` held
  view.resolve(values);   // closes the window; `values` becomes onChoice's payload
  view.cancel();          // closes it; the user can pick again
</script>
```

Closing the window by hand behaves like `cancel()` — the escalation panel
re-enables so the user can choose something else. It never hangs the step.

Views run with `contextIsolation: true`, no Node integration, and `webSecurity`
on. Inline `<style>` and `<script>` are allowed; network requests are not
(`connect-src 'none'`). Talk to the app through `galaxyView`, not over the wire.

## Branding: drop in a logo

Put an image in `setup/` and it becomes the window icon on boot — the wizard, the
splash, and every second screen. Nothing to configure.

```
setup/
  logo.png     ← picked up automatically
```

Names are tried in order `logo`, `icon`, `app-icon`, case-insensitively. Formats
are `.png`, `.jpg`, and — **on Windows only** — `.ico`, which wins over a `.png`
even under a lower-ranked name because it carries the multiple sizes the taskbar
and title bar want.

Two things that are quietly easy to get wrong:

- **SVG does not work.** It cannot be decoded. If `logo.svg` is the only image
  present, the wizard logs a warning telling you to export a `.png` rather than
  silently starting with no icon.
- **A file that exists is not a file that decodes.** A truncated download or a
  `.png` that is really an SVG is rejected too, with its own warning.

Because `setup/` is served, the logo is also reachable at
`http://127.0.0.1:3334/setup/logo.png` — handy if you want it in one of your own
`*.view.*.html` screens.

### Docking it as a sidebar

```bash
npx @app-galaxy/setup-api --sidebar
npx @app-galaxy/setup-api --sidebar=true --sidebar-width 600
```

The window docks against the **right edge** of the primary display's work area,
full height, and stays on top. Handy for following the run beside your editor.
Width defaults to 520px, is clamped to at least 320 (below which the timeline
stops being readable) and never exceeds the display. It re-docks automatically if
the resolution changes or a monitor is unplugged.

**What it is not:** a real OS sidebar. Reserving a strip of the desktop so
maximized windows sit *beside* it needs the Windows AppBar API
(`SHAppBarMessage`), which Electron does not expose. So a maximized window will
be covered by the sidebar rather than shrink to make room. `alwaysOnTop` keeps it
visible, which is the closest thing available.

`--sidebar=false`, `--no-sidebar`, and simply omitting the flag all centre the
window as usual. Anything other than a boolean (`--sidebar=maybe`) is an error.

### Naming the app

The wizard calls itself **Galaxy Setup**. Rename it per host:

```bash
npx @app-galaxy/setup-api --name "Acme Bootstrap"
```

That sets the window title, the taskbar entry, and `app.getName()`. The page's
own `<title>` is deliberately *not* allowed to override it.

**One place the name stays "Electron", and it is not fixable from here:** the
Windows firewall and UAC prompts. Those read the `ProductName` baked into the
running `.exe`'s version resource. For an `npx`-launched wizard that binary is
Electron's own prebuilt `electron.exe`, and nothing an app does at runtime can
rewrite it. The fix is to *package* the wizard — `electron-builder` stamps
`productName` into the executable. See `src/electron/options/maker.options.json`.

(You should rarely see a firewall prompt anyway: the built-in server binds
`127.0.0.1`, and Windows does not prompt for loopback-only listeners.)

## The `ctx` object

Steps run in the main process with full Node access — they are your code. `ctx`
is a convenience layer, not a sandbox.

| Member | Notes |
| --- | --- |
| `ctx.projectDir` / `ctx.setupDir` | Absolute paths. |
| `ctx.log(level, message)` | `info` `ok` `warn` `heal` `attn`. Shows in the step log. |
| `ctx.exec(cmd, { cwd })` | Shell, in `projectDir` by default. Streams output to the log. Resolves `{ code, stdout, stderr }` — it does **not** throw on a non-zero exit. |
| `ctx.exists(p)` / `ctx.list(p, /re/)` | Relative to `projectDir`, or absolute *inside* it. Escaping it throws. `list` returns absolute paths. |
| `ctx.readEnv()` / `ctx.writeEnv(values, opts)` | Root `.env`. Preserves comments and key order. **Never replaces an existing value** unless `{ overwrite: true }`. |
| `ctx.openView(name, data)` | Opens a view directly, outside an escalation. |

## Never clobber what you did not write

The wizard runs against projects it did not create. `ctx.writeEnv()` adds keys
that are missing, leaves keys that already hold the same value, and **refuses**
to replace a key whose value differs — reporting it instead:

```js
const { written, unchanged, conflicts } = await ctx.writeEnv({ DB_TYPE: 'sqlite' });

if (conflicts.length) {
  // conflicts: [{ key: 'DB_TYPE', existing: 'postgres', incoming: 'sqlite' }]
  // Don't force it. Escalate and let the user decide.
}
```

Ask first, then insist. `{ overwrite: true }` is for the branch the user
explicitly chose, and even then the old file is copied to `.env.backup`:

```js
async escalate(ctx) {
  const env = await ctx.readEnv();
  if (env['DB_TYPE']) {
    return {
      title: `Replace the existing DB_TYPE (${env['DB_TYPE']})?`,
      message: 'Overwriting keeps a copy at <code>.env.backup</code>.',
      choices: [
        { id: 'keep',  label: 'Keep what I have', kind: 'primary' },
        { id: 'force', label: 'Replace it',       kind: 'line' },
      ],
    };
  }
  /* … */
},

async onChoice(choiceId, payload, ctx) {
  if (choiceId === 'keep')  return { accept: true, note: 'kept your values' };
  if (choiceId === 'force') await ctx.writeEnv({ DB_TYPE: 'sqlite' }, { overwrite: true });
},
```

The same instinct applies to files you write yourself: check `ctx.exists()` and
escalate rather than truncating.

## Gotchas

- **`title` and `description` are inserted as markup** so you can use `<code>`.
  They come from your files. Command output never is — it is always escaped.
- **`ctx.exec` does not throw on failure.** Check `result.code` yourself. In a
  `heal`, throwing is the way to escalate.
- **Don't write secrets into files you commit.** `ctx.writeEnv` writes `.env`,
  which should be gitignored. Auth tokens belong in your shell profile or CI.
- **The wizard serves on `127.0.0.1:3334`** (3333 is the Galaxy api). Override
  with `--port`.

## Running a subset

While writing a step you rarely want the whole plan. `--use` narrows, `--skip`
subtracts, and both accept a step id, a filename, or the id without its number:

```bash
npx @app-galaxy/setup-api --use 06-workspace
npx @app-galaxy/setup-api --use=06-workspace.actions.js
npx @app-galaxy/setup-api --use="[04-seeds.seeds.js, 06-workspace.actions.js]"
npx @app-galaxy/setup-api --use workspace          # number optional
npx @app-galaxy/setup-api --skip=02-dependencies   # everything but the install
npx @app-galaxy/setup-api --use=[01,02] --skip=02  # --skip subtracts from --use
```

Two behaviours worth relying on:

- **Selected steps always run in plan order**, never the order you list them.
  `--use=06,02` runs 02 first, because 06 probably depends on it.
- **An unknown name is an error**, in `--skip` as much as in `--use`. A typo'd
  `--skip=dependancies` that silently ran the install would be worse than a stop.

Filtering happens before the step files are `require`d, so `--use=06-workspace`
still works when step 02 has a syntax error.

## Running steps in parallel

The plan is sequential by design: step 06 usually needs what step 02 wrote. But
some steps are genuinely independent — an API health check and a frontend health
check have nothing to say to each other, and waiting for one to finish before
starting the other just makes the run slower.

Tag such steps with a shared **`group`** label and enable parallelism, and they
fire at once:

```js
// setup/05-api-health.commands.js
module.exports = {
  title: 'Check API health',
  group: 'health',
  check: "curl -fsS http://localhost:3333/api/health/alive",
};

// setup/06-frontend-health.commands.js
module.exports = {
  title: 'Check frontend health',
  group: 'health',
  check: "curl -fsS http://localhost:4200",
};
```

```bash
npx @app-galaxy/setup-api --parallel
```

Or turn it on in code — it is a setting like any other:

```js
launchSetup({ projectDir: '.', parallel: true });
```

`group` works on `*.actions.js` and `*.commands.js` steps alike.

Three rules keep it honest:

- **It is opt-in.** Without `--parallel` (or `parallel: true`) the `group` labels
  are ignored and everything runs one step at a time, exactly as before.
- **Only *adjacent* steps batch.** A group is a maximal run of neighbouring steps
  that share the label, so plan order still holds — a grouped step never jumps
  ahead of the ungrouped steps between it and its group. Keep the members of a
  group next to each other.
- **A failure still stops the run**, but the batch's already-running siblings are
  allowed to finish first; the *next* batch is what gets cut off. Leave the label
  off any step a later step depends on.

Inside a batch the steps' logs and status badges update together — that
interleaving is what "in parallel" looks like on the timeline.

## Grouping sub-steps: `*.group.js`

The `group` label above is the *lightweight* way to run siblings together. When a
set of checks really belongs to one idea — "the app is healthy", "the database is
ready" — promote them to a **group step**: one parent row on the timeline that
*contains* its children and rolls up their status.

A group is authored as `NN-name.group.js`:

```js
/** @type {import('@app-galaxy/setup-api').GroupModule} */
module.exports = {
  title: 'Health checks',
  mode: 'parallel',        // 'parallel' | 'sequence' (default: 'sequence')
  steps: [
    { key: 'api',      title: 'Check API health',      check: 'curl -fsS http://localhost:3333/api/health/alive' },
    { key: 'frontend', title: 'Check frontend health', check: 'curl -fsS http://localhost:4200' },
  ],
};
```

Each entry in `steps` is one of the same three shapes you already know — a full
`StepDefinition` (a function `check`, plus `heal`/`escalate`), a declarative
`CommandsModule` (a string `check`), or a `SeedsModule` (no `check`). They can
heal and escalate exactly like top-level steps.

On the timeline the group draws as a bordered box: a parent header with a
`⇄ in parallel` / `≡ in sequence` chip and a rolled-up badge (`2/2 passed`), and
its children indented beneath it.

```
≡  Health checks              in parallel        2/2 passed
   ├─ ○ Check API health                         Passed ✓
   └─ ○ Check frontend health                    Passed ✓
●  Verify workspace                              Queued
```

Rules:

- **`mode` is the group's own contract**, honoured regardless of `--parallel`.
  `parallel` fires the children at once; `sequence` runs them in order and stops
  at the first failure. (`--parallel` still governs the *implicit* batching of
  same-`group`-label top-level steps — the two are independent.)
- **A child's id is `parent/key`** (`05-health/api`). Without a `key` it falls
  back to the child's position (`05-health/0`), so give long-lived children a
  `key` — reordering the list would otherwise rename them.
- **The parent fails if any child fails**, and a failing group stops the run like
  any other failure. Children count toward the "N checks" total; the parent does
  not.
- **Children have no view files.** A child that needs a second screen should be a
  top-level step instead — inline group children are for self-contained checks.

Reach for a group when the children share a purpose and you want one line that
says whether that purpose is met; reach for a bare `group` label when you just
want two independent steps to run at the same time.

## Exporting a report

`--report` writes a Markdown record of the run to
`setup/reports/<timestamp>-setup.md`:

```bash
npx @app-galaxy/setup-api --report
npx @app-galaxy/setup-api --report=./setup-run.md   # anywhere you like
```

It contains the summary table, per-step status, duration, which steps needed you,
and the full log of every step — the same events the UI drew, so the two can
never disagree. Handy for pasting into an issue when someone's setup misbehaves.

The report is written even when a step fails; a run you kill halfway is marked
**incomplete** rather than pretending to be a clean bill of health. Add
`setup/reports/` to your `.gitignore`.

## Try it

```bash
npx @app-galaxy/setup-api --dir . 
```

`--dev` opens devtools on both the wizard and any view window. See the working
example in this repo's own [`setup/`](../../../../setup) folder.
