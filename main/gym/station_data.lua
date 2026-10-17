-- Version 1: world metres, converted once at the engine boundary by stations.lua.
-- Pure validation: no engine calls, no partially constructed terrain on failure.
local M={}
local function finite(x) return type(x)=="number" and x==x and math.abs(x)<100000 end
local function point(p) return type(p)=="table" and #p==2 and finite(p[1]) and finite(p[2]) end
function M.validate(d)
    if type(d)~="table" or d.schema~=1 or d.units~="metres" then return nil,"Unsupported station schema/units" end
    if type(d.id)~="string" or not d.id:match("^[a-z][a-z0-9%-]*$") or type(d.name)~="string" then return nil,"Invalid station identity" end
    if not point(d.spawn) or not finite(d.start_speed) or math.abs(d.start_speed)>30 then return nil,"Invalid station start" end
    if not finite(d.run_in) or d.run_in<0 or not finite(d.run_out) or d.run_out<0 then return nil,"Invalid run-in/out" end
    local b=d.bounds
    if type(b)~="table" or #b~=4 then return nil,"Missing safety bounds" end
    for _,n in ipairs(b) do if not finite(n) then return nil,"Non-finite bounds" end end
    if b[1]>=b[2] or b[3]>=b[4] or d.spawn[1]<=b[1] or d.spawn[1]>=b[2] or d.spawn[2]<=b[3] or d.spawn[2]>=b[4] then return nil,"Invalid safety bounds" end
    if type(d.chains)~="table" or #d.chains<1 or #d.chains>32 then return nil,"Missing/too many chains" end
    for _,chain in ipairs(d.chains) do
        if type(chain)~="table" or #chain<2 or #chain>2048 then return nil,"Invalid chain length" end
        for i,p in ipairs(chain) do
            if not point(p) then return nil,"Invalid chain point" end
            if i>1 then local q=chain[i-1];if (p[1]-q[1])^2+(p[2]-q[2])^2<0.0001 then return nil,"Chain points too close" end end
        end
    end
    if d.hulls~=nil then
        if type(d.hulls)~="table" or #d.hulls>64 then return nil,"Invalid hulls" end
        for _,h in ipairs(d.hulls) do
            if type(h)~="table" or type(h.vertices)~="table" or #h.vertices<3 or #h.vertices>8 then return nil,"Invalid hull vertices" end
            for _,p in ipairs(h.vertices) do if not point(p) then return nil,"Invalid hull point" end end
            -- Strict convex CCW hull; reject degenerate/self-intersecting input.
            for i,p in ipairs(h.vertices) do
                local q=h.vertices[i%#h.vertices+1]
                for j,v in ipairs(h.vertices) do
                    if j~=i and j~=i%#h.vertices+1 and (q[1]-p[1])*(v[2]-p[2])-(q[2]-p[2])*(v[1]-p[1])<=0 then return nil,"Hull must be convex CCW" end
                end
            end
        end
    end
    if d.markers then
        local m=d.markers
        if not finite(m.from_m) or not finite(m.to_m) or m.to_m<=m.from_m or not finite(m.minor_m) or m.minor_m<=0 or not finite(m.major_m) or m.major_m<m.minor_m or (m.to_m-m.from_m)/m.minor_m>1000 then return nil,"Invalid markers" end
    end
    return d
end
function M.speed(value,default)
    if value==nil or value=="" then return default end
    local n=tonumber(value)
    if not finite(n) or math.abs(n)>30 then return default,"Invalid speed; using station default (range -30..30 m/s)" end
    return n
end
return M
