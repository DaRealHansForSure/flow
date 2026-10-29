// Shared by setup and service-side agent discovery. Never source shell profiles.
import * as NodeFS from 'node:fs';
import * as NodeOS from 'node:os';
import * as NodePath from 'node:path';
import * as NodeCrypto from 'node:crypto';
const validName = name => /^[a-zA-Z0-9_-]+$/.test(name);
export function executableFile(file) {
  try { NodeFS.accessSync(file, NodeFS.constants.X_OK); return NodeFS.statSync(file).isFile(); } catch { return false; }
}
function cacheFile(command, home) { return NodePath.join(home, '.flow', 'executables', command + '.json'); }
export function rememberExecutable(command, file, { home = NodeOS.homedir() } = {}) {
  if (!validName(command) || !NodePath.isAbsolute(file) || !executableFile(file)) return;
  const destination = cacheFile(command, home), temp = destination + '.' + NodeCrypto.randomUUID();
  try {
    NodeFS.mkdirSync(NodePath.dirname(destination), { recursive: true, mode: 0o700 });
    NodeFS.writeFileSync(temp, JSON.stringify({ path: file }) + '\n', { mode: 0o600 });
    NodeFS.renameSync(temp, destination);
  } catch { try { NodeFS.unlinkSync(temp); } catch {} } // Read-only homes must still work.
}
// oxlint-disable-next-line t3code/no-global-process-runtime -- Plain Node CLI outside the Effect runtime, so HostProcess is not available.
export function executableCandidates(command, { home = NodeOS.homedir(), env = process.env, platform = process.platform, accept = () => true } = {}) {
  if (NodePath.isAbsolute(command) || command.includes('/') || command.includes('\\')) return executableFile(command) && accept(command) ? [command] : [];
  if (!validName(command)) return [];
  const names = platform === 'win32' ? [command, ...(env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean).map(ext => command + ext)] : [command];
  const candidates = dirs => [...new Set(dirs.filter(dir => NodePath.isAbsolute(dir)).flatMap(dir => names.map(name => NodePath.join(dir, name))))].filter(file => executableFile(file) && accept(file));
  // Keep explicit PATH selection/version ranking when available. Recover from a
  // minimal service PATH using the last selection, then standard install locations.
  const onPath = candidates((env.PATH ?? '').split(NodePath.delimiter));
  if (onPath.length) return onPath;
  try {
    const saved = JSON.parse(NodeFS.readFileSync(cacheFile(command, home), 'utf8')).path;
    if (typeof saved === 'string' && NodePath.isAbsolute(saved) && executableFile(saved) && accept(saved)) return [saved];
  } catch {}
  const dirs = [NodePath.join(home, '.local', 'bin'), NodePath.join(home, '.opencode', 'bin'), NodePath.join(home, '.bun', 'bin'), NodePath.join(home, '.npm-global', 'bin'), NodePath.join(home, '.claude', 'local'), '/usr/local/bin', '/opt/homebrew/bin'];
  const nvm = NodePath.join(env.NVM_DIR || NodePath.join(home, '.nvm'), 'versions', 'node');
  try { for (const version of NodeFS.readdirSync(nvm).filter(v => /^v\d+\.\d+\.\d+$/.test(v)).slice(0,100)) dirs.push(NodePath.join(nvm, version, 'bin')); } catch {}
  if (platform === 'win32' && env.APPDATA) dirs.push(NodePath.join(env.APPDATA, 'npm'));
  return candidates(dirs);
}
export function discoverExecutable(command, options = {}) {
  const file = executableCandidates(command, options)[0] ?? null;
  if (file) rememberExecutable(command, file, options);
  return file;
}
