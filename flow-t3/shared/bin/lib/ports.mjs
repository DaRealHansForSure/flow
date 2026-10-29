// Ports per project: gateway 7433 and orchestrator 7500, plus 10 * the project's
// index in the sorted project list. One dashboard at 7600 for the deployment
// (the per-index slot stays allocated for legacy cleanup). FLOW_PORT_OFFSET
// shifts every base so a second deployment can run beside a live one.

const OFFSET = Number(process.env.FLOW_PORT_OFFSET ?? 0) || 0;

export const BASE_GATEWAY = 7433 + OFFSET;
export const BASE_ORCHESTRATOR = 7500 + OFFSET;
export const BASE_DASHBOARD = 7600 + OFFSET;
export const PORT_STRIDE = 10;

/**
 * Return {gateway, orchestrator, dashboard} ports for a given project index.
 * @param {number} index  0-based index into the sorted project list
 */
export function portsForIndex(index) {
  return {
    gateway: BASE_GATEWAY + PORT_STRIDE * index,
    orchestrator: BASE_ORCHESTRATOR + PORT_STRIDE * index,
    dashboard: BASE_DASHBOARD + PORT_STRIDE * index,
  };
}

/** The single deployment-wide dashboard port. */
export function dashboardPort() {
  return BASE_DASHBOARD;
}
