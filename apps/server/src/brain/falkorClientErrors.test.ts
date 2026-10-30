import * as NodeEvents from "node:events";
import { describe, expect, it } from "vite-plus/test";

import { survivesFalkorClientErrors } from "./falkorClientErrors.ts";

describe("survivesFalkorClientErrors", () => {
  it("keeps a dropped FalkorDB socket from throwing", () => {
    const client = new NodeEvents.EventEmitter();
    const socketClosed = () => client.emit("error", new Error("Socket closed unexpectedly"));
    expect(socketClosed).toThrow("Socket closed unexpectedly");

    survivesFalkorClientErrors({ client });
    expect(socketClosed).not.toThrow();
  });
});
