// lib/paths.mjs — Canonical path helpers relative to flow/ root.

import * as NodeURL from "node:url";
import * as NodePath from "node:path";

// flow/ root is two levels up from bin/lib/
const __filename = NodeURL.fileURLToPath(import.meta.url);
const FLOW_ROOT = NodePath.dirname(NodePath.dirname(NodePath.dirname(__filename)));

export const flowRoot = FLOW_ROOT;

/** Absolute path to data/projects/<name> */
export function projectDir(name) {
  return NodePath.join(FLOW_ROOT, "data", "projects", name);
}

/** Absolute path to data/projects/<name>/project.json */
export function projectJsonPath(name) {
  return NodePath.join(projectDir(name), "project.json");
}

/** Absolute path to data/projects/<name>/pids.json */
export function pidsJsonPath(name) {
  return NodePath.join(projectDir(name), "pids.json");
}

/** Absolute path to flow/data/projects/ */
export function projectsRoot() {
  return NodePath.join(FLOW_ROOT, "data", "projects");
}

/** Absolute path to graph-gateway/ inside flow/ */
export function gatewayDir() {
  return NodePath.join(FLOW_ROOT, "graph-gateway");
}

/** Absolute path to orchestrator/ inside flow/ */
export function orchestratorDir() {
  return NodePath.join(FLOW_ROOT, "orchestrator");
}

/** Absolute path to dashboard/ inside flow/ */
export function dashboardDir() {
  return NodePath.join(FLOW_ROOT, "dashboard");
}

/** Absolute path to index-workspace/ (template for per-project workspaces) */
export function indexWorkspaceDir() {
  return NodePath.join(FLOW_ROOT, "index-workspace");
}
