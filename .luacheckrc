-- Luacheck configuration for Rider (#400). Run through `python tools/ci/lint_lua.py`,
-- which uses the SHA-256-pinned luacheck from tools/ci/luacheck-lock.json.
-- Defold runs game Lua on LuaJIT (Lua 5.1 + bit/jit); HTML5 uses Lua 5.1, a subset.
std = "luajit"

-- Rider keeps compact one-line statements; line length is not a correctness signal.
max_line_length = false
-- Defold lifecycle callbacks and shared interfaces keep their full argument lists. This also
-- disables unused loop variables (W213).
unused_args = false
-- Shadowing/redefinition (41x-43x, 32 sites today, mostly in long GUI scripts) is not renamed
-- here: churn without a behaviour change. Undefined globals, unused values and dead code stay errors.
ignore = { "41.", "42.", "43." }

local defold = {
    "b2d", "buffer", "camera", "collectionfactory", "collectionproxy", "crash", "factory", "font",
    "go", "graphics", "gui", "hash", "hash_to_hex", "html5", "http", "image", "json", "label",
    "liveupdate", "model", "msg", "particlefx", "physics", "pprint", "profiler", "render",
    "resource", "socket", "sound", "sprite", "sys", "tilemap", "timer", "types", "vmath",
    "window", "zlib",
}
local callbacks = { "init", "final", "update", "fixed_update", "late_update", "on_message", "on_input", "on_reload" }

read_globals = defold
-- Only Defold script components may define the lifecycle callbacks as globals.
for _, pattern in ipairs({ "**/*.script", "**/*.gui_script", "**/*.render_script" }) do
    files[pattern] = { globals = callbacks }
end

-- Native debug Bridge extension module; only the debug Bridge fixture GUI reads it.
files["main/bridge/**"] = { read_globals = { "automation_bridge" } }

-- Host-side test/check scripts run under Bob's LuaJIT and install Defold API stubs as globals.
-- (and may capture `print`). They also assert on one value of a multi-value result (`local ok, err, unknown = f()`).
local stub_globals = { "io", "os", "print" }
for _, name in ipairs(defold) do stub_globals[#stub_globals + 1] = name end
files["tests/**"] = { globals = stub_globals, unused_secondaries = false }
files["tools/**"] = { globals = stub_globals, unused_secondaries = false }
