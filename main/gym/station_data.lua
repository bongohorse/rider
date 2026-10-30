-- Versions 1 (legacy), 2 (gold coins) and 3 (Wonder Gems): world metres, converted once at the engine boundary by stations.lua.
-- Pure validation: no engine calls, no partially constructed terrain on failure.
local M={}
local TEXT_LIMIT=64
-- Provisional start limit (decisions after LE1b, tightened in LE2): float32 positions keep the
-- 0.01-unit reset-pose guard only below 655.36 m (65536 units); a debug sweep failed from 724 m in x
-- and at 1000 m in y. Applies to both coordinates of the station start and every section start.
M.START_LIMIT_DEFAULT=500
M.START_LIMIT=M.START_LIMIT_DEFAULT
-- A19d: balance section types and the plank built by main/gym/seesaw.collisionobject (metres, kg).
M.BALANCE_TYPES={beam=true,up=true,down=true,seesaw=true}
M.SEESAW_PLANK={length=4,thickness=0.08,taper=0.3,mass=20}
local function finite(x) return type(x)=="number" and x==x and math.abs(x)<100000 end
local function point(p) return type(p)=="table" and #p==2 and finite(p[1]) and finite(p[2]) end
function M.start_allowed(p,limit)
    limit=limit or M.START_LIMIT
    return math.abs(p[1])<=limit and math.abs(p[2])<=limit
end
-- Ids and names travel in every telemetry message; msg.post data is capped at 2048 bytes.
local function text(s) return type(s)=="string" and #s<=TEXT_LIMIT end
function M.validate(d)
    if type(d)~="table" or (d.schema~=1 and d.schema~=2 and d.schema~=3) or d.units~="metres" then return nil,"Unsupported station schema/units",true end
    if d.coins~=nil and d.schema~=2 and d.schema~=3 then return nil,"Ordinary coins require station schema 2",true end
    if d.coins and d.coins.version==2 and d.schema~=3 then return nil,'Wonder Gems require station schema 3',true end
    local medals_ok,medals_err,medals_unknown=require('main.gym.medals').validate(d.medal_times)
    if not medals_ok then return nil,medals_err,medals_unknown end
    if d.race_revision~=nil and (type(d.race_revision)~='number' or d.race_revision<1 or d.race_revision>1000000 or d.race_revision%1~=0) then return nil,'Invalid race revision' end
    local profile_ok,profile_err=require('main.terrain_perspective.profile').validate(d)
    if not profile_ok then return nil,profile_err,true end
    if type(d.id)~="string" or not d.id:match("^[a-z][a-z0-9%-]*$") or type(d.name)~="string" then return nil,"Invalid station identity" end
    if not text(d.id) or not text(d.name) then return nil,"Station id and name are limited to "..TEXT_LIMIT.." bytes" end
    if not point(d.spawn) or not finite(d.start_speed) or math.abs(d.start_speed)>30 then return nil,"Invalid station start" end
    if not M.start_allowed(d.spawn) then return nil,"Start is limited to "..M.START_LIMIT.." m from the origin in x and y" end
    if not finite(d.run_in) or d.run_in<0 or not finite(d.run_out) or d.run_out<0 then return nil,"Invalid run-in/out" end
    local b=d.bounds
    if type(b)~="table" or #b~=4 then return nil,"Missing safety bounds" end
    for _,n in ipairs(b) do if not finite(n) then return nil,"Non-finite bounds" end end
    if b[1]>=b[2] or b[3]>=b[4] or d.spawn[1]<=b[1] or d.spawn[1]>=b[2] or d.spawn[2]<=b[3] or d.spawn[2]>=b[4] then return nil,"Invalid safety bounds" end
    local coin_ok,coin_err,coin_unknown=require('main.gym.coin_data').validate(d.coins,b)
    if not coin_ok then return nil,coin_err,coin_unknown end
    if type(d.chains)~="table" or #d.chains>32 then return nil,"Missing/too many chains" end
    -- Structural geometry counts; rendering and physics admission are checked independently below.
    local objects,segments,edges,labels,seesaws=0,0,0,0,0
    for _,chain in ipairs(d.chains) do
        if type(chain)~="table" or #chain<2 or #chain>2048 then return nil,"Invalid chain length" end
        objects,segments=objects+#chain-1,segments+#chain-1
        for i,p in ipairs(chain) do
            if not point(p) then return nil,"Invalid chain point" end
            if i>1 then local q=chain[i-1];if (p[1]-q[1])^2+(p[2]-q[2])^2<0.0001 then return nil,"Chain points too close" end end
        end
    end
    -- Two-sided chains (LE3b): an optional list parallel to chains; a true entry is also built
    -- reversed, so it collides on both sides. It is drawn once and counts twice towards 32 chains.
    if d.two_sided~=nil then
        if type(d.two_sided)~="table" or #d.two_sided~=#d.chains then return nil,"Invalid two_sided list" end
        local count=#d.chains
        for i=1,#d.chains do
            if type(d.two_sided[i])~="boolean" then return nil,"Invalid two_sided list" end
            if d.two_sided[i] then count=count+1 end
        end
        if count>32 then return nil,"Missing/too many chains" end
    end
    if d.hulls~=nil then
        if type(d.hulls)~="table" or #d.hulls>64 then return nil,"Invalid hulls" end
        for _,h in ipairs(d.hulls) do
            if type(h)~="table" or type(h.vertices)~="table" or #h.vertices<3 or #h.vertices>8 then return nil,"Invalid hull vertices" end
            for _,p in ipairs(h.vertices) do if not point(p) then return nil,"Invalid hull point" end end
            objects,edges=objects+#h.vertices,edges+#h.vertices
            -- Strict convex CCW hull; reject degenerate/self-intersecting input.
            for i,p in ipairs(h.vertices) do
                local q=h.vertices[i%#h.vertices+1]
                for j,v in ipairs(h.vertices) do
                    if j~=i and j~=i%#h.vertices+1 and (q[1]-p[1])*(v[2]-p[2])-(q[2]-p[2])*(v[1]-p[1])<=0 then return nil,"Hull must be convex CCW" end
                end
            end
        end
    end
    if objects==0 then return nil,"Empty station terrain" end
    if d.kind=="seams" then
        if type(d.seams)~="table" or #d.seams~=20 or not point(d.baseline) or not point(d.window) then return nil,"Invalid seam protocol" end
        if not (d.spawn[1]<d.baseline[1] and d.baseline[1]<d.baseline[2] and d.baseline[2]<d.window[1] and d.window[2]<b[2]) then return nil,"Invalid seam windows" end
        for i,x in ipairs(d.seams) do
            if not finite(x) or x<=d.window[1] or x>=d.window[2] or (i>1 and x-d.seams[i-1]<2) then return nil,"Invalid seam positions" end
        end
    end
    if d.labels then
        if type(d.labels)~="table" then return nil,"Invalid labels" end
        for _,label in ipairs(d.labels) do
            if type(label)~="table" or not point(label.position) or type(label.text)~="string" or #label.text>64 then return nil,"Invalid label" end
            objects,labels=objects+1,labels+1
        end
    end
    -- FINISH (LE2): position, a finish segment and the unit direction it must be crossed in.
    if d.finish~=nil then
        local f=d.finish
        if type(f)~="table" or not point(f.position) or type(f.line)~="table" or #f.line~=2 or not point(f.line[1]) or not point(f.line[2])
            or not point(f.direction) then return nil,"Invalid finish" end
        local lx,ly=f.line[2][1]-f.line[1][1],f.line[2][2]-f.line[1][2]
        local length=math.sqrt(lx*lx+ly*ly)
        if length<0.1 or math.abs(math.sqrt(f.direction[1]^2+f.direction[2]^2)-1)>0.001 or math.abs(lx*f.direction[2]-ly*f.direction[1])/length<0.5 then return nil,"Invalid finish line/direction" end
        for _,q in ipairs(f.line) do if q[1]<=b[1] or q[1]>=b[2] or q[2]<=b[3] or q[2]>=b[4] then return nil,"Finish outside bounds" end end
        objects=objects+2
    end
    local finish=objects-segments-edges-labels
    -- Reserved for later tasks; v1 levels carry an empty list.
    if d.checkpoints~=nil and (type(d.checkpoints)~="table" or next(d.checkpoints)~=nil) then return nil,"Checkpoints are not supported yet" end
    if (d.kind=="ramps" or d.kind=="steps" or d.kind=="gaps" or d.kind=="balance" or d.kind=="bumps" or d.kind=="air") and not d.sections then return nil,"Missing station sections" end
    if d.sections then
        if (d.kind~="ramps" and d.kind~="steps" and d.kind~="gaps" and d.kind~="balance" and d.kind~="bumps" and d.kind~="air") or type(d.sections)~="table" or #d.sections<1 or #d.sections>32 then return nil,"Invalid ramp sections" end
        local ids={}
        for _,section in ipairs(d.sections) do
            if type(section)~="table" or not text(section.id) or ids[section.id] or not text(section.name) or not point(section.spawn) then return nil,"Invalid section identity/start" end
            ids[section.id]=true
            if section.stop_probe~=nil and (d.kind~="steps" or type(section.stop_probe)~="boolean") then return nil,"Invalid step probe" end
            if not M.start_allowed(section.spawn) then return nil,"Start is limited to "..M.START_LIMIT.." m from the origin in x and y" end
            if section.spawn[1]<=b[1] or section.spawn[1]>=b[2] or section.spawn[2]<=b[3] or section.spawn[2]>=b[4] then return nil,"Section spawn outside bounds" end
            if section.mode~="up" and section.mode~="down" then return nil,"Invalid ramp mode" end
            if not finite(section.start_speed) or section.start_speed<0 or section.start_speed>30 then return nil,"Invalid section speed" end
            if d.kind=="ramps" then
                for _,key in ipairs({"ramp_start","top_x","top_y","end_x","angle","length"}) do if not finite(section[key]) then return nil,"Invalid ramp measurement" end end
                if section.length<=0 or section.end_x<=section.ramp_start or section.angle<=0 or section.angle>90 then return nil,"Invalid ramp limits" end
            elseif d.kind=="gaps" then
                for _,key in ipairs({"ramp_start","lip_x","lip_y","land_x","deck_y","gap","end_x"}) do if not finite(section[key]) then return nil,"Invalid gap measurement" end end
                if section.landing~="flat" and section.landing~="down" and section.landing~="up" then return nil,"Invalid gap landing" end
                if section.gap<=0 or section.gap>12 or math.abs(section.land_x-section.lip_x-section.gap)>.001 or section.spawn[1]>=section.ramp_start
                    or section.ramp_start>=section.lip_x or section.end_x<=section.land_x+2 then return nil,"Invalid gap limits" end
            elseif d.kind=="balance" then
                -- A19d: a target platform ahead of the start; both wheel centres (0.92 m apart) must fit on it.
                for _,key in ipairs({"target_x0","target_x1","target_y","end_x"}) do if not finite(section[key]) then return nil,"Invalid balance measurement" end end
                if not M.BALANCE_TYPES[section.type] or section.target_x1-section.target_x0<0.95 or section.spawn[1]>=section.target_x0
                    or section.end_x<section.target_x1 or section.end_x>=b[2] or section.start_speed~=0 then return nil,"Invalid balance limits" end
            elseif d.kind=="bumps" then
                -- A19b: ordered, non-overlapping cosine features (waves, crest, dip) ahead of the start.
                if type(section.features)~="table" or #section.features<1 or #section.features>16 or not finite(section.end_x) then return nil,"Invalid bump features" end
                local last=section.spawn[1]+1
                for _,f in ipairs(section.features) do
                    if type(f)~="table" or not text(f.id) or (f.type~="waves" and f.type~="crest" and f.type~="dip") then return nil,"Invalid bump feature" end
                    for _,key in ipairs({"start_x","end_x","height","wavelength","count"}) do if not finite(f[key]) then return nil,"Invalid bump measurement" end end
                    if f.start_x<last or f.wavelength<=0 or f.count<1 or f.count%1~=0 or math.abs(f.end_x-f.start_x-f.wavelength*f.count)>.001
                        or f.height==0 or math.abs(f.height)>1 or (f.type~="waves" and f.count~=1) or (f.type=="dip")~=(f.height<0) then return nil,"Invalid bump limits" end
                    last=f.end_x
                end
                if section.end_x<last or section.end_x>=b[2] then return nil,"Invalid bump limits" end
            elseif d.kind=="air" then
                -- A19c: plateau run-in, kicker to the lip, then a flat or downslope landing area below.
                for _,key in ipairs({"ramp_start","lip_x","lip_y","height","slope","land_x","land_y","end_x"}) do if not finite(section[key]) then return nil,"Invalid air measurement" end end
                if (section.landing~="flat" and section.landing~="down") or (section.landing=="flat")~=(section.slope==0) or section.slope<0 or section.slope>60
                    or section.height<=0 or section.height>30 or section.lip_y<=section.land_y or section.spawn[1]>=section.ramp_start
                    or section.ramp_start>=section.lip_x or section.land_x<section.lip_x or section.end_x<=section.land_x+5 then return nil,"Invalid air limits" end
            else
                for _,key in ipairs({"step_x","top_y","end_x","height"}) do if not finite(section[key]) then return nil,"Invalid step measurement" end end
                if section.height<=0 or section.height>.5 or section.spawn[1]>=section.step_x-1 or section.end_x<=section.step_x+1 then return nil,"Invalid step limits" end
            end
        end
    end
    -- A19d seesaw: only a built-in balance station carries one (custom levels have no kind). The plank
    -- is station geometry, built by the fixed seesaw resource, so the data must state exactly its values.
    if d.seesaw~=nil then
        local s,p=d.seesaw,M.SEESAW_PLANK
        if d.kind~="balance" or type(s)~="table" or not point(s.pivot) then return nil,"Invalid seesaw" end
        for _,key in ipairs({"length","thickness","taper","mass"}) do if s[key]~=p[key] then return nil,"Seesaw plank differs from its resource" end end
        if not finite(s.rest_angle) or not finite(s.limit) or s.rest_angle<=0 or s.limit<=s.rest_angle or s.limit>0.8 then return nil,"Invalid seesaw angles" end
        local found
        for _,section in ipairs(d.sections) do if section.id==s.section and section.type=="seesaw" then found=section end end
        if not found or s.pivot[1]<=found.spawn[1] or s.pivot[1]>=found.target_x0 or s.pivot[1]<=b[1] or s.pivot[1]>=b[2] or s.pivot[2]<=b[3] or s.pivot[2]>=b[4] then return nil,"Invalid seesaw position" end
        objects,seesaws=objects+1,1
    elseif d.kind=="balance" then
        for _,section in ipairs(d.sections) do if section.type=="seesaw" then return nil,"Missing seesaw" end end
    end
    if d.markers then
        if type(d.markers)~="table" then return nil,"Invalid markers" end
        local m=d.markers
        if not finite(m.from_m) or not finite(m.to_m) or m.to_m<=m.from_m or not finite(m.minor_m) or m.minor_m<=0 or not finite(m.major_m) or m.major_m<m.minor_m or (m.to_m-m.from_m)/m.minor_m>1000 then return nil,"Invalid markers" end
    end
    local markers=0
    if d.markers then markers=(d.markers.to_m-d.markers.from_m)/d.markers.minor_m+1+(d.markers.to_m-d.markers.from_m)/d.markers.major_m+1 end
    objects=objects+markers
    local look_ok,look_err,look_unknown=require("main.terrain_perspective.look").validate_station(d)
    if not look_ok then return nil,look_err,look_unknown end
    local resources,err=require("main.gym.terrain_budget").check(d)
    if not resources then return nil,err end
    return d
end
function M.speed(value,default)
    if value==nil or value=="" then return default end
    local n=tonumber(value)
    if not finite(n) or math.abs(n)>30 then return default,"Invalid speed; using station default (range -30..30 m/s)" end
    return n
end
return M
