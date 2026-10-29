// pnpm's workspace junctions store absolute paths into the build machine, and
// copying targets fails because Node will not strip types under node_modules.
// So the build records and removes every link, and the installer recreates them
// where the release lands (restoreLinks in flow-release.mjs).
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";
import { linkManifest } from "./flow-release.mjs";

const portable = (path) => path.split(NodePath.sep).join("/");

/** Record every link under `root` in the manifest, then remove it. A link to a
    file is replaced by a copy, since only directories can be junctions. */
export async function recordLinks(root) {
  const links = [];
  const visit = async (directory) => {
    for (const entry of await NodeFSP.readdir(directory, { withFileTypes: true })) {
      const path = NodePath.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        const target = await NodeFSP.realpath(path).catch(() => null);
        const inside = target && !NodePath.relative(root, target).startsWith("..");
        const stat = inside ? await NodeFSP.stat(target) : null;
        // rm without `recursive` removes the link itself, never its target.
        await NodeFSP.rm(path);
        if (stat?.isDirectory())
          links.push({
            path: portable(NodePath.relative(root, path)),
            target: portable(NodePath.relative(NodePath.dirname(path), target)),
          });
        else if (stat) await NodeFSP.copyFile(target, path);
        // A link that dangles or leaves the bundle could never work once
        // installed; dropping it here keeps the failure on the build machine.
      } else if (entry.isDirectory()) await visit(path);
    }
  };
  await visit(root);
  await NodeFSP.writeFile(NodePath.join(root, linkManifest), JSON.stringify(links) + "\n");
  return links.length;
}
