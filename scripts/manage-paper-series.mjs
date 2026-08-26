#!/usr/bin/env node
/** Explicit, local paper-series management. Never schedules background work. */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.dirname(SCRIPT_DIR);
const DEFAULT_CONFIG = path.join(os.homedir(), ".config", "academic-pm", "projects.json");
const TODAY = () => new Date().toISOString().slice(0, 10);
const INDEX_START = "<!-- vault-maintain:index:start -->";
const INDEX_END = "<!-- vault-maintain:index:end -->";
const SUMMARY_START = "<!-- academic-project-management:managed-summary:start -->";
const SUMMARY_END = "<!-- academic-project-management:managed-summary:end -->";

const USAGE = `Usage: node scripts/manage-paper-series.mjs --action <action> --series <id> [options]

Actions:
  bootstrap       Create/repair a series root without replacing user notes.
  repair          Recreate missing series indexes and rebuild the participant roster.
  manage-meeting  Normalize an explicitly selected meeting note and rebuild the roster.
  capture-idea    Create one series Inbox capture note.
  triage-idea     Update one explicit Inbox capture; preserves its raw text.
  audit-inbox     Report missing metadata, unresolved targets, and exact-title duplicates.
  migrate-synopsis Copy, validate, relink, and then remove a legacy Synopsis folder.

Common: --config <projects.json> --dry-run
Bootstrap: --series-folder <path> --vault-root <path> --shared-manuscript-home <path>
           --coding-rules <relative note> --data-registry <relative note> [--paper <project> ...]
Meeting:  --note <meetings/note.md> [--paper <project>] --participant <name> ...
           --applies-to <series|paper-id> ... [--meeting-type advisor|collaborator|other]
           [--summary <text>] [--decision <text> ...] [--task <text> ...]
Idea:     --title <text> [--content <text>] [--source <text>] [--applies-to <scope> ...]
Triage:   --idea <inbox/captures/note.md> --status <triaged|promoted|archived>
           [--target <relative note> ...] [--rationale <text>]
Migrate:  --source <absolute legacy folder> --paper <project> [--target-relative archive/legacy-synopsis]
`;

function die(message) { throw new Error(message); }
function parseArgs(argv) {
  const out = { action: null, series: null, config: null, dryRun: false, papers: [], participants: [], appliesTo: [], decisions: [], tasks: [], targets: [], targetRelative: "archive/legacy-synopsis", meetingType: "other", date: TODAY(), content: "", source: "user", status: null, rationale: "", summary: "", note: null, idea: null, title: null, seriesFolder: null, vaultRoot: null, sharedManuscriptHome: null, codingRules: "Coding Rules/Coding Rules.md", dataRegistry: "Data/Data.md", paper: null };
  const repeat = new Map([["--participant", "participants"], ["--applies-to", "appliesTo"], ["--decision", "decisions"], ["--task", "tasks"], ["--target", "targets"]]);
  const single = new Map([["--action", "action"], ["--series", "series"], ["--config", "config"], ["--note", "note"], ["--idea", "idea"], ["--title", "title"], ["--content", "content"], ["--source", "source"], ["--status", "status"], ["--rationale", "rationale"], ["--summary", "summary"], ["--meeting-type", "meetingType"], ["--date", "date"], ["--series-folder", "seriesFolder"], ["--vault-root", "vaultRoot"], ["--shared-manuscript-home", "sharedManuscriptHome"], ["--coding-rules", "codingRules"], ["--data-registry", "dataRegistry"], ["--target-relative", "targetRelative"]]);
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--dry-run") { out.dryRun = true; continue; }
    if (a === "--help" || a === "-h") { console.log(USAGE); process.exit(0); }
    if (a === "--paper") { const value = argv[++i]; if (!value) die(`Missing value for ${a}`); out.papers.push(value); out.paper = value; continue; }
    const key = repeat.get(a) ?? single.get(a);
    if (!key) die(`Unknown option: ${a}`);
    const value = argv[++i];
    if (!value) die(`Missing value for ${a}`);
    if (repeat.has(a)) out[key].push(value); else out[key] = value;
  }
  if (!out.action || !out.series) die("--action and --series are required.");
  if (!out.config) out.config = DEFAULT_CONFIG;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(out.date)) die(`Invalid --date: ${out.date}`);
  return out;
}
const cli = parseArgs(process.argv);
const configPath = path.resolve(cli.config);

function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8"); }
function loadConfig() { return fs.existsSync(configPath) ? readJson(configPath) : { projects: {}, series: {}, skill_dir: SKILL_DIR }; }
function writeMaybe(file, content, label) { if (cli.dryRun) return log("would write", label ?? file); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content, "utf8"); log("write", label ?? file); }
function log(action, target) { console.log(`  ${action}: ${target}`); }
function readTemplate(name, values = {}) { let text = fs.readFileSync(path.join(SKILL_DIR, "templates", name), "utf8"); for (const [k, v] of Object.entries(values)) text = text.split(k).join(v); return text.replaceAll("<YYYY-MM-DD>", cli.date).replaceAll("<owner>", "researcher"); }
function exists(file) { return fs.existsSync(file); }
function relativeInside(root, rel) { if (!rel || path.isAbsolute(rel) || rel.includes("\\") || rel.split("/").includes("..")) die(`Path must be a slash-separated relative path inside the configured root: ${rel}`); return path.join(root, ...rel.split("/")); }
function slug(value) { return String(value).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 56) || "idea"; }
function stripMd(value) { return value.replace(/\.md$/i, ""); }
function wiki(target, label = null) { return `[[${target}${label ? `|${label}` : ""}]]`; }

function seriesEntry(cfg) { const entry = cfg.series?.[cli.series]; if (!entry) die(`Series '${cli.series}' is not registered in ${configPath}. Run bootstrap first.`); return entry; }
function seriesRoot(entry) { return path.resolve(entry.pm_folder); }
function member(cfg, id) { const p = cfg.projects?.[id]; if (!p) die(`Paper project '${id}' is not registered.`); if (p.series_id !== cli.series) die(`Paper '${id}' does not belong to series '${cli.series}'.`); return p; }
function rootNotePath(root) { const candidates = fs.readdirSync(root).filter((n) => n.endsWith(".md") && !["README.md", "CURRENT_STATUS.md"].includes(n)); return candidates.length === 1 ? path.join(root, candidates[0]) : null; }
function frontmatter(title, pageType, extra = "") { return `---\ntitle: "${title}"\ncreated: ${cli.date}\nupdated: ${cli.date}\nlast_reviewed: ${cli.date}\npageType: ${pageType}\nstatus: active\nowner: researcher\n${extra}---\n`; }
function ensureFile(file, content) { if (exists(file)) return; writeMaybe(file, content); }
function indexText(subfolders = [], notes = []) { const dirs = subfolders.length ? subfolders.map(([t, l, d]) => `- ${wiki(t, l)}${d ? ` - ${d}` : ""}`).join("\n") : "*(no items)*"; const nts = notes.length ? notes.map(([t, l, d]) => `- ${wiki(t, l)}${d ? ` - ${d}` : ""}`).join("\n") : "*(no items)*"; return `${INDEX_START}\n## Subfolders\n\n${dirs}\n\n## Notes\n\n${nts}\n${INDEX_END}`; }
function appendIndex(indexPath, target, label, desc = "") { if (!exists(indexPath)) return; const text = fs.readFileSync(indexPath, "utf8"); if (text.includes(`[[${target}|`) || text.includes(`[[${target}]]`) || (text.includes(target) && text.includes(`|${label}]]`))) return; const line = `- ${wiki(target, label)}${desc ? ` - ${desc}` : ""}`; const marker = `${INDEX_END}`; if (!text.includes(marker)) return; writeMaybe(indexPath, text.replace(marker, `${line}\n${marker}`), indexPath); }

function bootstrap() {
  const cfg = loadConfig();
  if (!cli.seriesFolder || !cli.vaultRoot || !cli.sharedManuscriptHome) die("bootstrap requires --series-folder, --vault-root, and --shared-manuscript-home.");
  const root = path.resolve(cli.seriesFolder);
  const entry = { project_type: "paper-series", pm_folder: root, vault_root: path.resolve(cli.vaultRoot), shared_manuscript_home: path.resolve(cli.sharedManuscriptHome), shared_resources: { coding_rules: cli.codingRules, data_registry: cli.dataRegistry }, papers: [...new Set(cli.papers)], phase: "analysis-writing", access: "authoritative", notes: "Shared research infrastructure for a paper series." };
  cfg.series ??= {}; cfg.projects ??= {}; cfg.skill_dir = SKILL_DIR;
  if (cfg.series[cli.series]) { entry.papers = [...new Set([...(cfg.series[cli.series].papers ?? []), ...entry.papers])]; cfg.series[cli.series] = { ...cfg.series[cli.series], ...entry }; } else cfg.series[cli.series] = entry;
  if (!cli.dryRun) writeJson(configPath, cfg); else log("would write", configPath);
  if (!cli.dryRun) fs.mkdirSync(root, { recursive: true });
  ensureFile(path.join(root, "README.md"), readTemplate("series-README.md", { "<Series>": cli.series }));
  ensureFile(path.join(root, "CURRENT_STATUS.md"), readTemplate("series-CURRENT_STATUS.md", { "<Series>": cli.series }));
  const notePath = rootNotePath(root) ?? path.join(root, `${cli.series}.md`);
ensureFile(notePath, readTemplate("series-root-note.md", { "<Series>": cli.series, "<SERIES_INDEX>": indexText([["Coding Rules/Coding Rules", "Coding Rules", "shared coding decisions"], ["Data/Data", "Data", "shared provenance and revisions"], ["meetings/meetings", "meetings", "series meetings and participants"], ["inbox/inbox", "Inbox", "untriaged research ideas"]], []) }));
  appendIndex(notePath, "Coding Rules/Coding Rules", "Coding Rules", "shared coding decisions");
  appendIndex(notePath, "Data/Data", "Data", "shared provenance and revisions");
  appendIndex(notePath, "meetings/meetings", "meetings", "series meetings and participants");
  appendIndex(notePath, "inbox/inbox", "Inbox", "untriaged research ideas");
  if (!cli.dryRun) { fs.mkdirSync(path.join(root, "meetings"), { recursive: true }); fs.mkdirSync(path.join(root, "inbox", "captures"), { recursive: true }); }
  ensureFile(path.join(root, "meetings", "meetings.md"), readTemplate("series-meetings.md", { "<Series>": cli.series }));
  ensureFile(path.join(root, "meetings", "participants.md"), readTemplate("participants.md", { "<Series>": cli.series }));
ensureFile(path.join(root, "inbox", "inbox.md"), readTemplate("inbox.md", { "<Series>": cli.series }));
  ensureFile(path.join(root, "inbox", "captures", "captures.md"), readTemplate("captures.md", { "<Series>": cli.series }));
  for (const id of entry.papers) { if (!cfg.projects[id]) { console.warn(`  warning: paper '${id}' is listed but not yet registered.`); continue; } const p = cfg.projects[id]; if (p.series_id !== cli.series) { p.series_id = cli.series; p.paper_id ??= id; if (!cli.dryRun) writeJson(configPath, cfg); } }
  console.log(`# Series bootstrap ${cli.dryRun ? "dry-run" : "complete"}: ${cli.series}`);
}

function parseFrontmatter(text) { const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/); if (!m) return { block: null, body: text, fields: {} }; const fields = {}; const lines = m[1].split(/\r?\n/); for (let i = 0; i < lines.length; i += 1) { const x = lines[i].match(/^([\w-]+):\s*(.*)$/); if (!x) continue; const key = x[1]; if (key === "participants" || key === "applies_to" || key === "promotion_targets") { const vals = []; if (x[2].trim().startsWith("[")) vals.push(...x[2].replace(/^\[|\]$/g, "").split(",").map((v) => v.trim().replace(/^"|"$/g, "")).filter(Boolean)); while (i + 1 < lines.length && /^\s+-\s+/.test(lines[i + 1])) vals.push(lines[++i].replace(/^\s+-\s+/, "").trim().replace(/^"|"$/g, "")); fields[key] = vals; } else fields[key] = x[2].trim().replace(/^"|"$/g, ""); }
  return { block: m[1], body: text.slice(m[0].length), fields };
}
function setYaml(block, key, value) { const lines = (block ?? "").split(/\r?\n/); const out = []; let skipped = false; for (let i = 0; i < lines.length; i += 1) { if (new RegExp(`^${key}:`).test(lines[i])) { skipped = true; while (i + 1 < lines.length && /^\s+-\s+/.test(lines[i + 1])) i += 1; continue; } out.push(lines[i]); } const rendered = Array.isArray(value) ? [`${key}:`, ...value.map((v) => `  - "${String(v).replaceAll('"', '\\"')}"`)] : [`${key}: "${String(value).replaceAll('"', '\\"')}"`]; out.push(...rendered); return out.filter((l) => l !== "").join("\n"); }
function upsertManagedSummary(body, heading, items) { const payload = `${SUMMARY_START}\n## Agent-managed summary\n\n${heading ? `${heading}\n\n` : ""}${items.length ? items.join("\n") : "- Metadata normalized; no decisions or action items were supplied."}\n${SUMMARY_END}\n`; const re = new RegExp(`${SUMMARY_START}[\\s\\S]*?${SUMMARY_END}\\n?`); return re.test(body) ? body.replace(re, payload) : `${body.trimEnd()}\n\n${payload}`; }
function writeNoteWithFrontmatter(file, fields, body) { let block = parseFrontmatter(fs.readFileSync(file, "utf8")).block; for (const [k, v] of Object.entries(fields)) block = setYaml(block, k, v); writeMaybe(file, `---\n${block}\n---\n${body}`); }
function meetingScope(cfg, entry) { if (!cli.paper) return { root: seriesRoot(entry), index: path.join(seriesRoot(entry), "meetings", "meetings.md"), prefix: "meetings" }; const p = member(cfg, cli.paper); return { root: path.resolve(p.pm_folder), index: path.join(path.resolve(p.pm_folder), "meetings", "meetings.md"), prefix: "meetings" }; }
function listMd(dir) { if (!exists(dir)) return []; const found = []; for (const name of fs.readdirSync(dir, { withFileTypes: true })) { if (name.isDirectory()) found.push(...listMd(path.join(dir, name))); else if (name.isFile() && name.name.endsWith(".md")) found.push(path.join(dir, name.name)); } return found; }
function rebuildRoster(cfg, entry) { const root = seriesRoot(entry); const notes = [path.join(root, "meetings"), ...(entry.papers ?? []).filter((id) => cfg.projects?.[id]).map((id) => path.join(cfg.projects[id].pm_folder, "meetings"))].flatMap(listMd).filter((p) => path.basename(p) !== "meetings.md" && path.basename(p) !== "participants.md"); const people = new Map(); for (const file of notes) { const { fields } = parseFrontmatter(fs.readFileSync(file, "utf8")); const participants = Array.isArray(fields.participants) ? fields.participants : []; for (const name of participants) { const key = name.trim().toLocaleLowerCase(); if (!key) continue; const rel = path.relative(path.resolve(entry.vault_root), file).replaceAll(path.sep, "/"); const item = people.get(key) ?? { name: name.trim(), links: [] }; item.links.push(wiki(stripMd(rel), path.basename(file, ".md"))); people.set(key, item); } }
  const rows = [...people.values()].sort((a, b) => a.name.localeCompare(b.name)).map((p) => `| ${p.name} | — | ${[...new Set(p.links)].join("<br>")} |`);
  const text = `${frontmatter("participants", "index")}# Participants\n\nGenerated from managed meeting-note frontmatter. Edit meeting notes, then run explicit meeting management or repair to rebuild this view.\n\n| Participant | Role / aliases | Meetings |\n|---|---|---|\n${rows.length ? rows.join("\n") : "| *(none yet)* | — | — |"}\n`;
  writeMaybe(path.join(root, "meetings", "participants.md"), text);
}
function manageMeeting() { const cfg = loadConfig(); const entry = seriesEntry(cfg); if (!cli.note || cli.participants.length === 0) die("manage-meeting requires --note and at least one --participant."); const scope = meetingScope(cfg, entry); const file = relativeInside(scope.root, cli.note); if (!exists(file)) die(`Meeting note does not exist: ${file}`); if (!cli.note.startsWith("meetings/")) die("Meeting note must be under meetings/."); const parsed = parseFrontmatter(fs.readFileSync(file, "utf8")); const applies = cli.appliesTo.length ? cli.appliesTo : [cli.paper ? cfg.projects[cli.paper].paper_id ?? cli.paper : "series"]; const items = [ ...cli.decisions.map((x) => `- Decision: ${x}`), ...cli.tasks.map((x) => `- [ ] ${x}`) ]; const body = upsertManagedSummary(parsed.body, cli.summary ? `> ${cli.summary}` : "", items); writeNoteWithFrontmatter(file, { date: cli.date, participants: [...new Set(cli.participants)], applies_to: [...new Set(applies)], meeting_type: cli.meetingType, managed_at: cli.date }, body); appendIndex(scope.index, `${scope.prefix}/${stripMd(cli.note.slice("meetings/".length))}`, path.basename(file, ".md"), cli.summary || `managed ${cli.meetingType} meeting`); rebuildRoster(cfg, entry); console.log(`# Meeting managed${cli.dryRun ? " (dry-run)" : ""}: ${cli.note}`); }

function captureIdea() { const cfg = loadConfig(); const entry = seriesEntry(cfg); if (!cli.title) die("capture-idea requires --title."); const root = seriesRoot(entry); let base = `${cli.date}-${slug(cli.title)}`; let name = `${base}.md`; let n = 2; while (exists(path.join(root, "inbox", "captures", name))) name = `${base}-${n++}.md`; const rel = `inbox/captures/${name}`; const body = readTemplate("idea.md", { "<Idea title>": cli.title, "<raw idea>": cli.content || "" }); const front = `${frontmatter(cli.title, "note", `captured: ${cli.date}\nstatus: untriaged\nsource: "${cli.source}"\napplies_to:\n${(cli.appliesTo.length ? cli.appliesTo : ["series"]).map((x) => `  - "${x}"`).join("\n")}\n`)}${body}`; writeMaybe(path.join(root, ...rel.split("/")), front); appendIndex(path.join(root, "inbox", "inbox.md"), stripMd(rel), cli.title, "untriaged capture"); console.log(`# Idea captured${cli.dryRun ? " (dry-run)" : ""}: ${rel}`); }
function targetExists(cfg, entry, target) {
  const roots = [seriesRoot(entry), ...(entry.papers ?? []).filter((id) => cfg.projects?.[id]).map((id) => path.resolve(cfg.projects[id].pm_folder))];
  return roots.some((root) => {
    try { return exists(relativeInside(root, target)); } catch { return false; }
  });
}
function triageIdea() { const cfg = loadConfig(); const entry = seriesEntry(cfg); if (!cli.idea || !cli.status || !["triaged", "promoted", "archived"].includes(cli.status)) die("triage-idea requires --idea and --status triaged|promoted|archived."); const root = seriesRoot(entry); const file = relativeInside(root, cli.idea); if (!exists(file) || !cli.idea.startsWith("inbox/captures/")) die("--idea must be an existing Inbox capture."); for (const target of cli.targets) if (!targetExists(cfg, entry, target)) die(`Promotion target does not exist in series or member PM roots: ${target}`); const parsed = parseFrontmatter(fs.readFileSync(file, "utf8")); const body = upsertManagedSummary(parsed.body, cli.rationale ? `> ${cli.rationale}` : "", cli.targets.map((t) => `- Promotion target: ${wiki(t, stripMd(path.basename(t)))}`)); writeNoteWithFrontmatter(file, { status: cli.status, triaged_at: cli.date, promotion_targets: cli.targets }, body); console.log(`# Idea triaged${cli.dryRun ? " (dry-run)" : ""}: ${cli.idea}`); }
function auditInbox() { const cfg = loadConfig(); const entry = seriesEntry(cfg); const root = seriesRoot(entry); const files = listMd(path.join(root, "inbox", "captures")).filter((file) => path.basename(file) !== "captures.md"); const titles = new Map(); const findings = []; for (const file of files) { const rel = path.relative(root, file).replaceAll(path.sep, "/"); const { fields } = parseFrontmatter(fs.readFileSync(file, "utf8")); for (const key of ["captured", "status", "source", "applies_to"]) if (!fields[key] || (Array.isArray(fields[key]) && fields[key].length === 0)) findings.push({ type: "missing-metadata", file: rel, field: key }); for (const target of fields.promotion_targets ?? []) if (!targetExists(cfg, entry, target)) findings.push({ type: "unresolved-promotion-target", file: rel, target }); const key = String(fields.title ?? path.basename(file, ".md")).trim().toLocaleLowerCase(); const arr = titles.get(key) ?? []; arr.push(rel); titles.set(key, arr); }
  for (const [title, paths] of titles) if (paths.length > 1) findings.push({ type: "duplicate-normalized-title", title, files: paths }); console.log(JSON.stringify({ series: cli.series, captures: files.length, findings }, null, 2)); if (findings.length) process.exitCode = 1; }
function digestFile(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function walkFiles(root) { if (!exists(root)) return []; const all = []; for (const entry of fs.readdirSync(root, { withFileTypes: true })) { const abs = path.join(root, entry.name); if (entry.isDirectory()) all.push(...walkFiles(abs)); else if (entry.isFile()) all.push(abs); } return all; }
function migrateSynopsis() { const cfg = loadConfig(); const entry = seriesEntry(cfg); if (!cli.source || !cli.paper) die("migrate-synopsis requires --source and --paper."); const p = member(cfg, cli.paper); const source = path.resolve(cli.source); const destination = path.join(path.resolve(p.pm_folder), ...cli.targetRelative.split("/")); if (!exists(source)) die(`Source folder not found: ${source}`); if (exists(destination)) die(`Migration destination already exists: ${destination}`); const sourceFiles = walkFiles(source); const manifest = { version: 1, series: cli.series, paper: cli.paper, source, destination, created: cli.date, files: sourceFiles.map((f) => ({ old_path: f, new_path: path.join(destination, path.relative(source, f)), sha256: digestFile(f) })) };
  if (cli.dryRun) { console.log(JSON.stringify({ action: "migrate-synopsis", ...manifest, dry_run: true }, null, 2)); return; }
  fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.cpSync(source, destination, { recursive: true, errorOnExist: true });
  for (const item of manifest.files) { if (!exists(item.new_path) || digestFile(item.new_path) !== item.sha256) die(`Copy validation failed: ${item.old_path}`); }
  const oldVaultRel = path.relative(path.resolve(entry.vault_root), source).replaceAll(path.sep, "/"); const newVaultRel = path.relative(path.resolve(entry.vault_root), destination).replaceAll(path.sep, "/");
  const changed = []; for (const md of walkFiles(path.resolve(entry.vault_root)).filter((f) => f.endsWith(".md"))) { const text = fs.readFileSync(md, "utf8"); const next = text.split(oldVaultRel).join(newVaultRel); if (next !== text) { fs.writeFileSync(md, next, "utf8"); changed.push(md); } }
  const completedManifest = { ...manifest, rewritten_markdown_files: changed, files: manifest.files.map((item) => ({ ...item, post_migration_sha256: digestFile(item.new_path) })) }; fs.writeFileSync(path.join(destination, "migration-manifest.json"), `${JSON.stringify(completedManifest, null, 2)}\n`, "utf8");
  const leftover = walkFiles(path.resolve(entry.vault_root)).filter((f) => f.endsWith(".md")).filter((f) => fs.readFileSync(f, "utf8").includes(oldVaultRel)); if (leftover.length) die(`Obsolete Synopsis references remain; source retained: ${leftover.join(", ")}`);
const legacyLanding = path.join(destination, "legacy-synopsis.md");
  if (!exists(legacyLanding)) {
    const notes = walkFiles(destination).filter((f) => f.endsWith(".md")).map((f) => path.relative(destination, f).replaceAll(path.sep, "/")).filter((rel) => rel !== "legacy-synopsis.md" && !rel.endsWith("/archive.md"));
    writeMaybe(legacyLanding, `${frontmatter("legacy-synopsis", "archive")}# Legacy Synopsis archive\n\nHistorical Paper I material migrated from the former Synopsis folder. The source tree and attachments are preserved below.\n\n${indexText([], notes.slice(0, 80).map((rel) => [stripMd(rel), path.basename(rel, ".md"), "historical note"]))}\n`);
  }
  const previewDir = path.join(seriesRoot(entry), "inbox", "migration-previews");
  const preview = path.join(previewDir, `${cli.date}-legacy-synopsis-extraction-preview.md`);
  const candidates = walkFiles(destination).filter((f) => f.endsWith(".md")).map((f) => path.relative(destination, f).replaceAll(path.sep, "/")).filter((rel) => !["legacy-synopsis.md"].includes(rel) && !rel.endsWith("/archive.md"));
  writeMaybe(preview, `${frontmatter("Legacy Synopsis extraction preview", "review")}# Legacy Synopsis extraction preview\n\nThis is a review queue only. It does not promote or create Inbox captures. Review each source-linked candidate and explicitly request capture or triage if it should become current work.\n\n## Candidate legacy notes\n\n${candidates.length ? candidates.map((rel) => `- [[${newVaultRel}/${stripMd(rel)}|${path.basename(rel, ".md")}]]`).join("\n") : "*(none)*"}\n`);
  fs.rmSync(source, { recursive: true, force: false });
  appendIndex(path.join(path.resolve(p.pm_folder), "archive", "archive.md"), "archive/legacy-synopsis/legacy-synopsis", "legacy-synopsis", "migrated historical Paper I Synopsis");
  console.log(`# Synopsis migration complete: ${destination}`);
}
function repair() { const cfg = loadConfig(); const entry = seriesEntry(cfg); const root = seriesRoot(entry); if (!exists(root)) die(`Series root missing: ${root}`); ensureFile(path.join(root, "meetings", "meetings.md"), readTemplate("series-meetings.md", { "<Series>": cli.series })); ensureFile(path.join(root, "meetings", "participants.md"), readTemplate("participants.md", { "<Series>": cli.series })); ensureFile(path.join(root, "inbox", "inbox.md"), readTemplate("inbox.md", { "<Series>": cli.series })); ensureFile(path.join(root, "inbox", "captures", "captures.md"), readTemplate("captures.md", { "<Series>": cli.series })); rebuildRoster(cfg, entry); console.log(`# Series repair ${cli.dryRun ? "dry-run" : "complete"}: ${cli.series}`); }
try { ({ bootstrap, repair, "manage-meeting": manageMeeting, "capture-idea": captureIdea, "triage-idea": triageIdea, "audit-inbox": auditInbox, "migrate-synopsis": migrateSynopsis }[cli.action] ?? (() => die(`Unknown action: ${cli.action}`)))(); } catch (error) { console.error(`ERROR: ${error.message}`); console.error(USAGE); process.exitCode = 2; }