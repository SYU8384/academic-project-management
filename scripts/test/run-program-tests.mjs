#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const skill = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const program = path.join(skill, "scripts", "manage-research-program.mjs");
const bootstrap = path.join(skill, "scripts", "bootstrap-academic-pm.mjs");
const check = path.join(skill, "scripts", "check-academic-pm.mjs");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "academic-pm-program-"));
const vault = path.join(tmp, "Vault"); const root = path.join(vault, "Dissertation Program"); const repo = path.join(tmp, "Repo"); const config = path.join(tmp, "projects.json");
const run = (script, args) => { const r = spawnSync(process.execPath, [script, ...args], { encoding: "utf8" }); assert.equal(r.status, 0, `${path.basename(script)} failed:\n${r.stdout}\n${r.stderr}`); return `${r.stdout}${r.stderr}`; };
for (const key of ["Chapter1", "Chapter2", "AppendixStudy"]) { const pm = path.join(vault, key); run(bootstrap, ["--project", key, "--pm-folder", pm, "--phase", "analysis", "--project-type", "research-project", "--config", config, "--no-agents-md"]); }
fs.mkdirSync(repo, { recursive: true }); fs.writeFileSync(path.join(vault, "AppendixStudy", "analysis", "preserve.md"), "# Preserve\n");
run(program, ["--action", "bootstrap", "--program", "dissertation-program", "--program-folder", root, "--vault-root", vault, "--shared-manuscript-home", repo, "--project", "Chapter1", "--project", "Chapter2", "--config", config]);
fs.mkdirSync(path.join(root, "Coding Rules"), { recursive: true }); fs.mkdirSync(path.join(root, "Data"), { recursive: true }); fs.writeFileSync(path.join(root, "Coding Rules", "Coding Rules.md"), "# Rules\n"); fs.writeFileSync(path.join(root, "Data", "Data.md"), "# Data\n");
let cfg = JSON.parse(fs.readFileSync(config, "utf8")); assert.ok(cfg.programs["dissertation-program"], "canonical programs entry missing"); assert.deepEqual(cfg.programs["dissertation-program"].projects, ["Chapter1", "Chapter2"]); assert.equal(cfg.projects.Chapter1.work_type, "project");
run(program, ["--action", "adopt-project", "--program", "dissertation-program", "--project", "AppendixStudy", "--work-id", "appendix-study", "--work-type", "study", "--mode", "bridge", "--config", config]);
cfg = JSON.parse(fs.readFileSync(config, "utf8")); assert.equal(cfg.projects.AppendixStudy.pm_folder, path.join(vault, "AppendixStudy"), "bridge moved PM folder"); assert.ok(fs.existsSync(path.join(vault, "AppendixStudy", "analysis", "preserve.md")), "bridge altered project files"); assert.equal(cfg.projects.AppendixStudy.work_type, "study");
run(check, ["--program", "dissertation-program", "--config", config]);
console.log("Research Program fixtures: PASS");