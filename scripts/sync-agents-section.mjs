#!/usr/bin/env node
/**
 * sync-agents-section.mjs
 *
 * Re-renders the managed `## Academic PM folder` section of every
 * registered manuscript home's `AGENTS.md` from the latest
 * `templates/AGENTS_ACADEMIC_PM_SECTION.md` template and the values in
 * projects.json. Creates `AGENTS.md` when missing, replaces the managed
 * marker-delimited span when present, and preserves all other content.
 *
 * Use this to backfill or heal drifted manuscript-home AGENTS.md files —
 * e.g. projects registered before local-folder AGENTS.md support landed —
 * without re-running bootstrap or re-passing manuscript flags.
 *
 * Flags:
 *   --project <name>   sync one project (default: all)
 *   --config <path>    path to projects.json (default: ~/.config/academic-pm/projects.json)
 *   --dry-run          print what would change, do not write
 *
 * Exit codes:
 *   0  all targets handled (in sync, updated, or legitimately skipped)
 *   1  one or more targets failed
 *   2  invalid arguments or missing config
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

import {
  isAgentsManaged,
  renderAgentsSection,
  upsertAgentsMd,
} from "./lib/agents-section.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.dirname(SCRIPT_DIR);
const DEFAULT_CONFIG_PATH = path.join(os.homedir(), ".config", "academic-pm", "projects.json");

const USAGE = `Usage: node scripts/sync-agents-section.mjs [options]

Options:
  --project <name>   sync one project (default: all)
  --config <path>    path to projects.json (default: ~/.config/academic-pm/projects.json)
  --dry-run          print what would change, do not write
  --help, -h         show this help
`;

function parseArgs(argv) {
  const out = { config: null, project: null, dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--help" || a === "-h") {
      process.stdout.write(USAGE);
      process.exit(0);
    } else if (a === "--project" || a === "--config") {
      const value = argv[++i];
      if (!value) {
        process.stderr.write(`Missing value for ${a}\n${USAGE}`);
        process.exit(2);
      }
      if (a === "--project") out.project = value;
      else out.config = value;
    } else {
      process.stderr.write(`Unknown arg: ${a}\n${USAGE}`);
      process.exit(2);
    }
  }
  return out;
}

const CLI = parseArgs(process.argv);
const configPath = path.resolve(CLI.config ?? DEFAULT_CONFIG_PATH);

if (!fs.existsSync(configPath)) {
  console.error(`ERROR: projects.json not found at ${configPath}. Pass --config <path> or set up the skill first.`);
  process.exit(2);
}
const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
const entries = CLI.project
  ? Object.entries(cfg.projects ?? {}).filter(([n]) => n === CLI.project)
  : Object.entries(cfg.projects ?? {});
if (CLI.project && entries.length === 0) {
  console.error(`ERROR: project '${CLI.project}' not found in ${configPath}`);
  process.exit(2);
}

console.log(`# Academic PM AGENTS.md section sync`);
console.log(``);
console.log(`Config: ${configPath}`);
console.log(`Skill:  ${SKILL_DIR}`);
console.log(`Mode:   ${CLI.dryRun ? "dry-run" : "apply"}`);
console.log(`Scope:  ${CLI.project ?? "(all)"}`);
console.log(``);

let failures = 0;
for (const [name, project] of entries) {
  const lines = [];
  const log = (action, target, detail = "") =>
    lines.push(`  ${action}: ${target}${detail ? ` - ${detail}` : ""}`);

  if (!project.manuscript_home) {
    console.log(`· ${name}: skipped (no manuscript_home registered)`);
    continue;
  }
  if (!isAgentsManaged(project)) {
    console.log(`· ${name}: skipped (manuscript_kind=${project.manuscript_kind}, manuscript_access=${project.manuscript_access})`);
    continue;
  }
  if (!project.pm_folder) {
    console.log(`✗ ${name}: no pm_folder registered; cannot render section`);
    failures++;
    continue;
  }
  const home = path.resolve(project.manuscript_home);
  if (!fs.existsSync(home) || !fs.statSync(home).isDirectory()) {
    console.log(`✗ ${name}: manuscript home not found: ${home}`);
    failures++;
    continue;
  }

  const section = renderAgentsSection({
    skillDir: SKILL_DIR,
    pmFolder: project.pm_folder,
    manuscriptHome: project.manuscript_home,
    manuscriptKind: project.manuscript_kind,
    manuscriptAccess: project.manuscript_access,
  });
  const result = upsertAgentsMd({ home, section, title: name, dryRun: CLI.dryRun, logFn: log });
  const marker = result === "in-sync" ? "✓" : result.startsWith("would") ? "·" : "✓";
  console.log(`${marker} ${name}: ${result} ${path.join(home, "AGENTS.md")}`);
  for (const l of lines) console.log(l);
}

console.log(``);
if (failures > 0) {
  console.log(`# Sync failed (${failures} project(s))`);
  process.exit(1);
}
console.log(`# Sync complete (${entries.length} project(s))`);
process.exit(0);
