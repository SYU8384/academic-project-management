/**
 * migrations/1.2.0-registry-manuscript-defaults.mjs
 *
 * Backfill registry-field defaults in `~/.config/academic-pm/projects.json`
 * for entries registered before the current bootstrap schema.
 *
 * `bootstrap-academic-pm.mjs` now always writes `project_type` plus the
 * manuscript triple (`manuscript_home`, `manuscript_kind`,
 * `manuscript_access`) for every registered project. Older registries may
 * contain entries missing one or more of these keys, which forces readers
 * (check-academic-pm.mjs, agents-section sync, ad-hoc tooling) to fall
 * back to per-caller defaults.
 *
 * This backfill adds, only when absent:
 *   - `project_type: "paper"`            (the skill's default project kind)
 *   - `manuscript_home: ""`              (no manuscript home declared)
 *   - `manuscript_kind: "null"`          (matches bootstrap's no-home value)
 *   - `manuscript_access: "authoritative"` (matches bootstrap's default)
 *
 * Existing values are never overwritten, so entries with a real manuscript
 * home keep their declared kind/access. Idempotent: re-running on a
 * projects.json whose entries already have all four keys is a no-op
 * (the `detect()` returns false).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";

const DEFAULT_CONFIG_PATH = join(os.homedir(), ".config", "academic-pm", "projects.json");

function loadProjectsConfig(ctx) {
  const configPath = ctx?.configPath ?? DEFAULT_CONFIG_PATH;
  if (!configPath || !existsSync(configPath)) return null;
  let raw;
  try {
    raw = readFileSync(configPath, "utf8");
  } catch {
    return null;
  }
  try {
    return { configPath, cfg: JSON.parse(raw) };
  } catch {
    return null;
  }
}

const DEFAULTS = {
  project_type: "paper",
  manuscript_home: "",
  manuscript_kind: "null",
  manuscript_access: "authoritative",
};

function findMissingFields(cfg) {
  const projects = cfg?.projects ?? {};
  const out = [];
  for (const [name, proj] of Object.entries(projects)) {
    if (!proj || typeof proj !== "object") continue;
    const missing = Object.keys(DEFAULTS).filter(
      (key) => !Object.prototype.hasOwnProperty.call(proj, key)
    );
    if (missing.length > 0) out.push({ name, missing });
  }
  return out;
}

function detect({ pmFolder, ctx }) {
  const loaded = loadProjectsConfig(ctx);
  if (!loaded) return false;
  return findMissingFields(loaded.cfg).length > 0;
}

function plan({ pmFolder, ctx }) {
  const loaded = loadProjectsConfig(ctx);
  const lines = [
    `Read projects.json and add default \`project_type\` / \`manuscript_home\` / \`manuscript_kind\` / \`manuscript_access\` keys where absent.`,
  ];
  if (!loaded) {
    lines.push(`(no projects.json found — nothing to do)`);
    return lines;
  }
  const affected = findMissingFields(loaded.cfg);
  if (affected.length === 0) {
    lines.push(`(no entries with missing fields — nothing to do)`);
  } else {
    for (const { name, missing } of affected) {
      lines.push(`Project: ${name} — backfill ${missing.map((k) => `\`${k}\``).join(", ")}`);
    }
  }
  return lines;
}

function apply({ pmFolder, ctx }) {
  const loaded = loadProjectsConfig(ctx);
  if (!loaded) {
    ctx.log(`skip`, `no projects.json found`);
    return {};
  }
  const { configPath, cfg } = loaded;
  const affected = findMissingFields(cfg);
  if (affected.length === 0) {
    ctx.log(`skip`, `no entries with missing fields in ${configPath}`);
    return {};
  }

  for (const { name, missing } of affected) {
    for (const key of missing) {
      cfg.projects[name][key] = DEFAULTS[key];
    }
    ctx.log(`rewrite`, `${name}: backfilled ${missing.join(", ")}`);
  }

  if (!ctx.dryRun) {
    writeFileSync(configPath, `${JSON.stringify(cfg, null, 2)}\n`);
    ctx.log(`summary`, `wrote ${configPath} (${affected.length} entr${affected.length === 1 ? "y" : "ies"} backfilled)`);
  }

  return {
    suggestedHistory: [
      `- **Registry backfill: manuscript/type defaults.** fix(pm): backfill missing \`project_type\` / \`manuscript_home\` / \`manuscript_kind\` / \`manuscript_access\` defaults in projects.json (migration \`1.2.0-registry-manuscript-defaults\`). Backfilled ${affected.length} project entr${affected.length === 1 ? "y" : "ies"}: ${affected.map((a) => a.name).join(", ")}.`,
    ],
  };
}

export default {
  id: "1.2.0-registry-manuscript-defaults",
  from: "<1.2.0",
  to: "1.2.0",
  describe:
    "Backfill `project_type`, `manuscript_home`, `manuscript_kind`, and `manuscript_access` defaults in projects.json entries registered before the current bootstrap schema (existing values are never overwritten).",
  detect,
  plan,
  apply,
};
