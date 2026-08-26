# Changelog

All notable changes to this skill are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-08-26

### Added

- Canonical **Research Project PM** and **Research Program PM** model. New program registries use `programs`, `program_id`, `work_id`, `work_type`, and ordered `projects`; project labels may be articles, chapters, studies, or other work units.
- `scripts/manage-research-program.mjs` for program infrastructure, meetings, Inbox workflows, and explicit project adoption.
- Safe `adopt-project --mode bridge` conversion. It updates registry membership only and never moves PM folders, repositories, or artifacts.
- Program validation through `check-academic-pm.mjs --program`, plus fixtures for chapter-oriented programs, legacy series compatibility, and no-relocation bridge adoption.

### Changed

- Public documentation, templates, examples, and agent prompts now use canonical Research Program/Project terminology. Existing `series`, `series_id`, `paper_id`, `papers`, `--series`, and `manage-paper-series.mjs` remain supported without silent conversion.

## [1.2.0] - 2026-08-25

### Added

- `scripts/check-academic-closeout.mjs`: session close-out guard ported from project-management's `check-pm-closeout.mjs`, adapted to the two-folder academic model. Matches the current git repo (or `--manuscript-home`) to a registered project by `manuscript_home`, detects manuscript changes (worktree + commits since `--since` for git repos, mtime walk for local folders), and fails unless `CURRENT_STATUS.md` and/or a current-day `history/` entry was updated since the baseline. Skips cleanly for projects with `manuscript_kind: null` or `manuscript_access: none`; `access: read-only` projects get suggest-only output. `--allow-no-impact "<reason>"` records intentional no-PM sessions. Exit codes: 0 pass/skip, 1 close-out required, 2 usage error.
- `scripts/check-reorg-candidates.mjs`: read-only reorganization candidate detector ported from project-management, with signals adapted to academic lanes: tiny notes (with a `templateShaped` flag for notes still carrying template placeholders), stale notes, orphan notes (no inbound wikilinks outside `history/`/`archive/`), similar/overlap pairs (slug-token gated, academic stopwords), supersession hints across `planning/` and `writing/`, stale lane indexes (folder note lags newest lane note by >14 days), and archive candidates (active-lane notes untouched >180 days). Human table by default, `--json` for machine output, `REORG_*` env-var thresholds, exit 0 always, never edits anything.
- `scripts/migrate.mjs` + `scripts/migrations/` + `scripts/lib/check-academic-pm-migrations.mjs`: versioned applied-once migrations framework ported from project-management. Registry `_index.mjs`, per-PM-folder `.pm/migrations.json` ledger, `--list/--project/--pm-folder/--migration/--force/--dry-run/--yes` CLI. Ships one real migration, `1.2.0-registry-manuscript-defaults`, which backfills missing `project_type`/`manuscript_home`/`manuscript_kind`/`manuscript_access` keys in `projects.json` entries without overwriting existing values. `check-academic-pm.mjs` now reports pending migrations as warnings (`pendingMigrations` in `--json`).
- `install.ps1`: native Windows PowerShell installer mirroring `install.sh` (targets `codex`/`agents`/`claude`/`openclaw`, `-Dest`, `-Ref`/`-Channel v1|main`, dirty-tree update guard, seeds `%USERPROFILE%\.config\academic-pm\projects.json`). README gains the Path C quick-start section; Path B now notes its commands do not run in native PowerShell/`cmd.exe`.
- `scripts/check-academic-skill.mjs`: skill-repo self-check (ported from project-management's `check-skill.mjs`) validating the shipped skill itself — stale doc phrases, unresolved template placeholders, doc references to nonexistent scripts/templates, version mentions vs `VERSION`, CHANGELOG head vs `VERSION`, and template/bootstrap drift (required lanes ↔ templates, `openclaw-instruction.md` section-3 contract used by `sync-openclaw-apm-section.mjs`).
- `templates/meeting-record.md`: per-meeting note template (attendees, agenda, discussion notes, attributed feedback, decisions, action items with owner+due, follow-ups) for the `meetings/` lane, documented in SKILL.md Workflow 3.
- SKILL.md trigger rows for close-out ("close out", "did we log this work"), reorganize ("organize/tidy PM folder"), and migrate ("run migrations", "backfill registry"); Commands section entries for all three scripts.
- Self-tests T30–T34 covering the skill self-check, migration backfill idempotency, close-out guard fail-then-pass, reorg detector signals + `--json`, and install.ps1 static sanity. Suite now 37/37.

## [1.1.0] - 2026-08-25

### Added

- `scripts/sync-openclaw-apm-section.mjs`: drift-detection and sync tool for the `## Academic Project Management` block in OpenClaw workspace `AGENTS.md` files, ported from project-management's `sync-openclaw-pm-section.mjs`. The template is sourced from `openclaw-instruction.md` section 3 and stamped with `<!-- pm-skill: skill_version=... pm_section_sha=... -->`; `--check` prints a drift table (MISSING / UNSTAMPED / DRIFT_SHA / DRIFT_VERSION / IN_SYNC), `--apply` shows the full diff and requires per-workspace confirmation (`--force` skips it), `--bootstrap <path>` does first-time insert, and `--workspace <path>` limits scope. Discovery defaults to `~/.openclaw/workspace*/AGENTS.md`. Exit codes: 0 in sync/applied, 1 drift, 2 invalid args, 3 declined.
- Self-tests T27–T29 in `scripts/test/run-tests.mjs` covering bootstrap-then-IN_SYNC, drift detection for MISSING/UNSTAMPED/DRIFT_SHA, and `--apply --force` healing while preserving surrounding content. Suite now 32/32.
- MIT `LICENSE` file; the README has linked to it since the repo's first release.

### Changed

- `README.md` rewritten as a benefit-led landing page (354 → ~100 lines), modeled on the project-management README: hero pitch, "Why This Exists," Highlights, Path A (OpenClaw) / Path B (curl|bash) Quick Start, compact Triggers table, one-paragraph PM Folder at a Glance, and a Maintainer Corner table. The conversational setup walkthrough, ASCII folder tree, validator checklist, `projects.json` schema, workflow diagram, manuscript-kind table, and Design Principles were removed from the README (all live in `REFERENCE.md`/`EXAMPLES.md`).
- `SKILL.md` "OpenClaw Integration" section documents the new workspace sync script (check/apply/bootstrap usage).
- `openclaw-instruction.md` section 3 documents the sync script and notes the managed-block caveat: stamp-based drift detection does not see hand-edits that leave the stamp intact, so the block should be treated as read-only.

## [1.0.0] - 2026-06-11

Initial release: PM-folder scaffold with academic lanes (literature, evidence, analysis, writing, meetings, planning, history, archive), `bootstrap-academic-pm.mjs` (bootstrap / repair / log), `check-academic-pm.mjs` validator, `sync-agents-section.mjs` manuscript-home AGENTS.md sync, OpenClaw instruction, and the `scripts/test/run-tests.mjs` self-test suite.
