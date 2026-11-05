-- #536 experiment: soft shadow below the vehicle on the textured test route. Visual only: reads vehicle positions and
-- the course's driving lines, never physics state. A linear search per frame is fine for the test course; a real
-- version needs an indexed lookup for full-size levels.
local material=require 'main.terrain_perspective.material'
local M={WIDTH_FACTOR=1.7,FADE_HEIGHT=4,MIN_SCALE=.4,ALPHA=.85,MIN_ALPHA=.2}
local function ground(chains,x,y)
    local best,angle
    for _,chain in ipairs(chains) do
        for i=1,#chain-1 do
            local a,b=chain[i],chain[i+1]
            if x>=math.min(a[1],b[1]) and x<=math.max(a[1],b[1]) and a[1]~=b[1] then
                local v=a[2]+(b[2]-a[2])*(x-a[1])/(b[1]-a[1])
                if v<=y+.25 and (not best or v>best) then
                    best=v;angle=math.atan((b[2]-a[2])/(b[1]-a[1]))
                end
            end
        end
    end
    return best,angle
end
function M.update(self)
    local v=self.vehicle;local state=self.terrain_mesh
    if not material.spec() or not v or not v.ready or not state or not state.source then return end
    local scale=sys.get_config_number('physics.scale',.01)
    local a,b=go.get_position(v.ids[1]),go.get_position(v.ids[2])
    local radius=require('main.game.feel').values.wheel_radius or 22
    local x=(a.x+b.x)/2
    local lowest=(math.min(a.y,b.y)-radius)*scale
    local y,angle=ground(state.source.chains,x*scale,lowest)
    if not self.vehicle_shadow then
        self.vehicle_shadow=factory.create('#vehicle_shadow',vmath.vector3(x,lowest/scale,go.get_position(v.ids.chassis).z-.01))
    end
    local id=self.vehicle_shadow;local url=msg.url(nil,id,'sprite')
    if not y then
        go.set(url,'tint.w',0)
        if html5 then html5.run('window.riderVehicleShadow={height:null}') end
        return
    end
    local height=math.max(0,lowest-y)
    local t=math.min(1,height/M.FADE_HEIGHT)
    local size=math.abs(a.x-b.x)*M.WIDTH_FACTOR/256*(1-(1-M.MIN_SCALE)*t)
    local alpha=M.ALPHA+(M.MIN_ALPHA-M.ALPHA)*t
    go.set_position(vmath.vector3(x,y/scale,go.get_position(v.ids.chassis).z-.01),id)
    go.set_rotation(vmath.quat_rotation_z(angle),id)
    go.set_scale(vmath.vector3(size,size,1),id)
    go.set(url,'tint.w',alpha)
    if html5 and sys.get_engine_info().is_debug then
        html5.run(('window.riderVehicleShadow={height:%.3f,size:%.3f,alpha:%.3f}'):format(height,size,alpha))
    end
end
return M
