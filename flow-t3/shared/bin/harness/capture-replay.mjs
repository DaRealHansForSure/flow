import { agentHome } from './agent-home.mjs';
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";
const home = agentHome;
const spoolPath = project => NodePath.join(home(), "agent-capture", project);
export async function readJson(file, fallback) {
  try { return JSON.parse(await NodeFSP.readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT' && fallback !== undefined) return fallback; throw error; }
}
export async function request(binding, method, fields = {}, timeout = 30000) {
  const endpoint = await readJson(NodePath.join(binding.stateDir, 'brain-endpoint.json'));
  const url = new URL(endpoint.url);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !endpoint.token) throw Error('Flow endpoint must be an authenticated local runtime');
  const response = await fetch(url, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(timeout),
    headers: { authorization: `Bearer ${endpoint.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ method, instance: binding.instance, workspace: binding.workspace, ...fields }),
  });
  const body = await response.json();
  if (!response.ok || body.error) throw Error(body.error || `Flow returned ${response.status}`);
  return body.result;
}
export async function flush(project, binding, timeout = 1000) {
  const directory = spoolPath(project);
  const files = await NodeFSP.readdir(directory).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
  for (const name of files.filter(name => name.endsWith('.json')).sort()) {
    const file = NodePath.join(directory, name);
    const item = await readJson(file, null);
    if (!item) continue;
    await request(binding, 'hook', item, timeout);
    await NodeFSP.rm(file, { force: true });
  }
}
export async function replay(stateDir) {
  const config = await readJson(NodePath.join(home(), 'config.json'), {});
  for (const [project, binding] of Object.entries(config.projects ?? {})) {
    if (binding.connector && binding.stateDir === stateDir) await flush(project, binding, 700).catch(() => {});
  }
}
