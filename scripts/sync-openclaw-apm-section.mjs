#!/usr/bin/env node
/**
 * sync-openclaw-apm-section.mjs
 *
 * Re-syncs the `## Academic Project Management` block in OpenClaw workspace
 * `AGENTS.md` files from the section-3 template in `openclaw-instruction.md`.
 *
 * Drift detection: the template carries a `<!-- pm-skill: skill_version=... pm_section_sha=... -->` stamp on the first line of the block. The script reads the same stamp (if present) from each workspace `AGENTS.md` and compares against the template's current version (from `VERSION`) and sha (SHA256 of the template body, computed at runtime).
 *
 * Scope: only the `## Academic Project Management` block is managed. Everything else in the workspace `AGENTS.md` is preserved. Hand-edits *inside* the block are not preserved in v1 — the block is treated as fully managed. The script always shows the full diff before applying.
 *
 * Modes:
 *   --check                print drift table; do not write
 *   --apply                show diff per workspace, require explicit y/N confirmation, then write
 *   --bootstrap <path>     first-time insert: append the block to <path> if no `## Academic Project Management` section exists
 *   --force                skip the confirmation prompt (use with care)
 *   --workspace <path>     limit to a single workspace AGENTS.md (default: discover all)
 *
 * Exit codes:
 *   0  all targets in sync (or changes applied)
 *   1  drift detected and not fixed
 *   2  invalid arguments or missing config
 *   3  user declined the apply confirmation
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const SCRIPT_NAME = "sync-openclaw-apm-section.mjs";
const STAMP_RE = /^<!--\s*pm-skill:\s*skill_version=(\S+)\s+pm_section_sha=(\S+)(?:\s+managed_by=(\S+))?\s*-->\s*$/;
const SECTION_HEADING_RE = /^##\s+Academic Project Management\s*$/;

function findSkillDir() {
  const scriptDir = fileURLToPath(new URL(".", import.meta.url));
  const candidates = [
    process.env.ACADEMIC_PROJECT_MANAGEMENT_SKILL_DIR,
    resolve(scriptDir, ".."),
    join(homedir(), ".agents/skills/academic-project-management"),
    join(homedir(), ".openclaw/skills/academic-project-management"),
  ];
  for (const c of candidates) {
    if (c && existsSync(join(c, "SKILL.md"))) return c;
  }
  return null;
}

const SKILL_DIR = findSkillDir();
if (!SKILL_DIR) {
  console.error(`ERROR: cannot locate the academic-project-management skill install.`);
  console.error(`Set ACADEMIC_PROJECT_MANAGEMENT_SKILL_DIR or install to ~/.agents/skills/academic-project-management.`);
  process.exit(2);
}

const OPENCLAW_INSTRUCTION = join(SKILL_DIR, "openclaw-instruction.md");
const VERSION_FILE = join(SKILL_DIR, "VERSION");

function readVersion() {
  if (!existsSync(VERSION_FILE)) {
    console.error(`ERROR: ${VERSION_FILE} not found.`);
    process.exit(2);
  }
  return readFileSync(VERSION_FILE, "utf8").trim();
}

function findTemplateBlock(content) {
  const sectionMatch = content.match(/^## 3\. Configure Your OpenClaw Workspace `AGENTS\.md`\s*$/m);
  if (!sectionMatch) return null;
  const afterSection = sectionMatch.index + sectionMatch[0].length;
  const nextSectionMatch = content.slice(afterSection).match(/\n## \d+\. /);
  const sectionEnd = nextSectionMatch ? afterSection + nextSectionMatch.index : content.length;
  const section = content.slice(afterSection, sectionEnd);
  const fenceMatch = section.match(/^```markdown\s*\n([\s\S]*?)\n```\s*$/m);
  if (!fenceMatch) return null;
  return fenceMatch[1];
}

function extractStamp(body) {
  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(STAMP_RE);
    if (m) return { line: lines[i], index: i, version: m[1], sha: m[2], managedBy: m[3] ?? null };
  }
  return null;
}

function templateBodySha(body) {
  const stamp = extractStamp(body);
  let content = body;
  if (stamp) {
    content = body.split("\n").filter((_, i) => i !== stamp.index).join("\n");
  }
  const normalized = content.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n+$/, "\n");
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

function renderTemplate(templateBlock, version, sha) {
  const stampLine = `<!-- pm-skill: skill_version=${version} pm_section_sha=${sha} managed_by=${SCRIPT_NAME} -->`;
  const body = templateBlock.split("\n").filter((line) => !line.match(STAMP_RE)).join("\n").replace(/\n+$/, "");
  return `${stampLine}\n${body}\n`;
}

function extractSection(content) {
  const lines = content.split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (SECTION_HEADING_RE.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start === -1) return null;
  if (start > 0 && STAMP_RE.test(lines[start - 1])) {
    start = start - 1;
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return { start, end, text: lines.slice(start, end).join("\n") };
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = { mode: null, force: false, workspace: null, bootstrap: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--check") out.mode = "check";
    else if (args[i] === "--apply") out.mode = "apply";
    else if (args[i] === "--force") out.force = true;
    else if (args[i] === "--workspace") out.workspace = args[++i];
    else if (args[i] === "--bootstrap") out.bootstrap = args[++i];
    else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`Usage: node ${SCRIPT_NAME} [--check | --apply | --bootstrap <path>] [--workspace <path>] [--force]`);
      process.exit(0);
    } else {
      console.error(`ERROR: unknown argument: ${args[i]}`);
      process.exit(2);
    }
  }
  if (!out.mode && !out.bootstrap) {
    console.error(`ERROR: specify --check, --apply, or --bootstrap <path>.`);
    process.exit(2);
  }
  return out;
}

function discoverWorkspaces() {
  const found = new Set();
  const openclawDir = join(homedir(), ".openclaw");
  if (!existsSync(openclawDir)) return [];
  const directPath = join(openclawDir, "workspace", "AGENTS.md");
  if (existsSync(directPath)) found.add(directPath);
  const entries = readFileNames(openclawDir);
  for (const entry of entries) {
    if (entry.startsWith("workspace-")) {
      const candidate = join(openclawDir, entry, "AGENTS.md");
      if (existsSync(candidate)) found.add(candidate);
    }
  }
  return [...found].sort();
}

function readFileNames(dir) {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

async function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

function diffLines(oldText, newText) {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const out = [];
  let i = 0, j = 0;
  while (i < oldLines.length && j < newLines.length) {
    if (oldLines[i] === newLines[j]) {
      out.push(`  ${oldLines[i]}`);
      i++; j++;
    } else {
      const lookAheadOld = oldLines.slice(i, i + 5);
      const lookAheadNew = newLines.slice(j, j + 5);
      const oldInNew = lookAheadNew.includes(oldLines[i]);
      const newInOld = lookAheadOld.includes(newLines[j]);
      if (oldInNew && !newInOld) {
        out.push(`- ${oldLines[i]}`); i++;
      } else if (newInOld && !oldInNew) {
        out.push(`+ ${newLines[j]}`); j++;
      } else {
        out.push(`- ${oldLines[i]}`); i++;
        out.push(`+ ${newLines[j]}`); j++;
      }
    }
  }
  while (i < oldLines.length) { out.push(`- ${oldLines[i]}`); i++; }
  while (j < newLines.length) { out.push(`+ ${newLines[j]}`); j++; }
  return out;
}

const CLI = parseArgs(process.argv);
const VERSION = readVersion();
const INSTRUCTION = readFileSync(OPENCLAW_INSTRUCTION, "utf8");
const TEMPLATE_BLOCK = findTemplateBlock(INSTRUCTION);
if (!TEMPLATE_BLOCK) {
  console.error(`ERROR: could not locate the section-3 template code block in ${OPENCLAW_INSTRUCTION}.`);
  process.exit(2);
}
const CURRENT_SHA = templateBodySha(TEMPLATE_BLOCK);
const RENDERED_TEMPLATE = renderTemplate(TEMPLATE_BLOCK, VERSION, CURRENT_SHA);

if (CLI.bootstrap) {
  const targetPath = resolve(CLI.bootstrap);
  if (!existsSync(targetPath)) {
    console.error(`ERROR: bootstrap target does not exist: ${targetPath}`);
    process.exit(2);
  }
  const content = readFileSync(targetPath, "utf8");
  if (extractSection(content)) {
    console.error(`ERROR: ${targetPath} already has a \`## Academic Project Management\` section. Use --apply to update it.`);
    process.exit(2);
  }
  const trimmed = content.replace(/\s*$/, "");
  const separator = trimmed ? "\n\n" : "";
  const newContent = `${trimmed}${separator}${RENDERED_TEMPLATE.trimEnd()}\n`;
  if (CLI.force) {
    writeFileSync(targetPath, newContent);
    console.log(`bootstrapped: ${targetPath}`);
    process.exit(0);
  }
  console.log(`\nBootstrap will append the following block to ${targetPath}:\n`);
  console.log(RENDERED_TEMPLATE);
  console.log("");
  const ans = await prompt(`Apply bootstrap? [y/N] `);
  if (ans !== "y" && ans !== "yes") {
    console.log("declined.");
    process.exit(3);
  }
  writeFileSync(targetPath, newContent);
  console.log(`bootstrapped: ${targetPath}`);
  process.exit(0);
}

const TARGETS = CLI.workspace ? [resolve(CLI.workspace)] : discoverWorkspaces();
if (TARGETS.length === 0) {
  console.log("No OpenClaw workspace AGENTS.md files detected under ~/.openclaw/.");
  process.exit(0);
}

const rows = [];
for (const path of TARGETS) {
  const content = readFileSync(path, "utf8");
  const section = extractSection(content);
  if (!section) {
    rows.push({ path, status: "MISSING", currentVersion: null, currentSha: null });
    continue;
  }
  const stamp = extractStamp(section.text);
  if (!stamp) {
    rows.push({ path, status: "UNSTAMPED", currentVersion: null, currentSha: null });
    continue;
  }
  const driftVersion = stamp.version !== VERSION;
  const driftSha = stamp.sha !== CURRENT_SHA;
  const status = !driftVersion && !driftSha ? "IN_SYNC" : (driftVersion && driftSha ? "DRIFT_BOTH" : (driftVersion ? "DRIFT_VERSION" : "DRIFT_SHA"));
  rows.push({ path, status, currentVersion: stamp.version, currentSha: stamp.sha });
}

if (CLI.mode === "check") {
  console.log(`# OpenClaw APM Section Sync — template version ${VERSION} / sha ${CURRENT_SHA.slice(0, 12)}…\n`);
  for (const row of rows) {
    const shortPath = relative(homedir(), row.path);
    const cur = row.currentVersion ? `${row.currentVersion}/${row.currentSha ? row.currentSha.slice(0, 12) : "?"}…` : "(none)";
    console.log(`- ${row.status.padEnd(12)} ${shortPath}  current: ${cur}`);
  }
  const drift = rows.filter((r) => r.status !== "IN_SYNC").length;
  console.log(`\n${drift === 0 ? "All in sync." : `${drift} workspace(s) drift; run with --apply to update.`}`);
  process.exit(drift === 0 ? 0 : 1);
}

if (CLI.mode === "apply") {
  let applied = 0, declined = 0, skipped = 0;
  for (const row of rows) {
    if (row.status === "IN_SYNC") {
      console.log(`skip (in sync): ${relative(homedir(), row.path)}`);
      skipped++;
      continue;
    }
    if (row.status === "MISSING") {
      console.log(`\n[!] ${relative(homedir(), row.path)}: missing \`## Academic Project Management\` section. Run --bootstrap on this path first.`);
      continue;
    }
    if (!process.stdin.isTTY && !CLI.force) {
      console.error(`ERROR: --apply requires an interactive terminal for confirmation, or pass --force.`);
      process.exit(2);
    }
    const content = readFileSync(row.path, "utf8");
    const section = extractSection(content);
    const diff = diffLines(section.text, RENDERED_TEMPLATE);
    console.log(`\n# Diff for ${relative(homedir(), row.path)}`);
    console.log(`# status: ${row.status}; current: ${row.currentVersion ?? "?"} / ${row.currentSha ? row.currentSha.slice(0, 12) : "?"}…; new: ${VERSION} / ${CURRENT_SHA.slice(0, 12)}…`);
    console.log(diff.map((l) => l).join("\n"));
    if (CLI.force) {
      const startIdx = content.indexOf(section.text);
      const newContent = content.slice(0, startIdx) + RENDERED_TEMPLATE + content.slice(startIdx + section.text.length);
      writeFileSync(row.path, newContent);
      console.log(`\napplied (--force): ${relative(homedir(), row.path)}`);
      applied++;
      continue;
    }
    const ans = await prompt(`Apply this diff to ${relative(homedir(), row.path)}? [y/N] `);
    if (ans !== "y" && ans !== "yes") {
      console.log(`declined: ${relative(homedir(), row.path)}`);
      declined++;
      continue;
    }
    const startIdx = content.indexOf(section.text);
    const newContent = content.slice(0, startIdx) + RENDERED_TEMPLATE + content.slice(startIdx + section.text.length);
    writeFileSync(row.path, newContent);
    console.log(`applied: ${relative(homedir(), row.path)}`);
    applied++;
  }
  console.log(`\nSummary: ${applied} applied, ${declined} declined, ${skipped} in sync.`);
  process.exit(declined > 0 ? 3 : 0);
}
