---
name: academic-project-management
description: "Keeps academic research state in sync for standalone Research Projects and Research Programs: shared coding/data registries, literature, evidence, analysis, writing, meetings, ideas, planning, history, and archive. Use when the user asks to set up, initialize, normalize, register, log, update, audit, validate, repair, or organize an academic project; record advisor feedback, data checks, analysis findings, writing progress, revisions, or research decisions; declare a manuscript home and wire its AGENTS.md to the PM folder."
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
| **"repair PM"**, **"fix indexes"**, **"rebuild folder notes"** | Repair drift | Runs repair action, shows what will be fixed, asks confirmation. Also refreshes the manuscript-home `AGENTS.md` section from `projects.json`. |
| **"sync AGENTS.md"**, **"backfill AGENTS.md"**, **"AGENTS.md is missing/stale"** | Sync AGENTS.md | Runs `scripts/sync-agents-section.mjs` to re-render the manuscript-home `AGENTS.md` managed section from `projects.json` — no bootstrap flags needed. |
| **"close out"**, **"session close-out"**, **"did we log this work"** | Close-out guard | Runs `scripts/check-academic-closeout.mjs` to verify manuscript-home changes in this session came with matching `CURRENT_STATUS.md` / history updates. |
| **"organize PM folder"**, **"tidy PM folder"**, **"PM spring cleaning"** | Reorganize | Runs `scripts/check-reorg-candidates.mjs` (read-only) and proposes an approval-gated merge/retire/archive plan from the detected signals. |
| **"run migrations"**, **"backfill registry"**, **"migrate projects.json"** | Migrate | Runs `scripts/migrate.mjs` to apply pending versioned migrations (config/PM-folder schema backfills). Idempotent; ledger-recorded. |
| **"set up OpenClaw PM"**, **"OpenClaw academic PM"** | OpenClaw setup | Displays the copy-paste prompt for OpenClaw workspace configuration. |
| **"set up a research program"**, **"register my chapters"** | Research Program bootstrap | Registers shared infrastructure and independent Research Projects. |
| **"manage this meeting note"** | Meeting normalization | Preserves prose; adds canonical metadata, a marked summary block, index entry, and roster backlink. |
| **"capture/triage/audit this idea"** | Research Program Inbox | Creates or updates explicit capture notes; never silently promotes or deletes an idea. |

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
4. **Manuscript home** (optional) — path to your LaTeX/code workfile folder
5. **Confirmation** — agent shows summary, you approve before anything is created

The agent then runs the bootstrap script and reports what was created.

### 2. Log completed work

When you say **"log this"** or **"I just finished the regression analysis"**, the agent will:

1. Ask which notes were affected (e.g., `analysis/regression.md`)
2. Create a dated history entry in `history/`
3. Update `CURRENT_STATUS.md` Recent Progress section
4. Update lane indexes to link back to the history entry

### 3. Record an advisor meeting

Put the note in `meetings/` — start from `templates/meeting-record.md` (attendees, agenda, discussion notes, feedback, decisions, action items, follow-ups) — extract action items into `CURRENT_STATUS.md`, update `planning/`, `analysis/`, or `writing/` if feedback changes active work. Keep raw advisor feedback verbatim.

### 4. Track data or reproducibility work

Source registries, dataset provenance, measurement definitions, and data risks go in `evidence/`. Data verification reports, reproducibility checks, hand-calculation logs, and cross-file consistency audits go in `verification/` (optional lane). Methods, findings, interpretations, and methodology/process audits go in `analysis/`. Keep raw sensitive data out of the PM folder unless `README.md` explicitly permits it.

### 5. Declare the manuscript home and wire AGENTS.md

When the project has a manuscript + analysis-code folder, declare it during setup or re-bootstrap with the manuscript home path. The bootstrap script appends or refreshes a managed `## Academic PM folder` section in `<manuscript_home>/AGENTS.md` that routes both the LaTeX-writing agent and the analysis-coding agent at this PM folder. This applies to authoritative git repos and authoritative local workfile folders.

## Default Paper Pipeline

```text
<Project>.md or existing folder note    # Obsidian landing page
README.md                              # routing rules + conventions
RESEARCH.md                            # question, contribution, claims, scope, venue
CURRENT_STATUS.md                      # phase, priorities, blockers, progress
literature/  evidence/  analysis/  writing/
meetings/  planning/  history/  archive/
```

Each lane has a `<lane>/<lane>.md` folder note with an Obsidian-compatible index (see REFERENCE.md). Optional lanes (`verification/`, `submissions/`, `admin/`, `ethics/`, `collaboration/`) are preserved when present and created only when needed.

## Route Information

| Information | Goes to |
|---|---|
| Research question, contribution, hypotheses, scope, target venue | `RESEARCH.md` |
| Current phase, priorities, blockers, recent progress, next actions | `CURRENT_STATUS.md` |
| Paper notes, reading queue, related-work synthesis, citation gaps | `literature/` |
| Dataset/source registry, provenance, measurement definitions, data risks | `evidence/` |
| Methods, findings, interpretations, methodology/process audits | `analysis/` |
| Data verification reports, reproducibility checks, hand-calculation logs, cross-file consistency audits | `verification/` (optional) |
| Outline, draft status, figures, tables, submission/revision notes | `writing/` |
| Advisor/collaborator meetings, feedback, action items | `meetings/` |
| Concrete next-work plans and research decisions | `planning/` |
| Brief chronological completed-work logs | `history/` |
| Superseded notes, old plans, retired drafts | `archive/` |
| Manuscript source, analysis code, figures, configs, replication artifacts | `<manuscript_home>` (declared in `projects.json`) |
| Coding/writing-agent routing contract (when `manuscript_kind = git-repo` or `local-folder` and access is authoritative) | `<manuscript_home>/AGENTS.md` (`## Academic PM folder` section) |

Always read the project `README.md` first. If it defines different routing, it wins over this generic map.

The PM folder is for research state; the manuscript home is for executable artifacts. When the manuscript home is a declared authoritative workfile folder, its `AGENTS.md` is the entry point for any coding or writing agent; it defers to the PM folder's `README.md` and this skill for any state change. There is no separate code repo `AGENTS.md` — the manuscript and the code share one folder and one routing contract.

## Templates

The `templates/` directory holds the canonical source files for what the bootstrap script writes into a new PM folder. Each lane-specific template carries prompts (`## Reading Queue` for literature, `## Open Action Items` for meetings, `## Active Plans` for planning, etc.) that guide the user to fill in the right content.

- **Read on every bootstrap** (the script uses these): `root-note.md` → `<Project>.md`, `README.md` → `README.md`, `RESEARCH.md` → `RESEARCH.md`, `CURRENT_STATUS.md` → `CURRENT_STATUS.md`, and the 8 lane templates (`literature.md`, `evidence.md`, `analysis.md`, `writing.md`, `meetings.md`, `planning.md`, `history.md`, `archive.md`) → their respective lane notes. `AGENTS_ACADEMIC_PM_SECTION.md` is the manuscript-home routing section, also written by the script.
- **Documentation-only** (read by humans and agents, not seeded by the script): `folder-note.md` (an older lane-note factory, kept as a reference for what a lane note looks like), `meeting-record.md` (per-meeting note template applied when recording advisor/collaborator meetings — see Workflow 3), and `projects.template.json` (a reference of the `projects.json` schema).

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

Repair structural drift (missing folder notes, stale indexes, missing or stale manuscript-home `AGENTS.md` section):

```bash
node <skill_dir>/scripts/bootstrap-academic-pm.mjs \
  --project <ProjectName> --pm-folder <academic-pm-folder> \
  [--config <path>] \
  --action repair [--dry-run]
```

Sync the manuscript-home `AGENTS.md` managed section from `projects.json` (backfill or heal drift without re-running bootstrap; omit `--project` for all projects):

```bash
node <skill_dir>/scripts/sync-agents-section.mjs [--project <ProjectName>] [--config <path>] [--dry-run]
```

Re-running bootstrap without `--manuscript-home` preserves the `manuscript_*` values already in `projects.json`; pass `--no-manuscript-home` to clear them explicitly.

Close-out guard (run before signing off a manuscript-home work session; fails when committed/uncommitted manuscript changes lack a matching `CURRENT_STATUS.md` or same-day history update):

```bash
node <skill_dir>/scripts/check-academic-closeout.mjs \
  [--project <ProjectName>] [--config <path>] \
  [--manuscript-home <path>] [--since <ISO datetime>] \
  [--allow-no-impact "<reason>"]
```

Detect reorganization candidates (read-only; tiny/stale/orphan notes, similar pairs, supersession hints, stale lane indexes, archive candidates; exit 0 always):

```bash
node <skill_dir>/scripts/check-reorg-candidates.mjs \
  [--project <ProjectName> [--config <path>] | --path <pm-folder>] [--json]
```

Apply pending versioned migrations (config/schema backfills; idempotent, ledger-recorded):

```bash
node <skill_dir>/scripts/migrate.mjs \
  [--project <ProjectName>] [--pm-folder <academic-pm-folder>] [--config <path>] \
  [--list] [--dry-run] [--yes]
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

- Sync the OpenClaw workspace `AGENTS.md` `## Academic Project Management` block with the section-3 template in `openclaw-instruction.md`: `node <skill_dir>/scripts/sync-openclaw-apm-section.mjs --check` (drift table), `--apply` (with per-workspace confirmation; `--force` skips the prompt), or `--bootstrap <path>` (first-time insert). Discovery defaults to `~/.openclaw/workspace*/AGENTS.md`; pass `--workspace <path>` to limit scope.

**OpenClaw's unique role:** As the PM agent, OpenClaw can write to **both** its own workspace `AGENTS.md` (telling itself where PM folders live) and the **manuscript/workfile folder's `AGENTS.md`** (telling coding agents where research state lives). Users can brainstorm ideas, track literature, and manage meetings through OpenClaw, while coding agents focus on the manuscript/workfile folder.

## Final Response

After setup, logging, migration, or repair, state exactly which project/vault/manuscript-home files were updated, including `<manuscript_home>/AGENTS.md` when the managed section was appended, created, or refreshed. If no files changed, say that and why.

## Research Program model

A Research Program is a shared layer above independently managed Research Projects. A project can be an article, chapter, study, or another work unit. Its registered root owns the shared `Coding Rules/`, `Data/`, `meetings/`, and `inbox/` lanes. Each member Research Project keeps its existing PM lanes, status, history, manuscript-home routing, and optional `artifact_subpath` under the shared manuscript repository. Standalone projects remain valid.

Use `scripts/manage-research-program.mjs` only after an explicit user request. It has no cron, watcher, background scan, or silent edit mode. Research Program meetings are the default for cross-project matters. A project-specific meeting remains valid when the user scopes it to that project.

A meeting can start as free-form prose. When asked to manage it, resolve ambiguous participants, applicability, or decision destinations with the user; then write only its standard frontmatter (`date`, `participants`, `applies_to`, `meeting_type`, `managed_at`) and the marker-delimited agent-managed summary. The generated participant roster is derived from those note fields.

The Research Program Inbox stores one capture note per idea. Capture fields are `captured`, `status`, `applies_to`, `source`, `triaged_at`, and `promotion_targets`; statuses are `untriaged`, `triaged`, `promoted`, and `archived`. Triage preserves the capture and records rationale/links. Audit is read-only.

For command syntax, validation, and migration safeguards, read the Research Program section of `REFERENCE.md` and the Research Program recipe in `EXAMPLES.md`.

## Canonical naming and legacy compatibility

Use **Research Project PM** for any independently managed work unit. Set optional `work_type` to a descriptive value such as `article`, `chapter`, or `study`. Use **Research Program PM** only when multiple projects share data, rules, meetings, or an idea Inbox. New registrations use `programs`, `program_id`, and `work_id`. Existing `series` / `paper_id` configuration and `manage-paper-series.mjs` remain supported as legacy aliases.

To convert a standalone project safely, bootstrap a Research Program and run `manage-research-program.mjs --action adopt-project --mode bridge`. Bridge adoption updates only registry membership; it never relocates PM folders, manuscript repositories, or artifacts.
