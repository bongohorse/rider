-- Pure draw transforms for compiled decorations. Metres in, engine units out, converted once here.
local assets=require('main.decorations.assets').ASSETS
local M={PPM=96,BODY_TINT={.42,.38,.36,1},
    -- Terrain meshes draw at -2..-2.8 and write depth, the vehicle at 0..1, pickups at 2.
    Z={behind=-3,body=-1.5,front=3}}
function M.transform(item,scale)
    local a=assets[item.asset]
    -- The sprite is centred; lift its centre along the object's own up axis, base sunk into the ground.
    local size=item.scale or 1
    local lift=(a.height/2-a.sink)*size
    local x,y=item.position[1]-math.sin(item.angle)*lift,item.position[2]+math.cos(item.angle)*lift
    return {x=x/scale,y=y/scale,z=M.Z[item.placement],angle=item.angle,scale=size/scale/M.PPM,
        -- Half diagonal in engine units: a safe visibility radius at any tilt.
        radius=size*math.sqrt(a.width*a.width+a.height*a.height)/2/scale}
end
function M.visible(t,left,right,bottom,top) return t.x+t.radius>=left and t.x-t.radius<=right and t.y+t.radius>=bottom and t.y-t.radius<=top end
return M
