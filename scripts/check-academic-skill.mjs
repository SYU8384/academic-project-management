#!/usr/bin/env node
/**
 * Skill-level quality gate for the academic-project-management skill repo.
 *
 * This checks the reusable skill repository itself, not a user's PM folder.
 * It catches unresolved template placeholders in shipped docs/templates,
 * references to nonexistent scripts/templates/docs, stale version mentions,
 * and structural drift between templates/ and bootstrap-academic-pm.mjs.
 *
 * Usage:
 *   node scripts/check-academic-skill.mjs [--help]
 *
 * Exit codes: 0 = pass, 1 = fail.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MODULE_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIR = dirname(MODULE_PATH);
const SKILL_DIR = dirname(SCRIPT_DIR);

// ---- mini findings helpers (mirrors project-management's lib/findings.mjs) ----

function finding({ code, severity = "error", path = "", message, remedy = "" }) {
  return { code, severity, path, message, remedy };
}

function renderFindings(title, findings, { okMessage = "No issues found." } = {}) {
  const lines = [`# ${title}`, ""];
  lines.push(`**Status:** ${findings.length === 0 ? "PASS" : "FAIL"}`);
  lines.push("");
  if (findings.length === 0) {
    lines.push(okMessage);
    return lines.join("\n");
  }
  for (const item of findings) {
    const path = item.path ? ` \`${item.path}\`` : "";
    lines.push(`- [${item.severity}] ${item.code}${path}: ${item.message}`);
    if (item.remedy) lines.push(`  Remedy: ${item.remedy}`);
  }
  return lines.join("\n");
}

function unresolvedPlaceholders(content) {
  return [...content.matchAll(/<([A-Za-z][A-Za-z0-9_ -]*)>/g)]
    .map((match) => match[0])
    .filter((value, index, all) => all.indexOf(value) === index)
    .sort();
}

// ---- configuration ----

const PUBLIC_DOCS = [
  "README.md",
  "SKILL.md",
  "REFERENCE.md",
  "EXAMPLES.md",
  "openclaw-instruction.md",
];

const TEMPLATE_FILES = [
  "templates/AGENTS_ACADEMIC_PM_SECTION.md",
  "templates/CURRENT_STATUS.md",
  "templates/README.md",
  "templates/RESEARCH.md",
  "templates/analysis.md",
  "templates/archive.md",
  "templates/evidence.md",
  "templates/folder-note.md",
  "templates/history.md",
  "templates/literature.md",
  "templates/meetings.md",
  "templates/planning.md",
  "templates/projects.template.json",
  "templates/root-note.md",
  "templates/verification.md",
  "templates/writing.md",
];

// Placeholders that are intentional template syntax in this repo: substituted
// by bootstrap-academic-pm.mjs, used in CLI usage examples, or used in prose
// to show users what to fill in.
const ALLOWED_PLACEHOLDERS = new Set([
  // bootstrap-substituted (templates/)
  "<Project>",
  "<NOTES>",
  "<PHASE>",
  "<SKILL_VALIDATOR>",
  "<PROJECT_PM_FOLDER>",
  "<SUBFOLDERS_INDEX>",
  "<history-INITIAL>",
  "<YYYY-MM-DD>",
  "<owner>",
  // renderAgentsSection-substituted (AGENTS_ACADEMIC_PM_SECTION.md)
  "<pm_folder>",
  "<skill_dir>",
  "<manuscript_home>",
  "<manuscript_kind>",
  "<manuscript_access>",
  // folder-note.md factory placeholders
  "<folder>",
  "<LiIconName>",
  "<hex>",
  // projects.template.json
  "<ProjectName>",
  "<ProgramId>",
  "<id>",
  "<registry-key>",
  "<stable-id>",
  // CLI usage / prose examples in docs
  "<academic-pm-folder>",
  "<pm-folder>",
  "<ISO datetime>",
  "<reason>",
  "<action>",
  "<agent>",
  "<date>",
  "<decision1>",
  "<decision2>",
  "<feedback1>",
  "<feedback2>",
  "<item to report back on>",
  "<item1>",
  "<item2>",
  "<lane>",
  "<name>",
  "<name1>",
  "<name2>",
  "<one-line summary>",
  "<path>",
  "<phase>",
  "<project-slug>",
  "<question to raise>",
  "<relative-path>",
  "<REPO>",
  "<slug>",
  "<skills-dir>",
  "<title>",
  "<topic>",
  "<vault>",
]);

// Phrases retired by the academic port (carry-overs from the project-management
// skill that must not leak into academic docs).
const STALE_PUBLIC_PATTERNS = [
  {
    code: "stale.pm-config-path",
    pattern: /~\/\.config\/project-management\//,
    files: PUBLIC_DOCS,
    remedy: "The academic registry lives at ~/.config/academic-pm/projects.json.",
  },
  {
    code: "stale.unported-script-name",
    pattern: /\b(?:bootstrap-pm|check-pm|sync-openclaw-pm-section|sync-pm-section)\.mjs\b/,
    files: PUBLIC_DOCS,
    remedy: "Use the academic script names: bootstrap-academic-pm.mjs, check-academic-pm.mjs, sync-agents-section.mjs, sync-openclaw-apm-section.mjs.",
  },
  {
    code: "stale.roadmap-concept",
    pattern: /\broadmap\/(plans|known-issues|milestones)/,
    files: PUBLIC_DOCS,
    remedy: "Academic lanes are literature/evidence/analysis/writing/meetings/planning/history/archive (+ optional verification); there is no roadmap/.",
  },
];

function read(rel) {
  return readFileSync(join(SKILL_DIR, rel), "utf8");
}

function existingPublicDocs() {
  return PUBLIC_DOCS.filter((rel) => existsSync(join(SKILL_DIR, rel)));
}

function existingTemplates() {
  return TEMPLATE_FILES.filter((rel) => existsSync(join(SKILL_DIR, rel)));
}

// ---- checks ----

function checkStalePhrases(findings) {
  for (const rel of existingPublicDocs()) {
    const content = read(rel);
    for (const stale of STALE_PUBLIC_PATTERNS) {
      if (stale.files && !stale.files.includes(rel)) continue;
      if (stale.pattern.test(content)) {
        findings.push(finding({
          code: stale.code,
          path: rel,
          message: "public docs contain a retired phrase or a project-management carry-over",
          remedy: stale.remedy,
        }));
      }
    }
  }
}

function checkPlaceholders(findings) {
  for (const rel of [...existingPublicDocs(), ...existingTemplates(), "CHANGELOG.md"]) {
    if (!existsSync(join(SKILL_DIR, rel))) continue;
    for (const placeholder of unresolvedPlaceholders(read(rel))) {
      if (ALLOWED_PLACEHOLDERS.has(placeholder)) continue;
      findings.push(finding({
        code: "template.unresolved-placeholder",
        path: rel,
        message: `unexpected placeholder ${placeholder}`,
        remedy: "Either substitute it during bootstrap or add it to the explicit allowlist if it is intentional template syntax.",
      }));
    }
  }
}

function checkDocReferences(findings) {
  // References of the form scripts/<name>.mjs and templates/<name> in docs must
  // point at files that exist in this repo.
  const docs = [...existingPublicDocs(), "CHANGELOG.md"];
  for (const rel of docs) {
    if (!existsSync(join(SKILL_DIR, rel))) continue;
    const content = read(rel);
    for (const m of content.matchAll(/\b(scripts\/[A-Za-z0-9_-]+\.mjs)\b/g)) {
      if (!existsSync(join(SKILL_DIR, m[1]))) {
        findings.push(finding({
          code: "docs.missing-script-reference",
          path: rel,
          message: `references ${m[1]}, which does not exist`,
          remedy: "Fix the reference or add the script.",
        }));
      }
    }
    for (const m of content.matchAll(/\b(templates\/[A-Za-z0-9_.-]+)/g)) {
      if (!existsSync(join(SKILL_DIR, m[1]))) {
        findings.push(finding({
          code: "docs.missing-template-reference",
          path: rel,
          message: `references ${m[1]}, which does not exist`,
          remedy: "Fix the reference or add the template.",
        }));
      }
    }
  }
  // Relative markdown links like [REFERENCE.md](REFERENCE.md) at skill root.
  for (const rel of existingPublicDocs()) {
    const content = read(rel);
    for (const m of content.matchAll(/\]\((\.\/)?([A-Za-z0-9_-]+\.md)\)/g)) {
      if (!existsSync(join(SKILL_DIR, m[2]))) {
        findings.push(finding({
          code: "docs.missing-doc-link",
          path: rel,
          message: `links to ${m[2]}, which does not exist`,
          remedy: "Fix the link target.",
        }));
      }
    }
  }
}

function checkVersionMentions(findings) {
  const versionPath = join(SKILL_DIR, "VERSION");
  if (!existsSync(versionPath)) {
    findings.push(finding({
      code: "version.file-missing",
      path: "VERSION",
      message: "VERSION file is missing",
    }));
    return;
  }
  const version = read("VERSION").trim();
  // Public docs must not pin a different semver (URLs like keepachangelog.com
  // are excluded by requiring a word boundary and no surrounding URL chars).
  for (const rel of existingPublicDocs()) {
    const content = read(rel);
    for (const m of content.matchAll(/(?<![\w/.-])v?(\d+\.\d+\.\d+)(?![\w/.-])/g)) {
      if (m[1] !== version) {
        findings.push(finding({
          code: "version.stale-mention",
          path: rel,
          message: `mentions version ${m[1]} but VERSION is ${version}`,
          remedy: "Update the mention or remove the pin.",
        }));
      }
    }
  }
  // CHANGELOG's newest entry must match VERSION.
  const changelogPath = join(SKILL_DIR, "CHANGELOG.md");
  if (existsSync(changelogPath)) {
    const m = read("CHANGELOG.md").match(/^## \[(\d+\.\d+\.\d+)\]/m);
    if (m && m[1] !== version) {
      findings.push(finding({
        code: "version.changelog-head-mismatch",
        path: "CHANGELOG.md",
        message: `Newest changelog entry is ${m[1]} but VERSION is ${version}`,
        remedy: "Add a changelog entry for the current version or fix VERSION.",
      }));
    }
  }
}

function extractArrayLiteral(source, name) {
  const m = source.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`));
  if (!m) return null;
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

function checkTemplateDrift(findings) {
  const bootstrapRel = "scripts/bootstrap-academic-pm.mjs";
  const bootstrap = read(bootstrapRel);

  const requiredFolders = extractArrayLiteral(bootstrap, "REQUIRED_FOLDERS");
  const optionalFolders = extractArrayLiteral(bootstrap, "OPTIONAL_FOLDERS");
  if (!requiredFolders || requiredFolders.length === 0) {
    findings.push(finding({
      code: "drift.required-folders-unparsed",
      path: bootstrapRel,
      message: "could not parse REQUIRED_FOLDERS from the bootstrap script",
    }));
    return;
  }

  // Every required lane needs a template; templates for optional lanes are fine.
  const knownLanes = new Set([...requiredFolders, ...(optionalFolders ?? [])]);
  for (const lane of requiredFolders) {
    const rel = `templates/${lane}.md`;
    if (!existsSync(join(SKILL_DIR, rel))) {
      findings.push(finding({
        code: "drift.lane-template-missing",
        path: rel,
        message: `required lane ${lane} has no template`,
        remedy: `Add templates/${lane}.md; bootstrap writes ${lane}/${lane}.md from it.`,
      }));
    }
  }

  // Every template loaded via loadAndSubstitute("...") must exist, and every
  // template on disk must be either loaded by bootstrap, used by
  // lib/agents-section.mjs, or be a known documentation-only file.
  const loaded = new Set([...bootstrap.matchAll(/loadAndSubstitute\("([^"]+)"/g)].map((m) => m[1]));
  const agentsLib = existsSync(join(SKILL_DIR, "scripts/lib/agents-section.mjs"))
    ? read("scripts/lib/agents-section.mjs")
    : "";
  for (const m of agentsLib.matchAll(/"templates",\s*"([^"]+)"/g)) {
    loaded.add(m[1]);
  }
  // Reference-only files shipped in templates/ but intentionally not loaded by
  // any script: folder-note.md (older lane-note factory), projects.template.json
  // (projects.json schema reference), and meeting-record.md (meeting-note body
  // template). NOTE: meeting-record.md is not currently documented in SKILL.md.
  const DOCUMENTATION_ONLY = new Set(["folder-note.md", "projects.template.json", "meeting-record.md", "captures.md", "idea.md", "inbox.md", "participants.md", "series-CURRENT_STATUS.md", "series-meetings.md", "series-README.md", "series-root-note.md", ".gitignore"]);
  for (const name of loaded) {
    if (!existsSync(join(SKILL_DIR, "templates", name))) {
      findings.push(finding({
        code: "drift.loaded-template-missing",
        path: "templates/" + name,
        message: "loaded by bootstrap/agents-section but missing from templates/",
      }));
    }
  }
  for (const entry of readdirSync(join(SKILL_DIR, "templates"), { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    if (loaded.has(name) || DOCUMENTATION_ONLY.has(name)) continue;
    const laneName = name.replace(/\.md$/, "");
    if (knownLanes.has(laneName)) continue; // optional-lane template, used by repair fallback
    findings.push(finding({
      code: "drift.unused-template",
      path: `templates/${name}`,
      message: "template is not loaded by bootstrap, not an optional lane, and not documented as reference-only",
      remedy: "Load it, document it as reference-only in SKILL.md, or remove it.",
    }));
  }

  // Root files the bootstrap scaffolds.
  for (const name of ["root-note.md", "README.md", "RESEARCH.md", "CURRENT_STATUS.md"]) {
    if (!loaded.has(name) || !existsSync(join(SKILL_DIR, "templates", name))) {
      findings.push(finding({
        code: "drift.root-template-missing",
        path: `templates/${name}`,
        message: "bootstrap scaffolds this root file but the template is missing or not loaded",
      }));
    }
  }

  // sync-openclaw-apm-section.mjs parses the section-3 template out of
  // openclaw-instruction.md; make sure that contract still holds.
  const instructionRel = "openclaw-instruction.md";
  if (existsSync(join(SKILL_DIR, instructionRel))) {
    const content = read(instructionRel);
    const sectionMatch = content.match(/^## 3\. Configure Your OpenClaw Workspace `AGENTS\.md`\s*$/m);
    if (!sectionMatch) {
      findings.push(finding({
        code: "drift.openclaw-section3-heading",
        path: instructionRel,
        message: "sync-openclaw-apm-section.mjs expects a '## 3. Configure Your OpenClaw Workspace `AGENTS.md`' heading",
        remedy: "Restore the heading or update findTemplateBlock() in sync-openclaw-apm-section.mjs.",
      }));
    } else {
      const after = sectionMatch.index + sectionMatch[0].length;
      const next = content.slice(after).match(/\n## \d+\. /);
      const section = content.slice(after, next ? after + next.index : content.length);
      if (!/^```markdown\s*\n[\s\S]*?\n```\s*$/m.test(section)) {
        findings.push(finding({
          code: "drift.openclaw-section3-fence",
          path: instructionRel,
          message: "section 3 has no ```markdown fenced block for the sync template",
          remedy: "Add the fenced template block; sync-openclaw-apm-section.mjs extracts it at runtime.",
        }));
      }
    }
  }
}

function checkPortableAgentsTemplate(findings) {
  const rel = "templates/AGENTS_ACADEMIC_PM_SECTION.md";
  const abs = join(SKILL_DIR, rel);
  if (!existsSync(abs)) {
    findings.push(finding({
      code: "template.portable-agents-missing",
      path: rel,
      message: "manuscript-home AGENTS section template is missing",
    }));
    return;
  }
  const content = read(rel);
  // Placeholders like <pm_folder> are intentional here (rendered by
  // renderAgentsSection); machine-absolute paths are not.
  const forbidden = [
    ["/home/", "Unix home path"],
    ["/mnt/", "WSL mount path"],
    ["C:\\", "Windows absolute path"],
  ];
  for (const [needle, label] of forbidden) {
    if (content.includes(needle)) {
      findings.push(finding({
        code: "template.portable-agents-local-path",
        path: rel,
        message: `portable AGENTS template contains ${label}`,
        remedy: "Keep committed AGENTS instructions path-agnostic; resolve local identity from projects.json at runtime.",
      }));
    }
  }
}

export function runSkillChecks() {
  const findings = [];
  checkStalePhrases(findings);
  checkPlaceholders(findings);
  checkDocReferences(findings);
  checkVersionMentions(findings);
  checkTemplateDrift(findings);
  checkPortableAgentsTemplate(findings);
  return findings;
}

function printHelp() {
  console.log(`Usage: node scripts/check-academic-skill.mjs [--help]

Skill-level quality gate for the academic-project-management skill repo.
Checks shipped docs and templates (not a user's PM folder) for stale phrases,
unresolved placeholders, broken script/template references, stale version
mentions, and drift between templates/ and bootstrap-academic-pm.mjs.

Exit codes: 0 = pass, 1 = fail.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1].replace(/^file:\/\//, "")) {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }
  const findings = runSkillChecks();
  const scriptCount = readdirSync(join(SKILL_DIR, "scripts"), { recursive: true })
    .filter((e) => String(e).endsWith(".mjs")).length;
  console.log(renderFindings("Skill Quality Report", findings, {
    okMessage: `Checked ${existingPublicDocs().length} public docs, ${existingTemplates().length} templates, and ${scriptCount} scripts.`,
  }));
  process.exit(findings.length > 0 ? 1 : 0);
}
