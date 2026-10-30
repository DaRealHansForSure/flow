// Flow fork: Chromium tries Vulkan on Linux, which its Wayland backend cannot use; it then
// logs an error at every start and falls back to GL. Turning Vulkan off on Wayland skips
// the attempt and the message without changing how the window renders.

const VULKAN_FEATURE = "Vulkan";

function isWaylandSession(env: NodeJS.ProcessEnv, ozonePlatform: string | null): boolean {
  if (ozonePlatform === "x11") {
    return false;
  }
  if (ozonePlatform === "wayland") {
    return true;
  }
  return env.XDG_SESSION_TYPE === "wayland" || Boolean(env.WAYLAND_DISPLAY);
}

/** The disable-features list with Vulkan added on Wayland, or the list unchanged. */
export function withWaylandVulkanDisabled(input: {
  readonly env: NodeJS.ProcessEnv;
  readonly ozonePlatform: string | null;
  readonly enableFeatures: string | null;
  readonly disableFeatures: string | null;
}): string | null {
  if (!isWaylandSession(input.env, input.ozonePlatform)) {
    return input.disableFeatures;
  }
  const listed = (list: string | null) =>
    (list ?? "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
  if (listed(input.enableFeatures).includes(VULKAN_FEATURE)) {
    return input.disableFeatures;
  }
  const disabled = listed(input.disableFeatures);
  if (disabled.includes(VULKAN_FEATURE)) {
    return input.disableFeatures;
  }
  return [...disabled, VULKAN_FEATURE].join(",");
}
