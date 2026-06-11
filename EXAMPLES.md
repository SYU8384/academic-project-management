# Examples

End-to-end recipes for the academic-project-management skill. Each recipe is a real scenario the bootstrap and check scripts can execute end-to-end. Run them in `/tmp/opencode` first to see the effect, then adapt to your project.

All examples assume `SKILL_DIR=/home/syu/.agents/skills/academic-project-management`. Adjust to your install path.

---

## Recipe Index

Quick mapping from user phrases to skill actions. Use this to find the recipe that matches what the user said.

| User says | Action | Recipe |
|---|---|---|
| "set up academic project", "initialize the pm folder", "bootstrap the pm folder" | bootstrap a new project | [Recipe 1](#recipe-1-set-up-a-new-project-from-scratch) |
| "declare manuscript home", "wire the AGENTS.md", "link the code repo" | bootstrap with `--manuscript-*` flags | [Recipe 2](#recipe-2-declare-a-manuscript-home-on-an-existing-project) |
| "re-bootstrap", "refresh projects.json", "switch manuscript access" | re-run bootstrap (idempotent) | [Recipe 3](#recipe-3-re-bootstrap-after-changing-manuscript-access) |
| "recover from bad access", "switch from unavailable to authoritative" | re-run bootstrap with new `--access` | [Recipe 4](#recipe-4-recover-from-a-bad-access-value) |
| "log this", "record this meeting", "log advisor feedback", "record analysis finding", "log this decision" | `bootstrap-academic-pm.mjs --action log` | [Recipe 7](#recipe-7-log-a-session-of-work) |
| "repair the pm folder", "fix the index", "reconcile drift", "fix missing folder notes" | `bootstrap-academic-pm.mjs --action repair` | [Recipe 6](#recipe-6-repair-drift-after-adding-files) |
| "audit the pm folder", "validate the project", "what's wrong with this folder" | `check-academic-pm.mjs` (Quick Health Check) | — |
| "run the self-test", "test the skill scripts" | `scripts/test/run-tests.mjs` | [Recipe 5](#recipe-5-run-the-self-test) |

---

## Recipe 1: Set up a new project from scratch

Scenario: you have an empty Obsidian folder for a new paper, and you want a fully scaffolded PM folder with a registered `projects.json` entry.

```bash
PROJ=Paper1
PM="/path/to/Obsidian Vaults/<vault>/Research Projects/$PROJ"
node $SKILL_DIR/scripts/bootstrap-academic-pm.mjs \
  --project "$PROJ" \
  --pm-folder "$PM" \
  --phase idea \
  --notes "One-line project summary." \
  --config "$SKILL_DIR/projects.json"
```

This creates the standard 12-file scaffold (3 root files + `<Project>.md` + 8 lane notes) and the 8 lane folders, registers the project locally, and (in this case) records `manuscript_home = ""` because no `--manuscript-home` was passed. The PM folder is now wired.

Verify:

```bash
node $SKILL_DIR/scripts/check-academic-pm.mjs \
  --project "$PROJ" \
  --config "$SKILL_DIR/projects.json"
```

Expected: `Status: PASS`, `Errors: 0`, `Warnings: 0`.

---

## Recipe 2: Declare a manuscript home on an existing project

Scenario: you've been working in a paper repo (`~/Code/Paper1/`) with `.tex`, `.R`, and figures. Now you want the PM agent to know about it and to wire the repo's `AGENTS.md` so any coding or writing agent that opens the repo gets routed back to the PM folder.

```bash
PROJ=Paper1
PM="/path/to/Obsidian Vaults/<vault>/Research Projects/$PROJ"
REPO="/path/to/Paper1"

# In production, REPO is a real git repo. Bootstrap will:
#   - update projects.json with manuscript_home / manuscript_kind / manuscript_access
#   - create or update <REPO>/AGENTS.md with a managed "## Academic PM folder" section
#     bounded by <!-- academic-project-management:section:start --> / :end --> markers
#   - leave any user content outside the markers untouched (append-safe)
node $SKILL_DIR/scripts/bootstrap-academic-pm.mjs \
  --project "$PROJ" \
  --pm-folder "$PM" \
  --phase analysis \
  --notes "..." \
  --config "$SKILL_DIR/projects.json" \
  --manuscript-home "$REPO" \
  --manuscript-kind git-repo \
  --manuscript-access authoritative
```

After this, the validator checks the wiring:

```bash
node $SKILL_DIR/scripts/check-academic-pm.mjs \
  --project "$PROJ" \
  --config "$SKILL_DIR/projects.json"
```

Expected: `Status: PASS`, plus a `Manuscript home:` block at the bottom showing `path`, `kind: git-repo`, `access: authoritative`.

If the PM folder is renamed or moved, the path inside `<REPO>/AGENTS.md` will diverge from `projects.json`. The validator detects this as a **drift error** and tells you the declared vs. registered path. Re-run the bootstrap command above to refresh the section in place (the marker-block machinery preserves any user content outside the markers).

---

## Recipe 3: Re-bootstrap after changing manuscript access

Scenario: you previously declared the manuscript home with `--manuscript-access authoritative`. Now you want to switch to `read-only` (or `none`) because you've handed the repo off to a collaborator and should not write to their AGENTS.md anymore.

```bash
# Re-run with the new access value. The bootstrap script will:
#   - update projects.json: manuscript_access changes from "authoritative" to "read-only"
#   - detect the existing AGENTS.md section and update its "access `read-only`" line in place
#   - leave all other manuscript_home and manuscript_kind fields unchanged
#   - preserve any user content outside the marker block
node $SKILL_DIR/scripts/bootstrap-academic-pm.mjs \
  --project "$PROJ" \
  --pm-folder "$PM" \
  --phase analysis \
  --notes "..." \
  --config "$SKILL_DIR/projects.json" \
  --manuscript-home "$REPO" \
  --manuscript-kind git-repo \
  --manuscript-access read-only
```

After this, the bootstrap script's `writeManuscriptHomeAgentsMd()` short-circuits (`manuscript_access === "read-only"` → skip the write). But the existing managed section is still updated to reflect the new `read-only` value because the file already exists and the access change is part of the metadata. To stop touching `<REPO>/AGENTS.md` entirely on future re-bootstraps, use `--manuscript-access none`.

To verify nothing was lost:

```bash
node $SKILL_DIR/scripts/check-academic-pm.mjs \
  --project "$PROJ" \
  --config "$SKILL_DIR/projects.json"
```

If the section marker block is intact, the validator PASSes with a note: `access: read-only`, `note: manuscript_access=read-only` (no AGENTS.md checks performed on subsequent runs).

---

## Recipe 4: Recover from a bad access value

Scenario: you registered a project with `access: unavailable` (PM folder is on a different machine you don't have access to). The validator previously returned `SKIP`. Now you have access — switch to `authoritative` and re-bootstrap.

```bash
# Edit projects.json directly OR re-bootstrap with --access authoritative.
# Re-bootstrap is safer because it also re-applies all other defaults.
node $SKILL_DIR/scripts/bootstrap-academic-pm.mjs \
  --project "$PROJ" \
  --pm-folder "$PM" \
  --phase analysis \
  --notes "..." \
  --config "$SKILL_DIR/projects.json" \
  --access authoritative
```

Note: the bootstrap script does **not** re-scaffold the PM folder if the standard layout already exists (it detects the existing scaffold and skips to `projects.json` + AGENTS.md updates only). So this command is safe to re-run; it just updates the `access` field.

After this, `check-academic-pm.mjs` runs all the structural checks against the PM folder and the AGENTS.md wiring.

---

## Recipe 5: Run the self-test

The skill ships with a self-test that exercises the deterministic parts of the bootstrap and check scripts against real temp folders. Useful after editing the scripts, or as a regression suite when you upgrade Node.

```bash
node $SKILL_DIR/scripts/test/run-tests.mjs
```

Expected: 18/18 passed, exit 0. The test creates temp folders under `/tmp/opencode/apm-test-*` and cleans them up implicitly (the tempdirs accumulate but don't interfere with anything; clean them up with `rm -rf /tmp/opencode/apm-test-*` if desired).

The test covers:
- T1 scaffold creation with lane-specific content
- T2 bootstrap idempotency on existing scaffold
- T3 AGENTS.md creation with managed section
- T4 AGENTS.md section replace-in-place (idempotent marker-block behavior)
- T5 `--no-manuscript-home` skips AGENTS.md write
- T6 cross-field invariant: `--manuscript-kind git-repo` without `--manuscript-home` errors
- T7 validator PASS on fresh scaffold
- T8 validator FAIL on missing required file
- T9 `--manuscript-access read-only` skips AGENTS.md write
- T10 re-bootstrap preserves user edits in every required file
- T11 projects.json schema after bootstrap
- T12 repair adds missing subfolder/notes entries to lane indexes
- T13 repair recreates missing folder notes
- T14 repair on a fresh project reports no drift
- T15 `--action log` creates a dated history entry
- T16 `--action log` updates affected lane Notes index
- T17 `--action log` rejects nonexistent `--note` paths
- T18 `--action log` errors when `--event` is missing

---

## Recipe 6: Repair drift after adding files

Scenario: you've been working in your PM folder for a few weeks. You've added notes to `analysis/`, created a new subdirectory `analysis/replication/`, and created a new optional folder `submissions/`. The validator now reports drift warnings about missing index entries and missing folder notes.

```bash
PROJ=Paper1
PM="/path/to/Obsidian Vaults/<vault>/Research Projects/$PROJ"
node $SKILL_DIR/scripts/bootstrap-academic-pm.mjs \
  --project "$PROJ" \
  --pm-folder "$PM" \
  --action repair \
  --config "$SKILL_DIR/projects.json"
```

What `repair` does:
- Re-creates missing required and optional folder notes from the templates.
- Adds missing subfolders to each lane's `## Subfolders` index in place (preserves existing entries and descriptions).
- Adds missing notes to each lane's `## Notes` index in place.
- Adds missing optional folders to the root note's `## Subfolders` index.

What `repair` does **not** do:
- Move user notes between lanes (content-level routing is human judgment).
- Reorder existing entries or rewrite descriptions (insert-only).
- Touch the manuscript-home `AGENTS.md` section (managed separately by bootstrap).
- Delete anything.

Verify after repair:

```bash
node $SKILL_DIR/scripts/check-academic-pm.mjs \
  --project "$PROJ" \
  --config "$SKILL_DIR/projects.json"
```

If you only want to see what would change without writing, pass `--dry-run`:

```bash
node $SKILL_DIR/scripts/bootstrap-academic-pm.mjs \
  --project "$PROJ" \
  --pm-folder "$PM" \
  --action repair \
  --config "$SKILL_DIR/projects.json" \
  --dry-run
```

---

## Recipe 7: Log a session of work

Scenario: you've finished a unit of work — fixed an analysis bug, recorded an advisor meeting, made a research decision — and want to record it in the project's history. The PM folder is already scaffolded.

```bash
PROJ=Paper1
PM="/path/to/Obsidian Vaults/<vault>/Research Projects/$PROJ"
node $SKILL_DIR/scripts/bootstrap-academic-pm.mjs \
  --project "$PROJ" \
  --pm-folder "$PM" \
  --config "$SKILL_DIR/projects.json" \
  --action log \
  --event "Fixed Issue #1 in unique-count table" \
  --note analysis/2026-06-11-issue-fix.md \
  --note analysis/analysis.md
```

What happens:
- A new history entry `history/YYYY-MM-DD-fixed-issue-1-in-unique-count-table.md` is created with frontmatter `kind: log`, `event: "..."` and a body containing `## What Changed` with wiki links to each `--note` path.
- The touched lane's `## Notes` index (`analysis/analysis.md`) gets the new history entry added.
- The history folder note (`history/history.md`) gets the new history entry added to its `## Notes` index.
- If a file with the same name already exists (same day, same event), `-2`, `-3`, etc. are appended until the filename is unique.

Common types:
- `--type log` (default): a session of work.
- `--type decision`: a research decision worth durably recording.
- `--type review`: a periodic review of lane content.
- `--type audit`: a structural or reproducibility audit.

Constraints:
- `--event` is required.
- At least one `--note` is required; paths must already exist in the PM folder.
- `--note` paths must be relative to the PM folder (no `..` or absolute paths).
- `--log` does not modify any of the touched files; it only updates indexes.
