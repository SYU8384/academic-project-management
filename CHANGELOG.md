# Changelog

All notable changes to this skill are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
