#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.dirname(SCRIPT_DIR);
const DEFAULT_CONFIG_PATH = path.join(os.homedir(), ".config", "academic-pm", "projects.json");

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

const OPTIONAL_FOLDERS = ["docs", "submissions", "admin", "ethics", "collaboration"];

function usage() {
  console.error(`Usage:
  node scripts/bootstrap-academic-pm.mjs \\
    --project <name> \\
    --pm-folder <path> \\
    [--config <path>] \\
    [--action bootstrap|repair|log] \\
    [--phase <phase>] [--notes "<one-line summary>"] \\
    [--project-type paper] [--access authoritative] [--vault-root <path>] \\
    [--manuscript-home <path>] \\
    [--manuscript-kind git-repo|local-folder|null] \\
    [--manuscript-access authoritative|read-only|none] \\
    [--no-agents-md] \\
    [--date YYYY-MM-DD] \\
    [--event "<one-line summary>"] \\
    [--type log|decision|review|audit] \\
    [--note <relative-path>] [--note <relative-path> ...] \\
    [--dry-run]

Actions:
  bootstrap (default) — scaffold a fresh PM folder or refresh projects.json
                        and the manuscript-home AGENTS.md section.
  repair              — detect structural drift (missing folder notes,
                        out-of-date subfolders/notes indexes) and rewrite
                        the affected files in place. Does not move user
                        notes between lanes.
  log                 — record a session of work. Generates a dated
                        history/YYYY-MM-DD-<slug>.md entry that links back
                        to each --note path, and updates the affected
                        lane indexes. Does not modify the touched files.

Bootstrap re-runs: if the PM folder already has the standard scaffold, the
script skips the scaffold step and only updates projects.json and the
manuscript-home AGENTS.md section.

For bootstrap: --phase is required, --notes is optional (default one-line
  summary is generated if omitted).
For repair: --phase and --notes are not used.
For log: --event is required; --note is required at least once (repeatable).
  --type defaults to "log". Each --note path must exist inside --pm-folder;
  otherwise the script errors out without writing anything.
`);
}

function parseArgs(argv) {
  const out = {
    project: null,
    pmFolder: null,
    phase: null,
    notes: "",
    config: null,
    action: "bootstrap",
    projectType: "paper",
    access: "authoritative",
    vaultRoot: null,
    manuscriptHome: null,
    manuscriptKind: null,
    manuscriptAccess: "authoritative",
    writeAgentsMd: true,
    date: localDate(),
    dryRun: false,
    logEvent: null,
    logType: "log",
    logNotes: [],
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      out.dryRun = true;
      continue;
    }
    if (arg === "--no-agents-md") {
      out.writeAgentsMd = false;
      continue;
    }
    if (arg === "--no-manuscript-home") {
      out.manuscriptHome = "";
      out.manuscriptKind = "null";
      continue;
    }
    const value = argv[i + 1];
    if (!value) throw new Error(`Missing value for ${arg}`);
    i += 1;

    if (arg === "--project") out.project = value;
    else if (arg === "--pm-folder") out.pmFolder = value;
    else if (arg === "--phase") out.phase = value;
    else if (arg === "--notes") out.notes = value;
    else if (arg === "--config") out.config = value;
    else if (arg === "--action") out.action = value;
    else if (arg === "--project-type") out.projectType = value;
    else if (arg === "--access") out.access = value;
    else if (arg === "--vault-root") out.vaultRoot = value;
    else if (arg === "--manuscript-home") out.manuscriptHome = value;
    else if (arg === "--manuscript-kind") out.manuscriptKind = value;
    else if (arg === "--manuscript-access") out.manuscriptAccess = value;
    else if (arg === "--date") out.date = value;
    else if (arg === "--event") out.logEvent = value;
    else if (arg === "--type") out.logType = value;
    else if (arg === "--note") out.logNotes.push(value);
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!["bootstrap", "repair", "log"].includes(out.action)) {
    throw new Error(`Invalid --action: ${out.action} (expected bootstrap|repair|log)`);
  }

  // Use default config path if not provided.
  if (!out.config) out.config = DEFAULT_CONFIG_PATH;

  // Required args differ by action.
  for (const key of ["project", "pmFolder"]) {
    if (!out[key]) throw new Error(`Missing required --${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`);
  }
  if (out.action === "bootstrap" && !out.phase) {
    throw new Error(`Missing required --phase (required for --action bootstrap)`);
  }
  if (out.action === "log") {
    if (!out.logEvent) throw new Error(`Missing required --event (required for --action log)`);
    if (out.logNotes.length === 0) throw new Error(`At least one --note is required for --action log (paths to touched files)`);
    if (!["log", "decision", "review", "audit"].includes(out.logType)) {
      throw new Error(`Invalid --type: ${out.logType} (expected log|decision|review|audit)`);
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(out.date)) throw new Error(`Invalid --date: ${out.date}`);
  if (out.manuscriptKind && !["git-repo", "local-folder", "null"].includes(out.manuscriptKind)) {
    throw new Error(`Invalid --manuscript-kind: ${out.manuscriptKind} (expected git-repo|local-folder|null)`);
  }
  if (out.manuscriptAccess && !["authoritative", "read-only", "none"].includes(out.manuscriptAccess)) {
    throw new Error(`Invalid --manuscript-access: ${out.manuscriptAccess} (expected authoritative|read-only|none)`);
  }

  // Cross-field invariants for manuscript home.
  if (out.manuscriptKind === "null" && out.manuscriptHome) {
    throw new Error(`--manuscript-home must be empty when --manuscript-kind is null`);
  }
  if (out.manuscriptKind && out.manuscriptKind !== "null" && !out.manuscriptHome) {
    throw new Error(`--manuscript-home is required when --manuscript-kind is ${out.manuscriptKind}`);
  }

  return out;
}

function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yaml(value) {
  return JSON.stringify(String(value));
}

function log(action, target, detail = "") {
  const suffix = detail ? ` - ${detail}` : "";
  console.log(`${action}: ${target}${suffix}`);
}

const cli = parseArgs(process.argv);
const project = cli.project;
const pmFolder = path.resolve(cli.pmFolder);
const configPath = path.resolve(cli.config);
const vaultRoot = cli.vaultRoot ? path.resolve(cli.vaultRoot) : path.dirname(pmFolder);
const notes = cli.notes || `${project} academic research project.`;

function ensureDir(abs) {
  if (fs.existsSync(abs)) {
    log("exists", abs);
    return;
  }
  if (cli.dryRun) {
    log("would mkdir", abs);
    return;
  }
  fs.mkdirSync(abs, { recursive: true });
  log("mkdir", abs);
}

function writeCreateOnly(abs, content) {
  if (fs.existsSync(abs)) {
    log("skip", abs, "exists");
    return;
  }
  if (cli.dryRun) {
    log("would write", abs);
    return;
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  log("write", abs);
}

function writeReplace(abs, content) {
  const existed = fs.existsSync(abs);
  if (cli.dryRun) {
    log(existed ? "would update" : "would write", abs);
    return;
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  log(existed ? "update" : "write", abs);
}

function frontmatter(title, pageType, extra = {}) {
  const fields = {
    title: yaml(title),
    created: cli.date,
    updated: cli.date,
    last_reviewed: cli.date,
    pageType,
    status: "active",
    owner: "researcher",
    ...extra,
  };
  const lines = ["---"];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === "") continue;
    lines.push(`${key}: ${value}`);
  }
  lines.push("---");
  return `${lines.join("\n")}\n`;
}

function nav(...items) {
  return `## Navigation\n\n${items.map(([target, label]) => `- [[${target}|${label}]]`).join("\n")}\n`;
}

function loadAndSubstitute(templateRel, extra = {}) {
  const templatePath = path.join(SKILL_DIR, "templates", templateRel);
  let raw = fs.readFileSync(templatePath, "utf8");
  for (const [key, value] of Object.entries(extra)) {
    raw = raw.split(key).join(value);
  }
  return raw
    .replace(/<YYYY-MM-DD>/g, cli.date)
    .replace(/<owner>/g, "researcher");
}

function indexBlock({ subfolders = [], notes: noteLinks = [] }) {
  const dirs = subfolders.length
    ? subfolders.map(([target, label, desc]) => `- [[${target}|${label}]]${desc ? ` - ${desc}` : ""}`).join("\n")
    : "*(no items)*";
  const notesBody = noteLinks.length
    ? noteLinks.map(([target, label, desc]) => `- [[${target}|${label}]]${desc ? ` - ${desc}` : ""}`).join("\n")
    : "*(no items)*";
  return `<!-- vault-maintain:index:start -->\n## Subfolders\n\n${dirs}\n\n## Notes\n\n${notesBody}\n<!-- vault-maintain:index:end -->`;
}

function rootNote() {
  const subfoldersIndex = indexBlock({
    subfolders: REQUIRED_FOLDERS.map((folder) => [`${folder}/${folder}`, folder, laneDescription(folder)]),
    notes: [
      ["README", "README", "Routing map and update rules"],
      ["RESEARCH", "RESEARCH", "Research framing"],
      ["CURRENT_STATUS", "CURRENT_STATUS", "Current priorities and blockers"],
    ],
  });
  return loadAndSubstitute("root-note.md", {
    "<Project>": project,
    "<NOTES>": notes,
    "<SUBFOLDERS_INDEX>": subfoldersIndex,
  });
}

function laneDescription(folder) {
  return {
    literature: "paper notes, synthesis, citation gaps",
    evidence: "source registry, data provenance, measurement definitions",
    analysis: "methods, audits, verification, reproducibility",
    writing: "draft, figures, tables, submission notes",
    meetings: "advisor and collaborator notes",
    planning: "plans and decisions",
    history: "concise completed-work logs",
    archive: "superseded material",
  }[folder] ?? "project notes";
}

function readme() {
  return loadAndSubstitute("README.md", {
    "<Project>": project,
    "<SKILL_VALIDATOR>": path.join(SKILL_DIR, "scripts", "check-academic-pm.mjs"),
    "<PROJECT_PM_FOLDER>": pmFolder,
  });
}

function research() {
  return loadAndSubstitute("RESEARCH.md", {
    "<NOTES>": notes,
  });
}

function currentStatus() {
  return loadAndSubstitute("CURRENT_STATUS.md", {
    "<PHASE>": cli.phase,
  });
}

function historyEntry() {
  return `${frontmatter(`history-${cli.date}`, "history", { kind: "log" })}# history-${cli.date}\n\n- setup: created academic PM scaffold for ${project}.\n\n${nav(["history/history", "Back to history"], [project, `Back to ${project}`])}`;
}

function loadConfig() {
  if (!fs.existsSync(configPath)) return { projects: {} };
  const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (!cfg.projects || typeof cfg.projects !== "object") cfg.projects = {};
  if (Object.prototype.hasOwnProperty.call(cfg.projects, "<ProjectName>")) delete cfg.projects["<ProjectName>"];
  return cfg;
}

function writeConfig() {
  const cfg = loadConfig();
  cfg.skill_dir = SKILL_DIR;
  cfg.projects[project] = {
    project_type: cli.projectType,
    pm_folder: pmFolder,
    vault_root: vaultRoot,
    phase: cli.phase,
    access: cli.access,
    notes,
  };
  if (cli.manuscriptHome) {
    cfg.projects[project].manuscript_home = path.resolve(cli.manuscriptHome);
    cfg.projects[project].manuscript_kind = cli.manuscriptKind;
    cfg.projects[project].manuscript_access = cli.manuscriptAccess;
  } else {
    cfg.projects[project].manuscript_home = "";
    cfg.projects[project].manuscript_kind = "null";
    cfg.projects[project].manuscript_access = cli.manuscriptAccess;
  }
  writeReplace(configPath, `${JSON.stringify(cfg, null, 2)}\n`);
}

function agentsMdSection() {
  const templatePath = path.join(SKILL_DIR, "templates", "AGENTS_ACADEMIC_PM_SECTION.md");
  let raw = fs.readFileSync(templatePath, "utf8");

  if (cli.manuscriptKind === "null") {
    raw = raw.replace(
      "The paper artifact and analysis code live at `<manuscript_home>` (`<manuscript_kind>`, access `<manuscript_access>`). The PM folder's `README.md` wins for routing.",
      "The PM folder is the whole project; there is no separate manuscript home.",
    );
  }

  const manuscriptHomeResolved = cli.manuscriptHome ? path.resolve(cli.manuscriptHome) : "(no manuscript home)";
  const manuscriptKindResolved = cli.manuscriptKind === "null" ? "null" : cli.manuscriptKind ?? "unknown";
  const manuscriptAccessResolved = cli.manuscriptAccess ?? "authoritative";
  return raw
    .replace(/<pm_folder>/g, pmFolder)
    .replace(/<skill_dir>/g, SKILL_DIR)
    .replace(/<manuscript_home>/g, manuscriptHomeResolved)
    .replace(/<manuscript_kind>/g, manuscriptKindResolved)
    .replace(/<manuscript_access>/g, manuscriptAccessResolved);
}

function writeManuscriptHomeAgentsMd() {
  if (!cli.writeAgentsMd) {
    log("skip", "AGENTS.md", "--no-agents-md");
    return;
  }
  if (!cli.manuscriptHome) {
    log("skip", "AGENTS.md", "no --manuscript-home");
    return;
  }
  if (cli.manuscriptKind === "local-folder") {
    log("skip", "AGENTS.md", "manuscript_kind=local-folder");
    return;
  }
  if (cli.manuscriptAccess === "none" || cli.manuscriptAccess === "read-only") {
    log("skip", "AGENTS.md", `manuscript_access=${cli.manuscriptAccess}`);
    return;
  }
  const home = path.resolve(cli.manuscriptHome);
  if (!fs.existsSync(home) || !fs.statSync(home).isDirectory()) {
    log("skip", "AGENTS.md", `manuscript home not found: ${home}`);
    return;
  }
  const agentsPath = path.join(home, "AGENTS.md");
  const section = agentsMdSection();
  const block = `<!-- academic-project-management:section:start -->\n${section}\n<!-- academic-project-management:section:end -->\n`;

  if (!fs.existsSync(agentsPath)) {
    if (cli.dryRun) {
      log("would write", agentsPath);
      return;
    }
    fs.writeFileSync(agentsPath, `# ${project} agent guidance\n\n${block}`);
    log("write", agentsPath);
    return;
  }

  const existing = fs.readFileSync(agentsPath, "utf8");
  const markerStart = "<!-- academic-project-management:section:start -->";
  const markerEnd = "<!-- academic-project-management:section:end -->";
  const startIdx = existing.indexOf(markerStart);
  const endIdx = existing.indexOf(markerEnd);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = existing.slice(0, startIdx);
    const after = existing.slice(endIdx + markerEnd.length).replace(/^\n+/, "");
    const next = `${before}${block}${after ? `\n${after}` : ""}`;
    if (cli.dryRun) {
      log("would update", agentsPath, "replace managed section");
      return;
    }
    fs.writeFileSync(agentsPath, next);
    log("update", agentsPath, "replace managed section");
    return;
  }

  if (cli.dryRun) {
    log("would update", agentsPath, "append managed section");
    return;
  }
  const sep = existing.endsWith("\n") ? "\n" : "\n\n";
  fs.writeFileSync(agentsPath, `${existing}${sep}${block}`);
  log("update", agentsPath, "append managed section");
}

function updateCurrentStatusPhase() {
  const statusPath = path.join(pmFolder, "CURRENT_STATUS.md");
  if (!fs.existsSync(statusPath) || !cli.phase) return;
  
  let text = fs.readFileSync(statusPath, "utf8");
  const phaseRegex = /(## Current Phase\s*\n\s*)[^\n]+/;
  
  if (phaseRegex.test(text)) {
    text = text.replace(phaseRegex, `$1${cli.phase}`);
    // Update the updated date in frontmatter
    text = text.replace(/updated: \d{4}-\d{2}-\d{2}/, `updated: ${cli.date}`);
    
    if (cli.dryRun) {
      log("would update", statusPath, `phase -> ${cli.phase}`);
    } else {
      fs.writeFileSync(statusPath, text);
      log("update", statusPath, `phase -> ${cli.phase}`);
    }
  }
}

function detectExistingScaffold() {
  // A PM folder is considered already scaffolded if the standard lanes exist as directories
  // and the three required root files are present.
  for (const folder of REQUIRED_FOLDERS) {
    if (!fs.existsSync(path.join(pmFolder, folder))) return false;
  }
  for (const file of ["README.md", "RESEARCH.md", "CURRENT_STATUS.md"]) {
    if (!fs.existsSync(path.join(pmFolder, file))) return false;
  }
  return true;
}

function scaffold() {
  ensureDir(pmFolder);
  for (const folder of REQUIRED_FOLDERS) ensureDir(path.join(pmFolder, folder));

  writeCreateOnly(path.join(pmFolder, `${project}.md`), rootNote());
  writeCreateOnly(path.join(pmFolder, "README.md"), readme());
  writeCreateOnly(path.join(pmFolder, "RESEARCH.md"), research());
  writeCreateOnly(path.join(pmFolder, "CURRENT_STATUS.md"), currentStatus());

  writeCreateOnly(path.join(pmFolder, "literature/literature.md"), loadAndSubstitute("literature.md"));
  writeCreateOnly(path.join(pmFolder, "evidence/evidence.md"), loadAndSubstitute("evidence.md"));
  writeCreateOnly(path.join(pmFolder, "analysis/analysis.md"), loadAndSubstitute("analysis.md"));
  writeCreateOnly(path.join(pmFolder, "writing/writing.md"), loadAndSubstitute("writing.md"));
  writeCreateOnly(path.join(pmFolder, "meetings/meetings.md"), loadAndSubstitute("meetings.md"));
  writeCreateOnly(path.join(pmFolder, "planning/planning.md"), loadAndSubstitute("planning.md"));
  writeCreateOnly(path.join(pmFolder, "history/history.md"), loadAndSubstitute("history.md", { "<history-INITIAL>": `history-${cli.date}` }));
  writeCreateOnly(path.join(pmFolder, `history/history-${cli.date}.md`), historyEntry());
  writeCreateOnly(path.join(pmFolder, "archive/archive.md"), loadAndSubstitute("archive.md"));
  writeCreateOnly(path.join(pmFolder, ".gitignore"), loadAndSubstitute(".gitignore"));
}

// ---- Repair ----
//
// The repair action detects structural drift and rewrites the affected files
// in place. It does not move user notes between lanes (content-level routing
// is human judgment) and does not modify the manuscript-home AGENTS.md section.

function listImmediateFolders(folderAbs) {
  if (!fs.existsSync(folderAbs)) return [];
  return fs.readdirSync(folderAbs, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name);
}

function listImmediateNotes(folderAbs, indexName) {
  if (!fs.existsSync(folderAbs)) return [];
  return fs.readdirSync(folderAbs, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== indexName)
    .map((entry) => entry.name.replace(/\.md$/i, ""));
}

// Parse an existing index block into { subfolders: [...], notes: [...] }.
// Each list contains { target, label, desc } objects. The order of items in
// the existing block is preserved (we only INSERT missing items, never reorder).
function parseIndexBlock(block) {
  const lines = block.split("\n");
  const result = { subfolders: [], notes: [], sectionHeaders: { subfoldersStart: -1, notesStart: -1 } };
  let current = null;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === "## Subfolders") { current = "subfolders"; result.sectionHeaders.subfoldersStart = i; continue; }
    if (line === "## Notes") { current = "notes"; result.sectionHeaders.notesStart = i; continue; }
    if (current && /^-\s+\[\[/.test(line)) {
      const m = line.match(/^-\s+\[\[([^\]|]+)\|([^\]]+)\]\](?:\s*-\s*(.*))?$/);
      if (m) {
        result[current].push({ target: m[1], label: m[2], desc: m[3] || "" });
      }
    }
  }
  return result;
}

function formatItemLine({ target, label, desc }) {
  return `- [[${target}|${label}]]${desc ? ` - ${desc}` : ""}`;
}

// Detect drift: items in live filesystem that are missing from the index.
// Returns a list of missing items, in filesystem order.
function detectMissingFolders(currentItems, liveFolders) {
  const currentTargets = new Set(currentItems.map((i) => i.target));
  return liveFolders.filter((name) => !currentTargets.has(`${name}/${name}`))
    .map((name) => ({ target: `${name}/${name}`, label: name, desc: "" }));
}

function detectMissingNotes(currentItems, liveNotes) {
  const currentTargets = new Set(currentItems.map((i) => i.target));
  return liveNotes.filter((name) => !currentTargets.has(name))
    .map((name) => ({ target: name, label: name, desc: "" }));
}

// Insert missing items into an existing index block. Only inserts; never
// reorders, reformats, or removes anything. Returns { next, addedCount }.
function insertMissingIntoBlock(block, kind, missingItems) {
  if (missingItems.length === 0) return { next: block, addedCount: 0 };
  const parsed = parseIndexBlock(block);
  const header = kind === "subfolders" ? "## Subfolders" : "## Notes";
  const items = parsed[kind];
  // If the section currently shows *(no items)*, replace that line with the
  // combined list of existing-but-empty (preserved) + missing items. Since the
  // parsed items list will be empty when the section shows *(no items)*, this
  // case yields "missing items only."
  const lines = block.split("\n");
  const headerLineIdx = lines.indexOf(header);
  if (headerLineIdx === -1) return { next: block, addedCount: 0 };
  // Find where items end. Items go until the next "##" header or until
  // "<!-- vault-maintain:index:end -->".
  let endLineIdx = lines.length;
  for (let i = headerLineIdx + 1; i < lines.length; i += 1) {
    if (lines[i].startsWith("## ") || lines[i].startsWith("<!-- vault-maintain:index:end")) {
      endLineIdx = i;
      break;
    }
  }
  // Find the "*(no items)*" line if present, replace it with the new items.
  const noItemsIdx = lines.indexOf("*(no items)*", headerLineIdx + 1);
  const newLines = [...missingItems.map(formatItemLine)];
  let nextLines;
  if (noItemsIdx !== -1 && noItemsIdx < endLineIdx) {
    // Replace *(no items)* with the new items; preserve everything else.
    nextLines = [
      ...lines.slice(0, noItemsIdx),
      ...newLines,
      ...lines.slice(noItemsIdx + 1),
    ];
  } else {
    // Insert new items before the closing line. Add an empty separator line
    // before the closing line so the new items don't get jammed against it.
    nextLines = [
      ...lines.slice(0, endLineIdx),
      ...newLines,
      "",
      ...lines.slice(endLineIdx),
    ];
  }
  return { next: nextLines.join("\n"), addedCount: missingItems.length };
}

function appendMissingToIndex(indexPath, kind, missingItems) {
  if (missingItems.length === 0) return 0;
  const text = fs.readFileSync(indexPath, "utf8");
  const startMarker = "<!-- vault-maintain:index:start -->";
  const endMarker = "<!-- vault-maintain:index:end -->";
  const startIdx = text.indexOf(startMarker);
  const endIdx = text.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1) return 0;
  const block = text.slice(startIdx + startMarker.length, endIdx);
  const { next, addedCount } = insertMissingIntoBlock(block, kind, missingItems);
  if (addedCount === 0) return 0;
  const newText =
    text.slice(0, startIdx) +
    startMarker +
    next +
    endMarker +
    text.slice(endIdx + endMarker.length);
  if (cli.dryRun) {
    log("would update", indexPath, `add ${addedCount} ${kind}`);
  } else {
    fs.writeFileSync(indexPath, newText);
    log("update", indexPath, `add ${addedCount} ${kind}`);
  }
  return addedCount;
}

function repairMissingFolderNotes() {
  const findings = [];
  for (const folder of REQUIRED_FOLDERS) {
    const note = path.join(pmFolder, folder, `${folder}.md`);
    if (!fs.existsSync(note)) {
      findings.push({ kind: "missing-folder-note", target: note, action: "recreate-from-template" });
      writeCreateOnly(note, loadAndSubstitute(`${folder}.md`));
    }
  }
  for (const folder of OPTIONAL_FOLDERS) {
    const folderAbs = path.join(pmFolder, folder);
    if (fs.existsSync(folderAbs) && fs.statSync(folderAbs).isDirectory()) {
      const note = path.join(folderAbs, `${folder}.md`);
      if (!fs.existsSync(note)) {
        const body = `${frontmatter(folder, "index")}# ${folder}\n\nOptional folder. Edit to describe what lives here.\n\n<!-- vault-maintain:index:start -->\n## Subfolders\n\n*(no items)*\n\n## Notes\n\n*(no items)*\n<!-- vault-maintain:index:end -->\n\n${nav(["../README", "Back to README"], ["../" + project, `Back to ${project}`])}`;
        findings.push({ kind: "missing-folder-note", target: note, action: "recreate-default" });
        writeCreateOnly(note, body);
      }
    }
  }
  return findings;
}

function repairFolderIndexes() {
  const findings = [];
  for (const folder of [...REQUIRED_FOLDERS, ...OPTIONAL_FOLDERS]) {
    const folderAbs = path.join(pmFolder, folder);
    const indexName = `${folder}.md`;
    const indexPath = path.join(folderAbs, indexName);
    if (!fs.existsSync(indexPath)) continue;
    const text = fs.readFileSync(indexPath, "utf8");
    const startIdx = text.indexOf("<!-- vault-maintain:index:start -->");
    const endIdx = text.indexOf("<!-- vault-maintain:index:end -->");
    if (startIdx === -1 || endIdx === -1) continue;
    const block = text.slice(startIdx, endIdx);
    const parsed = parseIndexBlock(block);
    const missingFolders = detectMissingFolders(parsed.subfolders, listImmediateFolders(folderAbs));
    const missingNotes = detectMissingNotes(parsed.notes, listImmediateNotes(folderAbs, indexName));
    const addedFolders = appendMissingToIndex(indexPath, "subfolders", missingFolders);
    const addedNotes = appendMissingToIndex(indexPath, "notes", missingNotes);
    if (addedFolders > 0 || addedNotes > 0) {
      findings.push({
        kind: "folder-index",
        target: indexPath,
        action: `added ${addedFolders} subfolders, ${addedNotes} notes`,
      });
    }
  }
  return findings;
}

function repairRootNoteIndexes() {
  const findings = [];
  const rootNoteAbs = path.join(pmFolder, `${project}.md`);
  if (!fs.existsSync(rootNoteAbs)) return findings;
  const indexPath = rootNoteAbs;
  const indexName = `${project}.md`;
  const text = fs.readFileSync(indexPath, "utf8");
  const startIdx = text.indexOf("<!-- vault-maintain:index:start -->");
  const endIdx = text.indexOf("<!-- vault-maintain:index:end -->");
  if (startIdx === -1 || endIdx === -1) return findings;
  const block = text.slice(startIdx, endIdx);
  const parsed = parseIndexBlock(block);
  const missingFolders = detectMissingFolders(parsed.subfolders, listImmediateFolders(pmFolder));
  // For notes, only known root notes (README, RESEARCH, CURRENT_STATUS) are
  // auto-listed. Other root-level .md files (user-added) are added with bare
  // names.
  const missingNotes = detectMissingNotes(parsed.notes, listImmediateNotes(pmFolder, indexName));
  const addedFolders = appendMissingToIndex(indexPath, "subfolders", missingFolders);
  const addedNotes = appendMissingToIndex(indexPath, "notes", missingNotes);
  if (addedFolders > 0 || addedNotes > 0) {
    findings.push({
      kind: "root-index",
      target: indexPath,
      action: `added ${addedFolders} subfolders, ${addedNotes} notes`,
    });
  }
  return findings;
}

function actionRepair() {
  if (!fs.existsSync(pmFolder) || !fs.statSync(pmFolder).isDirectory()) {
    throw new Error(`PM folder does not exist: ${pmFolder}`);
  }
  const findings = [
    ...repairMissingFolderNotes(),
    ...repairFolderIndexes(),
    ...repairRootNoteIndexes(),
  ];
  if (findings.length === 0) {
    log("ok", "PM repair", "no drift detected");
  } else {
    for (const f of findings) {
      log("repair", f.target, `${f.kind} (${f.action})`);
    }
  }
  return findings;
}

if (cli.action === "repair") {
  actionRepair();
  console.log("");
  console.log(cli.dryRun ? "# Academic PM repair dry run complete" : "# Academic PM repair complete");
  console.log(`Project: ${project}`);
  console.log(`PM folder: ${pmFolder}`);
  console.log(`Config: ${configPath}`);
  console.log("");
  console.log("Verify with:");
  console.log(`  node ${path.join(SKILL_DIR, "scripts", "check-academic-pm.mjs")} --project ${project} --config ${configPath}`);
  process.exit(0);
}

// ---- Log ----
//
// --action log records a session of work. It generates a dated
// history/YYYY-MM-DD-<slug>.md entry that links back to each --note path,
// and updates the affected lane indexes. Does not modify the touched files.

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    || "event";
}

function uniquifySlug(base) {
  let candidate = base;
  let counter = 2;
  while (fs.existsSync(path.join(pmFolder, "history", `history-${cli.date}-${candidate}.md`))) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }
  return candidate;
}

function eventBody(slug, event, touchedNotes) {
  // Each --note path becomes a wiki-link bullet. Non-md files get the path
  // verbatim; md files get the basename without extension as the label.
  const bullets = touchedNotes.map((rel) => {
    const label = rel.endsWith(".md") ? rel.replace(/\.md$/, "") : rel;
    return `- [[${rel}|${label}]]`;
  }).join("\n");
  const navBlock = nav(["history/history", "Back to history"], [project, `Back to ${project}`]);
  return `${frontmatter(
    `history-${cli.date}-${slug}`,
    "history",
    { kind: cli.logType, event },
  )}# history-${cli.date}-${slug}\n\n> ${event}\n\n## What Changed\n\n${bullets}\n\n${navBlock}`;
}

function actionLog() {
  if (!fs.existsSync(pmFolder) || !fs.statSync(pmFolder).isDirectory()) {
    throw new Error(`PM folder does not exist: ${pmFolder}`);
  }

  // Validate every --note path exists inside the PM folder.
  const touchedNotes = [];
  for (const rel of cli.logNotes) {
    if (path.isAbsolute(rel) || rel.startsWith("..") || rel.includes("\\")) {
      throw new Error(`--note must be a relative path inside the PM folder (got "${rel}")`);
    }
    const abs = path.join(pmFolder, rel);
    if (!fs.existsSync(abs)) {
      throw new Error(`--note path does not exist in PM folder: ${rel} (resolved to ${abs})`);
    }
    touchedNotes.push(rel);
  }

  // Determine the lane(s) each touched note belongs to.
  const touchedLanes = new Set();
  for (const rel of touchedNotes) {
    const top = rel.split("/")[0];
    if (REQUIRED_FOLDERS.includes(top) || OPTIONAL_FOLDERS.includes(top)) {
      touchedLanes.add(top);
    }
  }

  const slug = uniquifySlug(slugify(cli.logEvent));
  const entryName = `history-${cli.date}-${slug}.md`;
  const entryPath = path.join(pmFolder, "history", entryName);

  if (cli.dryRun) {
    log("would write", entryPath);
  } else {
    fs.mkdirSync(path.dirname(entryPath), { recursive: true });
    fs.writeFileSync(entryPath, eventBody(slug, cli.logEvent, touchedNotes));
    log("write", entryPath);
  }

  // Update history/history.md Notes index to include the new entry.
  const historyIndexPath = path.join(pmFolder, "history", "history.md");
  if (fs.existsSync(historyIndexPath)) {
    const entryLabel = entryName.replace(/\.md$/, "");
    appendMissingToIndex(historyIndexPath, "notes", [
      { target: `history/${entryLabel}`, label: entryLabel, desc: cli.logEvent },
    ]);
  } else {
    log("skip", historyIndexPath, "history folder note missing (run repair to recreate)");
  }

  // Update each touched lane's Notes index.
  for (const lane of touchedLanes) {
    const laneIndexPath = path.join(pmFolder, lane, `${lane}.md`);
    if (fs.existsSync(laneIndexPath)) {
      const entryLabel = entryName.replace(/\.md$/, "");
      appendMissingToIndex(laneIndexPath, "notes", [
        { target: `../history/${entryLabel}`, label: entryLabel, desc: cli.logEvent },
      ]);
    }
  }

  // Update CURRENT_STATUS.md Recent Progress section.
  updateCurrentStatusFromLog(entryName, cli.logEvent, touchedLanes);

  log("log", `${entryName}`, `${touchedNotes.length} file(s) referenced, ${touchedLanes.size} lane(s) updated`);
  return { entryName, touchedNotes, touchedLanes: [...touchedLanes] };
}

function updateCurrentStatusFromLog(entryName, event, touchedLanes) {
  const statusPath = path.join(pmFolder, "CURRENT_STATUS.md");
  if (!fs.existsSync(statusPath)) return;

  let text = fs.readFileSync(statusPath, "utf8");

  // Update the updated date in frontmatter.
  text = text.replace(/updated: \d{4}-\d{2}-\d{2}/, `updated: ${cli.date}`);

  // Append to Recent Progress section.
  const progressRegex = /(## Recent Progress\s*\n)/;
  const progressEntry = `- Logged ${entryName.replace(/\.md$/, "")}: ${event} (${[...touchedLanes].join(", ")})\n`;

  if (progressRegex.test(text)) {
    text = text.replace(progressRegex, `$1${progressEntry}`);
  }

  if (cli.dryRun) {
    log("would update", statusPath, "recent progress");
  } else {
    fs.writeFileSync(statusPath, text);
    log("update", statusPath, "recent progress");
  }
}

if (cli.action === "log") {
  actionLog();
  console.log("");
  console.log(cli.dryRun ? "# Academic PM log dry run complete" : "# Academic PM log complete");
  console.log(`Project: ${project}`);
  console.log(`PM folder: ${pmFolder}`);
  console.log(`Config: ${configPath}`);
  console.log("");
  console.log("Verify with:");
  console.log(`  node ${path.join(SKILL_DIR, "scripts", "check-academic-pm.mjs")} --project ${project} --config ${configPath}`);
  process.exit(0);
}

writeConfig();
if (detectExistingScaffold()) {
  log("skip", "PM scaffold", "existing scaffold detected (root files are create-only)");
  updateCurrentStatusPhase();
} else {
  scaffold();
}
writeManuscriptHomeAgentsMd();

console.log("");
console.log(cli.dryRun ? "# Academic PM bootstrap dry run complete" : "# Academic PM bootstrap complete");
console.log(`Project: ${project}`);
console.log(`PM folder: ${pmFolder}`);
console.log(`Config: ${configPath}`);
if (cli.manuscriptHome) {
  console.log(`Manuscript home: ${path.resolve(cli.manuscriptHome)} (${cli.manuscriptKind}, ${cli.manuscriptAccess})`);
} else {
  console.log(`Manuscript home: (none)`);
}
console.log("");
console.log("Verify with:");
console.log(`  node ${path.join(SKILL_DIR, "scripts", "check-academic-pm.mjs")} --project ${project} --config ${configPath}`);
