#!/usr/bin/env node
/**
 * Self-test for academic-project-management.
 *
 * Exercises the deterministic parts of the bootstrap and check scripts against
 * real filesystem operations on temp folders. Catches regressions in:
 *   - PM-folder scaffold creation
 *   - Bootstrap idempotency
 *   - Manuscript-home AGENTS.md marker-block idempotency (append / replace-in-place)
 *   - Cross-field invariant enforcement (manuscript_kind vs manuscript_home)
 *   - Validator end-to-end (PASS, 0 errors on a fresh scaffold)
 *
 * Usage:  node <skill_dir>/scripts/test/run-tests.mjs
 * Exits:  0 on full pass, 1 on any failure.
 *
 * Not in the test battery (intentionally):
 *   - The check-academic-pm.mjs --json / --strict flag combinations
 *   - The 5 system-header packages in renv (out of skill scope)
 *   - Renv lockfile integrity (covered by renv::restore() on the target host)
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const SKILL_DIR = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const BOOTSTRAP = path.join(SKILL_DIR, "scripts", "bootstrap-academic-pm.mjs");
const CHECK = path.join(SKILL_DIR, "scripts", "check-academic-pm.mjs");

const TMP_ROOT = path.join(os.tmpdir(), "opencode");
fs.mkdirSync(TMP_ROOT, { recursive: true });

const results = [];

function step(name, fn) {
  process.stdout.write(`  ${name} ... `);
  const start = Date.now();
  try {
    const detail = fn();
    const ms = Date.now() - start;
    process.stdout.write(`PASS  (${ms}ms)\n`);
    if (detail) process.stdout.write(`    ${detail}\n`);
    results.push({ name, status: "PASS", ms });
  } catch (err) {
    const ms = Date.now() - start;
    process.stdout.write(`FAIL  (${ms}ms)\n`);
    process.stdout.write(`    ${err.message}\n`);
    results.push({ name, status: "FAIL", ms, error: err.message });
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(`assertion failed: ${msg}`);
}

function assertEqual(actual, expected, msg) {
  assert(actual === expected, `${msg}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`);
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  if (opts.expectFail) return r;
  if (r.status !== 0) {
    throw new Error(
      `command failed (${cmd} ${args.join(" ")})\n` +
      `  stdout: ${r.stdout}\n` +
      `  stderr: ${r.stderr}`,
    );
  }
  return r;
}

function freshWorkdir(label) {
  const dir = fs.mkdtempSync(path.join(TMP_ROOT, `apm-test-${label}-`));
  return dir;
}

function makeRepo(label) {
  const dir = freshWorkdir(label);
  // Pre-initialize as a git repo so AGENTS.md wiring is meaningful.
  run("git", ["init", "-q", "-b", "main", dir]);
  run("git", ["-C", dir, "config", "user.email", "test@local"]);
  run("git", ["-C", dir, "config", "user.name", "Test"]);
  run("git", ["-C", dir, "commit", "--allow-empty", "-q", "-m", "init"]);
  return dir;
}

function bootstrap(args, opts = {}) {
  return run("node", [BOOTSTRAP, ...args], opts);
}

function validate(folder) {
  return run("node", [CHECK, "--path", folder, "--json"]);
}

// ---------------------------------------------------------------------------

console.log("academic-project-management self-test\n");

// Test 1: bootstrap creates scaffold on a fresh PM folder, with lane-specific
// content seeded from the templates.
const pm1 = freshWorkdir("scaffold");
step("T1 bootstrap creates scaffold with lane-specific content", () => {
  bootstrap([
    "--project", "T1Project", "--pm-folder", pm1, "--phase", "analysis",
    "--notes", "T1", "--config", path.join(pm1, "projects.json"),
  ]);
  for (const f of [
    "README.md", "RESEARCH.md", "CURRENT_STATUS.md", "T1Project.md",
    "analysis/analysis.md", "literature/literature.md", "evidence/evidence.md",
    "writing/writing.md", "meetings/meetings.md", "planning/planning.md",
    "history/history.md", "archive/archive.md",
  ]) {
    assert(fs.existsSync(path.join(pm1, f)), `expected ${f} to exist after bootstrap`);
  }

  // Lane-specific content checks: each lane's template must produce its
  // distinguishing sections. If a future template change drops one of these,
  // the test fails and forces an explicit decision.
  const contentChecks = [
    ["literature/literature.md", "## Reading Queue"],
    ["literature/literature.md", "## Citation Gaps"],
    ["evidence/evidence.md", "## Source Registry"],
    ["evidence/evidence.md", "## Measurement Definitions"],
    ["evidence/evidence.md", "## Data Risks"],
    ["analysis/analysis.md", "## Active Analysis Questions"],
    ["writing/writing.md", "## Draft Status"],
    ["meetings/meetings.md", "## Open Action Items"],
    ["planning/planning.md", "## Active Plans"],
    ["planning/planning.md", "## Decisions"],
    ["history/history.md", "<!-- vault-maintain:index:start -->"],
    ["T1Project.md", "<!-- vault-maintain:index:start -->"],
  ];
  for (const [rel, marker] of contentChecks) {
    const text = fs.readFileSync(path.join(pm1, rel), "utf8");
    assert(
      text.includes(marker),
      `expected ${rel} to contain "${marker}" (template-to-script binding broken)`,
    );
  }
});

// Test 2: bootstrap on an already-scaffolded folder is idempotent.
const pm2 = freshWorkdir("idempotent");
step("T2 bootstrap is idempotent on existing scaffold", () => {
  bootstrap([
    "--project", "T2Project", "--pm-folder", pm2, "--phase", "analysis",
    "--notes", "T2", "--config", path.join(pm2, "projects.json"),
  ]);
  // Mutate README.md so we can detect that bootstrap does NOT clobber it.
  const readme = path.join(pm2, "README.md");
  fs.writeFileSync(readme, "# USER EDIT\n");
  bootstrap([
    "--project", "T2Project", "--pm-folder", pm2, "--phase", "analysis",
    "--notes", "T2", "--config", path.join(pm2, "projects.json"),
  ]);
  const after = fs.readFileSync(readme, "utf8");
  assertEqual(after, "# USER EDIT\n", "second bootstrap clobbered user-edited README.md");
});

// Test 3: bootstrap with manuscript_home + git-repo writes AGENTS.md section.
const pm3 = freshWorkdir("agents-create");
const repo3 = makeRepo("agents-create-repo");
step("T3 bootstrap creates AGENTS.md with managed section", () => {
  bootstrap([
    "--project", "T3Project", "--pm-folder", pm3, "--phase", "analysis",
    "--notes", "T3", "--config", path.join(pm3, "projects.json"),
    "--manuscript-home", repo3, "--manuscript-kind", "git-repo",
    "--manuscript-access", "authoritative",
  ]);
  const agentsPath = path.join(repo3, "AGENTS.md");
  assert(fs.existsSync(agentsPath), "AGENTS.md should be created in manuscript home");
  const content = fs.readFileSync(agentsPath, "utf8");
  assert(content.includes("<!-- academic-project-management:section:start -->"), "missing start marker");
  assert(content.includes("<!-- academic-project-management:section:end -->"), "missing end marker");
  assert(content.includes(pm3), "AGENTS.md should reference pm_folder path");
});

// Test 4: re-bootstrap on the same manuscript_home replaces the section in place
// (idempotent marker-block behavior).
step("T4 re-bootstrap replaces managed section in place", () => {
  const agentsPath = path.join(repo3, "AGENTS.md");
  const before = fs.readFileSync(agentsPath, "utf8");
  // Add user content above and below the managed section.
  const wrapped = `# USER PREFIX\n\n${before}\n# USER SUFFIX\n`;
  fs.writeFileSync(agentsPath, wrapped);
  bootstrap([
    "--project", "T3Project", "--pm-folder", pm3, "--phase", "analysis",
    "--notes", "T3", "--config", path.join(pm3, "projects.json"),
    "--manuscript-home", repo3, "--manuscript-kind", "git-repo",
    "--manuscript-access", "authoritative",
  ]);
  const after = fs.readFileSync(agentsPath, "utf8");
  assert(after.includes("# USER PREFIX"), "user prefix content was lost");
  assert(after.includes("# USER SUFFIX"), "user suffix content was lost");
  // Only ONE managed section should remain, not duplicates.
  const starts = (after.match(/academic-project-management:section:start/g) || []).length;
  const ends = (after.match(/academic-project-management:section:end/g) || []).length;
  assertEqual(starts, 1, "expected exactly one start marker after re-bootstrap");
  assertEqual(ends, 1, "expected exactly one end marker after re-bootstrap");
});

// Test 5: bootstrap with --no-manuscript-home (the canonical way to declare
// "this project has no manuscript artifact yet") does NOT write AGENTS.md and
// records manuscript_kind = "null" in projects.json.
const pm5 = freshWorkdir("agents-null");
const repo5 = makeRepo("agents-null-repo");
step("T5 bootstrap with --no-manuscript-home skips AGENTS.md write", () => {
  bootstrap([
    "--project", "T5Project", "--pm-folder", pm5, "--phase", "idea",
    "--notes", "T5", "--config", path.join(pm5, "projects.json"),
    "--no-manuscript-home",
  ]);
  assert(!fs.existsSync(path.join(repo5, "AGENTS.md")), "AGENTS.md should not be created when --no-manuscript-home is passed");
  // But projects.json should still record manuscript_kind = "null" and home = "".
  const cfg = JSON.parse(fs.readFileSync(path.join(pm5, "projects.json"), "utf8"));
  assertEqual(cfg.projects.T5Project.manuscript_kind, "null", "manuscript_kind not recorded as null");
  assertEqual(cfg.projects.T5Project.manuscript_home, "", "manuscript_home should be empty when kind is null");
});

// Test 6: bootstrap with --manuscript-kind git-repo but no --manuscript-home fails.
const pm6 = freshWorkdir("cross-field");
step("T6 cross-field invariant: kind=git-repo without home fails", () => {
  const r = bootstrap([
    "--project", "T6Project", "--pm-folder", pm6, "--phase", "analysis",
    "--notes", "T6", "--config", path.join(pm6, "projects.json"),
    "--manuscript-kind", "git-repo",
  ], { expectFail: true });
  assert(r.status !== 0, "bootstrap should have failed");
  assert(/--manuscript-home is required/.test(r.stderr || r.stdout || ""),
    "error should mention --manuscript-home is required");
});

// Test 7: validator PASS on a fresh, valid PM folder.
const pm7 = freshWorkdir("validate");
step("T7 validator PASS on fresh scaffold", () => {
  bootstrap([
    "--project", "T7Project", "--pm-folder", pm7, "--phase", "analysis",
    "--notes", "T7", "--config", path.join(pm7, "projects.json"),
  ]);
  const r = validate(pm7);
  const report = JSON.parse(r.stdout);
  assertEqual(report.status, "PASS", "validator should PASS on a fresh, valid PM folder");
  assertEqual(report.errors.length, 0, "no errors expected");
});

// Test 8: validator FAIL on a missing required file.
step("T8 validator FAIL when required root file is missing", () => {
  // Reuse pm7 from T7; delete RESEARCH.md.
  fs.unlinkSync(path.join(pm7, "RESEARCH.md"));
  const r = run("node", [CHECK, "--path", pm7, "--json"], { expectFail: true });
  assert(r.status !== 0, "validator should exit non-zero on FAIL");
  const report = JSON.parse(r.stdout);
  assertEqual(report.status, "FAIL", "validator should FAIL when RESEARCH.md is missing");
  assert(report.errors.some(e => /RESEARCH\.md/.test(e)),
    `error should mention RESEARCH.md; got: ${JSON.stringify(report.errors)}`);
});

// Test 9: bootstrap with --manuscript-access read-only records the field but skips AGENTS.md write.
const pm9 = freshWorkdir("read-only");
const repo9 = makeRepo("read-only-repo");
step("T9 bootstrap with --manuscript-access read-only skips AGENTS.md", () => {
  bootstrap([
    "--project", "T9Project", "--pm-folder", pm9, "--phase", "analysis",
    "--notes", "T9", "--config", path.join(pm9, "projects.json"),
    "--manuscript-home", repo9, "--manuscript-kind", "git-repo",
    "--manuscript-access", "read-only",
  ]);
  assert(!fs.existsSync(path.join(repo9, "AGENTS.md")),
    "AGENTS.md should NOT be written when manuscript_access=read-only");
  const cfg = JSON.parse(fs.readFileSync(path.join(pm9, "projects.json"), "utf8"));
  assertEqual(cfg.projects.T9Project.manuscript_access, "read-only", "manuscript_access not recorded");
});

// Test 10: round-trip preservation. Mutate every required file with distinctive
// user content, re-bootstrap, assert every user edit is still present. This
// locks the create-only contract for all required files (not just README).
const pm10 = freshWorkdir("roundtrip");
const config10 = path.join(pm10, "projects.json");
step("T10 re-bootstrap preserves user edits in every required file", () => {
  bootstrap([
    "--project", "T10Project", "--pm-folder", pm10, "--phase", "analysis",
    "--notes", "T10", "--config", config10,
  ]);
  const requiredFiles = [
    "README.md", "RESEARCH.md", "CURRENT_STATUS.md", "T10Project.md",
    "analysis/analysis.md", "literature/literature.md", "evidence/evidence.md",
    "writing/writing.md", "meetings/meetings.md", "planning/planning.md",
    "history/history.md", "archive/archive.md",
  ];
  const userTag = "USER_EDIT_FOR_T10";
  for (const rel of requiredFiles) {
    const abs = path.join(pm10, rel);
    const original = fs.readFileSync(abs, "utf8");
    fs.writeFileSync(abs, `${original}\n\n${userTag} in ${rel}\n`);
  }
  // Re-bootstrap: the scaffold should be skipped, user edits should survive.
  bootstrap([
    "--project", "T10Project", "--pm-folder", pm10, "--phase", "analysis",
    "--notes", "T10", "--config", config10,
  ]);
  for (const rel of requiredFiles) {
    const abs = path.join(pm10, rel);
    const after = fs.readFileSync(abs, "utf8");
    assert(
      after.includes(`${userTag} in ${rel}`),
      `re-bootstrap clobbered user edit in ${rel}`,
    );
  }
});

// Test 11: projects.json schema after bootstrap. Locks the registry shape for
// the common case (manuscript_kind = git-repo) and the null case.
const config11 = path.join(freshWorkdir("schema-pm"), "projects.json");
step("T11 projects.json schema after bootstrap", () => {
  const pmA = freshWorkdir("schema-git");
  bootstrap([
    "--project", "T11A", "--pm-folder", pmA, "--phase", "analysis-writing",
    "--notes", "T11A notes", "--config", config11,
  ]);
  // Manually inject manuscript_home/kind/access to test the git-repo path.
  const cfgPath = config11;
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  cfg.projects.T11A.manuscript_home = pmA;
  cfg.projects.T11A.manuscript_kind = "git-repo";
  cfg.projects.T11A.manuscript_access = "authoritative";
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));

  // Assert the recorded fields have the expected values.
  const re = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  assertEqual(re.skill_dir, SKILL_DIR, "skill_dir not recorded");
  assertEqual(re.projects.T11A.project_type, "paper", "project_type default");
  assertEqual(re.projects.T11A.phase, "analysis-writing", "phase");
  assertEqual(re.projects.T11A.access, "authoritative", "access default");
  assertEqual(re.projects.T11A.notes, "T11A notes", "notes recorded");
  assertEqual(re.projects.T11A.pm_folder, path.resolve(pmA), "pm_folder");
  assertEqual(re.projects.T11A.manuscript_home, path.resolve(pmA), "manuscript_home");
  assertEqual(re.projects.T11A.manuscript_kind, "git-repo", "manuscript_kind");
  assertEqual(re.projects.T11A.manuscript_access, "authoritative", "manuscript_access");

  // Now test the --no-manuscript-home path produces manuscript_kind="null"
  // and manuscript_home="".
  const pmB = freshWorkdir("schema-null");
  const configB = path.join(freshWorkdir("schema-null-cfg"), "projects.json");
  bootstrap([
    "--project", "T11B", "--pm-folder", pmB, "--phase", "idea",
    "--notes", "T11B", "--config", configB,
    "--no-manuscript-home",
  ]);
  const cfgB = JSON.parse(fs.readFileSync(configB, "utf8"));
  assertEqual(cfgB.projects.T11B.manuscript_kind, "null", "manuscript_kind=string null");
  assertEqual(cfgB.projects.T11B.manuscript_home, "", "manuscript_home empty");
  assertEqual(cfgB.projects.T11B.phase, "idea", "phase recorded");
});

// Test 12: --action repair adds missing entries to a lane's subfolders/notes indexes.
const pm12 = freshWorkdir("repair-indexes");
step("T12 repair adds missing subfolder/notes entries to lane indexes", () => {
  bootstrap([
    "--project", "T12Project", "--pm-folder", pm12, "--phase", "analysis",
    "--notes", "T12", "--config", path.join(pm12, "projects.json"),
  ]);
  // Inject drift: a new note and a new subdirectory in the analysis/ lane.
  const noteRel = "analysis/2026-06-12_drift-note.md";
  const newNote = path.join(pm12, noteRel);
  fs.writeFileSync(
    newNote,
    `---\ntitle: drift note\ncreated: 2026-06-12\nupdated: 2026-06-12\nlast_reviewed: 2026-06-12\npageType: analysis\nstatus: active\nowner: researcher\n---\n# drift note\n`,
  );
  fs.mkdirSync(path.join(pm12, "analysis/replication"));
  // Run repair.
  bootstrap([
    "--project", "T12Project", "--pm-folder", pm12,
    "--config", path.join(pm12, "projects.json"),
    "--action", "repair",
  ]);
  const analysisIndex = fs.readFileSync(path.join(pm12, "analysis/analysis.md"), "utf8");
  assert(
    analysisIndex.includes("2026-06-12_drift-note"),
    `repair did not add the new note to analysis/analysis.md index`,
  );
  assert(
    analysisIndex.includes("replication/replication"),
    `repair did not add the new subdir to analysis/analysis.md index`,
  );
  // Markers preserved.
  assert(
    analysisIndex.includes("<!-- vault-maintain:index:start -->"),
    `repair stripped the start marker from analysis/analysis.md`,
  );
  assert(
    analysisIndex.includes("<!-- vault-maintain:index:end -->"),
    `repair stripped the end marker from analysis/analysis.md`,
  );
});

  // Test 13: --action repair creates missing folder notes (required + optional).
  const pm13 = freshWorkdir("repair-missing");
  step("T13 repair recreates missing folder notes", () => {
    bootstrap([
      "--project", "T13Project", "--pm-folder", pm13, "--phase", "analysis",
      "--notes", "T13", "--config", path.join(pm13, "projects.json"),
    ]);
    // Delete a required folder note.
    fs.unlinkSync(path.join(pm13, "writing/writing.md"));
    // Create an optional folder without its folder note.
    fs.mkdirSync(path.join(pm13, "verification"));
    // Run repair.
    bootstrap([
      "--project", "T13Project", "--pm-folder", pm13,
      "--config", path.join(pm13, "projects.json"),
      "--action", "repair",
    ]);
    // Required folder note recreated from the template (contains the
    // template's distinguishing section header).
    assert(
      fs.existsSync(path.join(pm13, "writing/writing.md")),
      "repair did not recreate writing/writing.md",
    );
    const writingContent = fs.readFileSync(path.join(pm13, "writing/writing.md"), "utf8");
    assert(
      writingContent.includes("## Draft Status"),
      "recreated writing.md missing the template's Draft Status section",
    );
    // Optional folder note created.
    assert(
      fs.existsSync(path.join(pm13, "verification/verification.md")),
      "repair did not create verification/verification.md",
    );
    const verificationContent = fs.readFileSync(path.join(pm13, "verification/verification.md"), "utf8");
    assert(
      verificationContent.includes("## Active Verification Items"),
      "recreated verification.md missing the template's Active Verification Items section",
    );
    // Root index updated.
    const rootContent = fs.readFileSync(path.join(pm13, "T13Project.md"), "utf8");
    assert(
      rootContent.includes("verification/verification"),
      "repair did not add verification to the root subfolders index",
    );
  });

// Test 14: --action repair on a fresh project reports no drift detected.
const pm14 = freshWorkdir("repair-noop");
step("T14 repair on a fresh project reports no drift", () => {
  bootstrap([
    "--project", "T14Project", "--pm-folder", pm14, "--phase", "analysis",
    "--notes", "T14", "--config", path.join(pm14, "projects.json"),
  ]);
  // Capture mtime of analysis.md before repair to ensure no write happens.
  const beforeMtime = fs.statSync(path.join(pm14, "analysis/analysis.md")).mtimeMs;
  // Run repair on the fresh project (no drift injected).
  const result = spawnSync(
    "node",
    [BOOTSTRAP, "--project", "T14Project", "--pm-folder", pm14,
     "--config", path.join(pm14, "projects.json"), "--action", "repair"],
    { encoding: "utf8" },
  );
  assertEqual(result.status, 0, "repair exit code on a fresh project");
  assert(
    result.stdout.includes("no drift detected"),
    `expected "no drift detected" in repair output; got: ${result.stdout}`,
  );
  const afterMtime = fs.statSync(path.join(pm14, "analysis/analysis.md")).mtimeMs;
  assertEqual(
    beforeMtime,
    afterMtime,
    "repair rewrote analysis.md on a fresh project (should be a no-op)",
  );
});

// Test 15: --action log creates a history entry with the right structure.
const pm15 = freshWorkdir("log-create");
const config15 = path.join(pm15, "projects.json");
step("T15 --action log creates a dated history entry", () => {
  bootstrap([
    "--project", "T15Project", "--pm-folder", pm15, "--phase", "analysis",
    "--notes", "T15", "--config", config15,
  ]);
  // Create a fake touched file with proper frontmatter (analysis/ already
  // exists from bootstrap).
  fs.writeFileSync(
    path.join(pm15, "analysis/touched.md"),
    `---\ntitle: touched\ncreated: 2026-06-11\nupdated: 2026-06-11\nlast_reviewed: 2026-06-11\npageType: analysis\nstatus: active\nowner: researcher\n---\n# touched\n`,
  );
  bootstrap([
    "--project", "T15Project", "--pm-folder", pm15,
    "--config", config15,
    "--action", "log",
    "--event", "Touched the analysis file",
    "--note", "analysis/touched.md",
  ]);
  // The history entry should exist with a name derived from the event.
  const entries = fs.readdirSync(path.join(pm15, "history"))
    .filter((f) => f.startsWith("history-") && f.endsWith(".md"));
  const match = entries.find((f) => f.includes("touched-the-analysis-file"));
  assert(match, `expected an entry named after the event slug; got: ${entries.join(", ")}`);
  const content = fs.readFileSync(path.join(pm15, "history", match), "utf8");
  assert(content.includes("kind: log"), "history entry missing kind: log frontmatter");
  assert(content.includes("event: Touched the analysis file"), "history entry missing event frontmatter");
  assert(content.includes("## What Changed"), "history entry missing ## What Changed section");
  assert(content.includes("[[analysis/touched.md|analysis/touched]]"), "history entry missing wiki link to touched file");
});

// Test 16: --action log updates the affected lane Notes index.
const pm16 = freshWorkdir("log-indexes");
const config16 = path.join(pm16, "projects.json");
step("T16 --action log updates affected lane Notes index", () => {
  bootstrap([
    "--project", "T16Project", "--pm-folder", pm16, "--phase", "analysis",
    "--notes", "T16", "--config", config16,
  ]);
  fs.writeFileSync(
    path.join(pm16, "analysis/2026-06-11-foo.md"),
    `---\ntitle: foo\ncreated: 2026-06-11\nupdated: 2026-06-11\nlast_reviewed: 2026-06-11\npageType: analysis\nstatus: active\nowner: researcher\n---\n# foo\n`,
  );
  bootstrap([
    "--project", "T16Project", "--pm-folder", pm16,
    "--config", config16,
    "--action", "log",
    "--event", "Foo bar baz",
    "--note", "analysis/2026-06-11-foo.md",
  ]);
  const analysisIndex = fs.readFileSync(path.join(pm16, "analysis/analysis.md"), "utf8");
  // Should reference the new history entry by basename.
  assert(
    /history-\d{4}-\d{2}-\d{2}-foo-bar-baz/.test(analysisIndex),
    `lane Notes index missing the new history entry; got: ${analysisIndex.match(/## Notes[\s\S]*?<!-- vault-maintain:index:end -->/)?.[0] ?? "(no Notes section)"}`,
  );
  // history/history.md should also list it.
  const historyIndex = fs.readFileSync(path.join(pm16, "history/history.md"), "utf8");
  assert(
    /history-\d{4}-\d{2}-\d{2}-foo-bar-baz/.test(historyIndex),
    "history.md Notes index missing the new entry",
  );
});

// Test 17: --action log rejects invalid --note paths.
const pm17 = freshWorkdir("log-invalid-note");
const config17 = path.join(pm17, "projects.json");
step("T17 --action log rejects nonexistent --note paths", () => {
  bootstrap([
    "--project", "T17Project", "--pm-folder", pm17, "--phase", "analysis",
    "--notes", "T17", "--config", config17,
  ]);
  const result = spawnSync(
    "node",
    [BOOTSTRAP, "--project", "T17Project", "--pm-folder", pm17,
     "--config", config17, "--action", "log",
     "--event", "Bad", "--note", "nonexistent.md"],
    { encoding: "utf8" },
  );
  assert(result.status !== 0, "expected --log with invalid --note to exit non-zero");
  assert(
    /--note path does not exist/.test(result.stderr || result.stdout || ""),
    `expected error message about missing --note path; got: ${result.stderr || result.stdout}`,
  );
  // No history file should have been created.
  const entries = fs.readdirSync(path.join(pm17, "history"))
    .filter((f) => f.startsWith("history-") && /-bad$/.test(f));
  assertEqual(entries.length, 0, "expected no history entry to be created on error");
});

// Test 18: --action log errors when --event is missing.
const pm18 = freshWorkdir("log-no-event");
const config18 = path.join(pm18, "projects.json");
step("T18 --action log errors when --event is missing", () => {
  bootstrap([
    "--project", "T18Project", "--pm-folder", pm18, "--phase", "analysis",
    "--notes", "T18", "--config", config18,
  ]);
  fs.writeFileSync(
    path.join(pm18, "analysis/foo.md"),
    `---\ntitle: foo\ncreated: 2026-06-11\nupdated: 2026-06-11\nlast_reviewed: 2026-06-11\npageType: analysis\nstatus: active\nowner: researcher\n---\n# foo\n`,
  );
  const result = spawnSync(
    "node",
    [BOOTSTRAP, "--project", "T18Project", "--pm-folder", pm18,
     "--config", config18, "--action", "log",
     "--note", "analysis/foo.md"],
    { encoding: "utf8" },
  );
  assert(result.status !== 0, "expected --log without --event to exit non-zero");
  assert(
    /Missing required --event/.test(result.stderr || result.stdout || ""),
    `expected error message about missing --event; got: ${result.stderr || result.stdout}`,
  );
});

// ---------------------------------------------------------------------------

console.log("");
const passed = results.filter(r => r.status === "PASS").length;
const failed = results.filter(r => r.status === "FAIL").length;
const totalMs = results.reduce((s, r) => s + r.ms, 0);
console.log(`Results: ${passed}/${results.length} passed, ${failed} failed, ${totalMs}ms total`);

if (failed > 0) {
  console.log("");
  console.log("Failed tests:");
  for (const r of results.filter(x => x.status === "FAIL")) {
    console.log(`  - ${r.name}: ${r.error}`);
  }
  process.exit(1);
}
process.exit(0);
