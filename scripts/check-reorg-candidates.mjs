#!/usr/bin/env node
/**
 * check-reorg-candidates.mjs
 *
 * Read-only detector for academic PM folder reorganization candidates.
 * Scans an academic-project-management PM folder and emits a report of
 * deterministic signals an agent can use to propose merges, retirements,
 * archive moves, supersession declarations, and index refreshes.
 *
 * This script NEVER merges, moves, or edits anything. Candidate detection
 * is deterministic; the merge/retire/supersede decision belongs to the
 * agent + human reorganization workflow.
 *
 * Ported from the sibling `project-management` skill's
 * scripts/check-reorg-candidates.mjs and adapted to the academic lane
 * model (REFERENCE.md → Folder Model):
 *
 *   Lane notes (literature/, evidence/, analysis/, writing/, meetings/,
 *   planning/, and any optional lanes present — excluding folder notes):
 *     tiny           — body prose under REORG_TINY_LINES meaningful lines;
 *                      entries flagged `templateShaped` when the note still
 *                      carries template placeholders ("TBD.", "<YYYY-MM-DD>")
 *     stale          — `updated` (fallback `last_reviewed`) older than
 *                      REORG_STALE_DAYS
 *     orphan         — zero inbound wikilinks from live lanes
 *     similar-pair   — slug/heading token Jaccard >= REORG_SIMILARITY,
 *                      gated on a shared slug token (suppresses template
 *                      noise from identical section headings)
 *
 *   Supersession hints (planning/ decisions and writing/ drafts):
 *     similar pairs where neither note links to or declares a
 *     supersession relationship with the other
 *
 *   Lane indexes:
 *     stale-index    — folder note `updated` older than the newest note
 *                      `updated` in the lane by more than
 *                      REORG_INDEX_LAG_DAYS (default 14, matching the
 *                      CURRENT_STATUS freshness cadence in REFERENCE.md)
 *
 *   Archive candidates:
 *     notes in active lanes untouched for more than REORG_ARCHIVE_DAYS
 *     (default 180) — candidates to move to archive/
 *
 * "Live lanes" for inbound-link counting means every .md file outside
 * history/ and archive/ — links from those lanes are historical record
 * and do not keep a note live.
 *
 * Usage:
 *   node scripts/check-reorg-candidates.mjs --path <academic-pm-folder>
 *   node scripts/check-reorg-candidates.mjs <academic-pm-folder>
 *   node scripts/check-reorg-candidates.mjs --project <name> [--config <p>]
 *   node scripts/check-reorg-candidates.mjs [--config <p>]      # all projects
 *   node scripts/check-reorg-candidates.mjs ... --json          # machine output
 *
 * Configuration via env:
 *   REORG_STALE_DAYS      default 90
 *   REORG_TINY_LINES      default 40
 *   REORG_SIMILARITY      default 0.5
 *   REORG_INDEX_LAG_DAYS  default 14
 *   REORG_ARCHIVE_DAYS    default 180
 *
 * Exit code is always 0 (report, not a gate); 2 on argument/config errors.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import os from "node:os";
import { basename, join, relative, resolve } from "node:path";

const STALE_DAYS = Number(process.env.REORG_STALE_DAYS ?? 90);
const TINY_LINES = Number(process.env.REORG_TINY_LINES ?? 40);
const SIMILARITY = Number(process.env.REORG_SIMILARITY ?? 0.5);
const INDEX_LAG_DAYS = Number(process.env.REORG_INDEX_LAG_DAYS ?? 14);
const ARCHIVE_DAYS = Number(process.env.REORG_ARCHIVE_DAYS ?? 180);

const DEFAULT_CONFIG_PATH = join(os.homedir(), ".config", "academic-pm", "projects.json");

const today = new Date().toISOString().slice(0, 10);

// --- CLI ----------------------------------------------------------------

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = { path: null, config: null, project: null, json: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--config" || args[i] === "-c") out.config = args[++i];
    else if (args[i] === "--project" || args[i] === "-p") out.project = args[++i];
    else if (args[i] === "--path") out.path = args[++i];
    else if (args[i] === "--json") out.json = true;
    else if (args[i] === "--help" || args[i] === "-h") out.help = true;
    else if (!args[i].startsWith("-")) out.path = args[i];
    else {
      console.error(`ERROR: unknown argument: ${args[i]}`);
      process.exit(2);
    }
  }
  return out;
}

const CLI = parseArgs(process.argv);

if (CLI.help) {
  console.log(`Usage:
  check-reorg-candidates.mjs [--path] <academic-pm-folder> [--json]
  check-reorg-candidates.mjs --project <ProjectName> [--config <projects.json>] [--json]
  check-reorg-candidates.mjs [--config <projects.json>] [--json]   # all projects

Env thresholds: REORG_STALE_DAYS=90 REORG_TINY_LINES=40 REORG_SIMILARITY=0.5
                REORG_INDEX_LAG_DAYS=14 REORG_ARCHIVE_DAYS=180`);
  process.exit(0);
}

function resolveTargets() {
  if (CLI.path) {
    const root = resolve(CLI.path);
    return [{ root, label: root }];
  }
  const configPath = resolve(CLI.config ?? DEFAULT_CONFIG_PATH);
  if (!existsSync(configPath)) {
    if (CLI.project) {
      console.error(`ERROR: config not found: ${configPath}`);
      process.exit(2);
    }
    return [{ root: process.cwd(), label: process.cwd() }];
  }
  const cfg = JSON.parse(readFileSync(configPath, "utf8"));
  if (CLI.project) {
    const proj = cfg.projects?.[CLI.project];
    if (!proj?.pm_folder) {
      console.error(`ERROR: project '${CLI.project}' has no pm_folder in ${configPath}`);
      process.exit(2);
    }
    return [{ root: resolve(proj.pm_folder), label: `${CLI.project} (${proj.pm_folder})` }];
  }
  return Object.entries(cfg.projects ?? {})
    .filter(([, proj]) => Boolean(proj.pm_folder))
    .map(([name, proj]) => ({ root: resolve(proj.pm_folder), label: `${name} (${proj.pm_folder})` }));
}

// --- Markdown helpers (inlined from the sibling skill's lib/markdown.mjs
// --- and lib/obsidian-links.mjs so this script stays dependency-free) ---

function parseFrontmatter(content) {
  const match = content.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)?/);
  if (!match) return null;
  const out = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

function stripFrontmatter(content) {
  const match = content.match(/^﻿?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)?/);
  return match ? content.slice(match[0].length) : content;
}

function isSkippableLine(line) {
  const t = line.trim();
  if (t === "") return true;
  if (t.startsWith("<!--") && t.endsWith("-->")) return true;
  if (t.startsWith("<!-- vault-maintain")) return true;
  return false;
}

function countMeaningfulLines(lines) {
  return lines.filter((l) => !isSkippableLine(l)).length;
}

function wikiLinks(content) {
  return [...content.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g)].map((m) => m[1]);
}

function normalizeLinkPath(value) {
  return String(value ?? "")
    .replace(/\\/g, "/")
    .replace(/\.md$/i, "")
    .replace(/^\/+/, "")
    .trim();
}

// --- .pm/skip (same convention as the sibling skill; optional) ---------

function loadPmSkip(pmFolder) {
  const path = join(pmFolder, ".pm", "skip");
  const out = new Set();
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    out.add(trimmed);
  }
  return out;
}

function isSkipped(skipSet, relPath) {
  if (skipSet.size === 0) return false;
  if (skipSet.has(relPath)) return true;
  return skipSet.has(basename(relPath));
}

// --- PM folder scanning -------------------------------------------------

const SKIP_DIRS = new Set([".obsidian", ".git", "node_modules", "scripts", ".workspace"]);
const SKIP_FILES = new Set(["README.md", "RESEARCH.md", "CURRENT_STATUS.md"]);
const HISTORICAL_LANES = new Set(["history", "archive"]);
const ACTIVE_LANES = new Set([
  "literature",
  "evidence",
  "analysis",
  "writing",
  "meetings",
  "planning",
  "verification",
  "submissions",
  "admin",
  "ethics",
  "collaboration",
]);

function walk(root, skipSet) {
  const out = [];
  function rec(abs) {
    let entries;
    try {
      entries = readdirSync(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const child = join(abs, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        rec(child);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        const rel = relative(root, child).split("\\").join("/");
        if (isSkipped(skipSet, rel)) continue;
        out.push({ abs: child, rel });
      }
    }
  }
  rec(root);
  return out;
}

function topLane(rel) {
  return rel.split("/", 1)[0];
}

// Lane folder notes are named after their folder (literature/literature.md).
// Root notes sit at depth 1 (<Project>.md); they are excluded from lane
// scanning by the lane filter, but recognized here for completeness.
function isFolderNote(rel) {
  const parts = rel.split("/");
  const file = parts[parts.length - 1];
  const parent = parts.length > 1 ? parts[parts.length - 2] : null;
  return Boolean(parent && file === `${parent}.md`);
}

function daysBetween(a, b) {
  const da = Date.parse(`${a}T00:00:00Z`);
  const db = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(da) || Number.isNaN(db)) return null;
  return Math.round((db - da) / 86_400_000);
}

const STOPWORDS = new Set([
  "the", "a", "an", "of", "for", "and", "to", "in", "on", "with", "how", "what",
  "md", "note", "notes", "doc", "docs", "guide", "page",
  // Generic template section headings. Templated notes share these, and
  // without filtering them every same-template pair looks "similar".
  "overview", "summary", "status", "related", "usage", "example", "examples",
  "details", "links", "background", "purpose", "scope", "description",
  "contents", "reference", "references", "conventions", "rules",
  // Academic template headings (templates/literature.md, planning.md, ...).
  "reading", "queue", "themes", "gaps", "citation", "active", "plans",
  "decisions", "draft", "figures", "tables", "submission", "revision",
  "navigation", "subfolders",
]);

function tokenize(text) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function slugTokens(rel) {
  const slug = basename(rel, ".md")
    .replace(/^D-\d{3}[_-]*/i, " ")
    .replace(/^\s*\d{4}-\d{2}-\d{2}[_-]*/, " ");
  return new Set(tokenize(slug));
}

function tokensFor(rel, content) {
  const body = stripFrontmatter(content);
  const headings = [...body.matchAll(/^#{1,3}\s+(.+)$/gm)].map((m) => m[1]).join(" ");
  return new Set([...slugTokens(rel), ...tokenize(headings)]);
}

function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

// Pairs only qualify as merge/overlap/supersession candidates when their
// filename slugs share at least one meaningful token. Heading-only overlap
// is almost always template noise (every note has the same template H2s).
function sharesSlugToken(aRel, bRel) {
  const a = slugTokens(aRel);
  const b = slugTokens(bRel);
  for (const t of a) if (b.has(t)) return true;
  return false;
}

function declaresRelationshipWith(content, otherRel) {
  const otherBase = basename(otherRel, ".md");
  if (content.includes(otherBase)) return true;
  return /(?:supersedes|superseded by|replaced by|replacement|deprecated by):/i.test(content);
}

function collectInbound(files, contentByRel) {
  const inbound = new Map();
  for (const { rel } of files) inbound.set(rel, new Set());
  const known = new Set(files.map((f) => f.rel.replace(/\.md$/i, "")));
  const byBasename = new Map();
  for (const { rel } of files) {
    const key = basename(rel, ".md").toLowerCase();
    if (!byBasename.has(key)) byBasename.set(key, []);
    byBasename.get(key).push(rel);
  }
  for (const { rel } of files) {
    if (HISTORICAL_LANES.has(topLane(rel))) continue;
    const content = contentByRel.get(rel) ?? "";
    for (const rawTarget of wikiLinks(content)) {
      const target = normalizeLinkPath(rawTarget);
      if (!target) continue;
      let resolved = null;
      if (known.has(target)) {
        resolved = `${target}.md`;
      } else {
        const suffix = target.split("/").slice(-2).join("/");
        if (known.has(suffix)) resolved = `${suffix}.md`;
      }
      if (!resolved) {
        const candidates = byBasename.get(basename(target).toLowerCase()) ?? [];
        if (candidates.length === 1) resolved = candidates[0];
      }
      if (resolved && resolved !== rel && inbound.has(resolved)) {
        inbound.get(resolved).add(rel);
      }
    }
  }
  return inbound;
}

// A note still shaped like its template when its body carries the template
// placeholder markers. Used to distinguish "stub note never filled in" from
// "genuinely short note".
function isTemplateShaped(content) {
  const body = stripFrontmatter(content);
  return /\bTBD\./.test(body) || /<YYYY-MM-DD>/.test(content) || /\*\(no items\)\*/.test(body);
}

// --- Per-folder scan -----------------------------------------------------

function runFor(target) {
  const skipSet = loadPmSkip(target.root);
  const files = walk(target.root, skipSet).filter(({ rel }) => !SKIP_FILES.has(basename(rel)));
  const contentByRel = new Map();
  const fmByRel = new Map();
  for (const { abs, rel } of files) {
    let content = "";
    try {
      content = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    contentByRel.set(rel, content);
    fmByRel.set(rel, parseFrontmatter(content) ?? {});
  }
  const inbound = collectInbound(files, contentByRel);

  const report = {
    label: target.label,
    root: target.root,
    generated: today,
    thresholds: {
      staleDays: STALE_DAYS,
      tinyLines: TINY_LINES,
      similarity: SIMILARITY,
      indexLagDays: INDEX_LAG_DAYS,
      archiveDays: ARCHIVE_DAYS,
    },
    notes: { tiny: [], stale: [], orphan: [], similarPairs: [] },
    supersessionHints: [],
    staleLaneIndexes: [],
    archiveCandidates: [],
  };

  function dateOf(rel, fields) {
    const fm = fmByRel.get(rel) ?? {};
    for (const field of fields) {
      if (fm[field] && daysBetween(fm[field], today) != null) return fm[field];
    }
    return null;
  }

  // Lane notes: any .md under an active lane that is not the lane folder note.
  const laneNoteRels = files
    .map((f) => f.rel)
    .filter((rel) => ACTIVE_LANES.has(topLane(rel)) && rel.includes("/") && !isFolderNote(rel));

  for (const rel of laneNoteRels) {
    const content = contentByRel.get(rel) ?? "";
    const fm = fmByRel.get(rel) ?? {};
    if (["deprecated", "superseded", "archived"].includes(fm.status)) continue;
    const bodyLines = countMeaningfulLines(stripFrontmatter(content).split("\n"));
    if (bodyLines < TINY_LINES) {
      report.notes.tiny.push({
        path: rel,
        bodyLines,
        updated: dateOf(rel, ["updated", "last_reviewed"]),
        templateShaped: isTemplateShaped(content),
      });
    }
    const date = dateOf(rel, ["updated", "last_reviewed"]);
    if (date) {
      const age = daysBetween(date, today);
      if (age != null && age > STALE_DAYS) report.notes.stale.push({ path: rel, ageDays: age, date });
      if (age != null && age > ARCHIVE_DAYS) {
        report.archiveCandidates.push({ path: rel, ageDays: age, date });
      }
    }
    if ((inbound.get(rel)?.size ?? 0) === 0) {
      report.notes.orphan.push({ path: rel });
    }
  }

  const tokenCache = new Map();
  function tokens(rel) {
    if (!tokenCache.has(rel)) tokenCache.set(rel, tokensFor(rel, contentByRel.get(rel) ?? ""));
    return tokenCache.get(rel);
  }

  for (let i = 0; i < laneNoteRels.length; i++) {
    for (let j = i + 1; j < laneNoteRels.length; j++) {
      if (!sharesSlugToken(laneNoteRels[i], laneNoteRels[j])) continue;
      const score = jaccard(tokens(laneNoteRels[i]), tokens(laneNoteRels[j]));
      if (score >= SIMILARITY) {
        report.notes.similarPairs.push({
          a: laneNoteRels[i],
          b: laneNoteRels[j],
          score: Number(score.toFixed(2)),
        });
      }
    }
  }

  // Supersession hints: planning/ notes (work plans, lightweight decisions)
  // and writing/ notes (drafts, revision notes) that look similar but never
  // declare a supersedes/superseded-by relationship.
  const supersessionRels = files
    .map((f) => f.rel)
    .filter((rel) => {
      const lane = topLane(rel);
      if (!rel.includes("/") || isFolderNote(rel)) return false;
      return lane === "planning" || lane === "writing";
    })
    .filter((rel) => !["deprecated", "superseded", "archived"].includes(fmByRel.get(rel)?.status));

  for (let i = 0; i < supersessionRels.length; i++) {
    for (let j = i + 1; j < supersessionRels.length; j++) {
      const a = supersessionRels[i];
      const b = supersessionRels[j];
      if (!sharesSlugToken(a, b)) continue;
      const score = jaccard(tokens(a), tokens(b));
      if (score < SIMILARITY) continue;
      const aContent = contentByRel.get(a) ?? "";
      const bContent = contentByRel.get(b) ?? "";
      if (declaresRelationshipWith(aContent, b) || declaresRelationshipWith(bContent, a)) continue;
      report.supersessionHints.push({ a, b, score: Number(score.toFixed(2)) });
    }
  }

  // Stale lane indexes: folder note `updated` lags the newest note `updated`
  // in the lane by more than INDEX_LAG_DAYS (the CURRENT_STATUS freshness
  // cadence from REFERENCE.md).
  const lanes = new Set(files.map((f) => topLane(f.rel)).filter((l) => ACTIVE_LANES.has(l)));
  for (const lane of lanes) {
    const indexRel = `${lane}/${lane}.md`;
    if (!contentByRel.has(indexRel)) continue;
    const indexDate = dateOf(indexRel, ["updated", "last_reviewed"]);
    if (!indexDate) continue;
    let newest = null;
    for (const rel of laneNoteRels) {
      if (topLane(rel) !== lane) continue;
      const d = dateOf(rel, ["updated", "created"]);
      if (d && (!newest || daysBetween(newest, d) > 0)) newest = d;
    }
    if (!newest) continue;
    const lag = daysBetween(indexDate, newest);
    if (lag != null && lag > INDEX_LAG_DAYS) {
      report.staleLaneIndexes.push({ path: indexRel, indexDate, newestNoteDate: newest, lagDays: lag });
    }
  }

  return report;
}

// --- Output --------------------------------------------------------------

function countCandidates(report) {
  return (
    report.notes.tiny.length +
    report.notes.stale.length +
    report.notes.orphan.length +
    report.notes.similarPairs.length +
    report.supersessionHints.length +
    report.staleLaneIndexes.length +
    report.archiveCandidates.length
  );
}

function emitHuman(report) {
  const lines = [];
  lines.push(`\n# Reorganization Candidates — ${report.label}\n`);
  lines.push(`Generated: ${report.generated}`);
  lines.push(
    `Thresholds: stale > ${report.thresholds.staleDays}d, tiny < ${report.thresholds.tinyLines} body lines, ` +
      `similarity >= ${report.thresholds.similarity}, index lag > ${report.thresholds.indexLagDays}d, ` +
      `archive > ${report.thresholds.archiveDays}d`
  );
  lines.push("");

  function section(title, items, format) {
    if (items.length === 0) return;
    lines.push(`## ${title} (${items.length})`);
    lines.push("");
    for (const item of items) lines.push(format(item));
    lines.push("");
  }

  section(
    "Tiny Notes",
    report.notes.tiny,
    (i) =>
      `- \`${i.path}\` — ${i.bodyLines} body lines, updated ${i.updated ?? "unknown"}` +
      `${i.templateShaped ? "; still template-shaped (stub)" : ""}`
  );
  section("Stale Notes", report.notes.stale, (i) => `- \`${i.path}\` — ${i.ageDays} days since ${i.date}`);
  section("Orphaned Notes (no live inbound links)", report.notes.orphan, (i) => `- \`${i.path}\``);
  section(
    "Similar Note Pairs (merge/dedup candidates)",
    report.notes.similarPairs,
    (i) => `- \`${i.a}\` ↔ \`${i.b}\` — token overlap ${i.score}`
  );
  section(
    "Possible Undeclared Supersessions (planning/ decisions, writing/ drafts)",
    report.supersessionHints,
    (i) => `- \`${i.a}\` ↔ \`${i.b}\` — token overlap ${i.score}; neither declares a supersession link`
  );
  section(
    "Stale Lane Indexes (folder note lags lane activity)",
    report.staleLaneIndexes,
    (i) => `- \`${i.path}\` — index updated ${i.indexDate}, newest note ${i.newestNoteDate} (${i.lagDays}d lag)`
  );
  section(
    "Archive Candidates (untouched in active lanes)",
    report.archiveCandidates,
    (i) => `- \`${i.path}\` — ${i.ageDays} days since ${i.date}`
  );

  const total = countCandidates(report);
  if (total === 0) {
    lines.push("No reorganization candidates found above the current thresholds.");
  } else {
    lines.push(`**Summary:** ${total} candidate signal(s).`);
    lines.push("");
    lines.push(
      "This report lists candidates only. Merging, retiring, archiving, and supersession decisions belong to the " +
        "agent + human reorganization workflow; nothing here is auto-fixed."
    );
  }
  console.log(lines.join("\n"));
}

const reports = [];
for (const target of resolveTargets()) {
  reports.push(runFor(target));
}

if (CLI.json) {
  console.log(JSON.stringify(reports.length === 1 ? reports[0] : reports, null, 2));
} else {
  for (const report of reports) emitHuman(report);
}

process.exit(0);
