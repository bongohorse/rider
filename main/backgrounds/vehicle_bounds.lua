-- Visual-only conservative bound for the shipped Buggy. Its root GOs are in the
-- untransformed gym collection; the rider is a child of the chassis. No body API.
local M={}
function M.low(ids,scale)
    local chassis=go.get_position(ids.chassis)
    local rider=go.get_position(ids.rider)
    -- Half diagonals incl. sprite offsets: chassis <=80 u, rider <=70 u, wheels <=40 u.
    -- The rider's current local offset can rotate with the chassis: bound its full radius.
    local low=math.min(chassis.y-80,chassis.y-vmath.length(rider)-70,
        go.get_position(ids[1]).y-40,go.get_position(ids[2]).y-40)
    -- get_world_position is the previous frame's cache. Include it for interpolation,
    -- rather than relying on it for the current frame (Defold 1.14 go API).
    low=math.min(low,go.get_world_position(ids.chassis).y-80,go.get_world_position(ids.rider).y-70,
        go.get_world_position(ids[1]).y-40,go.get_world_position(ids[2]).y-40)
    return low*scale
end
return M
