# Academic Project Management Skill

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Install](https://img.shields.io/badge/install-curl%20%7C%20bash-0f76e6.svg)](#install)
[![Skill](https://img.shields.io/badge/skill-academic--project--management-7c3aed.svg)]()

A portable agent skill for keeping academic research state in sync: literature, evidence, analysis, writing, meetings, planning, history, and archive. Optimized for paper projects and evidence-heavy research.

Works especially well with an Obsidian vault, but the convention is plain Markdown plus a small local `projects.json` registry. The important part is behavioral: when meaningful research work happens, the agent updates the right current-state docs, indexes, and history logs in the same session.

## 🗣️ Trigger Words

Just say any of these phrases and the agent handles the workflow:

| You say | Agent does |
|---|---|
| **"set up this project"** or **"setup this project"** | Asks for project name, PM folder path, research phase, and optional manuscript home. Shows summary, asks confirmation, then bootstraps everything. |
| **"log this"** or **"I just finished the regression"** | Creates a dated history entry and updates `CURRENT_STATUS.md`. |
| **"verify setup"** or **"check PM"** | Runs validator and reports findings. |
| **"repair PM"** or **"fix indexes"** | Detects drift, shows what will be fixed, asks confirmation. |
| **"set up OpenClaw PM"** | Displays the copy-paste prompt for OpenClaw workspace setup. |

You don't need to remember script paths or flags. The agent asks for missing info and confirms before making changes.

## ✨ What It Does

| Capability | What the agent does |
|---|---|
| 📚 **Literature tracking** | Maintains reading queue, paper notes, related-work synthesis, and citation gaps in `literature/` |
| 🔬 **Evidence management** | Tracks source registry, data provenance, measurement definitions, and data risks in `evidence/` |
| 📊 **Analysis tracking** | Records methods, findings, interpretations, modeling decisions, and methodology/process audits in `analysis/` |
| ✅ **Verification tracking** | Records data verification reports, reproducibility checks, hand-calculation logs, and cross-file consistency audits in `verification/` (optional) |
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

## 🚀 Quick Start

### The easy way: just talk to your agent

```
You: "set up this project"
Agent: "What's the project name?"
You: "MyPaper"
Agent: "Where should I create the PM folder? [~/MyPaper]"
You: (press Enter)
Agent: "What phase are you in?"
You: "2"  (for literature review)
Agent: "Does this project have a manuscript home (LaTeX/code repo)? [y/N]"
You: "n"
Agent: "📋 Setup Summary: Project: MyPaper, Phase: literature, ..."
      "Proceed? [y/N]"
You: "y"
Agent: "✅ Created PM folder with 12 files"
```

No manuscript repo? No problem. The PM folder works standalone for brainstorming, literature review, and planning.

### The explicit way: run scripts directly

**Bootstrap a new project:**

```bash
node ~/.agents/skills/academic-project-management/scripts/bootstrap-academic-pm.mjs \
  --project MyPaper \
  --pm-folder ~/vault/MyPaper \
  --phase idea \
  --notes "Research on institutional career paths"
```

Or interactively (no args needed):
```bash
node ~/.agents/skills/academic-project-management/scripts/bootstrap-academic-pm.mjs
```

**Log completed work:**

```bash
node ~/.agents/skills/academic-project-management/scripts/bootstrap-academic-pm.mjs \
  --project MyPaper \
  --action log \
  --event "Fixed issue #1 in unique-count table" \
  --note analysis/2026-06-11-issue-fix.md
```

**Repair drift:**

```bash
node ~/.agents/skills/academic-project-management/scripts/bootstrap-academic-pm.mjs \
  --project MyPaper \
  --action repair
```

**Validate:**

```bash
node ~/.agents/skills/academic-project-management/scripts/check-academic-pm.mjs \
  --project MyPaper
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
│   └── analysis.md        # Methods, findings, interpretations, modeling decisions, methodology/process audits
├── verification/          # (optional) Data verification reports, reproducibility checks, hand-calc logs
│   └── verification.md
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
- `verification/` — Data verification reports, reproducibility checks, hand-calculation logs, cross-file consistency audits
- `submissions/` — Journal/conference submission materials
- `admin/` — Administrative paperwork
- `ethics/` — Ethics approval and compliance
- `collaboration/` — External collaborator notes

Every lane has a folder-note index (`lane/lane.md`) with an Obsidian-compatible `vault-maintain:index` block listing subfolders and notes.

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

### Working without a manuscript repo

**You don't need a manuscript repo to use this skill.** Many researchers start with just a PM folder:

- **Idea stage** — Brainstorm research questions, track initial literature, record early decisions
- **Grant writing** — Organize proposal sections, track requirements, log reviewer feedback
- **Standalone literature review** — Build reading queues, synthesize findings, identify gaps
- **Collaboration planning** — Share research state before any code or LaTeX exists

When you're ready, add a manuscript home later by re-bootstrapping with `--manuscript-home`.

### When to declare each `manuscript_kind`

| Project shape | `manuscript_home` | `manuscript_kind` | `manuscript_access` | AGENTS.md? |
|---|---|---|---|---|
| Single git repo with `.tex` + `.R` + figures | `/path/to/repo` | `git-repo` | `authoritative` | ✅ Yes |
| Manuscript in `~/writing/`, no version control | `~/writing/MyPaper` | `local-folder` | n/a | ❌ No |
| **No manuscript yet** (idea / grant / brainstorming) | — | `null` | `authoritative` | ❌ No |

## 🤝 Integration with academic-writer

Use this skill for **research memory**: project status, evidence trails, meeting notes, and folder maintenance.

Use [`academic-writer`](https://github.com/SYU8384/academic-writer) for **manuscript drafting**: LaTeX editing, revision prose, citation insertion, and PDF compilation.

When manuscript state changes, update `writing/` in the PM folder; do not duplicate the manuscript in the PM folder. The `AGENTS.md` routing contract in the manuscript home tells both skills to defer to the PM folder's `README.md` for state changes.

## 🤖 OpenClaw Integration

For OpenClaw PM agents, use the dedicated instruction:

```
Read and follow this instruction:
https://raw.githubusercontent.com/SYU8384/academic-project-management/main/openclaw-instruction.md
```

**OpenClaw's unique role:** Unlike coding agents (Codex, Claude) that only access the manuscript repo, OpenClaw serves as the **PM agent** with three special capabilities:

1. **Dual AGENTS.md writing** — OpenClaw can write to **both** its own workspace `AGENTS.md` (telling itself where PM folders live) and the **manuscript repo's `AGENTS.md`** (telling coding agents where research state lives)

2. **Research brainstorming** — Users can brainstorm ideas, discuss literature, and plan analyses through OpenClaw conversation. The agent automatically logs these sessions to `planning/` and `history/`

3. **Meeting management** — After advisor discussions, OpenClaw records `meetings/` notes, extracts action items into `CURRENT_STATUS.md`, and updates affected lanes

The OpenClaw instruction installs/updates the skill, verifies `projects.json`, configures the workspace `AGENTS.md`, audits all registered projects, and **asks approval before every edit**.

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
curl -fsSL https://raw.githubusercontent.com/SYU8384/academic-project-management/main/install.sh | bash -s -- --target codex --yes

# For Claude
curl -fsSL https://raw.githubusercontent.com/SYU8384/academic-project-management/main/install.sh | bash -s -- --target claude --yes

# For OpenClaw
curl -fsSL https://raw.githubusercontent.com/SYU8384/academic-project-management/main/install.sh | bash -s -- --target openclaw --yes

# For custom path
curl -fsSL https://raw.githubusercontent.com/SYU8384/academic-project-management/main/install.sh | bash -s -- --dest /path/to/skills --yes
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
- **History stays concise.** Move detailed reports to `analysis/` or `verification/`; leave brief history entries behind. Default limits: 1200 words / 140 lines per history note.
- **Strict routing in AGENTS.md.** If a coding or writing task needs research state that is not in the PM folder, the agent stops and asks. It does not invent research state at the manuscript home.
- **Create-only by default.** The bootstrap script never overwrites user-edited files. Re-running only refreshes `projects.json` and the managed AGENTS.md section.
- **Manuscript home is optional.** The PM folder works standalone for brainstorming, literature review, grant writing, and planning. Add a manuscript repo when you're ready.

## 📄 License

MIT. See [LICENSE](LICENSE).
