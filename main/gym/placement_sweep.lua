-- Debug le1a only: runs the full vehicle reset (and its pose guards) at many start positions in one live world.
-- Positions follow a golden-ratio sequence, so they are fractional and dense rather than a coarse grid.
local vehicle=require "main.gym.vehicle"
local feel=require "main.gym.feel"
local M={}
function M.run(v,spec)
    assert(sys.get_engine_info().is_debug,"Placement sweep requires debug engine")
    local scale=sys.get_config_number("physics.scale",0.01)
    local home_x,home_y=feel.values.spawn_x,feel.values.spawn_y
    local result={count=0,failed=0,max_error=0,failures={}}
    for i=1,spec.count do
        local x=spec.from+(spec.to-spec.from)*((i*0.6180339887498949)%1)
        if i==1 then x=spec.from elseif i==2 then x=spec.to end
        local y=spec.heights[(i-1)%#spec.heights+1]
        feel.values.spawn_x,feel.values.spawn_y=x/scale,y/scale
        local ok,err=pcall(vehicle.reset,v)
        result.count=result.count+1
        if ok then
            for j,b in ipairs({v.chassis,v.wheels[1],v.wheels[2]}) do
                local p=b2d.body.get_position(b)
                local ex=feel.values.spawn_x+(j>1 and feel.values.wheel_x[j-1] or 0)
                local ey=feel.values.spawn_y+(j>1 and feel.values.wheel_y or 0)
                result.max_error=math.max(result.max_error,math.abs(p.x-ex),math.abs(p.y-ey))
            end
        else
            result.failed=result.failed+1
            if #result.failures<5 then result.failures[#result.failures+1]={x=x,y=y,error=tostring(err)} end
        end
    end
    feel.values.spawn_x,feel.values.spawn_y=home_x,home_y
    vehicle.reset(v)
    return result
end
return M
