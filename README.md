# Academic Project Management Skill

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Install with bash](https://img.shields.io/badge/install-bash-0f766e.svg)](#quick-start)
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
- 🧹 **Self-cleaning** — the validator checks structure, indexes, wiki links, stale status, and AGENTS.md drift; repair fixes drift, and a sync script keeps both OpenClaw workspace and manuscript-home `AGENTS.md` sections current.
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

For Codex, Claude, or another coding agent:

```bash
curl -fsSL https://raw.githubusercontent.com/SYU8384/academic-project-management/main/install.sh | bash
```

With a TTY, the installer shows an interactive menu; without one, pass a target explicitly: `bash -s -- --target agents --yes`. Targets: `agents`, `codex`, `claude`, `openclaw`, or `--dest <path>`. Re-run the same command to update (default channel is the stable `v1` ref; `--channel main` for bleeding edge).

## 🎯 Triggers

If you went through Path A (OpenClaw), the agent handles setup, repair, and logging autonomously — you don't need any of these. If you went through Path B, after install + first setup the project lives at `<pm_folder>` and `projects.json` lives at `~/.config/academic-pm/projects.json`. Restart your coding agent and say:

| Say | What happens |
|---|---|
| `set up this project` | Asks a few questions, then bootstraps the PM folder and registers the project. |
| `log this` / `I just finished the regression` | Creates a dated history entry and updates `CURRENT_STATUS.md`. |
| `verify setup` / `check PM` | Runs the validator and reports findings without changing anything. |
| `repair PM` / `fix indexes` | Detects drift, shows what will be fixed, asks confirmation. |
| `set up OpenClaw PM` | Shows the copy-paste prompt for OpenClaw workspace setup. |

The full routing table is in `SKILL.md`; deep workflow details are in `REFERENCE.md`.

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
| [`install.sh`](./install.sh) | Curl-friendly installer for agents, Codex, Claude, OpenClaw; rerun to update. |
| [`openclaw-instruction.md`](./openclaw-instruction.md) | Copy-paste instruction for bootstrapping an OpenClaw PM agent. |
| [`scripts/`](./scripts/) | Dependency-free Node scripts: `bootstrap-academic-pm.mjs` (bootstrap/repair/log), `check-academic-pm.mjs` (validator), `sync-agents-section.mjs` (manuscript-home AGENTS.md), `sync-openclaw-apm-section.mjs` (OpenClaw workspace AGENTS.md). |
| [`templates/`](./templates/) | Canonical templates for root files, lane notes, and AGENTS.md sections. |
| [`scripts/test/`](./scripts/test/) | Self-test suite: `node scripts/test/run-tests.mjs`. |

## 📄 License

MIT. See [LICENSE](./LICENSE).
