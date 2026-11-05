-- Soft shadow below the vehicle on a level with a material (docs/contracts/level-visuals.md). Visual only: reads wheel
-- positions and the course's driving lines, never physics state. A level's lines are indexed once by metre of x.
local material=require 'main.terrain_perspective.material'
local M={WIDTH_FACTOR=1.7,FADE_HEIGHT=4,MIN_SCALE=.4,ALPHA=.5,MIN_ALPHA=.08,ABOVE=.25,IMAGE_WIDTH=256}
function M.index(chains)
    local buckets={}
    for _,chain in ipairs(chains) do
        for i=1,#chain-1 do
            local a,b=chain[i],chain[i+1]
            if a[1]~=b[1] then
                for x=math.floor(math.min(a[1],b[1])),math.floor(math.max(a[1],b[1])) do
                    local list=buckets[x];if not list then list={};buckets[x]=list end
                    list[#list+1]={a,b}
                end
            end
        end
    end
    return buckets
end
-- The highest line at x that is not above the wheels, with its slope angle.
function M.ground(buckets,x,y)
    local best,angle
    for _,s in ipairs(buckets[math.floor(x)] or {}) do
        local a,b=s[1],s[2]
        if x>=math.min(a[1],b[1]) and x<=math.max(a[1],b[1]) then
            local v=a[2]+(b[2]-a[2])*(x-a[1])/(b[1]-a[1])
            if v<=y+M.ABOVE and (not best or v>best) then best=v;angle=math.atan((b[2]-a[2])/(b[1]-a[1])) end
        end
    end
    return best,angle
end
function M.look(height)
    local t=math.min(1,math.max(0,height)/M.FADE_HEIGHT)
    return 1+(M.MIN_SCALE-1)*t,M.ALPHA+(M.MIN_ALPHA-M.ALPHA)*t
end
function M.update(self)
    local v=self.vehicle;local state=self.terrain_mesh
    if not material.spec() or not v or not v.ready or not state or not state.source then return end
    if state.shadow_source~=state.source then state.shadow_source=state.source;state.shadow_index=M.index(state.source.chains) end
    local scale=sys.get_config_number('physics.scale',.01)
    local a,b=go.get_position(v.ids[1]),go.get_position(v.ids[2])
    local radius=require('main.game.feel').values.wheel_radius or 22
    local x=(a.x+b.x)/2
    local lowest=(math.min(a.y,b.y)-radius)*scale
    local z=go.get_position(v.ids.chassis).z-.01
    if not state.shadow then state.shadow=factory.create('#vehicle_shadow',vmath.vector3(x,lowest/scale,z)) end
    local id=state.shadow;local url=msg.url(nil,id,'sprite')
    local y,angle=M.ground(state.shadow_index,x*scale,lowest)
    if not y then go.set(url,'tint.w',0);return end
    local height=lowest-y
    local size,alpha=M.look(height)
    size=size*math.abs(a.x-b.x)*M.WIDTH_FACTOR/M.IMAGE_WIDTH
    go.set_position(vmath.vector3(x,y/scale,z),id)
    go.set_rotation(vmath.quat_rotation_z(angle),id)
    go.set_scale(vmath.vector3(size,size,1),id)
    go.set(url,'tint.w',alpha)
    if html5 and sys.get_engine_info().is_debug then
        html5.run(('window.riderVehicleShadow={height:%.3f,size:%.3f,alpha:%.3f}'):format(height,size,alpha))
    end
end
return M
