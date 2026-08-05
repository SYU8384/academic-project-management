#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

import {
  isAgentsManaged,
  renderAgentsSection,
  upsertAgentsMd,
} from "./lib/agents-section.mjs";

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

const OPTIONAL_FOLDERS = ["verification", "submissions", "admin", "ethics", "collaboration"];

const PHASES = [
  { value: "idea", desc: "Initial concept, no literature review yet" },
  { value: "literature", desc: "Active literature review and related-work synthesis" },
  { value: "design", desc: "Research design, hypotheses, methods planned" },
  { value: "data", desc: "Data collection, cleaning, measurement definition" },
  { value: "analysis", desc: "Active analysis, results emerging" },
  { value: "analysis-writing", desc: "Parallel analysis and drafting" },
  { value: "writing", desc: "Focused manuscript writing" },
  { value: "revision", desc: "Addressing reviewer comments, revising claims" },
  { value: "submission", desc: "Preparing submission materials" },
  { value: "published", desc: "Paper published, project maintenance mode" },
];

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function interactiveBootstrap(out) {
  console.log("\n📚 Academic Project Management — Interactive Setup\n");

  if (!out.project) {
    out.project = await prompt("Project name (e.g., CareerPathsPaper): ");
    if (!out.project) throw new Error("Project name is required");
  }

  if (!out.pmFolder) {
    const defaultPath = path.join(process.cwd(), out.project);
    const answer = await prompt(`PM folder path [${defaultPath}]: `);
    out.pmFolder = answer || defaultPath;
  }

  if (!out.phase) {
    console.log("\nResearch phases:");
    PHASES.forEach((p, i) => console.log(`  ${i + 1}) ${p.value.padEnd(18)} — ${p.desc}`));
    const answer = await prompt("\nSelect phase (number or name): ");
    const num = parseInt(answer, 10);
    if (!isNaN(num) && num >= 1 && num <= PHASES.length) {
      out.phase = PHASES[num - 1].value;
    } else {
      const found = PHASES.find((p) => p.value === answer);
      if (found) out.phase = found.value;
      else out.phase = answer;
    }
    if (!out.phase) throw new Error("Phase is required");
  }

  if (!out.notes) {
    const defaultNotes = `${out.project} academic research project.`;
    const answer = await prompt(`Project description [${defaultNotes}]: `);
    out.notes = answer || defaultNotes;
  }

  const hasManuscript = await prompt("\nDoes this project have a manuscript home (LaTeX/code workfile folder)? [y/N]: ");
  if (hasManuscript.toLowerCase() === "y" || hasManuscript.toLowerCase() === "yes") {
    const homePath = await prompt("Manuscript home path: ");
    if (homePath) {
      out.manuscriptHome = homePath;
      // Auto-detect whether this is a git repo. Both git repos and local
      // folders can receive the managed AGENTS.md routing section.
      const gitDir = path.join(homePath, ".git");
      if (fs.existsSync(gitDir)) {
        out.manuscriptKind = "git-repo";
        console.log(`   Detected git repository`);
      } else {
        const kind = await prompt("  Type: [1] local-folder [2] git-repo [1]: ");
        out.manuscriptKind = kind === "2" ? "git-repo" : "local-folder";
      }
      const access = await prompt("  Access level [1] authoritative [2] read-only [1]: ");
      out.manuscriptAccess = access === "2" ? "read-only" : "authoritative";
    }
  }

  console.log("\n📋 Setup Summary:");
  console.log(`  Project:         ${out.project}`);
  console.log(`  PM folder:       ${out.pmFolder}`);
  console.log(`  Phase:           ${out.phase}`);
  console.log(`  Description:     ${out.notes}`);
  if (out.manuscriptHome) {
    console.log(`  Manuscript home: ${out.manuscriptHome}`);
    console.log(`  Manuscript kind: ${out.manuscriptKind}`);
    console.log(`  Manuscript access: ${out.manuscriptAccess}`);
  }

  if (!out.yes) {
    const confirm = await prompt("\nProceed? [y/N]: ");
    if (confirm.toLowerCase() !== "y" && confirm.toLowerCase() !== "yes") {
      console.log("Setup canceled.");
      process.exit(0);
    }
  }
}

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
    [--dry-run] [--yes]

Actions:
  bootstrap (default) — scaffold a fresh PM folder or refresh projects.json
                        and the manuscript-home AGENTS.md section.
  repair              — detect structural drift (missing folder notes,
                        including nested subfolders referenced by
                        folder-note wikilinks; out-of-date
                        subfolders/notes indexes) and rewrite
                        the affected files in place. Does not move user
                        notes between lanes. Also refreshes the
                        manuscript-home AGENTS.md managed section from
                        projects.json (no manuscript flags needed).
  log                 — record a session of work. Generates a dated
                        history/YYYY-MM-DD-<slug>.md entry that links back
                        to each --note path, and updates the affected
                        lane indexes. Does not modify the touched files.

Bootstrap re-runs: if the PM folder already has the standard scaffold, the
script skips the scaffold step and only updates projects.json and the
manuscript-home AGENTS.md section. When --manuscript-home is omitted on a
re-run, the manuscript_* values already in projects.json are preserved
(pass --no-manuscript-home to clear them explicitly).

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
    yes: false,
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
    if (arg === "--yes") {
      out.yes = true;
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

  // Interactive mode: if bootstrap args are missing, prompt for them.
  const needsInteractive = out.action === "bootstrap" && (!out.project || !out.pmFolder || !out.phase);
  if (needsInteractive) {
    // Interactive mode requires stdin to be a TTY.
    if (!process.stdin.isTTY) {
      throw new Error("Missing required arguments. Run with --project, --pm-folder, and --phase, or provide them interactively.");
    }
    // Don't validate yet; interactiveBootstrap will fill in the gaps.
  } else {
    // Required args differ by action.
    for (const key of ["project", "pmFolder"]) {
      if (!out[key]) throw new Error(`Missing required --${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`);
    }
    if (out.action === "bootstrap" && !out.phase) {
      throw new Error(`Missing required --phase (required for --action bootstrap)`);
    }
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

// Resolve the effective manuscript-home values for this run. When
// --manuscript-home is not passed on a re-bootstrap, preserve the values
// already registered in projects.json instead of wiping them. An explicit
// --no-manuscript-home (empty string) still clears them.
function resolveEffectiveManuscript(configPath, project) {
  const eff = { home: cli.manuscriptHome, kind: cli.manuscriptKind, access: cli.manuscriptAccess };
  if (cli.manuscriptHome !== null) return eff;
  let existing = null;
  try {
    if (fs.existsSync(configPath)) {
      existing = JSON.parse(fs.readFileSync(configPath, "utf8")).projects?.[project] ?? null;
    }
  } catch { /* unreadable config: fall through with CLI values */ }
  if (existing?.manuscript_home) {
    eff.home = existing.manuscript_home;
    eff.kind = existing.manuscript_kind ?? cli.manuscriptKind;
    eff.access = existing.manuscript_access ?? cli.manuscriptAccess;
  }
  return eff;
}

// Interactive mode for bootstrap when args are missing.
if (cli.action === "bootstrap" && (!cli.project || !cli.pmFolder || !cli.phase)) {
  if (!process.stdin.isTTY) {
    console.error("Error: Missing required arguments. Provide --project, --pm-folder, and --phase, or run interactively.");
    process.exit(1);
  }
  interactiveBootstrap(cli).then(() => {
    // After interactive mode fills in the args, continue with the main flow.
    runMain();
  }).catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
} else {
  runMain();
}

function runMain() {
const project = cli.project;
const pmFolder = path.resolve(cli.pmFolder);
const configPath = path.resolve(cli.config);
const vaultRoot = cli.vaultRoot ? path.resolve(cli.vaultRoot) : path.dirname(pmFolder);
const notes = cli.notes || `${project} academic research project.`;
const eff = resolveEffectiveManuscript(configPath, project);

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

// Canonical frontmatter shape, matching the generic `project-management`
// skill. Field order matters for human readability:
//   title, tags, pageType, created, owner, icon, iconColor,
//   updated, last_reviewed, status
// `extra` slots in at the end so callers can append (e.g. `aliases`,
// project-specific tags, decision_type). When you need to inject
// `icon` / `iconColor`, pass them via `extra` and they will be picked
// up out-of-order — to keep them in their canonical slots, prefer the
// dedicated `icon` / `iconColor` parameters below. The `tags` slot
// follows the same rule; pass it via `extra.tags` to override the
// default `[folder-note]`.
function frontmatter(title, pageType, extra = {}) {
  const {
    icon = null,
    iconColor = null,
    tags = null,
    ...rest
  } = extra;
  const fields = {
    title: yaml(title),
    tags,
    pageType,
    created: cli.date,
    owner: "researcher",
    icon: icon ? JSON.stringify(icon) : null,
    iconColor: iconColor ? JSON.stringify(iconColor) : null,
    updated: cli.date,
    last_reviewed: cli.date,
    status: "active",
    ...rest,
  };
  const lines = ["---"];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) lines.push(`  - ${item}`);
    } else {
      lines.push(`${key}: ${value}`);
    }
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
    analysis: "methods, findings, interpretations, modeling decisions",
    writing: "draft, figures, tables, submission notes",
    meetings: "advisor and collaborator notes",
    planning: "plans and decisions",
    history: "concise completed-work logs",
    archive: "superseded material",
    verification: "data verification, reproducibility checks, hand-calc logs",
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
  if (eff.home) {
    cfg.projects[project].manuscript_home = path.resolve(eff.home);
    cfg.projects[project].manuscript_kind = eff.kind;
    cfg.projects[project].manuscript_access = eff.access;
  } else {
    cfg.projects[project].manuscript_home = "";
    cfg.projects[project].manuscript_kind = "null";
    cfg.projects[project].manuscript_access = cli.manuscriptAccess;
  }
  writeReplace(configPath, `${JSON.stringify(cfg, null, 2)}\n`);
}

function writeManuscriptHomeAgentsMd() {
  if (!cli.writeAgentsMd) {
    log("skip", "AGENTS.md", "--no-agents-md");
    return;
  }
  if (!eff.home) {
    log("skip", "AGENTS.md", "no manuscript home (neither --manuscript-home nor projects.json)");
    return;
  }
  if (eff.access === "none" || eff.access === "read-only") {
    log("skip", "AGENTS.md", `manuscript_access=${eff.access}`);
    return;
  }
  const home = path.resolve(eff.home);
  if (!fs.existsSync(home) || !fs.statSync(home).isDirectory()) {
    log("skip", "AGENTS.md", `manuscript home not found: ${home}`);
    return;
  }
  const section = renderAgentsSection({
    skillDir: SKILL_DIR,
    pmFolder,
    manuscriptHome: eff.home,
    manuscriptKind: eff.kind,
    manuscriptAccess: eff.access,
  });
  upsertAgentsMd({ home, section, title: project, dryRun: cli.dryRun, logFn: log });
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
// is human judgment). It also refreshes the manuscript-home AGENTS.md managed
// section from projects.json — this is the backfill path for projects
// registered before a template or feature change (e.g. local-folder AGENTS.md
// support), since no CLI manuscript flags are needed.

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
        const templatePath = path.join(SKILL_DIR, "templates", `${folder}.md`);
        let body;
        if (fs.existsSync(templatePath)) {
          body = loadAndSubstitute(`${folder}.md`);
          findings.push({ kind: "missing-folder-note", target: note, action: "recreate-from-template" });
        } else {
          body = `${frontmatter(folder, "index")}# ${folder}\n\nOptional folder. Edit to describe what lives here.\n\n<!-- vault-maintain:index:start -->\n## Subfolders\n\n*(no items)*\n\n## Notes\n\n*(no items)*\n<!-- vault-maintain:index:end -->\n\n${nav(["../README", "Back to README"], ["../" + project, `Back to ${project}`])}`;
          findings.push({ kind: "missing-folder-note", target: note, action: "recreate-default" });
        }
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

// Collect every folder-note path referenced by wikilinks in the PM folder.
// A referenced path looks like `<dir>/<basename>` (e.g. a link to
// `[[.../literature/paper-notes/paper-notes|paper-notes]]`). Targets are
// normalized three ways, mirroring the validator's resolution: as-is
// (PM-root-relative), vault-relative (cut through the PM folder basename),
// and `./`/`../` resolved against the linking file's directory.
function collectReferencedFolderNotePaths() {
  const refs = new Set();
  const rootBase = path.basename(pmFolder);
  const marker = `${rootBase}/`;
  const files = [];
  (function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.isFile() && entry.name.endsWith(".md")) files.push(abs);
    }
  })(pmFolder);

  for (const abs of files) {
    const rel = path.relative(pmFolder, abs).split(path.sep).join("/");
    const relDir = path.posix.dirname(rel);
    const text = fs.readFileSync(abs, "utf8");
    for (const m of text.matchAll(/\[\[([^\]]+)\]\]/g)) {
      const noAlias = m[1].split("|")[0];
      const t = noAlias.split("#")[0].split("^")[0].trim().replace(/\\/g, "/").replace(/\.md$/i, "");
      if (!t) continue;
      refs.add(t);
      const markerIdx = t.lastIndexOf(marker);
      if (markerIdx >= 0) refs.add(t.slice(markerIdx + marker.length));
      if (t.startsWith("./") || t.startsWith("../")) {
        refs.add(path.posix.normalize(path.posix.join(relDir, t)));
      }
    }
  }
  return refs;
}

function nestedFolderNoteBody(rel, name) {
  const depth = rel.split("/").length;
  const parentBase = path.posix.basename(path.posix.dirname(rel));
  const projectPrefix = "../".repeat(depth);
  return `${frontmatter(name, "index")}# ${name}\n\n> Notes in this folder.\n\n<!-- vault-maintain:index:start -->\n## Subfolders\n\n*(no items)*\n\n## Notes\n\n*(no items)*\n<!-- vault-maintain:index:end -->\n\n${nav([`../${parentBase}`, `Back to ${parentBase}`], [`${projectPrefix}${project}`, `Back to ${project}`])}`;
}

// Nested lane subfolders (e.g. literature/paper-notes/) are not covered by
// the top-level lane repair above. Create a folder note for a nested dir
// only when some note already links to it as `<rel>/<basename>` — the
// reference gate keeps PDF holding dirs and unreferenced archive subdirs
// untouched while healing exactly the drift that produces unresolved-link
// validator warnings.
function repairNestedFolderNotes() {
  const findings = [];
  const refs = collectReferencedFolderNotePaths();
  const dirs = [];
  (function walk(dir, rel) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      dirs.push(childRel);
      walk(path.join(dir, entry.name), childRel);
    }
  })(pmFolder, "");

  for (const rel of dirs) {
    if (!rel.includes("/")) continue; // top-level lanes handled above
    const name = path.posix.basename(rel);
    const note = path.join(pmFolder, rel, `${name}.md`);
    if (fs.existsSync(note)) continue;
    if (!refs.has(`${rel}/${name}`)) continue;
    findings.push({ kind: "missing-folder-note", target: note, action: "recreate-default (nested, referenced)" });
    writeCreateOnly(note, nestedFolderNoteBody(rel, name));
  }
  return findings;
}

function repairManuscriptHomeAgentsMd() {
  if (!cli.writeAgentsMd) {
    log("skip", "AGENTS.md", "--no-agents-md");
    return [];
  }
  let entry = null;
  try {
    if (fs.existsSync(configPath)) {
      entry = JSON.parse(fs.readFileSync(configPath, "utf8")).projects?.[project] ?? null;
    }
  } catch { /* unreadable config: skip */ }
  if (!entry?.manuscript_home) {
    log("skip", "AGENTS.md", "no manuscript_home registered in projects.json");
    return [];
  }
  if (!isAgentsManaged(entry)) {
    log("skip", "AGENTS.md", `manuscript_kind=${entry.manuscript_kind} manuscript_access=${entry.manuscript_access}`);
    return [];
  }
  const home = path.resolve(entry.manuscript_home);
  if (!fs.existsSync(home) || !fs.statSync(home).isDirectory()) {
    log("skip", "AGENTS.md", `manuscript home not found: ${home}`);
    return [];
  }
  const section = renderAgentsSection({
    skillDir: SKILL_DIR,
    pmFolder,
    manuscriptHome: entry.manuscript_home,
    manuscriptKind: entry.manuscript_kind,
    manuscriptAccess: entry.manuscript_access,
  });
  const agentsPath = path.join(home, "AGENTS.md");
  const existed = fs.existsSync(agentsPath);
  const result = upsertAgentsMd({ home, section, title: project, dryRun: cli.dryRun, logFn: log });
  if (result === "in-sync") return [];
  return [{ kind: "agents-md", target: agentsPath, action: existed ? "refreshed managed section" : "created with managed section" }];
}

function actionRepair() {
  if (!fs.existsSync(pmFolder) || !fs.statSync(pmFolder).isDirectory()) {
    throw new Error(`PM folder does not exist: ${pmFolder}`);
  }
  const findings = [
    ...repairMissingFolderNotes(),
    ...repairNestedFolderNotes(),
    ...repairFolderIndexes(),
    ...repairRootNoteIndexes(),
    ...repairManuscriptHomeAgentsMd(),
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
if (eff.home) {
  console.log(`Manuscript home: ${path.resolve(eff.home)} (${eff.kind}, ${eff.access})`);
} else {
  console.log(`Manuscript home: (none)`);
}
console.log("");
console.log("Verify with:");
console.log(`  node ${path.join(SKILL_DIR, "scripts", "check-academic-pm.mjs")} --project ${project} --config ${configPath}`);
} // end runMain()
