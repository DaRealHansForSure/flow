// lib/projects.mjs — Read/write project.json files and enumerate projects.

import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import { projectJsonPath, projectsRoot, pidsJsonPath } from "./paths.mjs";

/**
 * Read project.json for a given project name.
 * Throws if the project doesn't exist.
 */
export function readProject(name) {
  const p = projectJsonPath(name);
  if (!NodeFS.existsSync(p)) {
    throw new Error(`Project "${name}" not found. Run: flow project create ${name}`);
  }
  return JSON.parse(NodeFS.readFileSync(p, "utf-8"));
}

/**
 * Write project.json for a given project name.
 */
export function writeProject(name, data) {
  NodeFS.writeFileSync(projectJsonPath(name), JSON.stringify(data, null, 2) + "\n", "utf-8");
}

/**
 * Return sorted list of all project names in data/projects/.
 */
export function listProjectNames() {
  const root = projectsRoot();
  if (!NodeFS.existsSync(root)) return [];
  return NodeFS.readdirSync(root)
    .filter((d) => NodeFS.existsSync(NodePath.join(root, d, "project.json")))
    .sort();
}

/**
 * Return all projects as {name, project} objects.
 */
export function listProjects() {
  return listProjectNames().map((name) => ({
    name,
    project: readProject(name),
  }));
}

/**
 * Read pids.json for a project, returns {} if missing.
 */
export function readPids(name) {
  const p = pidsJsonPath(name);
  if (!NodeFS.existsSync(p)) return {};
  try {
    return JSON.parse(NodeFS.readFileSync(p, "utf-8"));
  } catch {
    return {};
  }
}

/**
 * Write pids.json for a project.
 */
export function writePids(name, pids) {
  NodeFS.writeFileSync(pidsJsonPath(name), JSON.stringify(pids, null, 2) + "\n", "utf-8");
}
