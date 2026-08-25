#!/usr/bin/env node
/**
 * migrate.mjs
 *
 * Declarative migration runner for academic-project-management PM folders.
 * Ported from project-management's scripts/migrate.mjs.
 *
 * The runner reads a registry of named, versioned migrations and applies
 * any that are (a) registered and (b) not yet recorded as applied in the
 * project's `.pm/migrations.json` ledger. Each migration is a small,
 * self-contained module that knows its id, from/to versions, and how to
 * apply itself.
 *
 * Why a registry? Adding a new migration is one new file in
 * `migrations/` plus one line in `_index.mjs`. The runner, validator,
 * and CLI stay the same.
 *
 * Usage:
 *   node scripts/migrate.mjs --project <name> [--config <path>] [--yes] [--dry-run]
 *   node scripts/migrate.mjs --pm-folder <path> [--yes] [--dry-run]
 *   node scripts/migrate.mjs --list
 *   node scripts/migrate.mjs --pm-folder <path> --migration <id> [--force] [--yes] [--dry-run]
 *
 * The --force flag bypasses the applied-migrations ledger for the targeted
 * migration. Use this when a migration's detect() patterns are extended
 * after you already ran it. Without --force the ledger blocks re-running.
 * Successful forced reapplication preserves the existing ledger row instead
 * of appending a duplicate.
 *
 * Exit codes:
 *   0 = no work to do, or all applicable migrations applied cleanly
 *   1 = a migration failed mid-apply; re-run after fixing the cause
 *   2 = argument or state error (unknown migration, missing pm_folder, etc.)
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(SCRIPT_DIR, "migrations");

const DEFAULT_CONFIG_PATH = join(os.homedir(), ".config", "academic-pm", "projects.json");

const LEDGER_REL = join(".pm", "migrations.json");
const LEDGER_SCHEMA_VERSION = 1;

const USAGE = `Usage:
  node scripts/migrate.mjs --project <name> [--config <path>] [--yes] [--dry-run]
  node scripts/migrate.mjs --pm-folder <path> [--yes] [--dry-run]
  node scripts/migrate.mjs --list
  node scripts/migrate.mjs --migration <id> --pm-folder <path> [--force] [--yes] [--dry-run]
`;

function resolveProjectsConfigPath(explicitConfigPath) {
  if (explicitConfigPath && existsSync(explicitConfigPath)) return explicitConfigPath;
  if (existsSync(DEFAULT_CONFIG_PATH)) return DEFAULT_CONFIG_PATH;
  return explicitConfigPath ?? DEFAULT_CONFIG_PATH;
}

function parseArgs(argv) {
  const out = {
    project: null,
    configPath: null, // resolved after parsing via resolveProjectsConfigPath()
    pmFolder: null,
    migration: null,
    list: false,
    json: false,
    dryRun: false,
    yes: false,
    force: false,
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--project":
        out.project = argv[++i];
        break;
      case "--config":
        out.configPath = resolve(argv[++i]);
        break;
      case "--pm-folder":
        out.pmFolder = resolve(argv[++i]);
        break;
      case "--migration":
        out.migration = argv[++i];
        break;
      case "--list":
        out.list = true;
        break;
      case "--json":
        out.json = true;
        break;
      case "--dry-run":
        out.dryRun = true;
        break;
      case "--yes":
      case "-y":
        out.yes = true;
        break;
      case "--force":
        out.force = true;
        break;
      case "--help":
      case "-h":
        out.help = true;
        break;
      default:
        process.stderr.write(`Unknown argument: ${arg}\n${USAGE}`);
        process.exit(2);
    }
  }
  return out;
}

async function loadRegistry() {
  const indexPath = join(MIGRATIONS_DIR, "_index.mjs");
  if (!existsSync(indexPath)) {
    process.stderr.write(`Registry not found: ${indexPath}\n`);
    process.exit(2);
  }
  const mod = await import(pathToFileURL(indexPath).href);
  if (!mod || !Array.isArray(mod.default)) {
    process.stderr.write(
      `Registry at ${indexPath} must default-export an array of migration module specifiers.`
    );
    process.exit(2);
  }
  const migrations = [];
  for (const spec of mod.default) {
    const filePath = resolve(MIGRATIONS_DIR, spec);
    const m = await import(pathToFileURL(filePath).href);
    if (!m || !m.default || typeof m.default.detect !== "function" || typeof m.default.apply !== "function") {
      process.stderr.write(`Migration at ${spec} is missing default export with detect/apply.`);
      process.exit(2);
    }
    const meta = m.default;
    if (!meta.id || !meta.to) {
      process.stderr.write(`Migration at ${spec} is missing id or to.`);
      process.exit(2);
    }
    migrations.push({ ...meta, _file: filePath });
  }
  return migrations;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function loadConfig(configPath) {
  if (!existsSync(configPath)) return null;
  return readJson(configPath);
}

function resolvePmFolder(args) {
  if (args.pmFolder) return args.pmFolder;
  if (!args.project) return null;
  const cfg = loadConfig(args.configPath);
  if (!cfg) {
    process.stderr.write(`No config at ${args.configPath}; pass --pm-folder or --config.\n`);
    process.exit(2);
  }
  const project = cfg.projects?.[args.project];
  if (!project) {
    process.stderr.write(`Project ${args.project} not found in ${args.configPath}.\n`);
    process.exit(2);
  }
  if (!project.pm_folder) {
    process.stderr.write(`Project ${args.project} has no pm_folder in ${args.configPath}.\n`);
    process.exit(2);
  }
  return resolve(project.pm_folder);
}

function readLedger(pmFolder) {
  const path = join(pmFolder, LEDGER_REL);
  if (!existsSync(path)) {
    return { schema_version: LEDGER_SCHEMA_VERSION, applied: [] };
  }
  try {
    const raw = readJson(path);
    if (!raw || typeof raw !== "object") {
      throw new Error("ledger is not an object");
    }
    return {
      schema_version: raw.schema_version ?? LEDGER_SCHEMA_VERSION,
      applied: Array.isArray(raw.applied) ? raw.applied : [],
    };
  } catch (err) {
    process.stderr.write(
      `Failed to read ${path}: ${err.message}\n` +
      `Fix or delete the ledger, then re-run.\n`
    );
    process.exit(1);
  }
}

function writeLedger(pmFolder, ledger) {
  const path = join(pmFolder, LEDGER_REL);
  writeJson(path, ledger);
  ensureGitignore(pmFolder);
}

function ensureGitignore(pmFolder) {
  const dir = join(pmFolder, ".pm");
  const gi = join(dir, ".gitignore");
  if (existsSync(gi)) return;
  writeFileSync(gi, "*\n");
}

function isInGitRepo(pmFolder) {
  try {
    execFileSync("git", ["-C", pmFolder, "rev-parse", "--show-toplevel"], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function gitMv(src, dst, pmFolder) {
  try {
    execFileSync("git", ["-C", pmFolder, "mv", src, dst], { stdio: "inherit" });
  } catch (err) {
    throw new Error(
      `git mv failed: ${err.message}\n` +
      `If the PM folder is not a git checkout, this is expected — the runner should have fallen back to plain rename.`
    );
  }
}

function movePath(srcAbs, dstAbs, ctx) {
  if (srcAbs === dstAbs) return;
  if (!existsSync(srcAbs)) return;
  if (ctx.dryRun) {
    ctx.log(`would move: ${relative(ctx.pmFolder, srcAbs)} → ${relative(ctx.pmFolder, dstAbs)}`);
    return;
  }
  mkdirSync(dirname(dstAbs), { recursive: true });
  if (ctx.isGit) {
    gitMv(relative(ctx.pmFolder, srcAbs), relative(ctx.pmFolder, dstAbs), ctx.pmFolder);
  } else {
    renameSync(srcAbs, dstAbs);
  }
  ctx.log(`moved: ${relative(ctx.pmFolder, srcAbs)} → ${relative(ctx.pmFolder, dstAbs)}`);
}

void movePath;

function listMdFiles(root, skipDirs = []) {
  const out = [];
  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const abs = join(dir, e.name);
      if (e.isDirectory()) {
        const rel = relative(root, abs);
        if (skipDirs.some((s) => rel === s || rel.startsWith(s + sep))) continue;
        walk(abs);
      } else if (e.isFile() && e.name.endsWith(".md")) {
        out.push(abs);
      }
    }
  }
  walk(root);
  return out;
}

void listMdFiles;

function confirmIfNeeded(plan, args) {
  if (args.yes || args.dryRun) return;
  process.stderr.write("\nMigration plan:\n");
  for (const line of plan) process.stderr.write(`  - ${line}\n`);
  process.stderr.write("\nContinue? [y/N] ");
  let input = "";
  try {
    input = readFileSync(0, "utf8").trim();
  } catch {
    process.stderr.write("\nNo TTY available; re-run with --yes to skip this prompt.\n");
    process.exit(2);
  }
  if (input !== "y" && input !== "Y") {
    process.stderr.write("Canceled.\n");
    process.exit(0);
  }
}

const cli = parseArgs(process.argv);

if (cli.help) {
  process.stdout.write(USAGE);
  process.exit(0);
}

if (cli.force && !cli.migration) {
  process.stderr.write("--force requires --migration <id>.\n");
  process.exit(2);
}

// Resolve projects.json path: --config flag wins, else ~/.config/academic-pm/projects.json.
if (!cli.configPath) {
  cli.configPath = resolveProjectsConfigPath(null);
}

main().catch((err) => {
  process.stderr.write(`Unexpected error: ${err.message}\n${err.stack ?? ""}\n`);
  process.exit(1);
});

async function main() {
  const registry = await loadRegistry();

  if (cli.list) {
    if (cli.json) {
      const out = registry.map((m) => ({
        id: m.id,
        from: m.from ?? null,
        to: m.to ?? null,
        describe: m.describe ?? null,
        reconcileOnDrift: m.reconcileOnDrift === true,
      }));
      process.stdout.write(JSON.stringify(out, null, 2) + "\n");
    } else {
      process.stdout.write("\nRegistered migrations (in order):\n\n");
      for (const m of registry) {
        process.stdout.write(`  ${m.id}\n`);
        process.stdout.write(`    ${m.describe ?? "(no description)"}\n\n`);
      }
    }
    process.exit(0);
  }

  const pmFolder = resolvePmFolder(cli);
  if (!existsSync(pmFolder) || !statSync(pmFolder).isDirectory()) {
    process.stderr.write(`PM folder not found: ${pmFolder}\n`);
    process.exit(2);
  }

  const ledger = readLedger(pmFolder);
  const appliedIds = new Set(ledger.applied.map((a) => a.id));

  const targets = cli.migration
    ? registry.filter((m) => m.id === cli.migration)
    : registry;

  if (cli.migration && targets.length === 0) {
    process.stderr.write(`Unknown migration id: ${cli.migration}\n`);
    process.stderr.write(`Available: ${registry.map((m) => m.id).join(", ")}\n`);
    process.exit(2);
  }

  const ctx = {
    pmFolder,
    dryRun: cli.dryRun,
    isGit: isInGitRepo(pmFolder),
    configPath: cli.configPath,
    log(action, target, detail = "") {
      const suffix = detail ? ` — ${detail}` : "";
      const prefix = cli.dryRun ? "would " : "";
      process.stdout.write(`${prefix}${action}: ${target}${suffix}\n`);
    },
  };

  let anyApplied = false;

  for (const migration of targets) {
    const alreadyApplied = appliedIds.has(migration.id);
    if (alreadyApplied && !cli.migration) {
      continue;
    }
    if (alreadyApplied && cli.migration && !cli.force) {
      continue;
    }

    let shouldApply = false;
    try {
      shouldApply = await migration.detect({ pmFolder, ctx });
    } catch (err) {
      process.stderr.write(`detect() threw for ${migration.id}: ${err.message}\n`);
      process.exit(1);
    }

    if (!shouldApply) {
      if (cli.migration) {
        process.stderr.write(
          `Migration ${migration.id} detect() returned false; nothing to apply for this project.\n`
        );
      }
      continue;
    }

    process.stdout.write(`\n# Applying ${migration.id}\n`);
    process.stdout.write(`${migration.describe ?? ""}\n\n`);

    if (!cli.yes && !cli.dryRun) {
      const summary = migration.plan
        ? migration.plan({ pmFolder, ctx })
        : [`Apply ${migration.id} to ${pmFolder}`];
      confirmIfNeeded(summary, cli);
    }

    try {
      const result = await migration.apply({ pmFolder, ctx });
      if (cli.dryRun) {
        process.stdout.write(
          alreadyApplied
            ? `(dry run) Would reapply ${migration.id} and preserve its existing ledger record.\n`
            : `(dry run) Would record ${migration.id} as applied.\n`
        );
      } else if (alreadyApplied) {
        process.stdout.write(`Reapplied ${migration.id}; existing ledger record preserved.\n`);
      } else {
        ledger.applied.push({
          id: migration.id,
          applied_at: new Date().toISOString(),
          skill_version: migration.to,
        });
        appliedIds.add(migration.id);
        writeLedger(pmFolder, ledger);
        process.stdout.write(`Recorded ${migration.id} as applied.\n`);
        if (result && Array.isArray(result.suggestedHistory)) {
          process.stdout.write("\nSuggested history bullet (append to history/YYYY/<Month>/history-YYYY-MM-DD.md):\n");
          for (const line of result.suggestedHistory) process.stdout.write(`  ${line}\n`);
        }
      }
      if (result && Array.isArray(result.manualReview) && result.manualReview.length > 0) {
        process.stdout.write("\nManual review required (these items need human judgement, not auto-fix):\n");
        for (const line of result.manualReview) process.stdout.write(`  - ${line}\n`);
      }
      anyApplied = true;
    } catch (err) {
      process.stderr.write(`Migration ${migration.id} failed: ${err.message}\n`);
      process.stderr.write(`Re-run after fixing the cause. The runner is idempotent and will pick up where it left off.\n`);
      process.exit(1);
    }
  }

  if (!anyApplied) {
    process.stdout.write("\nNo applicable migrations.\n");
  }
}
