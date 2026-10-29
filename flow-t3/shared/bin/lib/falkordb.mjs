// FalkorDB lifecycle helpers used by the Flow CLI.

import { FalkorDB } from "falkordb";

/**
 * Delete one project's named graph and its graph-scoped bookkeeping.
 *
 * FalkorDB is shared by every Flow project, so this deliberately deletes only
 * the requested graph. Missing graphs are treated as already clean, which
 * keeps `flow rm` safe to retry after a partially completed removal.
 */
export async function deleteProjectGraph({ graph, host = "localhost", port = 6379 }) {
  const db = await FalkorDB.connect({
    socket: {
      host,
      port: Number(port),
      connectTimeout: 3000,
      reconnectStrategy: false,
    },
  });

  try {
    const graphs = await db.list();
    const existed = graphs.includes(graph);
    if (existed) await db.selectGraph(graph).delete();

    // Gateway bookkeeping lives in plain Redis keys rather than in the graph.
    const connection = await db.connection;
    await connection.del(`flow:graph-version:${graph}`);
    await connection.del(`flow:embed-stamp:${graph}`);
    // Tombstone: FalkorDB recreates a graph on first query, so a surviving
    // client would resurrect it as an orphan. The gateway refuses writes to
    // tombstoned graphs; `flow up` clears the tombstone on legitimate reuse.
    await connection.set(`flow:graph-deleted:${graph}`, new Date().toISOString());
    return { existed };
  } finally {
    await db.close();
  }
}

/**
 * Clear a graph's deletion tombstone — called by `flow up` so a project that
 * legitimately reuses the name (recreate after rm) can write again.
 */
export async function clearGraphTombstone({ graph, host = "localhost", port = 6379 }) {
  const db = await FalkorDB.connect({
    socket: {
      host,
      port: Number(port),
      connectTimeout: 3000,
      reconnectStrategy: false,
    },
  });
  try {
    const connection = await db.connection;
    await connection.del(`flow:graph-deleted:${graph}`);
  } finally {
    await db.close();
  }
}
