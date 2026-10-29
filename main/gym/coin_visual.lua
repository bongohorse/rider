-- Sprite-only pickup. Positions cross the metre/engine boundary once here.
local M={}
function M.position(id,p)
    local scale=sys.get_config_number('physics.scale',.01)
    go.set_position(vmath.vector3(p[1]/scale,p[2]/scale,2),id)
end
function M.scale(id,kind,factor)
    local s=(kind=='gem' and 1.44 or 1)*factor
    go.set_scale(vmath.vector3(s,s,1),id)
end
function M.create(p,kind)
    local id=factory.create('#coin');M.position(id,p);M.scale(id,kind,1);if kind=='gem' then sprite.play_flipbook(msg.url(nil,id,'sprite'),'wonder-gem') end;return id
end
return M
