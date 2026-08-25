/**
 * lib/check-academic-pm-migrations.mjs
 *
 * Pending-migration probe for check-academic-pm.mjs, ported from
 * project-management's lib/check-pm-migrations.mjs.
 *
 * The academic validator is single-target (one --path or one --project per
 * invocation), so this lib exposes a single focused helper instead of the
 * PM repo's multi-target argument expansion. It shells out to migrate.mjs
 * in dry-run mode so the validator never mutates state.
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";

function runMigrate(scriptDir, args) {
  return spawnSync(process.execPath, [join(scriptDir, "migrate.mjs"), ...args], {
    encoding: "utf8",
  });
}

export function findRegisteredMigrations(scriptDir) {
  const listResult = runMigrate(scriptDir, ["--list", "--json"]);
  if (listResult.error || listResult.status !== 0) return [];
  let registry;
  try {
    registry = JSON.parse(listResult.stdout);
  } catch {
    return [];
  }
  if (!Array.isArray(registry)) return [];
  return registry.map((m) => ({ id: m.id, describe: m.describe ?? "" }));
}

/**
 * Return the subset of registered migrations whose detect() reports pending
 * work for this PM folder. Always runs migrate.mjs with --yes --dry-run, so
 * no ledger writes and no prompts; a pending migration prints
 * `# Applying <id>` even in dry-run mode.
 */
export function findPendingMigrations(scriptDir, { pmFolder, configPath } = {}) {
  const pending = [];
  for (const migration of findRegisteredMigrations(scriptDir)) {
    const args = ["--migration", migration.id, "--yes", "--dry-run"];
    if (pmFolder) {
      args.push("--pm-folder", pmFolder);
    }
    if (configPath) {
      args.push("--config", configPath);
    }
    const result = runMigrate(scriptDir, args);
    if (result.error || result.status !== 0) continue;
    if (typeof result.stdout === "string" && result.stdout.includes(`# Applying ${migration.id}`)) {
      pending.push(migration);
    }
  }
  return pending;
}
