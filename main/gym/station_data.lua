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
    local objects=0
    for _,chain in ipairs(d.chains) do
        if type(chain)~="table" or #chain<2 or #chain>2048 then return nil,"Invalid chain length" end
        objects=objects+#chain-1
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
            objects=objects+#h.vertices
            -- Strict convex CCW hull; reject degenerate/self-intersecting input.
            for i,p in ipairs(h.vertices) do
                local q=h.vertices[i%#h.vertices+1]
                for j,v in ipairs(h.vertices) do
                    if j~=i and j~=i%#h.vertices+1 and (q[1]-p[1])*(v[2]-p[2])-(q[2]-p[2])*(v[1]-p[1])<=0 then return nil,"Hull must be convex CCW" end
                end
            end
        end
    end
    if d.labels then
        if type(d.labels)~="table" then return nil,"Invalid labels" end
        for _,label in ipairs(d.labels) do
            if type(label)~="table" or not point(label.position) or type(label.text)~="string" or #label.text>64 then return nil,"Invalid label" end
            objects=objects+1
        end
    end
    if (d.kind=="ramps" or d.kind=="steps") and not d.sections then return nil,"Missing station sections" end
    if d.sections then
        if (d.kind~="ramps" and d.kind~="steps") or type(d.sections)~="table" or #d.sections<1 or #d.sections>32 then return nil,"Invalid ramp sections" end
        local ids={}
        for _,section in ipairs(d.sections) do
            if type(section)~="table" or type(section.id)~="string" or ids[section.id] or type(section.name)~="string" or not point(section.spawn) then return nil,"Invalid section identity/start" end
            ids[section.id]=true
            if section.stop_probe~=nil and (d.kind~="steps" or type(section.stop_probe)~="boolean") then return nil,"Invalid step probe" end
            if section.spawn[1]<=b[1] or section.spawn[1]>=b[2] or section.spawn[2]<=b[3] or section.spawn[2]>=b[4] then return nil,"Section spawn outside bounds" end
            if section.mode~="up" and section.mode~="down" then return nil,"Invalid ramp mode" end
            if not finite(section.start_speed) or section.start_speed<0 or section.start_speed>30 then return nil,"Invalid section speed" end
            if d.kind=="ramps" then
                for _,key in ipairs({"ramp_start","top_x","top_y","end_x","angle","length"}) do if not finite(section[key]) then return nil,"Invalid ramp measurement" end end
                if section.length<=0 or section.end_x<=section.ramp_start or section.angle<=0 or section.angle>90 then return nil,"Invalid ramp limits" end
            else
                for _,key in ipairs({"step_x","top_y","end_x","height"}) do if not finite(section[key]) then return nil,"Invalid step measurement" end end
                if section.height<=0 or section.height>.5 or section.spawn[1]>=section.step_x-1 or section.end_x<=section.step_x+1 then return nil,"Invalid step limits" end
            end
        end
    end
    if d.markers then
        if type(d.markers)~="table" then return nil,"Invalid markers" end
        local m=d.markers
        if not finite(m.from_m) or not finite(m.to_m) or m.to_m<=m.from_m or not finite(m.minor_m) or m.minor_m<=0 or not finite(m.major_m) or m.major_m<m.minor_m or (m.to_m-m.from_m)/m.minor_m>1000 then return nil,"Invalid markers" end
    end
    if d.markers then objects=objects+(d.markers.to_m-d.markers.from_m)/d.markers.minor_m+1+(d.markers.to_m-d.markers.from_m)/d.markers.major_m+1 end
    if objects>800 then return nil,"Station render budget exceeds 800 objects" end
    return d
end
function M.speed(value,default)
    if value==nil or value=="" then return default end
    local n=tonumber(value)
    if not finite(n) or math.abs(n)>30 then return default,"Invalid speed; using station default (range -30..30 m/s)" end
    return n
end
return M
