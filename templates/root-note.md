---
title: <Project>
tags:
  - project
  - folder-note
  - <project-slug>
pageType: index
created: <YYYY-MM-DD>
owner: <owner>
icon: "<LiIconName>"
iconColor: "#<hex>"
updated: <YYYY-MM-DD>
last_reviewed: <YYYY-MM-DD>
status: active
---
# <Project>

> <NOTES>

<SUBFOLDERS_INDEX>

## Optional Lanes

- `verification/` — data verification reports, reproducibility checks, hand-calculation logs, cross-file consistency audits
- `submissions/` — submission packages, cover letters, reviewer responses
- `admin/` — funding, travel, compliance, deadlines
- `ethics/` — IRB, consent, privacy, human-subjects documentation
- `collaboration/` — shared notes with co-authors

## Navigation

- [[RESEARCH|Research framing]]
- [[CURRENT_STATUS|Current priorities]]
- [[README|Project README]]

<!--
Canonical root folder note shape for academic PM projects. Mirrors
the generic `project-management` skill's root note format so the two
shapes stay aligned. The `<NOTES>` placeholder above is rendered into
a blockquote by `scripts/bootstrap-academic-pm.mjs` (the project's
one-line description); the `<SUBFOLDERS_INDEX>` placeholder is
replaced by the bootstrap's `indexBlock()` output, which brackets
`## Subfolders` and `## Notes` with the standard
`vault-maintain:index` markers so the vault-maintain script can
regenerate them.

Field order: title, tags, pageType, created, owner, [icon, iconColor],
updated, last_reviewed, status — matching the canonical folder note
frontmatter order. The icon / iconColor slots are optional; omit
when the project has no icon.

`## Optional Lanes` is the +1 extra section permitted for the root
note (the academic equivalent of the generic skill's `## Features`).
Keep the lane catalog short; per-lane detail belongs under the lane
folder notes (`literature/literature.md`, etc.).

Body-bloat and section-count rules from the generic
project-management skill's `check-vault-structure.mjs` apply when an
academic PM folder is scanned with that validator; this skill's own
`check-academic-pm.mjs` enforces academic-specific structure.
-->