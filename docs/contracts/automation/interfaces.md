# Distinct automation interfaces

1. Editor HTTP API: resources, builds, console and editor tasks for an open project; the running editor's `/openapi.json` is authoritative. Experimental.
2. Engine service: a separate process with a dynamic port per running debug engine, e.g. `/ping` and `/info`; not the editor API. Release must not expose debug services.
3. Automation Bridge: pinned debug native extension with versioned runtime inspection/input/screenshot routes. Negotiate actual platform capabilities; it is not HTML5 browser automation or a physics binding.

Official Bob/HTTP automation is an approved standard path; community MCP is optional and may be deferred with a reason without an extra approval for the standard path. Missing required standard capabilities block only affected work. Never claim inaccessible capabilities or assume an editor/session. Observe the owned process's port rather than hardcoding or scanning. Keep debug services private to the trusted development host/network; do not publish HTTP servers.
