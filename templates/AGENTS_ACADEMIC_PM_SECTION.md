## Academic PM folder

This project has an academic PM folder at `<pm_folder>`. The paper artifact and analysis code live at `<manuscript_home>` (`<manuscript_kind>`, access `<manuscript_access>`). The PM folder's `README.md` wins for routing.

Before coding or writing:
- Read the PM folder's `README.md` to know the routing map.
- Read `RESEARCH.md` for the research question, contribution, claims, scope, and target venue.
- Read `CURRENT_STATUS.md` for current phase, priorities, blockers, and recent progress.
- If a `planning/<date>_slug.md` note is in progress, read it for design rationale.
- If your change affects a coherent feature or analysis, read `analysis/` and the relevant `writing/` notes.

After coding or writing:
- Did current methods, data processing, or analysis behavior change? If yes, update the relevant `analysis/` note (methods, findings, interpretations, modeling decisions, methodology/process audits).
- Did a data verification report, reproducibility check, hand-calculation log, or cross-file consistency audit change? If yes, update `verification/` (optional lane).
- Did the underlying data or its provenance change? If yes, update `evidence/` (source registry, measurement definitions, data risks).
- Did the manuscript outline, draft, figures, tables, or submission status change? If yes, update `writing/` (do not duplicate manuscript prose in either the PM folder or the code side of the manuscript home).
- Did a literature note, citation, or reading-queue item change? If yes, update `literature/`.
- Did an active planning plan complete, partially complete, or get superseded? If yes, update `planning/` and reflect the outcome in `CURRENT_STATUS.md`.
- Did a new bug, data risk, reproducibility gap, or blocker appear? If yes, note it in `analysis/` (with verification details in `verification/` if applicable) and surface it in `CURRENT_STATUS.md`.
- Did the research framing or scope shift? If yes, update `RESEARCH.md`.
- Did a research decision worth durably recording happen? If yes, add a note in `planning/` (lightweight ADR-style) with the rationale and alternatives considered.
- Did any note get added, moved, renamed, archived, or deleted? If yes, update the affected folder indexes in the same session.
- Always add a `history/YYYY-MM-DD-<slug>.md` (or `history/YYYY-MM/...`) bullet for what changed and why.

Strict routing:
- Research state (questions, claims, evidence, literature notes, advisor meetings, decisions, history) lives in the PM folder, not in `<manuscript_home>`.
- Executable artifacts (manuscript source, analysis scripts, figures, configs, replication code) live at `<manuscript_home>`, not in the PM folder.
- The PM folder and the manuscript home share this single `AGENTS.md` as their routing entry point.
- If a coding or writing task needs research state that is not in the PM folder, stop and ask. Do not invent research state at `<manuscript_home>` or in this `AGENTS.md`.

If the PM folder path is unknown, check the academic-project-management skill's `projects.json` for the project's `pm_folder` field, or ask the maintainer.

The full convention is documented in the academic-project-management skill at `<skill_dir>/SKILL.md` (specifically the "Manuscript Home And AGENTS.md Integration" section).
