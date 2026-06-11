# Academic Project Management Reference

`SKILL.md` is the loadable entry point. This file defines the paper-pipeline folder model, setup, logging, validation, and repair rules.

## Folder Model

Required for paper projects:

```text
<Project>.md or existing Obsidian folder note
README.md
RESEARCH.md
CURRENT_STATUS.md
literature/literature.md
evidence/evidence.md
analysis/analysis.md
writing/writing.md
meetings/meetings.md
planning/planning.md
history/history.md
archive/archive.md
```

Optional folders:

```text
docs/
submissions/
admin/
ethics/
collaboration/
```

Preserve optional folders already present. Create new optional folders only when the current project needs them.

## Setup Intake

Discover these from the folder before asking:

- project title and root note
- current phase
- existing navigation anchors
- live lanes and index conventions
- obvious research summary and current blockers

Ask only for missing high-impact facts:

- project type: paper, thesis/dissertation, grant, lab project, independent study
- phase: idea, literature-review, study-design, data-collection, analysis, writing, submitted, revision, published, dormant
- one-sentence research summary
- access: authoritative, read-only, unavailable

For new or normalized folders, seed required root notes and folder notes from `templates/`. Preserve existing content. Do not move notes unless the destination is unambiguous from title, frontmatter, or content.

## What Goes Where

| Lane | Purpose |
|---|---|
| `<Project>.md` | Obsidian landing page and high-level project navigation |
| `README.md` | Routing rules, folder conventions, update rules, validation command |
| `RESEARCH.md` | Research question, contribution, claims, scope, study shape, target venue |
| `CURRENT_STATUS.md` | Current phase, top priorities, blockers, recent progress, next actions |
| `literature/` | Paper notes, reading queue, related-work synthesis, citation gaps |
| `evidence/` | Data/source registry, provenance, measurement definitions, data risks |
| `analysis/` | Methods, audit reports, verification reports, reproducibility checks, findings |
| `writing/` | Manuscript outline, section status, figures, tables, submissions, revisions |
| `meetings/` | Advisor/collaborator meeting notes, feedback, action items |
| `planning/` | Concrete work plans and lightweight research decisions |
| `history/` | Concise chronological completed-work logs |
| `archive/` | Superseded notes, old plans, retired drafts |

History is never the canonical home for current research state. If a history note grows into a report, move the report to `analysis/` and leave a brief history entry behind.

## Logging Workflow

When logging meaningful work:

1. Determine the project from the explicit path, current folder, or `projects.json`.
2. Read the project `README.md`, `RESEARCH.md`, and `CURRENT_STATUS.md`.
3. Update durable current-state notes first.
4. Update folder-note indexes if notes were added, moved, archived, or deleted.
5. Add a concise history entry last.
6. Run the validator when structure or links changed.

Meeting notes should keep raw advisor feedback. Action items and decisions should also be reflected in `CURRENT_STATUS.md`, `planning/`, `analysis/`, or `writing/` as appropriate.

## Obsidian Conventions

Use English structural filenames and headings for automation. Preserve Chinese, Japanese, or English note content as written.

Root and folder notes should have YAML frontmatter:

```yaml
---
title: <title>
created: YYYY-MM-DD
updated: YYYY-MM-DD
last_reviewed: YYYY-MM-DD
pageType: index | research | literature | evidence | analysis | writing | meeting | planning | history | note
status: active
owner: <owner>
---
```

Folder notes use:

```markdown
<!-- vault-maintain:index:start -->
## Subfolders

...

## Notes

...
<!-- vault-maintain:index:end -->
```

Update folder indexes in the same session when moving notes. Preserve existing external navigation anchors such as parent research-project and `Home` links.

## Validation And Repair

Validation command:

```bash
node <skill_dir>/scripts/check-academic-pm.mjs --path <academic-pm-folder>
```

Registered project command:

```bash
node <skill_dir>/scripts/check-academic-pm.mjs --project <ProjectName> --config <skill_dir>/projects.json
```

Useful flags:

```bash
--strict   Treat warnings as validation failures.
--json     Print machine-readable JSON.
```

The validator checks:

- required root notes and lanes
- folder-note presence for required and optional lanes
- basic frontmatter on visible notes
- folder index completeness
- unresolved project-internal wiki links
- stale `CURRENT_STATUS.md` — flagged when `last_reviewed` (or `updated`) is older than `STATUS_STALE_DAYS = 14` days. Adjust by editing `scripts/check-academic-pm.mjs` if a project has a different review cadence.
- overlong history notes — flagged when a history note exceeds `HISTORY_WORD_WARNING = 1200` words or `HISTORY_LINE_WARNING = 140` lines. Move the report detail to `analysis/` and leave a brief history entry behind.

The heuristic constants live at the top of `scripts/check-academic-pm.mjs`. `--strict` turns warnings into errors (so a stale status or overlong history note fails the validation). The thresholds themselves are not currently CLI-tunable; edit the source constants if a project needs different limits.

Repair workflow:

1. Run validation and list findings.
2. Decide target routing for each misplaced note.
3. Create missing roots and lane indexes.
4. Move only unambiguous notes; update all indexes and wiki links.
5. Update `CURRENT_STATUS.md`, then add a concise history entry.
6. Re-run validation.

## Registry

`projects.json` lives at the skill root and is local/private.

```json
{
  "projects": {
    "PaperI": {
      "project_type": "paper",
      "pm_folder": "/path/to/Paper I",
      "vault_root": "/path/to/Obsidian Vault",
      "phase": "analysis-writing",
      "access": "authoritative",
      "notes": "One-line project summary",
      "manuscript_home": "/path/to/Paper I repo",
      "manuscript_kind": "git-repo",
      "manuscript_access": "authoritative"
    }
  }
}
```

`access` values:

| Access | Meaning |
|---|---|
| `authoritative` | User owns the folder; agent may edit it directly |
| `read-only` | Agent may read and suggest changes |
| `unavailable` | Agent should ask for access and avoid inventing a PM folder |

`manuscript_home`, `manuscript_kind`, and `manuscript_access` are required fields. The bootstrap script records them and, when the manuscript home is a git repo with `authoritative` access, writes a managed routing section into `<manuscript_home>/AGENTS.md`. See **Manuscript Home And AGENTS.md Integration** below.

`manuscript_kind` values:

| Kind | Meaning |
|---|---|
| `git-repo` | Version-controlled repo; bootstrap may write a managed `AGENTS.md` section |
| `local-folder` | A plain folder (e.g. `~/writing/Paper I/`); no `AGENTS.md` integration |
| `null` | Project has no manuscript artifact yet (idea, dormant, grant-only) |

`manuscript_access` values:

| Access | Meaning |
|---|---|
| `authoritative` | PM agent owns the routing contract; the bootstrap script may update `<manuscript_home>/AGENTS.md` |
| `read-only` | PM agent may read the manuscript home but never writes to it; the bootstrap script skips the `AGENTS.md` write |
| `none` | Manuscript home is tracked for reference only; the bootstrap script skips the `AGENTS.md` write |

Cross-field invariants:

- `manuscript_kind = null` ⟺ `manuscript_home` is empty.
- `manuscript_kind ∈ {git-repo, local-folder}` ⟹ `manuscript_home` is non-empty.
- Bootstrap and validator enforce these.

## Manuscript Home And AGENTS.md Integration

Academic projects have a two-folder problem: the PM folder holds research state (questions, claims, evidence, literature, meetings, decisions, history), and the manuscript home holds executable artifacts (manuscript source, analysis code, figures, configs, replication code). A coding or writing agent opening the manuscript home has no way to find the PM folder on its own, and over time decisions leak into the manuscript home that never reach the paper project.

The manuscript-home integration is the answer: a managed `## Academic PM folder` section in `<manuscript_home>/AGENTS.md` that routes both the LaTeX-writing agent and the analysis-coding agent at the PM folder, and tells them to defer to `academic-project-management` for any state change.

For most projects, the manuscript home is a single git repo that contains both the LaTeX sources and the analysis code. The skill models this with one `AGENTS.md` in that folder — there is no separate code repo `AGENTS.md`.

### When to declare each `manuscript_kind`

| Project shape | `manuscript_home` | `manuscript_kind` | `manuscript_access` | AGENTS.md written? |
|---|---|---|---|---|
| Single git repo with `.tex` + `.R` + figures | `/path/to/repo` | `git-repo` | `authoritative` (default) | yes |
| Manuscript in `~/writing/`, no version control | `~/writing/Paper I` | `local-folder` | n/a | no |
| Paper project, no artifact side yet (idea / dormant / grant) | empty | `null` | `authoritative` (default) | no |

### The contract

`AGENTS.md` in the manuscript home gets a single managed section:

```markdown
<!-- academic-project-management:section:start -->
## Academic PM folder

This project has an academic PM folder at `<pm_folder>`. The paper artifact and analysis code live at `<manuscript_home>` (`<manuscript_kind>`, access `<manuscript_access>`). The PM folder's `README.md` wins for routing.

[full template]
<!-- academic-project-management:section:end -->
```

The opening sentence is **template-substituted** with the values from the bootstrap CLI flags. When `manuscript_kind = null`, the entire opening sentence is replaced with: "The PM folder is the whole project; there is no separate manuscript home." When `manuscript_kind = git-repo` or `local-folder`, it reads: "The paper artifact and analysis code live at `<manuscript_home>` (`<manuscript_kind>`, access `<manuscript_access>`)."

The bootstrap script manages that section end-to-end. It is **append-safe** (it never overwrites user content outside the marker block) and **idempotent** (re-running refreshes the managed section in place). The PM folder path inside the section is interpolated from `projects.json`, so the validator can detect drift if the PM folder is moved.

### Routing rules

The PM folder's `README.md` wins over `<manuscript_home>/AGENTS.md`. If a coding or writing task needs research state that is not in the PM folder, the agent stops and asks — it does not invent research state at the manuscript home or in `AGENTS.md`.

Strict routing:

- Research state (questions, claims, evidence, literature notes, advisor meetings, decisions, history) lives in the PM folder, not at `<manuscript_home>`.
- Executable artifacts (manuscript source, analysis scripts, figures, configs, replication code) live at `<manuscript_home>`, not in the PM folder.
- The PM folder and the manuscript home share this single `AGENTS.md` as their routing entry point.

### Bootstrap

The bootstrap script handles `AGENTS.md` automatically when the manuscript home is a git repo with `authoritative` access:

```bash
node <skill_dir>/scripts/bootstrap-academic-pm.mjs \
  --project <ProjectName> \
  --pm-folder <academic-pm-folder> \
  --phase <phase> \
  --notes "<one-line summary>" \
  --config <skill_dir>/projects.json \
  --manuscript-home <path> \
  --manuscript-kind git-repo \
  --manuscript-access authoritative
```

For projects with no manuscript artifact yet, omit `--manuscript-home` (or pass `--no-manuscript-home` to be explicit):

```bash
node <skill_dir>/scripts/bootstrap-academic-pm.mjs \
  --project <ProjectName> \
  --pm-folder <academic-pm-folder> \
  --phase idea \
  --notes "Pre-artifact project." \
  --config <skill_dir>/projects.json
```

Behavior:

- If `<manuscript_home>/AGENTS.md` does not exist and `manuscript_kind = git-repo` and `manuscript_access = authoritative`, it is created with the managed section.
- If it exists but has no managed markers, the section is appended below the existing content.
- If it exists and has managed markers, the section between the markers is replaced in place. Anything outside the markers is preserved verbatim.
- `--no-agents-md` skips the file write entirely (the `manuscript_*` fields are still recorded in `projects.json`).
- `--manuscript-access read-only|none` skips the file write without removing the field.
- `--manuscript-kind local-folder` skips the file write (the folder has no `AGENTS.md` integration).
- `--manuscript-kind null` records the field as null and skips the file write.

### Validation

The integrated validator `check-academic-pm.mjs` reports on the manuscript-home integration in the same run as the PM folder checks:

```bash
node <skill_dir>/scripts/check-academic-pm.mjs --project <ProjectName> --config <skill_dir>/projects.json
```

It checks:

- `manuscript_home` exists and is a directory, when set.
- When `manuscript_kind = git-repo` and `manuscript_access = authoritative`, `<manuscript_home>/AGENTS.md` exists.
- The managed section markers are present in `<manuscript_home>/AGENTS.md`.
- The PM folder path declared in the section matches `projects.json` (drift detection).

Findings show up in the same errors/warnings buckets as PM folder issues, so a single command covers both sides — matching the "one integrated setup check" property of the project-management skill.

## Relationship To `academic-writer`

Use this skill for research memory, project status, evidence trails, meeting notes, and folder maintenance. Use `academic-writer` for LaTeX drafting, revision prose, citation insertion, and compilation. When manuscript state changes, update `writing/`; do not duplicate the manuscript in the PM folder.
