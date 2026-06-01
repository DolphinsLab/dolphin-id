# @dolphin-id/hosted

`@dolphin-id/hosted` contains the hosted nonce/session service primitives used
to offer Dolphin ID as an optional managed service while keeping the
self-hosted server SDK available.

It provides project API keys, allowed domain enforcement, project-scoped hosted
session reads, quota checks, billing hooks, and audit logs around the same
`@dolphin-id/server` auth core.

For production deployments, pass `runtimeEnvironment: "production"` and a
strong `jwtSecret`. Hosted project allow-lists accept exact hostnames or
`hostname:port` entries, and authenticated nonce, verification, and session
read failures are written to the audit log without raw API keys or tokens.
