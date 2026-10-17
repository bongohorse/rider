-- Fixed commands, no feedback or velocity correction. Uses the normal owner.
local feel=require "main.gym.feel"
local M={}
function M.command(station,freewheel)
    return {throttle=freewheel and 0 or math.min(1,math.max(0,station.start_speed/(math.abs(feel.values.motor_speed)*.22))),
        brake_reverse=0,lean=0,allow_reverse=false,measurement_freewheel=freewheel}
end
return M
