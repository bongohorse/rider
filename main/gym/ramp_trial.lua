-- Debug-only tick-command driver; same sole owner and vehicle.apply as play.
-- It removes browser navigation/keyboard latency from the speed-start protocol.
local M={}
function M.command(station)
    local section=station.sections and station.sections[station.section_index]
    return {throttle=section and section.mode=="up" and 1 or 0,brake_reverse=0,lean=0,allow_reverse=false}
end
return M
