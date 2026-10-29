import * as NodeOS from 'node:os';
import * as NodePath from 'node:path';
import * as NodeURL from 'node:url';
// Installed shims resolve their own registry even when an editor strips environment variables.
export function agentHome() {
  if (process.env.FLOW_AGENT_HOME) return process.env.FLOW_AGENT_HOME;
  const directory = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
  return NodePath.basename(directory) === 'bin' ? NodePath.dirname(directory) : NodePath.join(NodeOS.homedir(), '.flow');
}
