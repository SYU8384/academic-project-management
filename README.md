# Academic Project Management Skill

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Install with bash or PowerShell](https://img.shields.io/badge/install-bash%20%2F%20PowerShell-0f766e.svg)](#quick-start)
[![Markdown PM folders](https://img.shields.io/badge/docs-Markdown%20%2B%20Obsidian-2563eb.svg)](#pm-folder-model)

**A lab notebook that never forgets.** Your agent keeps research state — literature, evidence, analysis, writing, meetings, decisions, history — in sync as work happens, all in plain Markdown, in a folder you own.

The important part is behavioral: when meaningful research happens, the agent updates the right current-state docs, lane indexes, and history logs *in the same session*. Months later, a new session — or a new agent — reads the folder and knows exactly where the project stands. No archaeology through chat logs and email threads.

## 🧠 Why This Exists

Agents have no memory beyond the session, and academic memory decays in predictable ways: papers read months ago fade, citation gaps accumulate, the manuscript drifts from the analysis code, advisor feedback dies in email threads, and nobody remembers why a method was chosen or a dataset excluded. Meanwhile a coding agent opening your LaTeX/analysis folder has no way to discover the research state at all. This skill gives your project one strict, repeatable operating model, so any agent, on any machine, picks up exactly where the last session left off.

## ✨ Highlights

- 🧭 **Productive in minutes** — say `set up this project`; the agent bootstraps the PM folder, registers it, and wires up `AGENTS.md`. No workflow to learn.
- 📝 **The memory loop** — when work ships, the agent updates current-state docs, lane indexes, and an outcome-first history entry in the same session. "Where are we?" is always answered.
- 📚 **Literature stays honest** — reading queue, paper notes, synthesis, and citation gaps live in `literature/`; evidence provenance and measurement definitions live in `evidence/`.
- 🔗 **Two folders, one wire** — research state in the PM folder, LaTeX/code in the manuscript home; a managed `## Academic PM folder` section in the manuscript home's `AGENTS.md` routes coding and writing agents to the state.
- 🌱 **Manuscript optional** — the PM folder works standalone for brainstorming, literature review, grant writing, and planning. Add a manuscript home when you're ready.
- 🧹 **Self-cleaning** — the validator checks structure, indexes, wiki links, stale status, and AGENTS.md drift; repair fixes drift; sync scripts keep both OpenClaw workspace and manuscript-home `AGENTS.md` sections current; a close-out guard stops manuscript work from shipping without PM updates; a read-only reorg detector keeps a year of growth navigable.
- 🔗 **Obsidian-optional** — as an Obsidian vault, every note is structured and interlinked. But the convention is just Markdown plus a small local `projects.json` registry; it works anywhere.

## 🤝 Plays well with academic-writer

This skill owns **research memory**: status, evidence trails, meeting notes, folder maintenance. Use [`academic-writer`](https://github.com/SYU8384/academic-writer) for **manuscript drafting**: LaTeX editing, revision prose, citation insertion, PDF compilation. When manuscript state changes, update `writing/` in the PM folder — never duplicate the manuscript itself.

<a id="quick-start"></a>

## 🚀 Quick Start

Pick the path that matches how you use the skill.

### Path A — OpenClaw PM agent (recommended for PM-domain work)

OpenClaw PM agents live in your chat, not in your repo — brainstorming, capturing meetings and decisions, tracking progress across projects. Paste this to your OpenClaw agent:

```text
Read https://raw.githubusercontent.com/SYU8384/academic-project-management/main/openclaw-instruction.md and follow its instructions.
```

The agent handles the rest — installing the skill, creating `~/.config/academic-pm/projects.json`, configuring its workspace `AGENTS.md`, and running guided setup for each project.

### Path B — Coding agent on macOS / Linux / WSL / Git Bash

Use this path for Codex, Claude, or another coding agent when your shell can run POSIX `bash`. These `curl | bash` commands do **not** run in native Windows PowerShell or `cmd.exe`; use [Path C](#path-c--coding-agent-on-native-windows-powershell) there.

```bash
curl -fsSL https://raw.githubusercontent.com/SYU8384/academic-project-management/main/install.sh | bash
```

With a TTY, the installer shows an interactive menu; without one, pass a target explicitly: `bash -s -- --target agents --yes`. Targets: `agents`, `codex`, `claude`, `openclaw`, or `--dest <path>`. Re-run the same command to update (default channel is the stable `v1` ref; `--channel main` for bleeding edge).

### Path C — Coding agent on native Windows PowerShell

Use this path from PowerShell 5.1 (Windows 10 default) or PowerShell 7+:

```powershell
$installer = Join-Path $env:TEMP "academic-project-management-install.ps1"
Invoke-WebRequest -UseBasicParsing -Uri "https://raw.githubusercontent.com/SYU8384/academic-project-management/main/install.ps1" -OutFile $installer
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installer -Target agents -Yes
```

The installer needs `git` on PATH (ships with Git for Windows). The temp-file path keeps the command working even if PowerShell opens in `C:\WINDOWS\system32`; the process-scoped execution-policy bypass is only for this run. Targets are `agents` (`%USERPROFILE%\.agents\skills\academic-project-management`), `codex`, `claude`, `openclaw`, or `-Dest <skills-dir>` for a custom parent skills directory.

## 🎯 Triggers

If you went through Path A (OpenClaw), the agent handles setup, repair, and logging autonomously — you don't need any of these. If you went through Path B or Path C, after install + first setup the project lives at `<pm_folder>` and `projects.json` lives at `~/.config/academic-pm/projects.json`. Restart your coding agent and say:

| Say | What happens |
|---|---|
| `set up this project` | Asks a few questions, then bootstraps the PM folder and registers the project. |
| `log this` / `I just finished the regression` | Creates a dated history entry and updates `CURRENT_STATUS.md`. |
| `verify setup` / `check PM` | Runs the validator and reports findings without changing anything. |
| `repair PM` / `fix indexes` | Detects drift, shows what will be fixed, asks confirmation. |
| `set up OpenClaw PM` | Shows the copy-paste prompt for OpenClaw workspace setup. |
| `set up a research program` / `register my chapters` | Creates shared program infrastructure for independent Research Projects. |

The full routing table is in `SKILL.md`; deep workflow details are in `REFERENCE.md`.
## 🧭 Research Project PM and Research Program PM

A **Research Project PM** is the default: one independently managed article, chapter, study, grant, or other work unit. Its optional `work_type` records that label without imposing Paper I/II names.

A **Research Program PM** is an optional shared layer for several projects that use common Coding Rules, Data provenance, meetings, participant roster, or idea Inbox. Each member retains its own status, analysis, writing, history, and manuscript-home routing.

```bash
# Register existing projects in a shared program.
node $SKILL_DIR/scripts/manage-research-program.mjs --action bootstrap \
  --program DissertationProgram --program-folder "$PROGRAM_PM" --vault-root "$VAULT" \
  --shared-manuscript-home "$REPO" --project Chapter1 --project Chapter2

# Safely adopt an existing standalone project: registry only, no moves or copies.
node $SKILL_DIR/scripts/manage-research-program.mjs --action adopt-project \
  --program DissertationProgram --project Chapter3 \
  --work-id chapter-3 --work-type chapter --mode bridge
```

New registrations use `programs`, `program_id`, `work_id`, and `work_type`. Existing `series`, `series_id`, `paper_id`, and `manage-paper-series.mjs` setups remain valid and are never silently rewritten.

<a id="pm-folder-model"></a>

## 🗂️ The PM Folder at a Glance

`README.md` routing map · `RESEARCH.md` question, contribution, claims · `CURRENT_STATUS.md` live snapshot · `literature/` papers, queue, synthesis · `evidence/` sources, provenance, measurement · `analysis/` methods, findings, audits · `writing/` drafts, figures, submission notes · `meetings/` advisor feedback, action items · `planning/` plans and lightweight decisions · `history/` chronological work logs · `archive/` superseded material. Optional lanes (`verification/`, `submissions/`, `ethics/`, …) are created only when needed.

Every lane has a folder-note index; every note links to its neighbors. Full lane descriptions: `REFERENCE.md` and the generated project README.

## 🏠 Manuscript Home at a Glance

Academic projects have a **two-folder problem**: the PM folder holds research state; the manuscript home holds executable artifacts (LaTeX, analysis code, figures). A coding agent opening the manuscript home can't find the PM folder on its own — so the bootstrap manages a marker-delimited `## Academic PM folder` section in `<manuscript_home>/AGENTS.md` that routes agents to the research state. Append-safe, idempotent, and never touching content outside the markers. No manuscript yet? Skip it; add one later by re-bootstrapping with `--manuscript-home`.

## 🧰 Maintainer Corner

| Path | Purpose |
|---|---|
| [`SKILL.md`](./SKILL.md) | Agent entry point: intents, triggers, workflows, routing map. |
| [`REFERENCE.md`](./REFERENCE.md) | Deep reference: folder model, setup rules, validation, repair. |
| [`EXAMPLES.md`](./EXAMPLES.md) | End-to-end recipes: bootstrap, log, repair, manuscript home. |
| [`install.sh`](./install.sh) / [`install.ps1`](./install.ps1) | Bash and native PowerShell installers; rerun to update. |
| [`openclaw-instruction.md`](./openclaw-instruction.md) | Copy-paste instruction for bootstrapping an OpenClaw PM agent. |
| [`scripts/`](./scripts/) | Dependency-free Node scripts: `bootstrap-academic-pm.mjs` (bootstrap/repair/log), `check-academic-pm.mjs` (validator), `check-academic-closeout.mjs` (session close-out guard), `check-reorg-candidates.mjs` (read-only reorg detector), `migrate.mjs` (versioned config/schema migrations), `sync-agents-section.mjs` (manuscript-home AGENTS.md), `sync-openclaw-apm-section.mjs` (OpenClaw workspace AGENTS.md), `check-academic-skill.mjs` (skill-repo self-check), `manage-research-program.mjs` (canonical shared-program workflow), and `manage-paper-series.mjs` (legacy compatibility). |
| [`templates/`](./templates/) | Canonical templates for root files, lane notes, meeting records, and AGENTS.md sections. |
| [`scripts/test/`](./scripts/test/) | Self-test suite:
ode scripts/test/run-tests.mjs`. |

## 📄 License

MIT. See [LICENSE](./LICENSE).
