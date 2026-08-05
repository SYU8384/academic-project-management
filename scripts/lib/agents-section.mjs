// Shared rendering + upsert logic for the managed
// `## Academic PM folder` section in <manuscript_home>/AGENTS.md.
//
// Used by:
//   - bootstrap-academic-pm.mjs (setup-time write, CLI-derived values)
//   - sync-agents-section.mjs   (re-render from projects.json)
//   - bootstrap --action repair (config-derived refresh)
//
// The managed block is delimited by HTML comment markers so re-renders
// replace only the managed span and preserve all other AGENTS.md content.

import fs from "node:fs";
import path from "node:path";

export const SECTION_START = "<!-- academic-project-management:section:start -->";
export const SECTION_END = "<!-- academic-project-management:section:end -->";

export const MANAGED_KINDS = new Set(["git-repo", "local-folder"]);

// Decide whether a project entry should receive the managed section.
export function isAgentsManaged({ manuscript_home, manuscript_kind, manuscript_access }) {
  if (!manuscript_home) return false;
  if (!MANAGED_KINDS.has(manuscript_kind)) return false;
  if (manuscript_access === "none" || manuscript_access === "read-only") return false;
  return true;
}

export function renderAgentsSection({
  skillDir,
  pmFolder,
  manuscriptHome,
  manuscriptKind,
  manuscriptAccess,
}) {
  const templatePath = path.join(skillDir, "templates", "AGENTS_ACADEMIC_PM_SECTION.md");
  let raw = fs.readFileSync(templatePath, "utf8");

  if (manuscriptKind === "null") {
    raw = raw.replace(
      "The paper artifact and analysis code live at `<manuscript_home>` (`<manuscript_kind>`, access `<manuscript_access>`). The PM folder's `README.md` wins for routing.",
      "The PM folder is the whole project; there is no separate manuscript home.",
    );
  }

  const homeResolved = manuscriptHome ? path.resolve(manuscriptHome) : "(no manuscript home)";
  const kindResolved = manuscriptKind === "null" ? "null" : manuscriptKind ?? "unknown";
  const accessResolved = manuscriptAccess ?? "authoritative";
  return raw
    .replace(/<pm_folder>/g, pmFolder)
    .replace(/<skill_dir>/g, skillDir)
    .replace(/<manuscript_home>/g, homeResolved)
    .replace(/<manuscript_kind>/g, kindResolved)
    .replace(/<manuscript_access>/g, accessResolved);
}

export function wrapSectionBlock(section) {
  return `${SECTION_START}\n${section}\n${SECTION_END}\n`;
}

// Create or refresh <home>/AGENTS.md so it contains the managed block.
// Returns one of: "write" | "update" | "would write" | "would update".
export function upsertAgentsMd({ home, section, title, dryRun = false, logFn = null }) {
  const log = logFn ?? (() => {});
  const agentsPath = path.join(home, "AGENTS.md");
  const block = wrapSectionBlock(section);

  if (!fs.existsSync(agentsPath)) {
    if (dryRun) {
      log("would write", agentsPath);
      return "would write";
    }
    fs.writeFileSync(agentsPath, `# ${title} agent guidance\n\n${block}`);
    log("write", agentsPath);
    return "write";
  }

  const existing = fs.readFileSync(agentsPath, "utf8");
  const startIdx = existing.indexOf(SECTION_START);
  const endIdx = existing.indexOf(SECTION_END);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = existing.slice(0, startIdx);
    const after = existing.slice(endIdx + SECTION_END.length).replace(/^\n+/, "");
    const next = `${before}${block}${after ? `\n${after}` : ""}`;
    if (next === existing) {
      log("ok", agentsPath, "managed section already in sync");
      return "in-sync";
    }
    if (dryRun) {
      log("would update", agentsPath, "replace managed section");
      return "would update";
    }
    fs.writeFileSync(agentsPath, next);
    log("update", agentsPath, "replace managed section");
    return "update";
  }

  if (dryRun) {
    log("would update", agentsPath, "append managed section");
    return "would update";
  }
  const sep = existing.endsWith("\n") ? "\n" : "\n\n";
  fs.writeFileSync(agentsPath, `${existing}${sep}${block}`);
  log("update", agentsPath, "append managed section");
  return "update";
}
