#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const DEFAULT_CONFIG_PATH = path.join(os.homedir(), ".config", "academic-pm", "projects.json");
const REQUIRED_ROOT_FILES = ["README.md", "RESEARCH.md", "CURRENT_STATUS.md"];
const REQUIRED_FOLDERS = [
  "literature",
  "evidence",
  "analysis",
  "writing",
  "meetings",
  "planning",
  "history",
  "archive",
];
const OPTIONAL_FOLDERS = ["verification", "submissions", "admin", "ethics", "collaboration"];
const IGNORED_DIRS = new Set([".git", ".obsidian", "node_modules"]);
const REQUIRED_FRONTMATTER_FIELDS = ["title", "created", "updated", "last_reviewed", "pageType", "status"];
const HISTORY_WORD_WARNING = 1200;
const HISTORY_LINE_WARNING = 140;
const STATUS_STALE_DAYS = 14;

function usage() {
  console.error(`Usage:
  check-academic-pm.mjs --path <academic-pm-folder> [--strict] [--json] [--stale-days N] [--history-word-limit N]
  check-academic-pm.mjs --project <ProjectName> [--config <projects.json>] [--strict] [--json] [--stale-days N] [--history-word-limit N]`);
}

function parseArgs(argv) {
  const args = { strict: false, json: false, staleDays: STATUS_STALE_DAYS, historyWordLimit: HISTORY_WORD_WARNING };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--strict") {
      args.strict = true;
    } else if (arg === "--json") {
      args.json = true;
    } else if (arg === "--stale-days") {
      const value = argv[i + 1];
      if (!value) throw new Error(`Missing value for ${arg}`);
      args.staleDays = parseInt(value, 10);
      if (isNaN(args.staleDays) || args.staleDays < 1) throw new Error(`Invalid ${arg}: ${value}`);
      i += 1;
    } else if (arg === "--history-word-limit") {
      const value = argv[i + 1];
      if (!value) throw new Error(`Missing value for ${arg}`);
      args.historyWordLimit = parseInt(value, 10);
      if (isNaN(args.historyWordLimit) || args.historyWordLimit < 1) throw new Error(`Invalid ${arg}: ${value}`);
      i += 1;
    } else if (arg === "--path" || arg === "--project" || arg === "--config") {
      const value = argv[i + 1];
      if (!value) throw new Error(`Missing value for ${arg}`);
      args[arg.slice(2)] = value;
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.config && args.project) args.config = DEFAULT_CONFIG_PATH;
  return args;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function resolveTarget(args) {
  if (args.path) {
    const root = path.resolve(args.path);
    return {
      root,
      projectName: path.basename(root),
      vaultRoot: null,
      access: "direct",
      manuscriptHome: null,
      manuscriptKind: null,
      manuscriptAccess: null,
    };
  }
  if (!args.project) {
    throw new Error("Provide --path, or --project (with optional --config).");
  }
  const configPath = path.resolve(args.config);
  const config = readJson(configPath);
  const project = config.projects?.[args.project];
  if (!project) throw new Error(`Project '${args.project}' not found in ${configPath}.`);

  const manuscriptHomeRaw = project.manuscript_home;
  const manuscriptHome = manuscriptHomeRaw ? path.resolve(manuscriptHomeRaw) : null;
  const manuscriptKind = project.manuscript_kind ?? null;
  const manuscriptAccess = project.manuscript_access ?? null;

  if (project.access === "unavailable") {
    return {
      root: null,
      projectName: args.project,
      vaultRoot: project.vault_root ? path.resolve(project.vault_root) : null,
      access: "unavailable",
      manuscriptHome,
      manuscriptKind,
      manuscriptAccess,
    };
  }
  if (!project.pm_folder) throw new Error(`Project '${args.project}' is missing pm_folder.`);
  return {
    root: path.resolve(project.pm_folder),
    projectName: args.project,
    vaultRoot: project.vault_root ? path.resolve(project.vault_root) : null,
    access: project.access ?? "unknown",
    manuscriptHome,
    manuscriptKind,
    manuscriptAccess,
  };
}

function hasFrontmatter(text) {
  return text.startsWith("---\n") && text.indexOf("\n---", 4) !== -1;
}

function parseFrontmatter(text) {
  if (!hasFrontmatter(text)) return null;
  const end = text.indexOf("\n---", 4);
  const raw = text.slice(4, end).trim();
  const fields = {};
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    fields[match[1]] = match[2].replace(/^["']|["']$/g, "").trim();
  }
  return fields;
}

function readText(file) {
  return fs.readFileSync(file, "utf8");
}

function existsFile(root, rel) {
  const abs = path.join(root, rel);
  return fs.existsSync(abs) && fs.statSync(abs).isFile();
}

function existsDir(root, rel) {
  const abs = path.join(root, rel);
  return fs.existsSync(abs) && fs.statSync(abs).isDirectory();
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function stripMd(value) {
  return value.replace(/\.md$/i, "");
}

function visibleEntries(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => {
    if (entry.name.startsWith(".")) return false;
    if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) return false;
    return true;
  });
}

function listMarkdownFiles(root) {
  const files = [];
  function walk(dir) {
    for (const entry of visibleEntries(dir)) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(abs);
      }
    }
  }
  walk(root);
  return files;
}

function findRootNote(root) {
  const preferred = path.join(root, `${path.basename(root)}.md`);
  if (fs.existsSync(preferred)) return preferred;
  const rootMds = visibleEntries(root)
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .filter((name) => !REQUIRED_ROOT_FILES.includes(name));
  if (rootMds.length === 1) return path.join(root, rootMds[0]);
  return null;
}

function addFinding(report, kind, message) {
  report[kind].push(message);
}

function checkFrontmatter(report, root, abs) {
  const rel = toPosix(path.relative(root, abs));
  const text = readText(abs);
  const fields = parseFrontmatter(text);
  if (!fields) {
    addFinding(report, "warnings", `Missing YAML frontmatter: ${rel}`);
    return;
  }
  for (const field of REQUIRED_FRONTMATTER_FIELDS) {
    if (!fields[field]) {
      addFinding(report, "warnings", `Missing frontmatter field '${field}': ${rel}`);
    }
  }
}

function checkRequiredStructure(report, root) {
  for (const rel of REQUIRED_ROOT_FILES) {
    if (!existsFile(root, rel)) addFinding(report, "errors", `Missing file: ${rel}`);
  }

  const rootNote = findRootNote(root);
  if (!rootNote) {
    addFinding(report, "errors", `Missing project root folder note: ${path.basename(root)}.md or another root project note`);
  } else {
    report.rootNote = toPosix(path.relative(root, rootNote));
  }

  for (const folder of REQUIRED_FOLDERS) {
    if (!existsDir(root, folder)) {
      addFinding(report, "errors", `Missing folder: ${folder}/`);
      continue;
    }
    const index = `${folder}/${folder}.md`;
    if (!existsFile(root, index)) addFinding(report, "errors", `Missing folder note: ${index}`);
  }

  for (const folder of OPTIONAL_FOLDERS) {
    if (!existsDir(root, folder)) continue;
    const index = `${folder}/${folder}.md`;
    if (!existsFile(root, index)) addFinding(report, "warnings", `Optional folder missing folder note: ${index}`);
  }
}

function directChildSummary(root, dirRel, indexName) {
  const dirAbs = path.join(root, dirRel);
  const files = [];
  const dirs = [];
  for (const entry of visibleEntries(dirAbs)) {
    if (entry.isDirectory()) {
      dirs.push(entry.name);
    } else if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== indexName) {
      files.push(stripMd(entry.name));
    }
  }
  return { files, dirs };
}

function textMentionsIndexItem(text, item) {
  // Check for wiki link syntax: [[item]], [[item|label]], or [[folder/item|label]]
  const escaped = item.replace(/[.*+?^${}()|[\]\\]/g, '\\$\u0026');
  // Match: [[item]], [[item|label]], or [[path/item|label]]
  const wikiLinkPattern = new RegExp(`\\[\\[(?:[^\\]]*/)?${escaped}(?:\\|[^\\]]+)?\\]\\]`);
  return wikiLinkPattern.test(text);
}

function checkFolderIndex(report, root, dirRel, indexRel) {
  if (!existsFile(root, indexRel)) return;
  const text = readText(path.join(root, indexRel));
  if (!text.includes("<!-- vault-maintain:index:start -->") || !text.includes("<!-- vault-maintain:index:end -->")) {
    addFinding(report, "warnings", `Folder note missing vault-maintain index markers: ${indexRel}`);
  }
  const indexName = path.basename(indexRel);
  const { files, dirs } = directChildSummary(root, dirRel, indexName);
  for (const dir of dirs) {
    if (!textMentionsIndexItem(text, dir)) {
      addFinding(report, "warnings", `Index missing direct subfolder '${dir}': ${indexRel}`);
    }
  }
  for (const file of files) {
    if (!textMentionsIndexItem(text, file)) {
      addFinding(report, "warnings", `Index missing direct note '${file}': ${indexRel}`);
    }
  }
}

function checkIndexes(report, root) {
  const rootNote = report.rootNote ? path.join(root, report.rootNote) : null;
  if (rootNote && fs.existsSync(rootNote)) {
    checkFolderIndex(report, root, ".", report.rootNote);
  }

  const folders = [
    ...REQUIRED_FOLDERS,
    ...OPTIONAL_FOLDERS.filter((folder) => existsDir(root, folder)),
  ];
  for (const folder of folders) {
    checkFolderIndex(report, root, folder, `${folder}/${folder}.md`);
  }
}

function wikiTarget(raw) {
  const noAlias = raw.split("|")[0];
  return stripMd(noAlias.split("#")[0].split("^")[0].trim().replace(/\\/g, "/"));
}

function buildLinkKeys(root, vaultRoot) {
  const keys = new Set();
  const rootBase = path.basename(root);
  for (const abs of listMarkdownFiles(root)) {
    const rel = toPosix(path.relative(root, abs));
    const relNoExt = stripMd(rel);
    const baseNoExt = stripMd(path.basename(abs));
    keys.add(relNoExt);
    keys.add(baseNoExt);
    keys.add(`${rootBase}/${relNoExt}`);
    if (vaultRoot) {
      const vaultRel = toPosix(path.relative(vaultRoot, abs));
      keys.add(stripMd(vaultRel));
    }
  }
  return keys;
}

function checkWikiLinks(report, root, vaultRoot) {
  const keys = buildLinkKeys(root, vaultRoot);
  const rootBase = path.basename(root);
  const files = listMarkdownFiles(root);
  const linkRe = /\[\[([^\]]+)\]\]/g;

  for (const abs of files) {
    const rel = toPosix(path.relative(root, abs));
    const relDir = path.posix.dirname(rel);
    const text = readText(abs);
    for (const match of text.matchAll(linkRe)) {
      const target = wikiTarget(match[1]);
      if (!target || target.startsWith("http://") || target.startsWith("https://")) continue;
      if (keys.has(target)) continue;
      const projectMarker = `${rootBase}/`;
      const projectMarkerIndex = target.lastIndexOf(projectMarker);
      if (projectMarkerIndex >= 0 && keys.has(target.slice(projectMarkerIndex))) continue;
      if (target.startsWith("./") || target.startsWith("../")) {
        const resolved = path.posix.normalize(path.posix.join(relDir, target));
        if (keys.has(resolved)) continue;
      }

      const looksProjectInternal =
        target.includes(`${rootBase}/`) ||
        target.startsWith("./") ||
        target.startsWith("../");
      if (looksProjectInternal) {
        addFinding(report, "warnings", `Unresolved project wiki link in ${rel}: [[${match[1]}]]`);
      }
    }
  }
}

function parseDate(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
}

function checkCurrentStatusFreshness(report, root, staleDays) {
  const rel = "CURRENT_STATUS.md";
  if (!existsFile(root, rel)) return;
  const fields = parseFrontmatter(readText(path.join(root, rel)));
  const date = parseDate(fields?.last_reviewed || fields?.updated);
  if (!date) {
    addFinding(report, "warnings", "CURRENT_STATUS.md is missing a parseable updated or last_reviewed date");
    return;
  }
  const now = new Date();
  const ageDays = Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - date.getTime()) / 86400000);
  if (ageDays > staleDays) {
    addFinding(report, "warnings", `CURRENT_STATUS.md is stale: ${ageDays} days since last review (threshold: ${staleDays})`);
  }
}

function checkHistorySize(report, root, wordLimit) {
  const historyRoot = path.join(root, "history");
  if (!fs.existsSync(historyRoot)) return;
  for (const abs of listMarkdownFiles(historyRoot)) {
    const rel = toPosix(path.relative(root, abs));
    if (path.basename(abs) === "history.md") continue;
    const text = readText(abs);
    const words = text.split(/\s+/).filter(Boolean).length;
    const lines = text.split(/\r?\n/).length;
    if (words > wordLimit || lines > HISTORY_LINE_WARNING) {
      addFinding(report, "warnings", `History note is too detailed (${words} words, ${lines} lines); move report detail to analysis/: ${rel} (threshold: ${wordLimit} words, ${HISTORY_LINE_WARNING} lines)`);
    }
  }
}

const AGENTS_MARKER_START = "<!-- academic-project-management:section:start -->";
const AGENTS_MARKER_END = "<!-- academic-project-management:section:end -->";

function extractManagedAgentsSection(text) {
  const startIdx = text.indexOf(AGENTS_MARKER_START);
  const endIdx = text.indexOf(AGENTS_MARKER_END);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return null;
  return text.slice(startIdx + AGENTS_MARKER_START.length, endIdx);
}

function normalizePathForCompare(value) {
  if (!value) return "";
  return path.resolve(value).replace(/\\/g, "/").replace(/\/+$/, "");
}

function checkManuscriptHome(report, manuscriptHome, manuscriptKind) {
  if (!manuscriptHome) {
    report.manuscriptHome = null;
    return;
  }
  const result = { path: manuscriptHome, kind: manuscriptKind ?? "unknown" };
  report.manuscriptHome = result;

  if (!fs.existsSync(manuscriptHome)) {
    addFinding(report, "errors", `manuscript_home does not exist: ${manuscriptHome}`);
    return;
  }
  if (!fs.statSync(manuscriptHome).isDirectory()) {
    addFinding(report, "errors", `manuscript_home is not a directory: ${manuscriptHome}`);
  }
}

function checkManuscriptHomeAgentsMd(report, manuscriptHome, manuscriptKind, manuscriptAccess, pmRoot) {
  if (!manuscriptHome) return;
  if (manuscriptKind !== "git-repo") {
    if (!report.manuscriptHome) report.manuscriptHome = { path: manuscriptHome, kind: manuscriptKind ?? "unknown" };
    else report.manuscriptHome.kind = manuscriptKind ?? "unknown";
    return;
  }
  if (manuscriptAccess === "none" || manuscriptAccess === "read-only") {
    if (!report.manuscriptHome) report.manuscriptHome = { path: manuscriptHome, kind: "git-repo", access: manuscriptAccess };
    else {
      report.manuscriptHome.kind = "git-repo";
      report.manuscriptHome.access = manuscriptAccess;
      report.manuscriptHome.checked = false;
      report.manuscriptHome.reason = `manuscript_access=${manuscriptAccess}`;
    }
    return;
  }

  if (!report.manuscriptHome) report.manuscriptHome = { path: manuscriptHome, kind: "git-repo" };
  report.manuscriptHome.kind = "git-repo";
  report.manuscriptHome.access = manuscriptAccess ?? "authoritative";

  if (!fs.existsSync(manuscriptHome)) return; // already reported by checkManuscriptHome
  if (!fs.statSync(manuscriptHome).isDirectory()) return;

  const agentsPath = path.join(manuscriptHome, "AGENTS.md");
  if (!fs.existsSync(agentsPath)) {
    addFinding(report, "errors", `Missing manuscript-home AGENTS.md: ${agentsPath}`);
    return;
  }
  const text = readText(agentsPath);
  const section = extractManagedAgentsSection(text);
  if (!section) {
    addFinding(report, "errors", `manuscript-home AGENTS.md is missing the managed academic-project-management section markers: ${agentsPath}`);
    return;
  }

  if (pmRoot) {
    const expected = normalizePathForCompare(pmRoot);
    const pattern = /## Academic PM folder[\s\S]*?at `([^`]+)`/;
    const match = section.match(pattern);
    if (!match) {
      addFinding(report, "warnings", `manuscript-home AGENTS.md section is missing the PM folder path: ${agentsPath}`);
    } else {
      const declared = normalizePathForCompare(match[1]);
      if (declared && declared !== expected) {
        addFinding(
          report,
          "errors",
          `manuscript-home AGENTS.md points at PM folder '${declared}' but projects.json declares '${expected}' (drift)`,
        );
      }
    }
  }
}

function validate(target, args) {
  const report = {
    root: target.root,
    project: target.projectName,
    access: target.access,
    rootNote: null,
    manuscriptHome: null,
    errors: [],
    warnings: [],
  };

  if (target.access === "unavailable") {
    report.status = "SKIP";
    report.summary = "PM folder unavailable for this project.";
    return report;
  }

  if (!fs.existsSync(target.root)) throw new Error(`PM folder does not exist: ${target.root}`);
  if (!fs.statSync(target.root).isDirectory()) throw new Error(`PM path is not a folder: ${target.root}`);

  checkRequiredStructure(report, target.root);
  for (const abs of listMarkdownFiles(target.root)) checkFrontmatter(report, target.root, abs);
  checkIndexes(report, target.root);
  checkWikiLinks(report, target.root, target.vaultRoot);
  checkCurrentStatusFreshness(report, target.root, args.staleDays);
  checkHistorySize(report, target.root, args.historyWordLimit);
  checkManuscriptHome(report, target.manuscriptHome, target.manuscriptKind);
  checkManuscriptHomeAgentsMd(report, target.manuscriptHome, target.manuscriptKind, target.manuscriptAccess, target.root);

  report.status = report.errors.length > 0 || (args.strict && report.warnings.length > 0) ? "FAIL" : "PASS";
  return report;
}

function printReport(report, args) {
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log("# Academic PM Validation Report");
  if (report.project) console.log(`Project: ${report.project}`);
  console.log(`Root: ${report.root ?? "(unavailable)"}`);
  console.log("");
  console.log(`Status: ${report.status}`);
  if (report.summary) {
    console.log("");
    console.log(report.summary);
  }
  console.log("");
  console.log(`Errors: ${report.errors.length}`);
  for (const error of report.errors) console.log(`- ${error}`);
  console.log("");
  console.log(`Warnings: ${report.warnings.length}`);
  for (const warning of report.warnings) console.log(`- ${warning}`);

  if (report.manuscriptHome) {
    console.log("");
    console.log("Manuscript home:");
    console.log(`- path: ${report.manuscriptHome.path}`);
    console.log(`- kind: ${report.manuscriptHome.kind}`);
    if (report.manuscriptHome.access) console.log(`- access: ${report.manuscriptHome.access}`);
    if (report.manuscriptHome.checked === false) {
      console.log(`- note: ${report.manuscriptHome.reason ?? "skipped"}`);
    }
  }

  if (report.warnings.length > 0) {
    console.log("");
    console.log("Tip: re-run with --strict to fail on warnings.");
  }

  if (!report.manuscriptHome && report.access !== "unavailable") {
    console.log("");
    console.log("Tip: when the manuscript + analysis-code folder is ready, declare it via the bootstrap script with --manuscript-home, --manuscript-kind, and --manuscript-access.");
  }
}

try {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    process.exit(0);
  }
  const target = resolveTarget(args);
  const report = validate(target, args);
  printReport(report, args);
  process.exit(report.status === "FAIL" ? 1 : 0);
} catch (error) {
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ status: "ERROR", error: error.message }, null, 2));
  } else {
    console.error(`ERROR: ${error.message}`);
    usage();
  }
  process.exit(2);
}
