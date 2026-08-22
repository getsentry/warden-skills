/** Return a stable label for the Warden v0.47.0 production smoke test. */
export function formatSmokeTestLabel(runId: string): string {
  return `warden-smoke:${runId}`;
}
