#!/usr/bin/env node
/** Explicit, local Research Program management. Legacy paper-series files remain supported. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.dirname(SCRIPT_DIR);
const LEGACY = path.join(SCRIPT_DIR, "manage-paper-series.mjs");
const DEFAULT_CONFIG = path.join(os.homedir(), ".config", "academic-pm", "projects.json");
const usage = () => console.error(`Usage: node scripts/manage-research-program.mjs --action <action> --program <id> [options]

Actions: bootstrap, repair, manage-meeting, capture-idea, triage-idea, audit-inbox, migrate-synopsis, adopt-project
New bootstrap flags: --program-folder <path> --vault-root <path> --shared-manuscript-home <path> [--project <registry-key> ...]
Adopt: --project <registered-project> --work-id <stable-id> --work-type <article|chapter|study|...> [--mode bridge] [--dry-run]
All other flags match manage-paper-series.mjs with --program replacing --series. Bridge adoption never moves PM folders, repositories, or artifacts.`);
const args = process.argv.slice(2);
const value = (flag) => { const i = args.indexOf(flag); return i < 0 ? null : args[i + 1] ?? null; };
const programId = value("--program");
const action = value("--action");
const configPath = path.resolve(value("--config") ?? DEFAULT_CONFIG);
const dryRun = args.includes("--dry-run");
if (!programId || !action) { usage(); process.exit(2); }
const readConfig = () => fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, "utf8")) : { projects: {}, programs: {}, skill_dir: SKILL_DIR };
const writeConfig = (cfg) => { if (!dryRun) { fs.mkdirSync(path.dirname(configPath), { recursive: true }); fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2) + "\n", "utf8"); } };
const members = (entry) => entry.projects ?? entry.papers ?? [];
function materializeProgram(cfg, id) {
  if (cfg.programs?.[id]) return cfg.programs[id];
  const old = cfg.series?.[id];
  if (!old) throw new Error(`Research Program '${id}' is not registered. Bootstrap it first.`);
  const entry = { ...old, project_type: "research-program", projects: members(old) }; delete entry.papers;
  cfg.programs ??= {}; cfg.programs[id] = entry;
  for (const key of entry.projects) { const project = cfg.projects?.[key]; if (!project) continue; project.project_type = "research-project"; project.program_id = id; project.work_id ??= project.paper_id ?? key; project.work_type ??= "project"; }
  return entry;
}
function asLegacy(cfg, id) {
  const copy = structuredClone(cfg); copy.series ??= {}; const entry = copy.programs?.[id];
  if (entry) { copy.series[id] = { ...entry, project_type: "paper-series", papers: members(entry) }; delete copy.series[id].projects; for (const key of copy.series[id].papers) { const project = copy.projects?.[key]; if (!project) continue; project.series_id = id; project.paper_id = project.work_id ?? key; } }
  return copy;
}
function transformedArgs(tempConfig) { const out = []; for (let i = 0; i < args.length; i += 1) { const token = args[i]; if (token === "--program") { out.push("--series", args[++i]); continue; } if (token === "--program-folder") { out.push("--series-folder", args[++i]); continue; } if (token === "--project") { out.push("--paper", args[++i]); continue; } if (token === "--config") { i += 1; continue; } out.push(token); } out.push("--config", tempConfig); return out; }
function adopt() {
  const cfg = readConfig(); const projectName = value("--project"); const workId = value("--work-id"); const workType = value("--work-type"); const mode = value("--mode") ?? "bridge";
  if (mode !== "bridge") throw new Error("Only safe --mode bridge is supported; it never relocates project files.");
  if (!projectName || !workId || !workType) throw new Error("adopt-project requires --project, --work-id, and --work-type.");
  const program = materializeProgram(cfg, programId); const project = cfg.projects?.[projectName]; if (!project) throw new Error(`Research Project '${projectName}' is not registered.`);
  if (project.program_id && project.program_id !== programId) throw new Error(`Research Project '${projectName}' already belongs to '${project.program_id}'.`);
  project.project_type = "research-project"; project.program_id = programId; project.work_id = workId; project.work_type = workType;
  program.projects = [...new Set([...members(program), projectName])]; delete program.papers;
  writeConfig(cfg); console.log(`# Research Project adopted${dryRun ? " (dry-run)" : ""}: ${projectName} -> ${programId} (bridge; no paths moved)`);
}
function delegate() {
  const cfg = readConfig(); const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "academic-pm-program-")); const tempConfig = path.join(tempRoot, "projects.json");
  fs.writeFileSync(tempConfig, JSON.stringify(asLegacy(cfg, programId), null, 2) + "\n", "utf8");
  const result = spawnSync(process.execPath, [LEGACY, ...transformedArgs(tempConfig)], { encoding: "utf8" });
  process.stdout.write((result.stdout ?? "").replaceAll("Series", "Research Program").replaceAll("series", "program")); process.stderr.write((result.stderr ?? "").replaceAll("Series", "Research Program").replaceAll("series", "program"));
  if (result.status !== 0) { fs.rmSync(tempRoot, { recursive: true, force: true }); process.exit(result.status ?? 2); }
  if (action === "bootstrap") { const generated = JSON.parse(fs.readFileSync(tempConfig, "utf8")).series?.[programId]; if (!generated) throw new Error("Program bootstrap did not create its registry entry."); cfg.programs ??= {}; const entry = { ...generated, project_type: "research-program", projects: generated.papers ?? [], notes: "Shared research infrastructure for a Research Program." }; delete entry.papers; cfg.programs[programId] = entry; for (const key of entry.projects) { const project = cfg.projects?.[key]; if (!project) continue; project.project_type = "research-project"; project.program_id = programId; project.work_id ??= project.paper_id ?? key; project.work_type ??= "project"; } writeConfig(cfg); }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
try { if (action === "adopt-project") adopt(); else delegate(); } catch (error) { console.error(`ERROR: ${error.message}`); usage(); process.exitCode = 2; }