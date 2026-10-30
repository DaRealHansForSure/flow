import { describe, expect, it } from "vite-plus/test";

import { withWaylandVulkanDisabled } from "./WaylandVulkan.ts";

const wayland = { XDG_SESSION_TYPE: "wayland" };

describe("withWaylandVulkanDisabled", () => {
  it.each([
    ["adds Vulkan on a Wayland session", wayland, null, null, null, "Vulkan"],
    ["keeps earlier disabled features", wayland, null, null, "A,B", "A,B,Vulkan"],
    [
      "detects Wayland from WAYLAND_DISPLAY",
      { WAYLAND_DISPLAY: "wayland-0" },
      null,
      null,
      null,
      "Vulkan",
    ],
    ["follows an explicit wayland ozone switch", {}, "wayland", null, null, "Vulkan"],
    ["leaves X11 sessions alone", { XDG_SESSION_TYPE: "x11" }, null, null, "A", "A"],
    ["leaves a forced X11 backend alone", wayland, "x11", null, null, null],
    ["respects Vulkan the user enabled", wayland, null, "Vulkan", null, null],
    ["does not add Vulkan twice", wayland, null, null, "Vulkan", "Vulkan"],
  ] as const)("%s", (_name, env, ozonePlatform, enableFeatures, disableFeatures, expected) => {
    expect(withWaylandVulkanDisabled({ env, ozonePlatform, enableFeatures, disableFeatures })).toBe(
      expected,
    );
  });
});
