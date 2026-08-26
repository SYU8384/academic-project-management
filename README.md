# Academic Project Management Skill

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Install with bash or PowerShell](https://img.shields.io/badge/install-bash%20%2F%20PowerShell-0f766e.svg)](#quick-start)
[![Markdown PM folders](https://img.shields.io/badge/docs-Markdown%20%2B%20Obsidian-2563eb.svg)](#the-pm-folder)

**A lab notebook that never forgets.** Keep literature, evidence, analysis, writing, meetings, decisions, and history in sync — in plain Markdown folders you own.

Use it for one research work unit or a connected body of work. Each meaningful session updates the live state, indexes, and history, so the next person or agent can pick up without archaeology.

## 🧭 One project or a research program

| Use this | When you need it | It owns |
|---|---|---|
| **Research Project PM** | One article, chapter, study, grant, or other independent work unit | Its question, evidence, analysis, writing, status, history, and manuscript-home routing |
| **Research Program PM** *(optional)* | Several projects share research infrastructure | Shared Coding Rules, Data provenance, meetings, participant roster, and idea Inbox |

```text
Research Program PM (optional)
├── shared Coding Rules · Data · meetings · Inbox
├── Research Project PM — Chapter 1
├── Research Project PM — Chapter 2
└── Research Project PM — Case study
```

For example, a dissertation can use one Program PM for shared data and advisor meetings while each chapter keeps independent analysis and writing state. See [the program recipes](./EXAMPLES.md#recipe-8-register-and-manage-a-research-program) and [conversion guidance](./REFERENCE.md#safe-conversion-from-a-standalone-project) for the exact commands.

New registrations use `programs`, `program_id`, `work_id`, and `work_type`. Existing `series`, `series_id`, `paper_id`, and `manage-paper-series.mjs` setups remain valid; nothing is silently converted.

## ✨ Why it helps

- **Durable research memory** — a current answer to “where are we?” instead of scattered chats and email.
- **Two folders, one route** — research state in the PM folder; LaTeX, code, figures, and replication artifacts in the manuscript home, linked by `AGENTS.md`.
- **Useful from day one** — works for brainstorming and literature review before a manuscript exists.
- **Built to stay navigable** — validates drift, repairs indexes, records decisions, and supports close-out and reorganization checks.
- **Obsidian optional** — Markdown plus a small local `projects.json` registry works anywhere.

<a id="quick-start"></a>

## 🚀 Quick Start

### Path A — OpenClaw PM agent

Paste this to an OpenClaw agent:

```text
Read https://raw.githubusercontent.com/SYU8384/academic-project-management/main/openclaw-instruction.md and follow its instructions.
```

It installs the skill, configures its workspace, and guides project setup.

### Path B — macOS / Linux / WSL / Git Bash

```bash
curl -fsSL https://raw.githubusercontent.com/SYU8384/academic-project-management/main/install.sh | bash
```

For a non-interactive install, use `bash -s -- --target agents --yes`. Targets: `agents`, `codex`, `claude`, `openclaw`, or `--dest <path>`.

### Path C — native Windows PowerShell

```powershell
$installer = Join-Path $env:TEMP "academic-project-management-install.ps1"
Invoke-WebRequest -UseBasicParsing -Uri "https://raw.githubusercontent.com/SYU8384/academic-project-management/main/install.ps1" -OutFile $installer
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installer -Target agents -Yes
```

`git` must be on PATH. Re-run either installer to update.

## 🎯 Tell your agent

| Say | What happens |
|---|---|
| `set up this project` | Creates and registers a Research Project PM. |
| `set up a research program` / `register my chapters` | Creates shared infrastructure for independent Research Projects. |
| `adopt this project into a program` | Adds an existing project safely; bridge adoption never moves files. |
| `log this` / `I just finished the regression` | Updates current state and creates a dated history entry. |
| `verify setup` / `check PM` | Audits the structure and routing without changing anything. |
| `repair PM` / `fix indexes` | Detects drift, shows proposed repairs, then asks before editing. |

The full routing map is in [SKILL.md](./SKILL.md); detailed setup, validation, and conversion rules are in [REFERENCE.md](./REFERENCE.md).

<a id="the-pm-folder"></a>

## 🗂️ The PM folder

`README.md` routes work · `RESEARCH.md` captures the question and claims · `CURRENT_STATUS.md` is the live snapshot · `literature/`, `evidence/`, `analysis/`, and `writing/` hold active research state · `meetings/`, `planning/`, and `history/` retain decisions and continuity · `archive/` holds superseded material. Optional lanes such as `verification/`, `submissions/`, and `ethics/` appear only when needed.

## 🧰 Maintainer Corner

| Path | Purpose |
|---|---|
| [SKILL.md](./SKILL.md) | Agent entry point and routing rules. |
| [REFERENCE.md](./REFERENCE.md) | Detailed model, setup, validation, and compatibility reference. |
| [EXAMPLES.md](./EXAMPLES.md) | End-to-end project and program recipes. |
| [scripts/](./scripts/) | Dependency-free Node tools, including bootstrap, validator, program manager, migration, close-out, and reorganization checks. |
| [templates/](./templates/) | Canonical PM and Research Program templates. |
| [scripts/test/](./scripts/test/) | Self-test suite: `node scripts/test/run-tests.mjs`. |

## 📄 License

MIT. See [LICENSE](./LICENSE).