-- Level editor snapping (LE3; contract R6). Pure. Snapping only positions; it never connects (R5).
-- Precedence: anchor > angle > grid. Shift puts the point on a 15 degree ray from the origin and the
-- grid then applies to the length along that ray. Ctrl turns every snap off while it is held.
local M={GRID=0.5,FINE=0.1,ANGLE=15}
-- Steps are stored as their inverses so grid values are exact decimals (k/10, not k*0.1).
local INVERSE={[0.5]=2,[0.1]=10}
local function round(v,step) return math.floor(v/step+0.5)/INVERSE[step] end
M.round=round
-- o: grid (bool, persistent G toggle), fine (Alt held), from (angle origin, Shift held), off (Ctrl),
-- anchors (list of {p=...}), radius (anchor radius in metres, from a fixed screen distance).
-- Returns the snapped point, the active kind and the anchor it snapped to.
function M.snap(p,o)
    if o.off then return {p[1],p[2]},"off" end
    local best,bd
    for _,a in ipairs(o.anchors or {}) do
        local d=math.sqrt((a.p[1]-p[1])^2+(a.p[2]-p[2])^2)
        if d<=o.radius and (not bd or d<bd) then best,bd=a,d end
    end
    if best then return {best.p[1],best.p[2]},"anchor",best end
    local step=o.fine and M.FINE or o.grid and M.GRID
    if o.from then
        local f=o.from
        local dx,dy=p[1]-f[1],p[2]-f[2]
        local a=math.floor(math.atan2(dy,dx)/math.rad(M.ANGLE)+0.5)*math.rad(M.ANGLE)
        local ux,uy=math.cos(a),math.sin(a)
        -- Exact axes: cos(90 degrees) is not exactly 0 in floating point.
        if math.abs(ux)<1e-12 then ux=0 end
        if math.abs(uy)<1e-12 then uy=0 end
        local length=dx*ux+dy*uy
        if step then length=round(length,step) end
        return {f[1]+ux*length,f[2]+uy*length},"angle"
    end
    if step then return {round(p[1],step),round(p[2],step)},"grid" end
    return {p[1],p[2]},"free"
end
-- Length (m) and angle (degrees from +x, counter-clockwise) of a segment, for readouts.
function M.measure(a,b)
    local dx,dy=b[1]-a[1],b[2]-a[2]
    return math.sqrt(dx*dx+dy*dy),math.deg(math.atan2(dy,dx))
end
return M
