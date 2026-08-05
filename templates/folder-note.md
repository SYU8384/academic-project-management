---
title: <folder>
tags: [folder-note]
pageType: index
created: <YYYY-MM-DD>
owner: <owner>
icon: "<LiIconName>"
iconColor: "#<hex>"
updated: <YYYY-MM-DD>
last_reviewed: <YYYY-MM-DD>
status: active
---
# <folder>

> <One sentence: what this folder is for.>

<!-- vault-maintain:index:start -->
## Subfolders

*(no items)*

## Notes

*(no items)*
<!-- vault-maintain:index:end -->

## Navigation

- [[<Project>|Back to <Project>]]

<!--
Canonical lane folder note shape for academic PM projects. Mirrors
the generic `project-management` skill's `templates/folder-note.md`
so the two skills produce consistent folder note indexes. The body
shape is standardized: blockquote description → vault-maintain index
block (Subfolders + Notes) → Navigation. The `## Optional Lanes`
extra section in the academic root note (`templates/root-note.md`)
is the root-note-only +1 extra; lane folder notes do not add extra
sections.

Field order: title, tags, pageType, created, owner, [icon, iconColor],
updated, last_reviewed, status — matching the canonical folder note
frontmatter order. The icon / iconColor slots are optional.

This template is documentation-only; the bootstrap script generates
academic lane notes with its own `frontmatter()` helper rather than
loading this file.
-->