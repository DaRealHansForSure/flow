import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { beforeEach, vi } from "vite-plus/test";

const { handleMock, netFetchMock, unhandleMock } = vi.hoisted(() => ({
  handleMock: vi.fn(),
  netFetchMock: vi.fn(),
  unhandleMock: vi.fn(),
}));

vi.mock("electron", () => ({
  net: { fetch: netFetchMock },
  protocol: { handle: handleMock, unhandle: unhandleMock },
}));

import * as ElectronProtocol from "./ElectronProtocol.ts";

const layerProtocol = ElectronProtocol.layer.pipe(Layer.provide(NodeServices.layer));

describe("ElectronProtocol", () => {
  beforeEach(() => {
    handleMock.mockReset();
    netFetchMock.mockReset();
    unhandleMock.mockReset();
  });

  it.effect("serves the bundled client from disk without a backend", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const directory = yield* fileSystem.makeTempDirectoryScoped();
      yield* fileSystem.writeFileString(`${directory}/index.html`, "<html>app</html>");
      yield* fileSystem.writeFileString(`${directory}/app.js`, "export default 1;");
      let handler: ((request: Request) => Promise<Response>) | undefined;
      handleMock.mockImplementation((_scheme, nextHandler) => {
        handler = nextHandler;
      });
      const protocol = yield* ElectronProtocol.ElectronProtocol;
      yield* protocol.registerDesktopProtocol({
        scheme: "flow",
        assetDirectory: directory,
        clerkFrontendApiHostname: undefined,
      });
      const request = (pathname: string, init?: RequestInit) =>
        Effect.promise(() => handler!(new Request(`flow://app${pathname}`, init)));

      const page = yield* request("/settings/connections");
      assert.equal(yield* Effect.promise(() => page.text()), "<html>app</html>");
      assert.include(page.headers.get("content-security-policy") ?? "", "default-src 'self'");
      const dottedRoute = yield* request("/environment/thread.with.dots", {
        headers: { accept: "text/html" },
      });
      assert.equal(yield* Effect.promise(() => dottedRoute.text()), "<html>app</html>");

      const script = yield* request("/app.js?v=1");
      assert.equal(yield* Effect.promise(() => script.text()), "export default 1;");
      assert.include(script.headers.get("content-type") ?? "", "javascript");

      assert.equal((yield* request("/missing.js")).status, 404);
      assert.equal((yield* request("/%2e%2e%2fsecret.txt")).status, 404);
      assert.equal((yield* request("/%invalid")).status, 400);
      assert.equal((yield* request("/", { method: "POST" })).status, 405);
      assert.equal(netFetchMock.mock.calls.length, 0);
    }).pipe(Effect.provide(Layer.merge(layerProtocol, NodeServices.layer)), Effect.scoped),
  );

  it.effect("proxies the stable renderer origin to the current app server", () =>
    Effect.gen(function* () {
      let handler: ((request: Request) => Promise<Response>) | undefined;
      handleMock.mockImplementation((_scheme, nextHandler) => {
        handler = nextHandler;
      });
      netFetchMock.mockResolvedValue(new Response("ok"));

      yield* Effect.scoped(
        Effect.gen(function* () {
          const protocol = yield* ElectronProtocol.ElectronProtocol;
          yield* protocol.registerDesktopProtocol({
            scheme: "flow-dev",
            targetOrigin: new URL("http://127.0.0.1:3773/"),
            clerkFrontendApiHostname: "clerk.t3.codes",
          });
          assert.isDefined(handler);

          const response = yield* Effect.promise(() =>
            handler!(
              new Request("flow-dev://app/api/health?verbose=1", {
                headers: {
                  accept: "application/json",
                  origin: "flow-dev://app",
                  referer: "flow-dev://app/",
                  "sec-fetch-site": "same-origin",
                },
              }),
            ),
          );
          assert.equal(yield* Effect.promise(() => response.text()), "ok");
          assert.include(
            response.headers.get("content-security-policy") ?? "",
            "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://clerk.t3.codes https://challenges.cloudflare.com",
          );
          assert.include(
            response.headers.get("content-security-policy") ?? "",
            "connect-src 'self' blob: http: https: ws: wss:",
          );
          assert.include(
            response.headers.get("content-security-policy") ?? "",
            "img-src 'self' flow-dev: blob: data: http: https:",
          );
          assert.include(
            response.headers.get("content-security-policy") ?? "",
            "font-src 'self' flow-dev: data:",
          );
        }),
      );

      assert.deepEqual(
        handleMock.mock.calls.map((call) => call[0]),
        ["flow-dev"],
      );
      assert.equal(netFetchMock.mock.calls[0]?.[0], "http://127.0.0.1:3773/api/health?verbose=1");
      const forwardedHeaders = new Headers(netFetchMock.mock.calls[0]?.[1]?.headers);
      assert.equal(forwardedHeaders.get("accept"), "application/json");
      assert.isNull(forwardedHeaders.get("origin"));
      assert.isNull(forwardedHeaders.get("referer"));
      assert.isNull(forwardedHeaders.get("sec-fetch-site"));
      assert.deepEqual(unhandleMock.mock.calls, [["flow-dev"]]);
    }).pipe(Effect.provide(layerProtocol)),
  );

  it.effect("rejects custom protocol requests for another host", () =>
    Effect.gen(function* () {
      let handler: ((request: Request) => Promise<Response>) | undefined;
      handleMock.mockImplementation((_scheme, nextHandler) => {
        handler = nextHandler;
      });

      const response = yield* Effect.scoped(
        Effect.gen(function* () {
          const protocol = yield* ElectronProtocol.ElectronProtocol;
          yield* protocol.registerDesktopProtocol({
            scheme: "flow",
            targetOrigin: new URL("http://127.0.0.1:3773/"),
            clerkFrontendApiHostname: undefined,
          });
          return yield* Effect.promise(() => handler!(new Request("flow://other/")));
        }),
      );

      assert.equal(response.status, 404);
      assert.equal(netFetchMock.mock.calls.length, 0);
    }).pipe(Effect.provide(layerProtocol)),
  );
  it.effect("follows the attached server as it changes, resolving per request", () =>
    Effect.gen(function* () {
      let handler: ((request: Request) => Promise<Response>) | undefined;
      handleMock.mockImplementation((_scheme, nextHandler) => {
        handler = nextHandler;
      });
      netFetchMock.mockResolvedValue(new Response("ok"));
      let target = new URL("http://127.0.0.1:3773/");

      yield* Effect.scoped(
        Effect.gen(function* () {
          const protocol = yield* ElectronProtocol.ElectronProtocol;
          yield* protocol.registerDesktopProtocol({
            scheme: "flow",
            resolveTarget: () => Effect.sync(() => Option.some(target)),
            assetDirectory: "/nonexistent-client",
            clerkFrontendApiHostname: undefined,
          });

          yield* Effect.promise(() => handler!(new Request("flow://app/api/health")));
          target = new URL("http://127.0.0.1:9999/");
          yield* Effect.promise(() => handler!(new Request("flow://app/api/health")));
        }),
      );

      assert.deepEqual(
        netFetchMock.mock.calls.map((call) => call[0]),
        ["http://127.0.0.1:3773/api/health", "http://127.0.0.1:9999/api/health"],
      );
    }).pipe(Effect.provide(layerProtocol)),
  );

  it.effect("falls back to the bundled client while no Flow service is attached", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const directory = yield* fileSystem.makeTempDirectoryScoped();
      yield* fileSystem.writeFileString(`${directory}/index.html`, "<html>shell</html>");
      let handler: ((request: Request) => Promise<Response>) | undefined;
      handleMock.mockImplementation((_scheme, nextHandler) => {
        handler = nextHandler;
      });
      const protocol = yield* ElectronProtocol.ElectronProtocol;
      yield* protocol.registerDesktopProtocol({
        scheme: "flow",
        resolveTarget: () => Effect.succeedNone,
        assetDirectory: directory,
        clerkFrontendApiHostname: undefined,
      });
      const request = (pathname: string) =>
        Effect.promise(() =>
          handler!(new Request(`flow://app${pathname}`, { headers: { accept: "text/html" } })),
        );

      const page = yield* request("/unknown/route");
      assert.equal(yield* Effect.promise(() => page.text()), "<html>shell</html>");
      assert.include(page.headers.get("content-security-policy") ?? "", "default-src 'self'");

      for (const path of ["/api/x", "/ws", "/oauth/callback", "/.well-known/t3/environment"]) {
        const response = yield* request(path);
        assert.equal(response.status, 503);
        assert.deepEqual((yield* Effect.promise(() => response.json())) as unknown, {
          error: "flow-service-unavailable",
          detail: "The Flow service is not reachable.",
        });
        assert.include(response.headers.get("content-security-policy") ?? "", "default-src 'self'");
      }
      assert.equal(netFetchMock.mock.calls.length, 0);
    }).pipe(Effect.provide(Layer.merge(layerProtocol, NodeServices.layer)), Effect.scoped),
  );
});
