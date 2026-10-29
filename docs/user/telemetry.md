# Product usage data

Flow sends no product usage data and no relay connection traces unless you turn them on.

To turn them on, set `T3CODE_TELEMETRY_ENABLED=true` in the server's environment before
starting it. The server then sends product usage events to Flow's PostHog project, associated
with a hashed account or installation identifier. To count how many installations one person
uses, it also sends hashed account identifiers: your T3 Connect account, your OpenAI and Claude
accounts when you are signed in, and a random identifier for each device that connects. Events
include the provider, model, reasoning effort, permission mode, turn result, duration, release
channel, and main-agent token totals when available. Flow also records Brain setup, repository
indexing outcomes, anonymous tool usage, and background curation health. The same switch turns
on relay connection traces to Axiom, which diagnose T3 Connect connectivity, in builds that carry
a tracing endpoint.

Events do not include prompts, responses, file contents, authentication tokens, conversation IDs,
raw provider events, or child-agent output. Child-agent token use is excluded from the totals.

Relay tracing stays off when `T3CODE_OTEL_SDK_DISABLED` or `OTEL_SDK_DISABLED` turns
OpenTelemetry export off. The web app in a browser, including one the `t3` CLI opens, does not
read these variables.

The desktop app reads `T3CODE_TELEMETRY_ENABLED` from your shell profile (for example
`~/.zshrc`) on macOS and Linux, so export it there and restart the app. On Windows, set it as a
user environment variable.

## Mobile app crash reports

The iOS and Android app sends no crash reports unless you turn on **Send crash reports** in
**Settings > About > Diagnostics**. A report holds the error message, the stack trace, the app
version, and the device model and OS version; each launch then also sends startup timings, and
every report carries a random ID for the install. Reports go through the T3 Connect relay to
Axiom. They do not include your threads, prompts, or connection details, but an error message
can quote a value the app was handling.

## Export diagnostics to your own receiver

To send traces, metrics, or logs to an OpenTelemetry receiver, open
**Settings > Maintenance > Diagnostics**, select an environment, and enter each signal's OTLP HTTP
endpoint under **OpenTelemetry export** (for example `http://localhost:4318/v1/traces`). Save, then
restart that environment's server. The receiver must be reachable from the server's machine.
**Test** sends an empty export from the server to check an endpoint before or after you save it;
saved endpoints are checked when the section opens. Checks send authentication headers only to
the signal's currently running endpoint and do not follow redirects. To check a new endpoint
that requires authentication, save it and restart the server first.

`T3CODE_OTLP_*_URL` and standard `OTEL_EXPORTER_OTLP_*` environment variables override the saved
settings. An overridden signal shows **Set by environment** and names the variable that set it, and its
**Test** checks the running endpoint instead of the field. For endpoints saved here or set with `T3CODE_OTLP_*_URL`, set `T3CODE_OTLP_HEADERS` for
receivers that need authentication and `T3CODE_OTLP_PROTOCOL=http/protobuf` for receivers that do
not accept JSON. An endpoint set with `OTEL_EXPORTER_OTLP_*` takes its headers and protocol from
`OTEL_EXPORTER_OTLP_HEADERS` and `OTEL_EXPORTER_OTLP_PROTOCOL` instead.
