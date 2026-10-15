-- Shared Lua-state registry, explicitly keyed and released by the test-run owner.
local sessions = {}
local M = {}
function M.create(id)
    assert(not sessions[id], "duplicate session")
    sessions[id] = {generation=1}
    return sessions[id]
end
function M.get(id) return assert(sessions[id], "missing active session") end
function M.release(id) sessions[id] = nil end
return M
