// Plain-JS siblings of apps/server/src/cloud/bootService.ts (the T3 Cloud boot
// unit), duplicated because this bootstrap layer must not depend on the Effect
// server package and Flow's unit runs a supervisor, not a server.
// A plan is { label, nodePath, args, env, logPath, workingDirectory }.

/** systemd expands `%` specifiers, including in unquoted append-log paths. */
const escapeSpecifiers = (value) => value.replaceAll("%", "%%");

function quoteSystemdValue(value) {
  const escaped = escapeSpecifiers(value);
  return /[\s"'\\]/.test(escaped)
    ? `"${escaped.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`
    : escaped;
}

/** Plist values are emitted as XML text nodes; only these three need escaping. */
const escapeXmlText = (value) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** Pure renderer: a launch agent cannot rely on the user's shell or PATH. */
export function renderLaunchdPlist(plan) {
  // KeepAlive={SuccessfulExit:false}: the supervisor exits 1 to be restarted
  // (see supervisor.mjs). ExitTimeOut 90 matches systemd's TimeoutStopSec, as a
  // stop behind an update handoff outlasts launchd's 5s default and would be
  // SIGKILLed. ProcessType Interactive opts out of background throttling.
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">`,
    `<plist version="1.0">`,
    `<dict>`,
    `  <key>Label</key>`,
    `  <string>${escapeXmlText(plan.label)}</string>`,
    `  <key>ProgramArguments</key>`,
    `  <array>`,
    ...[plan.nodePath, ...plan.args].map((value) => `    <string>${escapeXmlText(value)}</string>`),
    `  </array>`,
    `  <key>EnvironmentVariables</key>`,
    `  <dict>`,
    ...Object.entries(plan.env).flatMap(([key, value]) => [
      `    <key>${escapeXmlText(key)}</key>`,
      `    <string>${escapeXmlText(value)}</string>`,
    ]),
    `  </dict>`,
    `  <key>WorkingDirectory</key>`,
    `  <string>${escapeXmlText(plan.workingDirectory)}</string>`,
    `  <key>RunAtLoad</key>`,
    `  <true/>`,
    `  <key>KeepAlive</key>`,
    `  <dict>`,
    `    <key>SuccessfulExit</key>`,
    `    <false/>`,
    `  </dict>`,
    `  <key>ThrottleInterval</key>`,
    `  <integer>5</integer>`,
    `  <key>ExitTimeOut</key>`,
    `  <integer>90</integer>`,
    `  <key>ProcessType</key>`,
    `  <string>Interactive</string>`,
    `  <key>StandardOutPath</key>`,
    `  <string>${escapeXmlText(plan.logPath)}</string>`,
    `  <key>StandardErrorPath</key>`,
    `  <string>${escapeXmlText(plan.logPath)}</string>`,
    `</dict>`,
    `</plist>`,
    ``,
  ].join("\n");
}

/** Pure renderer: a user unit cannot rely on the user's shell or PATH. */
export function renderSystemdUnit(plan) {
  // Restart=on-failure is the systemd half of the exit-code protocol. Agent tool
  // calls run under the supervisor and share this cgroup, so OOMPolicy=continue
  // keeps the kernel killing one greedy child from stopping the whole service,
  // and KillMode=mixed still SIGKILLs the cgroup when a graceful stop times out.
  return [
    "[Unit]",
    "Description=Flow service",
    "",
    "[Service]",
    "Type=simple",
    `WorkingDirectory=${quoteSystemdValue(plan.workingDirectory)}`,
    ...Object.entries(plan.env).map(
      ([key, value]) => `Environment=${key}=${quoteSystemdValue(value)}`,
    ),
    `ExecStart=${[plan.nodePath, ...plan.args].map(quoteSystemdValue).join(" ")}`,
    "KillMode=mixed",
    "OOMPolicy=continue",
    "Restart=on-failure",
    "RestartSec=5",
    `StandardOutput=append:${escapeSpecifiers(plan.logPath)}`,
    `StandardError=append:${escapeSpecifiers(plan.logPath)}`,
    "",
    "[Install]",
    "WantedBy=default.target",
    "",
  ].join("\n");
}
