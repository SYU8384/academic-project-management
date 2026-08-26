#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const workspace = path.dirname(fileURLToPath(import.meta.url));
const skill = "C:/Users/zhuqi/.agents/skills/academic-project-management";
const seriesScript = path.join(skill, "scripts/manage-paper-series.mjs");
const bootstrap = path.join(skill, "scripts/bootstrap-academic-pm.mjs");
const check = path.join(skill, "scripts/check-academic-pm.mjs");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "academic-pm-series-"));
const vault = path.join(tmp, "Vault");
const root = path.join(vault, "Research Projects", "Series Alpha");
const repo = path.join(tmp, "Repo");
const config = path.join(tmp, "projects.json");

function run(script, args, expected = 0) {
  const result = spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
  assert.equal(result.status, expected, `${path.basename(script)} failed:\n${result.stdout}\n${result.stderr}`);
  return `${result.stdout}${result.stderr}`;
}
function text(file) { return fs.readFileSync(file, "utf8"); }
function hash(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function exists(rel) { return fs.existsSync(path.join(root, ...rel.split("/"))); }

fs.mkdirSync(path.join(repo, "Paper1"), { recursive: true });
fs.mkdirSync(path.join(repo, "Paper2"), { recursive: true });
for (const id of ["Paper I", "Paper II"]) {
  run(bootstrap, ["--project", id, "--pm-folder", path.join(root, id), "--phase", "analysis", "--notes", id, "--config", config, "--no-agents-md"]);
}
const cfg0 = JSON.parse(text(config));
cfg0.projects["Paper I"].artifact_subpath = "Paper1";
cfg0.projects["Paper II"].artifact_subpath = "Paper2";
fs.writeFileSync(config, `${JSON.stringify(cfg0, null, 2)}\n`);

run(seriesScript, ["--action", "bootstrap", "--series", "series-alpha", "--series-folder", root, "--vault-root", vault, "--shared-manuscript-home", repo, "--coding-rules", "Coding Rules/Coding Rules.md", "--data-registry", "Data/Data.md", "--paper", "Paper I", "--paper", "Paper II", "--config", config]);
fs.mkdirSync(path.join(root, "Coding Rules"), { recursive: true });
fs.mkdirSync(path.join(root, "Data"), { recursive: true });
fs.writeFileSync(path.join(root, "Coding Rules/Coding Rules.md"), "# Rules\n");
fs.writeFileSync(path.join(root, "Data/Data.md"), "# Data\n");
for (const rel of ["README.md", "CURRENT_STATUS.md", "meetings/meetings.md", "meetings/participants.md", "inbox/inbox.md", "inbox/captures/captures.md"]) assert.ok(exists(rel), `missing ${rel}`);

const rawMeeting = "# Raw meeting\n\nProf. Tang asked us to compare both papers.\n";
fs.writeFileSync(path.join(root, "meetings/2026-08-26.md"), rawMeeting);
run(seriesScript, ["--action", "manage-meeting", "--series", "series-alpha", "--note", "meetings/2026-08-26.md", "--participant", "Prof. Tang", "--participant", "Researcher", "--applies-to", "paper-i", "--applies-to", "paper-ii", "--meeting-type", "advisor", "--summary", "Cross-paper coding decisions.", "--config", config]);
const managed = text(path.join(root, "meetings/2026-08-26.md"));
assert.ok(managed.includes("Prof. Tang asked us"), "meeting prose changed or disappeared");
assert.ok(managed.includes("managed_at:"), "meeting metadata missing");
assert.ok(text(path.join(root, "meetings/participants.md")).includes("Prof. Tang"), "roster missing participant");
const once = managed;
run(seriesScript, ["--action", "manage-meeting", "--series", "series-alpha", "--note", "meetings/2026-08-26.md", "--participant", "Prof. Tang", "--participant", "Researcher", "--applies-to", "paper-i", "--applies-to", "paper-ii", "--meeting-type", "advisor", "--summary", "Cross-paper coding decisions.", "--config", config]);
assert.equal((text(path.join(root, "meetings/2026-08-26.md")).match(/Agent-managed summary/g) ?? []).length, 1, "meeting management is not idempotent");
assert.ok(once.includes("Raw meeting"), "raw meeting check invalid");

run(seriesScript, ["--action", "capture-idea", "--series", "series-alpha", "--title", "Compare appointment pathways", "--content", "Keep this raw idea.", "--source", "meeting", "--applies-to", "paper-i", "--config", config]);
const idea = "inbox/captures/2026-08-26-compare-appointment-pathways.md";
run(seriesScript, ["--action", "triage-idea", "--series", "series-alpha", "--idea", idea, "--status", "promoted", "--target", "Paper I/planning/planning.md", "--rationale", "Fits Paper I design work.", "--config", config]);
const ideaText = text(path.join(root, ...idea.split("/")));
assert.ok(ideaText.includes("Keep this raw idea."), "idea prose disappeared");
assert.ok(ideaText.includes('status: "promoted"'), "idea promotion missing");
run(seriesScript, ["--action", "audit-inbox", "--series", "series-alpha", "--config", config]);

const synopsis = path.join(root, "Synopsis");
fs.mkdirSync(path.join(synopsis, "attachments"), { recursive: true });
fs.writeFileSync(path.join(synopsis, "Synopsis.md"), "# Legacy\n");
fs.writeFileSync(path.join(synopsis, "idea.md"), "# Old idea\n");
fs.writeFileSync(path.join(synopsis, "attachments/source.bin"), Buffer.from([1, 2, 3, 4]));
const oldRef = "Research Projects/Series Alpha/Synopsis/idea";
fs.writeFileSync(path.join(root, "Paper I", "analysis", "legacy-link.md"), `[[${oldRef}|old]]\n`);
run(seriesScript, ["--action", "migrate-synopsis", "--series", "series-alpha", "--source", synopsis, "--paper", "Paper I", "--config", config, "--dry-run"]);
run(seriesScript, ["--action", "migrate-synopsis", "--series", "series-alpha", "--source", synopsis, "--paper", "Paper I", "--config", config]);
const migrated = path.join(root, "Paper I", "archive", "legacy-synopsis");
assert.ok(!fs.existsSync(synopsis), "legacy source was not removed after validation");
assert.equal(hash(path.join(migrated, "attachments/source.bin")), crypto.createHash("sha256").update(Buffer.from([1, 2, 3, 4])).digest("hex"), "attachment hash changed");
assert.ok(text(path.join(root, "Paper I", "analysis", "legacy-link.md")).includes("archive/legacy-synopsis/idea"), "vault link was not rewritten");
assert.ok(fs.existsSync(path.join(root, "inbox", "migration-previews", "2026-08-26-legacy-synopsis-extraction-preview.md")), "migration preview missing");
assert.ok(fs.existsSync(path.join(migrated, "migration-manifest.json")), "migration manifest missing");
run(check, ["--series", "series-alpha", "--config", config]);

console.log("Series fixtures: PASS");
