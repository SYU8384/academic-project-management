# Academic Project Management Skill

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Install](https://img.shields.io/badge/install-curl%20%7C%20bash-0f76e6.svg)](#install)
[![Skill](https://img.shields.io/badge/skill-academic--project--management-7c3aed.svg)]()

A portable agent skill for keeping academic research state in sync: literature, evidence, analysis, writing, meetings, planning, history, and archive. Optimized for paper projects and evidence-heavy research.

Works especially well with an Obsidian vault, but the convention is plain Markdown plus a small local `projects.json` registry. The important part is behavioral: when meaningful research work happens, the agent updates the right current-state docs, indexes, and history logs in the same session.

## ✨ What It Does

| Capability | What the agent does |
|---|---|
| 📚 **Literature tracking** | Maintains reading queue, paper notes, related-work synthesis, and citation gaps in `literature/` |
| 🔬 **Evidence management** | Tracks source registry, data provenance, measurement definitions, and data risks in `evidence/` |
| 📊 **Analysis tracking** | Records methods, audit reports, verification checks, reproducibility notes, and findings in `analysis/` |
| ✍️ **Writing coordination** | Monitors draft status, figures, tables, submission notes, and revisions in `writing/` |
| 👥 **Meeting notes** | Captures advisor/collaborator feedback, verbatim notes, and action items in `meetings/` |
| 📝 **Decision logging** | Records research decisions with rationale and alternatives in `planning/` (lightweight ADR-style) |
| 🔗 **Manuscript home integration** | Wires `AGENTS.md` in your LaTeX/code repo so agents know where research state lives |
| 🧪 **Validation & drift detection** | Checks folder structure, indexes, wiki links, stale status, and manuscript-home wiring |

## 🧠 Why This Exists

Academic research memory usually decays in predictable ways:

- **Literature reviews grow stale** — papers read months ago fade from memory, citation gaps accumulate
- **Analysis code drifts from claims** — the manuscript says one thing, the code produces another, and nobody remembers which is authoritative
- **Advisor feedback gets lost** — action items from meetings live in email threads, never reaching the project state
- **Reproducibility notes are incomplete** — datasets, methods, and verification steps are scattered across notebooks
- **Research decisions evaporate** — why a method was chosen, why a dataset was excluded, why a claim was revised
- **Agents can't find the research context** — coding agents open the repo and have no way to discover the PM folder, questions, claims, or current blockers

This skill gives agents a strict, repeatable operating model for academic project memory.

## ⚙️ Install

### One-line install

```bash
curl -fsSL https://raw.githubusercontent.com/SYU8384/academic-project-management/main/install.sh | bash
```

### Manual install

```bash
git clone https://github.com/SYU8384/academic-project-management.git ~/.agents/skills/academic-project-management
mkdir -p ~/.config/academic-pm
```

Restart your agent after installing or updating the skill.

### Target-specific install

```bash
# For Codex
curl -fsSL https://raw.githubusercontent.com/SYU8384/academic-project-management/main/install.sh | bash -s -- codex

# For Claude
curl -fsSL https://raw.githubusercontent.com/SYU8384/academic-project-management/main/install.sh | bash -s -- claude

# For OpenClaw
curl -fsSL https://raw.githubusercontent.com/SYU8384/academic-project-management/main/install.sh | bash -s -- openclaw

# For custom path
curl -fsSL https://raw.githubusercontent.com/SYU8384/academic-project-management/main/install.sh | bash -s -- custom /path/to/skills
```

### Config location

`projects.json` is private local config and is gitignored. It lives at:

```
~/.config/academic-pm/projects.json
```

The bootstrap script creates this automatically on first run. Edit it manually only if you need to:

```json
{
  "projects": {
    "MyPaper": {
      "project_type": "paper",
      "pm_folder": "/path/to/vault/MyPaper",
      "vault_root": "/path/to/vault",
      "phase": "analysis-writing",
      "access": "authoritative",
      "notes": "Short project description",
      "manuscript_home": "/path/to/MyPaper-repo",
      "manuscript_kind": "git-repo",
      "manuscript_access": "authoritative"
    }
  }
}
```

## 🗂️ PM Folder Model

Each project gets a Markdown folder with stable academic lanes:

```
MyPaper/
├── README.md              # Routing rules, conventions, validation command
├── RESEARCH.md            # Research question, contribution, claims, scope, venue
├── CURRENT_STATUS.md      # Phase, priorities, blockers, recent progress, next actions
├── MyPaper.md             # Obsidian landing page and high-level navigation
│
├── literature/
│   └── literature.md      # Paper notes, reading queue, synthesis, citation gaps
├── evidence/
│   └── evidence.md        # Source registry, provenance, measurement definitions, data risks
├── analysis/
│   └── analysis.md        # Methods, audits, verification, reproducibility, findings
├── writing/
│   └── writing.md         # Outline, draft status, figures, tables, submission/revision notes
├── meetings/
│   └── meetings.md        # Advisor/collaborator notes, feedback, action items
├── planning/
│   └── planning.md        # Concrete work plans and lightweight research decisions
├── history/
│   └── history.md         # Concise chronological completed-work logs
└── archive/
    └── archive.md         # Superseded notes, old plans, retired drafts
```

Optional folders (created only when needed):
- `docs/` — Additional documentation
- `submissions/` — Journal/conference submission materials
- `admin/` — Administrative paperwork
- `ethics/` — Ethics approval and compliance
- `collaboration/` — External collaborator notes

Every lane has a folder-note index (`lane/lane.md`) with an Obsidian-compatible `vault-maintain:index` block listing subfolders and notes.

## 🚀 Quick Start

### Bootstrap a new project

```bash
node ~/.agents/skills/academic-project-management/scripts/bootstrap-academic-pm.mjs \
  --project MyPaper \
  --pm-folder ~/vault/MyPaper \
  --phase idea \
  --notes "Research on institutional career paths"
```

This creates the 12-file scaffold (3 root + 1 landing page + 8 lane notes) and registers the project in `projects.json`.

### Declare a manuscript home (when you have a LaTeX/code repo)

```bash
node ~/.agents/skills/academic-project-management/scripts/bootstrap-academic-pm.mjs \
  --project MyPaper \
  --pm-folder ~/vault/MyPaper \
  --phase analysis \
  --manuscript-home ~/Code/MyPaper \
  --manuscript-kind git-repo \
  --manuscript-access authoritative
```

This wires the repo's `AGENTS.md` so coding/writing agents can find the PM folder.

### Log completed work

```bash
node ~/.agents/skills/academic-project-management/scripts/bootstrap-academic-pm.mjs \
  --project MyPaper \
  --action log \
  --event "Fixed issue #1 in unique-count table" \
  --note analysis/2026-06-11-issue-fix.md
```

Automatically creates a dated history entry and updates `CURRENT_STATUS.md` Recent Progress.

### Repair drift

```bash
node ~/.agents/skills/academic-project-management/scripts/bootstrap-academic-pm.mjs \
  --project MyPaper \
  --action repair
```

Recreates missing folder notes, updates indexes, detects new subfolders/notes. Does not touch `projects.json`.

### Validate

```bash
# Auto-discovers projects.json
node ~/.agents/skills/academic-project-management/scripts/check-academic-pm.mjs \
  --project MyPaper

# Or with explicit config
node ~/.agents/skills/academic-project-management/scripts/check-academic-pm.mjs \
  --project MyPaper \
  --config ~/.config/academic-pm/projects.json

# With custom thresholds
node ~/.agents/skills/academic-project-management/scripts/check-academic-pm.mjs \
  --project MyPaper \
  --stale-days 7 \
  --history-word-limit 800
```

Checks folder structure, indexes, wiki links, frontmatter, stale status, and manuscript-home wiring.

## 🔄 Workflow

```
User or agent finishes meaningful research work
              |
              v
Read the project's README.md routing map
              |
              v
Update affected current-state docs first
literature/ + evidence/ + analysis/ + writing/
              |
              v
Update CURRENT_STATUS.md with progress/blockers
              |
              v
Update folder-note indexes
              |
              v
Write the final history/YYYY-MM-DD-<slug>.md entry
```

History is written last because it records what changed after the durable docs have already been updated.

## 🏠 Manuscript Home Integration

Academic projects have a **two-folder problem**:

- **PM folder** (`~/vault/MyPaper/`) holds research state: questions, claims, evidence, literature, meetings, decisions, history
- **Manuscript home** (`~/Code/MyPaper/`) holds executable artifacts: LaTeX source, analysis scripts, figures, configs, replication code

A coding agent opening the repo has no way to find the PM folder on its own. The integration solves this with a managed `## Academic PM folder` section in `<manuscript_home>/AGENTS.md` that routes both the LaTeX-writing agent and the analysis-coding agent at the PM folder.

```markdown
<!-- academic-project-management:section:start -->
## Academic PM folder

This project has an academic PM folder at `/path/to/vault/MyPaper`.
The paper artifact and analysis code live at `/path/to/repo` (git-repo, access authoritative).
The PM folder's `README.md` wins for routing.

... routing rules ...
<!-- academic-project-management:section:end -->
```

The bootstrap script manages this section end-to-end — append-safe (never overwrites user content outside markers) and idempotent (re-running refreshes in place).

### When to declare each `manuscript_kind`

| Project shape | `manuscript_home` | `manuscript_kind` | `manuscript_access` | AGENTS.md? |
|---|---|---|---|---|
| Single git repo with `.tex` + `.R` + figures | `/path/to/repo` | `git-repo` | `authoritative` | ✅ Yes |
| Manuscript in `~/writing/`, no version control | `~/writing/MyPaper` | `local-folder` | n/a | ❌ No |
| Paper project, no artifact yet (idea / dormant / grant) | — | `null` | `authoritative` | ❌ No |

## 🤝 Integration with academic-writer

Use this skill for **research memory**: project status, evidence trails, meeting notes, and folder maintenance.

Use [`academic-writer`](https://github.com/SYU8384/academic-writer) for **manuscript drafting**: LaTeX editing, revision prose, citation insertion, and PDF compilation.

When manuscript state changes, update `writing/` in the PM folder; do not duplicate the manuscript in the PM folder. The `AGENTS.md` routing contract in the manuscript home tells both skills to defer to the PM folder's `README.md` for state changes.

## 🧪 Validation

The integrated validator `check-academic-pm.mjs` runs all checks in one pass:

- ✅ Required root files and lane folders present
- ✅ Folder-note indexes present and complete
- ✅ YAML frontmatter on visible notes (title, created, updated, last_reviewed, pageType, status)
- ✅ No unresolved project-internal wiki links
- ✅ `CURRENT_STATUS.md` freshness (default: warn if >14 days stale)
- ✅ History note size limits (default: warn if >1200 words or >140 lines)
- ✅ Manuscript home exists and is directory (when declared)
- ✅ `AGENTS.md` managed section present and correct (for git-repo + authoritative)
- ✅ PM folder path in AGENTS.md matches `projects.json` (drift detection)

Run with `--strict` to fail on warnings. Run with `--json` for machine-readable output.

## 🧰 Repository Map

| Path | Purpose |
|---|---|
| [`SKILL.md`](SKILL.md) | Agent entry point: intents, triggers, workflows, and routing map |
| [`REFERENCE.md`](REFERENCE.md) | Deep reference: folder model, setup rules, validation, repair, AGENTS.md integration |
| [`EXAMPLES.md`](EXAMPLES.md) | End-to-end recipes: bootstrap, log, repair, manuscript home, re-bootstrap, self-test |
| [`install.sh`](install.sh) | Curl-friendly installer for agent skills, Codex, Claude, OpenClaw |
| [`templates/`](templates/) | Canonical templates for all root files, lane notes, and AGENTS.md sections |
| [`templates/projects.template.json`](templates/projects.template.json) | Starter for `~/.config/academic-pm/projects.json` |
| [`scripts/bootstrap-academic-pm.mjs`](scripts/bootstrap-academic-pm.mjs) | Bootstrap, repair, and log actions; idempotent scaffold creation |
| [`scripts/check-academic-pm.mjs`](scripts/check-academic-pm.mjs) | Integrated validator: PM folder + manuscript home + AGENTS.md |
| [`scripts/test/run-tests.mjs`](scripts/test/run-tests.mjs) | Self-test suite: 18 tests covering bootstrap, idempotency, AGENTS.md, repair, log |
| [`LICENSE`](LICENSE) | MIT license |

## 📐 Design Principles

- **Current truth before history.** Update durable docs first (`RESEARCH.md`, `CURRENT_STATUS.md`, lane notes); use history as the final chronological log.
- **PM folder for state, manuscript home for artifacts.** Research state lives in the PM folder; executable artifacts live in the manuscript home. Never duplicate.
- **Agents defer to README.md.** The project `README.md` is the routing map for every PM update. Agents do not invent routing rules.
- **Config in user home, not skill directory.** `projects.json` lives at `~/.config/academic-pm/projects.json` (user-specific, gitignored); the skill repo contains only reusable conventions, templates, and scripts.
- **History stays concise.** Move detailed reports to `analysis/`; leave brief history entries behind. Default limits: 1200 words / 140 lines per history note.
- **Strict routing in AGENTS.md.** If a coding or writing task needs research state that is not in the PM folder, the agent stops and asks. It does not invent research state at the manuscript home.
- **Create-only by default.** The bootstrap script never overwrites user-edited files. Re-running only refreshes `projects.json` and the managed AGENTS.md section.

## 📄 License

MIT. See [LICENSE](LICENSE).
