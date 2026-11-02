-- #372 / #356 Stage A2: isolated REAL Defold debug-only runtime cadence requests.
-- No new clock, physics step, production preference, or presented-FPS claim.
-- Uses existing editor-only J/K/Home key bindings while in the debug Gym testcase.
local M={}
local KEYS={
    [hash("editor_connect")]=30, -- J
    [hash("editor_split")]=60,   -- K
    [hash("editor_fit")]=0       -- Home: Auto/variable request
}
function M.new(self)
    assert(self.testcase=="fps356runtime" and sys.get_engine_info().is_debug and html5,
        "Runtime cadence requests require the debug HTML5 Gym case")
    return {sequence=0,requested_hz=60,ever_set=false}
end
function M.input(self,action_id,action)
    local hz=KEYS[action_id]
    if hz==nil then return false end
    -- Consume both key edges; never feed these debug controls into vehicle input.
    if action.pressed then
        assert(self.fps356runtime_state and self.testcase=="fps356runtime"
            and sys.get_engine_info().is_debug and html5,"Runtime FPS debug gate lost")
        -- The actual pinned Defold API, NOT JS requestAnimationFrame throttling.
        -- This queues an engine request; its effect must be measured separately.
        sys.set_update_frequency(hz)
        local state=self.fps356runtime_state
        state.sequence=state.sequence+1
        state.requested_hz=hz
        state.ever_set=true
        local report={
            kind="defold_runtime_update_frequency_request",
            event="sys.set_update_frequency",
            source_sha=sys.get_config_string("rider.source_sha","development"),
            run_id=self.run_id,sequence=state.sequence,requested_hz=hz,
            fixed_config_hz=60,platform="debug-html5",
            presented_fps="UNKNOWN",observed_callback_hz=false
        }
        html5.run("(function(s){window.riderFps356Runtime=s;"..
            "const a=window.riderFps356RuntimeHistory||(window.riderFps356RuntimeHistory=[]);"..
            "a.push(s);if(a.length>16)a.shift();})("..json.encode(report)..")")
    end
    return true
end
function M.restore(self)
    -- sys.set_update_frequency is global. Never leak a debug rate into a later world.
    if self.fps356runtime_state and self.fps356runtime_state.ever_set then
        sys.set_update_frequency(60)
    end
end
return M
