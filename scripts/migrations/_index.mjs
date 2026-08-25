/**
 * migrations/_index.mjs
 *
 * Ordered registry of migration module specifiers. The runner applies
 * migrations in the order they appear here. Each module is a small,
 * self-contained migration with `id`, `to`, `describe`, `detect()`, and
 * `apply()`.
 *
 * To add a new migration:
 *   1. Drop a new file in this directory (e.g. `1.3.0-foo.mjs`).
 *   2. Add its filename to the array below, in the order it should run.
 *   3. Update `CHANGELOG.md` with the new migration under the version
 *      that introduces the change.
 */
export default [
  "1.2.0-registry-manuscript-defaults.mjs",
];
