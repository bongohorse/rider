-- Pause and slow motion (A20). The loader, as proxy owner, is the only writer of the world proxy's time step;
-- the controller stays the sole tick owner. State lives on the loader instance (shared Lua state), not here.
-- Pinned 1.14.0: the proxy scales its world's dt and time scale by the factor (comp_collection_proxy.cpp L430-445);
-- the world runs no fixed step (script fixed_update, Box2D step) at a time scale <= 0.001 and otherwise steps
-- with (1/60)*factor (gameobject.cpp L3187-3206). Slow motion is a time scale with smaller steps, not a replay.
local M={STEPS={1,0.5,0.25}}
function M.new() return {paused=false,index=1,seq=0} end
function M.step(t) return M.STEPS[t.index] end
-- Edit worlds always run at 1.0 (R15 stays as it was); a paused play world at 0.
function M.factor(t,edit)
    if edit then return 1 end
    return t.paused and 0 or M.step(t)
end
function M.state(t,generation)
    return {paused=t.paused,step=M.step(t),factor=M.factor(t),generation=generation,seq=t.seq}
end
function M.apply(t,proxy,edit)
    local factor=M.factor(t,edit)
    msg.post(proxy,"set_time_step",{factor=factor,mode=0})
    print("RIDER_TIME "..json.encode({factor=factor,paused=t.paused,step=M.step(t),edit=edit or false,seq=t.seq}))
end
-- One control request: "pause" toggles, "step" cycles 1.0 -> 0.5 -> 0.25 -> 1.0 (pause is kept).
function M.control(t,action)
    if action=="pause" then t.paused=not t.paused
    elseif action=="step" then t.index=t.index%#M.STEPS+1
    else return false end
    return true
end
return M
