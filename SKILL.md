---
name: academic-project-management
description: "Keeps academic research state in sync: literature, evidence, analysis, writing, meetings, planning, history, and archive. Use when the user asks to set up, initialize, normalize, register, log, update, audit, validate, repair, or organize an academic project; record advisor feedback, data checks, analysis findings, writing progress, revisions, or research decisions; declare a manuscript home and wire its AGENTS.md to the PM folder."
---

# Academic Project Management

Use this skill for durable academic research memory and project coordination. Optimized for paper projects and evidence-heavy research. Use `academic-writer` for manuscript drafting, LaTeX editing, and PDF compilation; use this skill to keep project state, evidence trail, meetings, and history coherent.

For setup details, schema rules, validation, repair, and templates, read [REFERENCE.md](REFERENCE.md). For end-to-end recipes, see [EXAMPLES.md](EXAMPLES.md).

## Trigger Words (User Intents)

Say any of these phrases and the agent will handle the workflow interactively:

| User says | Intent | What the agent does |
|---|---|---|
| **"set up this project"**, **"setup this project"**, **"bootstrap my paper"**, **"initialize the PM folder"** | Guided setup | Asks for project name, PM folder path, research phase, and optional manuscript home. Shows summary, asks confirmation, then bootstraps. |
| **"log this"**, **"record analysis"**, **"I just finished..."**, **"I completed..."** | Log work | Asks for event description and affected notes. Creates history entry and updates CURRENT_STATUS.md. |
| **"verify setup"**, **"check PM"**, **"audit"**, **"validate setup"** | Validate | Runs validator and reports findings (PM folder + manuscript home + AGENTS.md). |
| **"repair PM"**, **"fix indexes"**, **"rebuild folder notes"** | Repair drift | Runs repair action, shows what will be fixed, asks confirmation. |
| **"set up OpenClaw PM"**, **"OpenClaw academic PM"** | OpenClaw setup | Displays the copy-paste prompt for OpenClaw workspace configuration. |

The agent handles the details — you don't need to remember script paths or flags.

## Workflows

### 1. Set up a new project (interactive)

When you say **"set up this project"**, the agent will ask:

1. **Project name** — e.g., "CareerPathsPaper"
2. **PM folder path** — where to create the project folder (default: current directory or `~/vault/<name>`)
3. **Research phase** — choose from:
   - `idea` — Initial concept, no literature review yet
   - `literature` — Active literature review and related-work synthesis
   - `design` — Research design, hypotheses, methods planned
   - `data` — Data collection, cleaning, measurement definition
   - `analysis` — Active analysis, results emerging
   - `analysis-writing` — Parallel analysis and drafting
   - `writing` — Focused manuscript writing
   - `revision` — Addressing reviewer comments
   - `submission` — Preparing submission materials
   - `published` — Paper published, maintenance mode
4. **Manuscript home** (optional) — path to your LaTeX/code repo
5. **Confirmation** — agent shows summary, you approve before anything is created

The agent then runs the bootstrap script and reports what was created.

### 2. Log completed work

When you say **"log this"** or **"I just finished the regression analysis"**, the agent will:

1. Ask which notes were affected (e.g., `analysis/regression.md`)
2. Create a dated history entry in `history/`
3. Update `CURRENT_STATUS.md` Recent Progress section
4. Update lane indexes to link back to the history entry

### 3. Record an advisor meeting

Put the note in `meetings/`, extract action items into `CURRENT_STATUS.md`, update `planning/`, `analysis/`, or `writing/` if feedback changes active work. Keep raw advisor feedback verbatim.

### 4. Track data or reproducibility work

Source registries, dataset provenance, audit reports, verification reports, and reproducibility decisions go in `evidence/` or `analysis/`. Keep raw sensitive data out of the PM folder unless `README.md` explicitly permits it.

### 5. Declare the manuscript home and wire AGENTS.md

When the project has a manuscript + analysis-code folder, declare it during setup or re-bootstrap with the manuscript home path. The bootstrap script appends or refreshes a managed `## Academic PM folder` section in `<manuscript_home>/AGENTS.md` that routes both the LaTeX-writing agent and the analysis-coding agent at this PM folder.

## Default Paper Pipeline

```text
<Project>.md or existing folder note    # Obsidian landing page
README.md                              # routing rules + conventions
RESEARCH.md                            # question, contribution, claims, scope, venue
CURRENT_STATUS.md                      # phase, priorities, blockers, progress
literature/  evidence/  analysis/  writing/
meetings/  planning/  history/  archive/
```

Each lane has a `<lane>/<lane>.md` folder note with an Obsidian-compatible index (see REFERENCE.md). Optional folders (`docs/`, `submissions/`, `admin/`, `ethics/`, `collaboration/`) are preserved when present and created only when needed.

## Route Information

| Information | Goes to |
|---|---|
| Research question, contribution, hypotheses, scope, target venue | `RESEARCH.md` |
| Current phase, priorities, blockers, recent progress, next actions | `CURRENT_STATUS.md` |
| Paper notes, reading queue, related-work synthesis, citation gaps | `literature/` |
| Dataset/source registry, provenance, measurement definitions, data risks | `evidence/` |
| Methods, audits, verification reports, reproducibility checks, findings | `analysis/` |
| Outline, draft status, figures, tables, submission/revision notes | `writing/` |
| Advisor/collaborator meetings, feedback, action items | `meetings/` |
| Concrete next-work plans and research decisions | `planning/` |
| Brief chronological completed-work logs | `history/` |
| Superseded notes, old plans, retired drafts | `archive/` |
| Manuscript source, analysis code, figures, configs, replication artifacts | `<manuscript_home>` (declared in `projects.json`) |
| Coding/writing-agent routing contract (when `manuscript_kind = git-repo`) | `<manuscript_home>/AGENTS.md` (`## Academic PM folder` section) |

Always read the project `README.md` first. If it defines different routing, it wins over this generic map.

The PM folder is for research state; the manuscript home is for executable artifacts. When the manuscript home is a git repo, its `AGENTS.md` is the entry point for any coding or writing agent; it defers to the PM folder's `README.md` and this skill for any state change. There is no separate code repo `AGENTS.md` — the manuscript and the code share one folder and one routing contract.

## Templates

The `templates/` directory holds the canonical source files for what the bootstrap script writes into a new PM folder. Each lane-specific template carries prompts (`## Reading Queue` for literature, `## Open Action Items` for meetings, `## Active Plans` for planning, etc.) that guide the user to fill in the right content.

- **Read on every bootstrap** (the script uses these): `root-note.md` → `<Project>.md`, `README.md` → `README.md`, `RESEARCH.md` → `RESEARCH.md`, `CURRENT_STATUS.md` → `CURRENT_STATUS.md`, and the 8 lane templates (`literature.md`, `evidence.md`, `analysis.md`, `writing.md`, `meetings.md`, `planning.md`, `history.md`, `archive.md`) → their respective lane notes. `AGENTS_ACADEMIC_PM_SECTION.md` is the manuscript-home routing section, also written by the script.
- **Documentation-only** (read by humans, not by the script): `folder-note.md` (an older lane-note factory, kept as a reference for what a lane note looks like), and `projects.template.json` (a reference of the `projects.json` schema).

After bootstrap, all 12 created files (3 root files + `<Project>.md` + 8 lane notes) are **user-owned** — re-running the script never clobbers them.

## Quick Health Check

One command validates a registered project's PM folder + manuscript home + AGENTS.md:

```bash
node <skill_dir>/scripts/check-academic-pm.mjs --project <ProjectName>
```

For a folder you've never registered, use `--path <folder>` instead. Add `--strict` to fail on warnings; add `--json` for machine-readable output.

## Commands

These are the underlying commands the agent runs when you use trigger words. You can also run them directly if you prefer:

Bootstrap a project (idempotent — re-running refreshes `projects.json` and the `AGENTS.md` section without touching existing notes):

```bash
node <skill_dir>/scripts/bootstrap-academic-pm.mjs \
  --project <ProjectName> --pm-folder <academic-pm-folder> --phase <phase> \
  [--config <path>] \
  [--notes "<one-line summary>"] \
  [--manuscript-home <path>] [--manuscript-kind git-repo|local-folder|null] \
  [--manuscript-access authoritative|read-only|none] [--no-agents-md]
```

`--config` defaults to `~/.config/academic-pm/projects.json`. `--notes` is optional; if omitted, a default one-line summary (`<ProjectName> academic research project.`) is used.

Validate (PM folder, projects.json, manuscript home, and AGENTS.md in one pass):

```bash
node <skill_dir>/scripts/check-academic-pm.mjs --project <ProjectName>
```

Repair structural drift (missing folder notes, stale indexes):

```bash
node <skill_dir>/scripts/bootstrap-academic-pm.mjs \
  --project <ProjectName> --pm-folder <academic-pm-folder> \
  [--config <path>] \
  --action repair [--dry-run]
```

Log a session of work (updates history and CURRENT_STATUS.md):

```bash
node <skill_dir>/scripts/bootstrap-academic-pm.mjs \
  --project <ProjectName> --pm-folder <academic-pm-folder> \
  [--config <path>] \
  --action log \
  --event "<one-line summary>" \
  --note <relative-path> [--note <relative-path> ...] \
  [--type log|decision|review|audit]
```

## OpenClaw Integration

For OpenClaw PM agents, use the dedicated instruction:

```
Read and follow this instruction:
https://raw.githubusercontent.com/SYU8384/academic-project-management/main/openclaw-instruction.md
```

The instruction installs or updates the skill, verifies `projects.json`, configures the OpenClaw workspace `AGENTS.md`, audits registered PM folders and manuscript home `AGENTS.md` files, and asks approval before edits.

**OpenClaw's unique role:** As the PM agent, OpenClaw can write to **both** its own workspace `AGENTS.md` (telling itself where PM folders live) and the **manuscript repo's `AGENTS.md`** (telling coding agents where research state lives). Users can brainstorm ideas, track literature, and manage meetings through OpenClaw, while coding agents focus on the manuscript repo.

## Final Response

After setup, logging, migration, or repair, state exactly which project/vault/manuscript-home files were updated, including `<manuscript_home>/AGENTS.md` when the managed section was appended, created, or refreshed. If no files changed, say that and why.
