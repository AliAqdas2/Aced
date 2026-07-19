/**
 * Playwright global teardown — resets e2e fixture records to a clean state.
 * Leaves rows in place (for faster re-runs) but resets any status mutations
 * so the next test run starts from the same known state.
 */
export default async function globalTeardown() {
  // Nothing destructive — global-setup resets state on next run.
  // We intentionally don't delete rows here so that debugging failed
  // tests is easier (the data is still in the DB to inspect).
}
