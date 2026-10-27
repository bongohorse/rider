-- Sprite-only pickup. Positions cross the metre/engine boundary once here.
local M={}
function M.position(id,p)
    local scale=sys.get_config_number('physics.scale',.01)
    go.set_position(vmath.vector3(p[1]/scale,p[2]/scale,2),id)
end
function M.create(p)
    local id=factory.create('#coin');M.position(id,p);return id
end
return M
