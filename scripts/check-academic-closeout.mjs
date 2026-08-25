#!/usr/bin/env node
/**
 * check-academic-closeout.mjs
 *
 * Session/worktree guard for coding/writing agents working in a project's
 * manuscript home. This is intentionally not part of the academic PM
 * structural validator (check-academic-pm.mjs): it answers "did this local
 * manuscript-work session close out PM updates?" rather than "is the PM
 * folder valid?"
 *
 * Close-out rule (mirrors SKILL.md/REFERENCE.md logging workflow):
 * meaningful manuscript-home changes since the session start require
 * CURRENT_STATUS.md and/or a history/ entry (history/YYYY-MM-DD-<slug>.md)
 * updated in the pm_folder since the session start.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";

const USAGE = `Usage: node scripts/check-academic-closeout.mjs [options]

Options:
  --config <path>              path to projects.json (default: ~/.config/academic-pm/projects.json)
  --project <name>             force a registered project instead of matching the manuscript home
  --manuscript-home <path>     manuscript home to inspect (default: current git repo / cwd)
  --repo <path>                alias for --manuscript-home
  --since <ISO datetime>       require PM files modified since this timestamp (default: today 00:00)
  --allow-no-impact <reason>   pass explicitly when changed files do not affect PM docs
  --help, -h                   show this help
`;

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = {
    config: null,
    project: null,
    manuscriptHome: null,
    since: null,
    allowNoImpact: null,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--config" || a === "-c") out.config = args[++i];
    else if (a === "--project" || a === "-p") out.project = args[++i];
    else if (a === "--manuscript-home" || a === "--repo") out.manuscriptHome = args[++i];
    else if (a === "--since") out.since = args[++i];
    else if (a === "--allow-no-impact") out.allowNoImpact = args[++i];
    else if (a === "--help" || a === "-h") {
      process.stdout.write(USAGE + "\n");
      process.exit(0);
    } else {
      process.stderr.write(`Unknown arg: ${a}\n${USAGE}\n`);
      process.exit(2);
    }
  }
  if (out.allowNoImpact !== null && out.allowNoImpact.trim() === "") {
    process.stderr.write("--allow-no-impact requires a non-empty reason.\n");
    process.exit(2);
  }
  return out;
}

const CLI = parseArgs(process.argv);

function runGit(repo, args) {
  return spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
}

function canonicalPath(value) {
  if (!value) return null;
  const abs = resolve(value);
  try {
    return realpathSync(abs);
  } catch {
    return abs;
  }
}

function normalizeForCompare(value) {
  const normalized = canonicalPath(value);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function samePath(a, b) {
  return normalizeForCompare(a) === normalizeForCompare(b);
}

function isUnderPath(child, parent) {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function resolveManuscriptRoot() {
  const startingPoint = CLI.manuscriptHome ? resolve(CLI.manuscriptHome) : process.cwd();
  if (!existsSync(startingPoint)) {
    return { root: null, kind: null, gitError: `path does not exist: ${startingPoint}` };
  }
  const result = runGit(startingPoint, ["rev-parse", "--show-toplevel"]);
  if (result.status === 0) {
    return { root: canonicalPath(result.stdout.trim()), kind: "git-repo", gitError: null };
  }
  // Plain workfile folder (manuscript_kind local-folder) — inspect by mtime.
  return { root: canonicalPath(startingPoint), kind: "local-folder", gitError: null };
}

function defaultConfigPath() {
  return join(homedir(), ".config", "academic-pm", "projects.json");
}

function loadConfig() {
  const configPath = CLI.config ? resolve(CLI.config) : defaultConfigPath();
  if (!existsSync(configPath)) return { configPath, config: null };
  return { configPath, config: JSON.parse(readFileSync(configPath, "utf8")) };
}

function resolveProject(config, configPath, manuscriptRoot) {
  if (CLI.project) {
    const entry = config?.projects?.[CLI.project];
    if (!entry) {
      process.stderr.write(`ERROR: project '${CLI.project}' not found in ${configPath}\n`);
      process.exit(2);
    }
    return { name: CLI.project, entry, matchedBy: "project flag" };
  }
  for (const [name, entry] of Object.entries(config?.projects ?? {})) {
    if (entry.manuscript_home && samePath(entry.manuscript_home, manuscriptRoot)) {
      return { name, entry, matchedBy: "manuscript_home" };
    }
    // A manuscript home may be inspected from a subdirectory of the
    // registered path, or the registered path may sit under the git root.
    if (entry.manuscript_home) {
      const home = canonicalPath(entry.manuscript_home);
      if (home && manuscriptRoot && (isUnderPath(manuscriptRoot, home) || isUnderPath(home, manuscriptRoot))) {
        return { name, entry, matchedBy: "manuscript_home (overlap)" };
      }
    }
  }
  return null;
}

function parseGitStatus(output) {
  const changes = [];
  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const status = line.slice(0, 2);
    let path = line.slice(3).trim();
    if (path.includes(" -> ")) path = path.split(" -> ").at(-1);
    path = path.replace(/^"|"$/g, "");
    changes.push({ status, path });
  }
  return changes;
}

// Files that never count as meaningful manuscript work.
function isNoisePath(relPath) {
  const base = relPath.split("/").at(-1);
  return (
    base === "AGENTS.md" || // managed routing section, not research work
    base === ".gitignore" ||
    base === ".gitattributes" ||
    relPath.startsWith(".git/")
  );
}

function worktreeChanges(root) {
  const result = runGit(root, ["status", "--porcelain=v1", "--untracked-files=all"]);
  if (result.status !== 0) {
    return { error: (result.stderr || result.stdout || "git status failed").trim(), changes: [] };
  }
  return { error: null, changes: parseGitStatus(result.stdout) };
}

function committedChanges(root, baseline) {
  const result = runGit(root, [
    "log",
    `--since=${baseline.toISOString()}`,
    "--name-status",
    "--pretty=format:",
  ]);
  if (result.status !== 0) {
    // e.g. no commits yet — not an error for the guard.
    return { error: null, changes: [] };
  }
  const changes = [];
  for (const line of result.stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [status, ...rest] = line.split("\t");
    const path = rest.at(-1);
    if (path) changes.push({ status, path });
  }
  return { error: null, changes };
}

function walkFiles(root, rel = "", out = []) {
  const abs = join(root, rel);
  if (!existsSync(abs)) return out;
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    if (entry.name.startsWith(".") ) continue; // dotfiles/dotdirs are not manuscript work
    const childRel = rel ? join(rel, entry.name) : entry.name;
    if (entry.isDirectory()) walkFiles(root, childRel, out);
    else if (entry.isFile()) out.push(childRel.replaceAll("\\", "/"));
  }
  return out;
}

function localFolderChanges(root, baseline) {
  const changes = [];
  for (const relPath of walkFiles(root)) {
    if (isNoisePath(relPath)) continue;
    try {
      if (statSync(join(root, relPath)).mtimeMs >= baseline.getTime()) {
        changes.push({ status: "M?", path: relPath });
      }
    } catch {
      // ignore unreadable entries
    }
  }
  return { error: null, changes };
}

function todayDate() {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function defaultBaseline() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function parseBaseline() {
  if (!CLI.since) return defaultBaseline();
  const parsed = new Date(CLI.since);
  if (Number.isNaN(parsed.getTime())) {
    process.stderr.write(`Invalid --since timestamp: ${CLI.since}\n`);
    process.exit(2);
  }
  return parsed;
}

function walkMarkdown(root, rel = "", out = []) {
  const abs = join(root, rel);
  if (!existsSync(abs)) return out;
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const childRel = rel ? join(rel, entry.name) : entry.name;
    if (entry.isDirectory()) walkMarkdown(root, childRel, out);
    else if (entry.isFile() && entry.name.endsWith(".md")) out.push(childRel.replaceAll("\\", "/"));
  }
  return out;
}

function isCurrentStatePmRel(relPath) {
  return !relPath.startsWith("history/") && !relPath.startsWith("archive/");
}

function recentlyModified(abs, baseline) {
  if (!existsSync(abs)) return false;
  return statSync(abs).mtimeMs >= baseline.getTime();
}

function findPmEvidence(pmFolder, baseline) {
  const modifiedCurrentState = walkMarkdown(pmFolder)
    .filter(isCurrentStatePmRel)
    .filter((relPath) => recentlyModified(join(pmFolder, relPath), baseline));
  const currentStatusUpdated = recentlyModified(join(pmFolder, "CURRENT_STATUS.md"), baseline);
  // Academic history entries are flat: history/YYYY-MM-DD-<slug>.md (with an
  // optional history/YYYY-MM/ monthly grouping tolerated by convention).
  const date = todayDate();
  const historyDir = join(pmFolder, "history");
  const todaysHistory = walkMarkdown(historyDir)
    .filter((relPath) => relPath.includes(`history-${date}`))
    .filter((relPath) => recentlyModified(join(historyDir, relPath), baseline));
  return {
    currentState: modifiedCurrentState,
    currentStatusUpdated,
    todaysHistory,
  };
}

function suggestAcademicLanes(changes) {
  const suggestions = new Set();
  for (const { path } of changes) {
    if (/\.(tex|bib|cls|sty|md)$/.test(path) || path.startsWith("sections/") || path.startsWith("figures/")) {
      suggestions.add("writing/ (draft status, figures, submission notes)");
    }
    if (/\.(py|r|do|ipynb|jl|m|sql)$/.test(path) || path.startsWith("code/") || path.startsWith("scripts/")) {
      suggestions.add("analysis/ (methods, findings)");
      suggestions.add("verification/ (reproducibility / data checks, if applicable)");
    }
    if (/\.(csv|tsv|dta|parquet|json|sav)$/.test(path) || path.startsWith("data/")) {
      suggestions.add("evidence/ (source registry, provenance, measurement)");
    }
    if (path === "AGENTS.md" || path === "README.md") {
      suggestions.add("CURRENT_STATUS.md");
    }
  }
  suggestions.add(`history/history-${todayDate()}-<slug>.md`);
  suggestions.add("CURRENT_STATUS.md (Recent Progress)");
  return [...suggestions];
}

function printHeader(lines, manuscriptRoot, configPath, project) {
  lines.push("# Academic PM close-out guard");
  lines.push("");
  lines.push(`Manuscript home: ${manuscriptRoot}`);
  lines.push(`Config: ${configPath ?? "(none found)"}`);
  lines.push(`Project: ${project ? `${project.name} (${project.matchedBy})` : "(no matching project)"}`);
  lines.push("");
}

function pass(lines, message) {
  lines.push("**Status:** PASS");
  lines.push("");
  lines.push(message);
  console.log(lines.join("\n"));
  process.exit(0);
}

function fail(lines, message, exitCode = 1) {
  lines.push("**Status:** FAIL");
  lines.push("");
  lines.push(message);
  console.log(lines.join("\n"));
  process.exit(exitCode);
}

const lines = [];
const baseline = parseBaseline();
const { root: manuscriptRoot, kind, gitError } = resolveManuscriptRoot();
const { configPath, config } = loadConfig();
const project = config ? resolveProject(config, configPath, manuscriptRoot ?? canonicalPath(CLI.manuscriptHome ?? process.cwd())) : null;
printHeader(lines, manuscriptRoot ?? CLI.manuscriptHome ?? process.cwd(), configPath, project);

if (!project) {
  pass(lines, "No registered academic project matches this manuscript home. The PM routing contract is inactive locally.");
}

if (project.entry.access === "read-only") {
  pass(lines, "Read-only PM access: do not edit the PM folder. Report specific suggested PM updates (CURRENT_STATUS.md, history entry) in your final response instead.");
}

if (project.entry.access && project.entry.access !== "authoritative") {
  pass(lines, `PM access is '${project.entry.access}'; close-out guard is inactive.`);
}

// The guard inspects the manuscript home. Projects without one have nothing
// to check here (idea / dormant / grant-only phases).
if (!project.entry.manuscript_home || !project.entry.manuscript_kind || project.entry.manuscript_kind === "null") {
  pass(lines, "Project has no manuscript_home (manuscript_kind is null); there is no manuscript work to close out.");
}

if (project.entry.manuscript_access === "none") {
  pass(lines, "manuscript_access is 'none': the manuscript home is tracked for reference only; close-out guard is inactive.");
}

if (!project.entry.pm_folder || !existsSync(project.entry.pm_folder)) {
  pass(lines, "The registered pm_folder is missing or inaccessible; no PM close-out can be checked.");
}

if (gitError) {
  fail(lines, `Cannot inspect manuscript home: ${gitError}`, 2);
}

if (project.entry.manuscript_access === "read-only") {
  lines.push("Note: manuscript_access is read-only — inspection only; this guard never writes to the manuscript home.");
  lines.push("");
}

// Collect meaningful manuscript-home changes since the baseline.
let changes = [];
if (kind === "git-repo") {
  const wt = worktreeChanges(manuscriptRoot);
  if (wt.error) fail(lines, `Cannot inspect git worktree: ${wt.error}`, 2);
  const committed = committedChanges(manuscriptRoot, baseline);
  if (committed.error) fail(lines, `Cannot inspect git history: ${committed.error}`, 2);
  const seen = new Set();
  for (const change of [...committed.changes, ...wt.changes]) {
    if (isNoisePath(change.path) || seen.has(change.path)) continue;
    seen.add(change.path);
    changes.push(change);
  }
} else {
  const local = localFolderChanges(manuscriptRoot, baseline);
  if (local.error) fail(lines, `Cannot inspect manuscript home: ${local.error}`, 2);
  changes = local.changes;
}

if (changes.length === 0) {
  pass(lines, "No meaningful manuscript-home changes found since baseline. PM close-out is not required.");
}

lines.push("Changed manuscript-home files:");
for (const change of changes) lines.push(`- ${change.status} ${change.path}`);
lines.push("");

if (CLI.allowNoImpact) {
  lines.push("**Status:** PASS");
  lines.push("");
  lines.push(`No PM impact asserted: ${CLI.allowNoImpact}`);
  lines.push("The agent must mention this reason in the final response.");
  console.log(lines.join("\n"));
  process.exit(0);
}

const pmFolder = canonicalPath(project.entry.pm_folder);
const evidence = findPmEvidence(pmFolder, baseline);
const hasCurrentStatus = evidence.currentStatusUpdated;
const hasHistory = evidence.todaysHistory.length > 0;

lines.push(`Baseline: ${baseline.toISOString()}`);
lines.push("");
lines.push("Suggested PM lanes:");
for (const suggestion of suggestAcademicLanes(changes)) lines.push(`- ${suggestion}`);
lines.push("");

if (evidence.currentState.length > 0) {
  lines.push("Current-state PM files updated since baseline:");
  for (const relPath of evidence.currentState.slice(0, 20)) lines.push(`- ${relPath}`);
  if (evidence.currentState.length > 20) lines.push(`- ... ${evidence.currentState.length - 20} more`);
} else {
  lines.push("Current-state PM files updated since baseline: none found.");
}
lines.push(`CURRENT_STATUS.md freshness: ${hasCurrentStatus ? "updated since baseline" : "not updated since baseline"}`);
lines.push(
  `Current-day history entry: ${
    hasHistory ? evidence.todaysHistory.join(", ") : `history/history-${todayDate()}-<slug>.md not updated since baseline`
  }`
);
lines.push("");

if (hasCurrentStatus || hasHistory) {
  lines.push("**Status:** PASS");
  lines.push("");
  lines.push("PM close-out evidence found: CURRENT_STATUS.md and/or a current-day history entry was updated since the session baseline.");
  console.log(lines.join("\n"));
  process.exit(0);
}

fail(
  lines,
  "PM close-out required. Update CURRENT_STATUS.md (Recent Progress) and/or add a " +
    `history/history-${todayDate()}-<slug>.md entry in the PM folder` +
    ", or rerun with `--allow-no-impact \"<reason>\"` if this work truly has no PM impact."
);
