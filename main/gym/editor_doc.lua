-- Level editor source documents (level-editor contract R1-R4, R9, R10, R13, R16). Pure: no engine
-- calls besides json, metres throughout. The editor block is authoritative; Play recompiles from it.
local data=require "main.gym.station_data"
local prefab=require "main.gym.editor_prefab"
local sample=require "main.gym.editor_sample"
-- Version 2 (LE3) adds explicit connections and compiles each connected run into one chain.
-- Version 3 (LE5a) adds parametric prefab objects; a Kicker + landing splits its run's chain at its gap.
-- Version 4 (LE5b) adds Bezier curves, the Bump/wave prefab, the recorded sampling settings and the
-- Step tread. Version 5 (LE5c) adds corner anchors: a segment between two corners compiles as one straight
-- chord, so a line turned into an editable path keeps its untouched segments exactly. Version 6 (compiler 6)
-- samples curved segments with the longest chords that fit the same bounds (editor_sample), so their compiled
-- points differ; nothing else in the format changes.
-- Version 7 adds optional name/hidden/locked source metadata; compilation ignores it.
-- Versions 1-6 open upgraded. Version 6 geometry compiles unchanged; older curves are resampled by
-- compiler 6 (their older compiled data is then out of date, not a conflict).
local M={EDITOR_VERSION=9,COMPILER_VERSION=9}
-- The sampling settings of compiler version 4 (R8), written into every document so a compile can be
-- reproduced; other values are a newer compiler's and are not recompiled.
M.SAMPLING={tolerance=sample.TOLERANCE,max_segment=sample.MAX_SEGMENT}
M.MODES={free=true,smooth=true,symmetric=true,corner=true}
-- Explicit document limits (R16): drafts may be incomplete, never unbounded.
M.MAX_OBJECTS,M.MAX_POINTS,M.MAX_TOTAL_POINTS=256,2048,8192
-- Upright vehicle box around the spawn (chassis 1.08 x 0.28 m, wheels r 0.22 at +-0.46/-0.30, head top 0.68).
M.VEHICLE={-0.68,0.68,-0.52,0.68}
-- Start on surface: the spawn sits 0.9 m above the ground like the built-in stations.
M.CLEARANCE=0.9
-- Compiled FINISH segment spans 2 m below to 6 m above the flag position.
M.FINISH_BELOW,M.FINISH_ABOVE=2,6
-- Automatic bounds margin (R13): sides and floor 10 m, 20 m of headroom for jumps.
M.MARGIN,M.HEADROOM=10,20
local function finite(x) return type(x)=="number" and x==x and math.abs(x)<100000 end
local function point(p) return type(p)=="table" and #p==2 and finite(p[1]) and finite(p[2]) end
local function copy(v)
    if type(v)~="table" then return v end
    local t={};for k,x in pairs(v) do t[k]=copy(x) end;return t
end
M.copy=copy
function M.pickup_id(e,id)
    local base='coin-'..id;local key=base;local n=1
    local used={};for _,o in ipairs(e.objects) do if o.type=='coin' then used[o.pickup_id]=true end end
    while used[key] do n=n+1;key=base..'-'..n end
    return key
end
local function points(list) local out={};for i,p in ipairs(list) do out[i]={p[1],p[2]} end;return out end
local function new_id(e) local id="o"..e.next_id;e.next_id=e.next_id+1;return id end
-- Connected ends coincide (R4); the editor makes them exactly equal, JSON keeps them equal (a prefab's
-- derived exit within this tolerance).
M.JOINT=1e-6
local function same(a,b,eps) return math.abs(a[1]-b[1])<=(eps or M.JOINT) and math.abs(a[2]-b[2])<=(eps or M.JOINT) end
M.same=same
M.finite=finite
-- Curves (LE5b): anchors {p, in, out, mode}, tangents relative to p. The sampled points are cached per
-- object and reused only while every anchor number is exactly the same (anchors are moved in place).
local curves=setmetatable({},{__mode="k"})
local function anchor_numbers(o)
    local t={}
    for _,a in ipairs(o.anchors) do
        t[#t+1],t[#t+2],t[#t+3],t[#t+4],t[#t+5],t[#t+6]=a.p[1],a.p[2],a["in"][1],a["in"][2],a.out[1],a.out[2]
    end
    return t
end
local function unchanged(o,nums)
    if #nums~=6*#o.anchors then return false end
    local k=0
    for _,a in ipairs(o.anchors) do
        if nums[k+1]~=a.p[1] or nums[k+2]~=a.p[2] or nums[k+3]~=a["in"][1] or nums[k+4]~=a["in"][2] or nums[k+5]~=a.out[1] or nums[k+6]~=a.out[2] then return false end
        k=k+6
    end
    return true
end
local function curve_samples(o)
    local hit=curves[o]
    if hit and unchanged(o,hit.nums) then return hit end
    local pts=sample.curve(o.anchors)
    hit={nums=anchor_numbers(o),points=pts}
    if not pts then
        -- Over the sampling budget: drawn through the anchors only; Play stays blocked (sample_error).
        hit.points,hit.error={},true
        for i,a in ipairs(o.anchors) do hit.points[i]={a.p[1],a.p[2]} end
    end
    curves[o]=hit
    return hit
end
-- A curve or Bump/wave that needs more points than the sampler allows: the reason, else nil.
function M.sample_error(o)
    if o.type=="curve" and curve_samples(o).error then
        return string.format("needs more than %d points at %d mm / %s m sampling: shorten it or split it [K]",sample.MAX_POINTS,sample.TOLERANCE*1000,sample.MAX_SEGMENT)
    end
    if o.type=="prefab" then return prefab.sample_error(o) end
end

-- Object geometry (LE5a). Terrain pieces are lines and terrain prefabs: each has an entry (first
-- point) and an exit (last point) and belongs to a run. parts: the open polylines a piece adds to
-- collision chains (a Kicker + landing has two, with its jump gap between them). path: every point of
-- an object, entry to exit (hull and Platform: the closed outline; label: its position).
function M.terrain(o) return o.type=="line" or o.type=="curve" or (o.type=="prefab" and prefab.terrain(o.kind)) end
function M.parts(o)
    if o.type=="line" then return {o.points} end
    if o.type=="curve" then return {curve_samples(o).points} end
    if o.type=="prefab" and o.kind~="platform" then return prefab.geometry(o).parts end
    return {}
end
function M.path(o)
    if o.type=="line" then return o.points end
    if o.type=="curve" then return curve_samples(o).points end
    if o.type=="hull" then return o.vertices end
    if o.type=="prefab" then return prefab.path(o) end
    return {o.position}
end
-- Closed outline of a hull or Platform (a separate obstacle), else nil.
function M.outline(o)
    if o.type=="hull" then return o.vertices end
    if o.type=="prefab" and o.kind=="platform" then return prefab.path(o) end
end
-- Line sprites an object draws in a compiled level (render budget, R7): one per segment or outline edge.
function M.drawn(o)
    local outline=M.outline(o)
    if o.type=='coin' then return 1 end
    if outline then return #outline end
    local n=0
    for _,part in ipairs(M.parts(o)) do n=n+#part-1 end
    return n
end
function M.entry(o) return o.type=="line" and o.points[1] or o.type=="curve" and o.anchors[1].p or o.at end
function M.exit(o) local p=M.path(o);return p[#p] end
-- Display name for messages: "Line o3", "Ramp o5".
function M.label(o) if o.name and o.name~="" then return o.name.." ("..o.id..")" end;return o.type=="prefab" and prefab.name(o.kind).." "..o.id or (o.type:sub(1,1):upper()..o.type:sub(2)).." "..o.id end

-- A2 protection at the document boundary, including indirect connected-run edits. Visibility and
-- unlocking remain available on locked objects; their source/name and incident connections are protected.
local function equal(a,b)
    if a==b then return true end
    if type(a)~=type(b) then return false end
    if type(a)~="table" then return a==b end
    for k,v in pairs(a) do if not equal(v,b[k]) then return false end end
    for k in pairs(b) do if a[k]==nil then return false end end
    return true
end
function M.lock_conflict(before,after)
    local ids={};for _,o in ipairs(after.objects) do ids[o.id]=o end
    local function incident(e,id)
        local t={};for _,c in ipairs(e.connections or {}) do if c.from==id or c.to==id then t[c.from..":"..c.to]=true end end;return t
    end
    for _,o in ipairs(before.objects) do
        if o.locked then
            local n=ids[o.id]
            local changed=not n
            for k,v in pairs(o) do if k~="hidden" and k~="locked" and not equal(v,n and n[k]) then changed=true;break end end
            for k in pairs(n or {}) do if k~="hidden" and k~="locked" and o[k]==nil then changed=true;break end end
            if changed or (before.connections~=after.connections and not equal(incident(before,o.id),incident(after,o.id))) then
                return "Locked: "..M.label(o)..". Unlock it before changing this object or its connected run."
            end
        end
    end
end

-- Station JSON (built-in or custom, without editor block) -> editable lines/hulls/labels (R2).
local function from_station(d,id,name)
    local e={editor_version=M.EDITOR_VERSION,compiler_version=M.COMPILER_VERSION,revision=0,next_id=1,objects={},connections={},
        sampling=copy(M.SAMPLING),start={position={d.spawn[1],d.spawn[2]},speed=d.start_speed or 0}}
    if require('main.terrain_perspective.profile').enabled(d) then e.road_profile=require('main.terrain_perspective.profile').ID end
    if require('main.terrain_perspective.look').authored(d) then e.road_profile='authored-v1';e.road_look=copy(d.editor.road_look) end
    e.medal_times=copy(d.medal_times)
    for _,chain in ipairs(d.chains or {}) do
        -- Logical order runs left to right ("downstream" = right, LE3); the compiler orients chains.
        local list=points(chain)
        if list[1][1]>list[#list][1] then local r={};for i=#list,1,-1 do r[#r+1]=list[i] end;list=r end
        e.objects[#e.objects+1]={id=new_id(e),type="line",points=list}
    end
    for _,h in ipairs(d.hulls or {}) do e.objects[#e.objects+1]={id=new_id(e),type="hull",vertices=points(h.vertices)} end
    for _,c in ipairs(d.coins and d.coins.items or {}) do e.objects[#e.objects+1]={id=new_id(e),type='coin',pickup_id=c.id,position=copy(c.position)} end
    for _,l in ipairs(d.labels or {}) do e.objects[#e.objects+1]={id=new_id(e),type="label",position={l.position[1],l.position[2]},text=l.text} end
    if type(d.finish)=="table" and point(d.finish.position) and type(d.finish.direction)=="table" then
        e.finish={position={d.finish.position[1],d.finish.position[2]},direction=d.finish.direction[1]<0 and -1 or 1}
    end
    return {schema=1,units="metres",id=id,name=name,editor=e}
end
-- R3: a template copy is a generic custom level. It keeps only geometry, labels and the start;
-- kind, sections, markers and every other measurement field are dropped by construction. The second
-- result names a dropped gameplay object (the balance seesaw, which the editor has no object for).
function M.template(d)
    local name=d.name.." copy"
    if #name>64 then name=d.name:sub(1,59).." copy" end
    local note=d.seesaw and "Template copy without the seesaw: it is a dynamic station object that the editor cannot hold yet. Drive it in the station itself."
    if require("main.terrain_perspective.look").authored(d) then return {schema=1,units="metres",id="my-"..d.id,name=name,editor=copy(d.editor)},note end
    return from_station(d,"my-"..d.id,name),note
end
-- New empty level (LE4): no terrain yet (an unplayable draft, R9), START at the origin.
function M.blank(id,name)
    return {schema=1,units="metres",id=id,name=name,editor={editor_version=M.EDITOR_VERSION,compiler_version=M.COMPILER_VERSION,
        revision=0,next_id=1,objects={},connections={},sampling=copy(M.SAMPLING),start={position={0,1},speed=0},road_profile=require('main.terrain_perspective.profile').ID}}
end
-- Opening a custom level (R1, R2, LE4). d is a validated station (custom.parse), so its compiled
-- geometry is always usable. Returns doc, note, conflict:
-- * no editor block: the compiled geometry as editable lines (R2);
-- * a supported block: the source. Compiled data claimed for this source revision (compiled_revision ==
--   revision) that differs from a recompile is a conflict {summary, lines}: the caller lets the user
--   choose the source or the compiled geometry as lines. Stale compiled data (an older compiled_revision
--   or none) is expected after autosaved edits and is not a conflict;
-- * an unsupported or invalid block: never recompiled; the compiled geometry opens as an editable line
--   copy with a note. The file and its unknown data stay unchanged.
function M.open_level(d)
    if d.editor==nil then return from_station(d,d.id,d.name) end
    local doc={schema=1,units="metres",id=d.id,name=d.name,editor=copy(d.editor)}
    local ok,err,unsupported=M.validate(doc)
    if not ok then
        local why=unsupported and "made by an unsupported editor ("..err..")" or "its editor data is invalid ("..err..")"
        return from_station(d,d.id,d.name),"This level was "..why.."; its compiled geometry was opened as editable lines. The file is unchanged."
    end
    local e=doc.editor
    if e.compiled_revision==e.revision then
        local summary=M.compare(doc,d)
        if summary then return doc,nil,{summary=summary,lines=from_station(d,d.id,d.name)} end
    end
    return doc
end
-- First difference between a recompile of doc and the compiled fields of station d, or nil (R1).
-- Only the compiled fields are compared, absent lists as empty and unknown extra fields ignored.
local COMPILED={"spawn","start_speed","run_in","run_out","bounds","chains","two_sided","hulls","labels","finish","medal_times","coins"}
local function compiled(d)
    local t={coins=d.coins,medal_times=d.medal_times,spawn=d.spawn,start_speed=d.start_speed or 0,run_in=d.run_in or 0,run_out=d.run_out or 0,bounds=d.bounds,chains=d.chains or {},hulls={},labels={},two_sided={}}
    for i,h in ipairs(d.hulls or {}) do t.hulls[i]={vertices=h.vertices} end
    for i,l in ipairs(d.labels or {}) do t.labels[i]={position=l.position,text=l.text} end
    -- An absent two_sided list means all one-sided.
    for i=1,#t.chains do t.two_sided[i]=d.two_sided and d.two_sided[i] or false end
    if type(d.finish)=="table" then t.finish={position=d.finish.position,line=d.finish.line,direction=d.finish.direction} end
    return t
end
local function describe(v) return type(v)=="table" and "a list" or v==nil and "absent" or tostring(v) end
local function differ(a,b,path)
    if type(a)=="number" and type(b)=="number" then
        if math.abs(a-b)>1e-6 then return path..string.format(" is %.3f in the file, %.3f recompiled",b,a) end
        return nil
    end
    if type(a)~="table" or type(b)~="table" then
        if a~=b then return path.." is "..describe(b).." in the file, "..describe(a).." recompiled" end
        return nil
    end
    if #a~=#b then return path.." has "..#b.." entries in the file, "..#a.." recompiled" end
    local keys={}
    for k in pairs(a) do keys[k]=true end
    for k in pairs(b) do keys[k]=true end
    local list={};for k in pairs(keys) do list[#list+1]=k end
    table.sort(list,function(x,y) return tostring(x)<tostring(y) end)
    for _,k in ipairs(list) do
        local r=differ(a[k],b[k],path..(type(k)=="number" and "["..k.."]" or "."..k))
        if r then return r end
    end
end
function M.compare(doc,d)
    local level,err=M.compile(doc)
    if not level then return "the editor source no longer compiles ("..err..")" end
    local a,b=compiled(level),compiled(d)
    for _,f in ipairs(COMPILED) do
        local r=differ(a[f],b[f],f)
        if r then return r end
    end
end

-- R16 source-document validator: structure, versions, finite/bounded input, unique stable ids.
-- Returns nil, message, unsupported (true when only the version is unknown: keep the data untouched).
function M.validate(doc)
    if type(doc)~="table" or doc.schema~=1 or doc.units~="metres" then return nil,"Unsupported document schema/units" end
    if type(doc.id)~="string" or not doc.id:match("^[a-z][a-z0-9%-]*$") or #doc.id>64 then return nil,"Invalid level id" end
    if type(doc.name)~="string" or #doc.name>64 then return nil,"Level name is limited to 64 bytes" end
    local e=doc.editor
    if type(e)~="table" then return nil,"Missing editor block" end
    local profile_ok,profile_err=require('main.terrain_perspective.profile').validate(doc)
    if not profile_ok then return nil,profile_err,true end
    if (e.editor_version~=1 and e.editor_version~=2 and e.editor_version~=3 and e.editor_version~=4 and e.editor_version~=5 and e.editor_version~=6 and e.editor_version~=7 and e.editor_version~=8 and e.editor_version~=9) or e.compiler_version~=e.editor_version then
        return nil,"Unsupported editor version "..tostring(e.editor_version).."/compiler "..tostring(e.compiler_version),true
    end
    if type(e.revision)~="number" or e.revision<0 or e.revision%1~=0 or type(e.next_id)~="number" or e.next_id<1 or e.next_id%1~=0 then return nil,"Invalid editor revision" end
    if type(e.objects)~="table" or #e.objects>M.MAX_OBJECTS then return nil,"Source object limit is 256; remove objects or split the document" end
    if e.editor_version>=4 then
        local s=e.sampling
        if type(s)~="table" or s.tolerance~=M.SAMPLING.tolerance or s.max_segment~=M.SAMPLING.max_segment then
            return nil,"Unsupported sampling settings "..(type(s)=="table" and tostring(s.tolerance).."/"..tostring(s.max_segment) or "(missing)"),true
        end
    elseif e.sampling~=nil then return nil,"Sampling settings need editor version 4" end
    if e.medal_times~=nil and e.editor_version<8 then return nil,'Medal targets require editor/compiler version 8',true end
    local medal_ok,medal_err,medal_unknown=require('main.gym.medals').validate(e.medal_times)
    if not medal_ok then return nil,medal_err,medal_unknown end
    local look_ok,look_err,look_unknown=require("main.terrain_perspective.look").validate(e)
    if not look_ok then return nil,look_err,look_unknown end
    local ids,total,pickups,coin_count={},0,{},0
    for _,o in ipairs(e.objects) do
        if type(o)~="table" or type(o.id)~="string" then return nil,"Invalid editor object" end
        local n=tonumber(o.id:match("^o(%d+)$"))
        if not n or n>=e.next_id then return nil,"Invalid object id "..o.id end
        if ids[o.id] then return nil,"Duplicate object id "..o.id end
        ids[o.id]=true
        if o.name~=nil and (type(o.name)~="string" or #o.name>64 or o.name:find("[%z\1-\31\127]")) then return nil,"Object name is limited to 64 bytes without control characters: "..o.id end
        if (o.hidden~=nil and type(o.hidden)~="boolean") or (o.locked~=nil and type(o.locked)~="boolean") then return nil,"Invalid visibility/lock: "..o.id end
        if e.editor_version<7 and (o.name~=nil or o.hidden~=nil or o.locked~=nil) then return nil,"Object metadata needs editor version 7: "..o.id end
        local list=o.type=="line" and o.points or o.type=="hull" and o.vertices
        if o.type=='coin' then
            if e.editor_version<9 then return nil,'Ordinary coins require editor/compiler version 9',true end
            local cd=require 'main.gym.coin_data'
            if not point(o.position) or not cd.id(o.pickup_id) or pickups[o.pickup_id] then return nil,'Invalid/duplicate coin pickup ID: '..o.id end
            pickups[o.pickup_id]=true;coin_count=coin_count+1
            if coin_count>cd.MAX then return nil,'Ordinary coin limit is '..cd.MAX end
        elseif o.type=="label" then
            if not point(o.position) or type(o.text)~="string" or #o.text>64 then return nil,"Invalid label "..o.id end
        elseif o.type=="prefab" then
            if e.editor_version<3 then return nil,"Prefab "..o.id.." needs editor version 3" end
            if (o.kind=="wave" and e.editor_version<4) then return nil,"Bump/wave "..o.id.." needs editor version 4" end
            -- An LE5a (version 3) Step is a bare riser: it upgrades to tread 0, the same shape.
            if e.editor_version==3 and o.kind=="step" and type(o.params)=="table" and o.params.length==nil and o.params.riser==nil then
                o.params.length,o.params.riser=0,"start"
            end
            local ok,err=prefab.validate(o,finite)
            if not ok then return nil,"Invalid prefab "..o.id..": "..err end
            total=total+prefab.count(o)
        elseif o.type=="curve" then
            if e.editor_version<4 then return nil,"Curve "..o.id.." needs editor version 4" end
            local a=o.anchors
            if type(a)~="table" or #a<2 or #a>M.MAX_POINTS then return nil,"Invalid anchor count in "..o.id end
            for _,x in ipairs(a) do
                local function tangent(t) return type(t)=="table" and #t==2 and finite(t[1]) and finite(t[2]) and math.abs(t[1])<=1000 and math.abs(t[2])<=1000 end
                if type(x)~="table" or not point(x.p) or not tangent(x["in"]) or not tangent(x.out) or not M.MODES[x.mode] then return nil,"Invalid anchor in "..o.id end
                -- A corner (version 5) has no tangents.
                if x.mode=="corner" and (e.editor_version<5 or x["in"][1]~=0 or x["in"][2]~=0 or x.out[1]~=0 or x.out[2]~=0) then return nil,"Invalid corner anchor in "..o.id end
            end
            total=total+3*#a
        elseif type(list)=="table" then
            if #list<(o.type=="line" and 2 or 3) or #list>(o.type=="line" and M.MAX_POINTS or 8) then return nil,"Invalid point count in "..o.id end
            for _,p in ipairs(list) do if not point(p) then return nil,"Invalid point in "..o.id end end
            total=total+#list
        else return nil,"Unknown object type in "..o.id end
    end
    if total>M.MAX_TOTAL_POINTS then return nil,"Source point limit is 8192; remove objects/anchors or split the document" end
    local s=e.start
    if type(s)~="table" or not point(s.position) or not finite(s.speed) or math.abs(s.speed)>30 then return nil,"Invalid START" end
    if e.finish~=nil and (type(e.finish)~="table" or not point(e.finish.position) or (e.finish.direction~=1 and e.finish.direction~=-1)) then return nil,"Invalid FINISH" end
    if e.compiled_revision~=nil and (type(e.compiled_revision)~="number" or e.compiled_revision>e.revision) then return nil,"Invalid compiled revision" end
    -- Connections (R4, v2): exit (last point) of `from` to entry (first point) of `to`, ends coincide,
    -- each end used once, no loops. Version 1 has none.
    local conns=e.connections
    if e.editor_version==1 then
        if conns~=nil and (type(conns)~="table" or #conns>0) then return nil,"Connections need editor version 2" end
    elseif type(conns)~="table" or #conns>M.MAX_OBJECTS then return nil,"Missing or too many connections" end
    local pieces,from,to={}, {}, {}
    for _,o in ipairs(e.objects) do if M.terrain(o) then pieces[o.id]=o end end
    for _,c in ipairs(conns or {}) do
        local a,b=type(c)=="table" and pieces[c.from],type(c)=="table" and pieces[c.to]
        if not a or not b or a==b then return nil,"Invalid connection" end
        if from[c.from] or to[c.to] then return nil,"Connection end used twice: "..c.from.." -> "..c.to end
        if not same(M.exit(a),M.entry(b)) then return nil,"Connected ends do not meet: "..c.from.." -> "..c.to end
        from[c.from],to[c.to]=c.to,c.from
    end
    for id in pairs(from) do
        local n,seen=id,0
        while from[n] do n=from[n];seen=seen+1;if n==id or seen>M.MAX_OBJECTS then return nil,"Connections form a loop at "..id end end
    end
    -- Upgrade a supported version 1-3 document in place: same geometry and connections (none in 1); the
    -- sampling settings are recorded.
    if e.editor_version<4 then e.sampling={tolerance=M.SAMPLING.tolerance,max_segment=M.SAMPLING.max_segment} end
    if e.editor_version<6 then
        -- Compiled data of a curve from compiler 4-5 no longer matches a recompile: out of date, as after an
        -- autosaved edit, so the level opens without an R1 conflict and Play compiles it again.
        for _,o in ipairs(e.objects) do if o.type=="curve" then e.compiled_revision=nil end end
        e.editor_version,e.compiler_version,e.connections=6,6,e.connections or {}
    end
    e.editor_version,e.compiler_version=M.EDITOR_VERSION,M.COMPILER_VERSION
    return doc
end

-- Connected runs (R4): terrain pieces (lines, terrain prefabs) linked exit -> entry, ordered from head
-- to tail. Unconnected pieces are runs of one. Every piece is in exactly one run (no loops).
function M.links(e)
    local next,prev={},{}
    for _,c in ipairs(e.connections or {}) do next[c.from],prev[c.to]=c.to,c.from end
    return next,prev
end
function M.runs(e)
    local next,prev=M.links(e)
    local list={}
    for _,o in ipairs(e.objects) do
        if M.terrain(o) and not prev[o.id] then
            local run,id={},o.id
            while id do run[#run+1]=id;id=next[id] end
            list[#list+1]=run
        end
    end
    return list
end
function M.pieces(e) local t={};for _,o in ipairs(e.objects) do if M.terrain(o) then t[o.id]=o end end;return t end
-- The collision chains of a run (R4, D8): its pieces merged with each joint once, so a connected run is
-- one chain. Only the open jump gap of a Kicker + landing ends a chain; its landing starts the next one.
-- Each chain is {points, owner} with the piece that owns each point.
function M.run_chains(e,run,pieces)
    pieces=pieces or M.pieces(e)
    local chains,pts,owner={},{},{}
    for _,id in ipairs(run) do
        for k,part in ipairs(M.parts(pieces[id])) do
            if k>1 then chains[#chains+1]={points=pts,owner=owner};pts,owner={},{} end
            for i,p in ipairs(part) do
                if #pts==0 or i>1 then pts[#pts+1]=p;owner[#pts]=id end
            end
        end
    end
    chains[#chains+1]={points=pts,owner=owner}
    return chains
end

-- Supported terrain domain (R16, LE3b), checked on every compile:
-- * Points of a run are at least 1 cm apart (station rule); joints are merged first.
-- * A run never doubles back onto its previous segment (a zero-width spike) and never crosses or
--   touches itself (this also rules out closed loops).
-- * A run that keeps one x direction compiles as before: one chain written right to left, solid
--   below every non-vertical segment, step walls facing the lower side.
-- * A run that turns back in x (overhang, curl) or has no x extent (a wall) is two-sided: its chain
--   is built a second time in reverse at the same place, because Box2D chains collide only on the
--   right of each segment. Both sides then drive, the inside of a curl included (decision 2026-10-19).
-- * One chain per run (no seams, A18/D8): at most 2048 points per run and 32 chains, a two-sided run
--   counting twice.
-- Logical entry/exit order stays as drawn and does not decide collision.
local function at(p) return string.format("(%.2f, %.2f) m",p[1],p[2]) end
-- True when the run keeps one x direction (vertical steps allowed) and has some x extent.
function M.one_sided(pts)
    local sign
    for i=2,#pts do
        local dx=pts[i][1]-pts[i-1][1]
        if math.abs(dx)>1e-9 then
            local s=dx>0 and 1 or -1
            if sign and s~=sign then return false end
            sign=s
        end
    end
    return sign~=nil
end
-- Segments a-b and c-d intersect or touch (orientation test with a small tolerance in metres).
local function cross(a,b,c,d)
    local function o(p,q,r) return (q[1]-p[1])*(r[2]-p[2])-(q[2]-p[2])*(r[1]-p[1]) end
    local function on(p,q,r) return math.min(p[1],q[1])-1e-9<=r[1] and r[1]<=math.max(p[1],q[1])+1e-9 and math.min(p[2],q[2])-1e-9<=r[2] and r[2]<=math.max(p[2],q[2])+1e-9 end
    local eps=1e-9
    local d1,d2,d3,d4=o(c,d,a),o(c,d,b),o(a,b,c),o(a,b,d)
    if ((d1>eps and d2<-eps) or (d1<-eps and d2>eps)) and ((d3>eps and d4<-eps) or (d3<-eps and d4>eps)) then return true end
    return (math.abs(d1)<=eps and on(c,d,a)) or (math.abs(d2)<=eps and on(c,d,b)) or (math.abs(d3)<=eps and on(a,b,c)) or (math.abs(d4)<=eps and on(a,b,d))
end
-- Grid cells a segment passes through, column by column (a conservative superset: boundaries and a
-- 1e-9 m margin count on both sides), so two segments that meet always share a cell.
local function cells(a,b,x0,y0,size,fn)
    local eps=1e-9
    local lo,hi=math.min(a[1],b[1]),math.max(a[1],b[1])
    for i=math.floor((lo-eps-x0)/size),math.floor((hi+eps-x0)/size) do
        local ya,yb=a[2],b[2]
        if hi-lo>eps then
            local xa,xb=math.max(lo,x0+i*size),math.min(hi,x0+(i+1)*size)
            ya=a[2]+(b[2]-a[2])*(xa-a[1])/(b[1]-a[1])
            yb=a[2]+(b[2]-a[2])*(xb-a[1])/(b[1]-a[1])
        end
        for j=math.floor((math.min(ya,yb)-eps-y0)/size),math.floor((math.max(ya,yb)+eps-y0)/size) do fn(i,j) end
    end
end
-- First pair of non-adjacent segments of a run that cross or touch, via a uniform grid (cells sized
-- from the run's extent). Returns the later segment's start index.
local function self_cross(pts)
    local n=#pts-1
    if n<3 then return nil end
    local x0,x1,y0,y1=math.huge,-math.huge,math.huge,-math.huge
    for _,p in ipairs(pts) do x0,x1,y0,y1=math.min(x0,p[1]),math.max(x1,p[1]),math.min(y0,p[2]),math.max(y1,p[2]) end
    local size=math.max(0.5,(x1-x0+y1-y0)/math.sqrt(n)/2)
    local grid={}
    for s=1,n do
        local a,b=pts[s],pts[s+1]
        local checked,found={},false
        cells(a,b,x0,y0,size,function(i,j)
            if found then return end
            local key=i*1048576+j
            local cell=grid[key]
            if not cell then cell={};grid[key]=cell end
            for _,t in ipairs(cell) do
                if not checked[t] and t<s-1 then
                    checked[t]=true
                    if cross(pts[t],pts[t+1],a,b) then found=true;return end
                end
            end
            cell[#cell+1]=s
        end)
        if found then return s end
    end
end
-- Problems (LE3; jump-to-problem LE6): Play-blocking errors and warnings as messages, plus a target per
-- message where it has one: {ids = source object ids (pieces, prefabs, curves; never sampled segments),
-- at = a location in metres, start = true for START}. Messages without a target stay unlocated.
function M.problems(e)
    local errors,warnings={},{}
    local error_at,warning_at={},{}
    local pieces=M.pieces(e)
    local runs=M.runs(e)
    local hulls=false
    for _,o in ipairs(e.objects) do hulls=hulls or M.outline(o)~=nil end
    if #runs==0 and not hulls then errors[#errors+1]="No terrain yet: draw a line [D] or a curve [C], or place a prefab [P]." end
    for _,o in ipairs(e.objects) do
        local err=M.sample_error(o)
        if err then errors[#errors+1]=M.label(o).." "..err..".";error_at[#errors]={ids={o.id}} end
    end
    local chains=0
    for _,run in ipairs(runs) do
        local name=#run>1 and "Run "..run[1].."-"..run[#run] or M.label(pieces[run[1]])
        for _,chain in ipairs(M.run_chains(e,run,pieces)) do
            local pts,owner=chain.points,chain.owner
            if #pts>2048 then errors[#errors+1]=name.." has "..#pts.." points; the limit is 2048 per connected run.";error_at[#errors]={ids=run} end
            local bad
            for i=2,#pts do
                local a,b=pts[i-1],pts[i]
                local dx,dy=b[1]-a[1],b[2]-a[2]
                if dx*dx+dy*dy<0.0001 then errors[#errors+1]=M.label(pieces[owner[i]]).." has points closer than 1 cm at "..at(b)..".";error_at[#errors]={ids={owner[i]},at={b[1],b[2]}};bad=true;break end
                local c=pts[i+1]
                if c then
                    local ex,ey=c[1]-b[1],c[2]-b[2]
                    local l=math.sqrt((dx*dx+dy*dy)*(ex*ex+ey*ey))
                    if dx*ex+dy*ey<0 and math.abs(dx*ey-dy*ex)<=1e-6*l then
                        errors[#errors+1]=M.label(pieces[owner[i]]).." doubles back on itself at "..at(b)..".";error_at[#errors]={ids={owner[i]},at={b[1],b[2]}};bad=true;break
                    end
                end
            end
            local one=M.one_sided(pts)
            if not bad and not one and #pts<=2048 then
                local s=self_cross(pts)
                if s then errors[#errors+1]=name.." crosses itself near "..at(pts[s])..": a run must not cross or close on itself.";error_at[#errors]={ids={owner[s]},at={pts[s][1],pts[s][2]}} end
            end
            chains=chains+(one and 1 or 2)
        end
    end
    if chains>32 then errors[#errors+1]=chains.." terrain chains (a run that turns back counts twice); the limit is 32. Connect pieces into runs [J]." end
    -- Ends that touch without a connection compile into two chains: a seam the wheels can bump on (A18).
    local next,prev=M.links(e)
    local ends={}
    for _,o in ipairs(e.objects) do
        if M.terrain(o) then
            if not prev[o.id] then ends[#ends+1]={o.id,"start",M.entry(o)} end
            if not next[o.id] then ends[#ends+1]={o.id,"end",M.exit(o)} end
        end
    end
    -- Sorted by x, only ends within 1 cm in x are compared.
    table.sort(ends,function(a,b) return a[3][1]<b[3][1] end)
    for i=1,#ends do
        local j=i+1
        while ends[j] and ends[j][3][1]-ends[i][3][1]<=0.01 do
            local a,b=ends[i],ends[j]
            if a[1]~=b[1] and same(a[3],b[3],0.01) then
                warnings[#warnings+1]=a[1].." "..a[2].." and "..b[1].." "..b[2].." touch but are not connected (seam bump). Select the end and press Connect [J]."
                warning_at[#warnings]={ids={a[1],b[1]},at={a[3][1],a[3][2]}}
            end
            j=j+1
        end
    end
    if not M.surface(e,e.start.position) then
        warnings[#warnings+1]="START has no terrain below it.";warning_at[#warnings]={start=true,at={e.start.position[1],e.start.position[2]}}
    end
    return errors,warnings,error_at,warning_at
end

-- Geometry helpers (metres): every terrain segment (not across a jump gap) and every obstacle edge.
local function each_segment(e,fn)
    for _,o in ipairs(e.objects) do
        local outline=M.outline(o)
        if outline then for i,p in ipairs(outline) do fn(p,outline[i%#outline+1],o) end
        else
            for _,part in ipairs(M.parts(o)) do for i=2,#part do fn(part[i-1],part[i],o) end end
        end
    end
end
M.each_segment=each_segment
local function segment_box(a,b,box)
    -- Liang-Barsky clip of segment a-b against the box.
    local t0,t1=0,1
    local dx,dy=b[1]-a[1],b[2]-a[2]
    for _,c in ipairs({{-dx,a[1]-box[1]},{dx,box[2]-a[1]},{-dy,a[2]-box[3]},{dy,box[4]-a[2]}}) do
        local p,q=c[1],c[2]
        if p==0 then if q<0 then return false end
        else
            local r=q/p
            if p<0 then if r>t1 then return false elseif r>t0 then t0=r end
            else if r<t0 then return false elseif r<t1 then t1=r end end
        end
    end
    return true
end
M.segment_box=segment_box
local function inside_hull(v,p)
    for i,a in ipairs(v) do
        local b=v[i%#v+1]
        if (b[1]-a[1])*(p[2]-a[2])-(b[2]-a[2])*(p[1]-a[1])<0 then return false end
    end
    return true
end
-- Clearance for the complete upright vehicle (R10): no terrain edge in its box, not inside a hull.
function M.blocked(e,p)
    local box={p[1]+M.VEHICLE[1],p[1]+M.VEHICLE[2],p[2]+M.VEHICLE[3],p[2]+M.VEHICLE[4]}
    local hit
    each_segment(e,function(a,b,o) if not hit and segment_box(a,b,box) then hit=o end end)
    if hit then return hit end
    for _,o in ipairs(e.objects) do local v=M.outline(o);if v and inside_hull(v,p) then return o end end
end
-- Highest terrain/hull edge directly below p (R10 "start on surface").
-- top_only additionally excludes hull undersides for editor pickup projection.
function M.surface(e,p,top_only)
    local best
    each_segment(e,function(a,b,o)
        -- CCW hull outward normals point up only on edges travelling to the left.
        if top_only and M.outline(o) and b[1]>=a[1] then return end
        local lo,hi=math.min(a[1],b[1]),math.max(a[1],b[1])
        if hi-lo<1e-9 or p[1]<lo or p[1]>hi then return end
        local y=a[2]+(b[2]-a[2])*(p[1]-a[1])/(b[1]-a[1])
        if y<=p[2] and (not best or y>best) then best=y end
    end)
    return best
end

-- The authored extent {x0, x1, y0, y1}: both ends of every terrain and hull edge, labels, the START
-- vehicle box and the FINISH segment (Fit level, LE6; R13 adds the margin to it).
local function extent(e)
    local b={math.huge,-math.huge,math.huge,-math.huge}
    local function add(x,y) b[1]=math.min(b[1],x);b[2]=math.max(b[2],x);b[3]=math.min(b[3],y);b[4]=math.max(b[4],y) end
    -- Both ends of every edge: an open line's last point is no edge's start.
    each_segment(e,function(a,b) add(a[1],a[2]);add(b[1],b[2]) end)
    for _,o in ipairs(e.objects) do if o.type=='label' or o.type=='coin' then add(o.position[1],o.position[2]);if o.type=='coin' then add(o.position[1]-.25,o.position[2]-.25);add(o.position[1]+.25,o.position[2]+.25) end end end
    local s=e.start.position
    add(s[1]+M.VEHICLE[1],s[2]+M.VEHICLE[3]);add(s[1]+M.VEHICLE[2],s[2]+M.VEHICLE[4])
    if e.finish then local f=e.finish.position;add(f[1],f[2]-M.FINISH_BELOW);add(f[1],f[2]+M.FINISH_ABOVE) end
    return b
end
M.extent=extent
-- R13: bounds from terrain, hulls, labels, START (vehicle box) and FINISH segment plus a margin.
local function bounds(e)
    local b=extent(e)
    return {b[1]-M.MARGIN,b[2]+M.MARGIN,b[3]-M.MARGIN,b[4]+M.HEADROOM}
end
M.bounds=bounds
-- Compiler (R1): writes every field the station validator requires from the editor sources.
-- A test start replaces only the run's spawn and speed; bounds always come from the sources.
-- errors: the result of M.problems when the caller already has it (saves a second domain check).
function M.compile(doc,test,errors)
    local e=doc.editor
    local d={schema=1,units="metres",id=doc.id,name=doc.name,spawn={e.start.position[1],e.start.position[2]},start_speed=e.start.speed,
        run_in=0,run_out=0,bounds=bounds(e),chains={},hulls={},labels={},checkpoints={}}
    errors=errors or M.problems(e)
    if errors[1] then return nil,errors[1] end
    local pieces=M.pieces(e)
    -- A connected run compiles into one chain (R4, D8): no seams between its pieces; only the open gap
    -- of a Kicker + landing splits it. A run that turns back is marked two-sided; the station builder
    -- adds its reversed chain.
    local sides,two={},false
    for _,run in ipairs(M.runs(e)) do
        for _,c in ipairs(M.run_chains(e,run,pieces)) do
            local chain=points(c.points)
            -- Solid side below the drawn line: the built-in stations run right to left.
            if chain[1][1]<chain[#chain][1] then
                local r={};for i=#chain,1,-1 do r[#r+1]=chain[i] end;chain=r
            end
            d.chains[#d.chains+1]=chain
            sides[#sides+1]=not M.one_sided(chain)
            two=two or sides[#sides]
        end
    end
    if two then d.two_sided=sides end
    for _,o in ipairs(e.objects) do
        local outline=M.outline(o)
        if outline then d.hulls[#d.hulls+1]={vertices=points(outline)}
        elseif o.type=='coin' then d.coins=d.coins or {version=1,items={}};d.coins.items[#d.coins.items+1]={id=o.pickup_id,position=copy(o.position)}
        elseif o.type=="label" then d.labels[#d.labels+1]={position={o.position[1],o.position[2]},text=o.text} end
    end
    if e.finish then
        local f=e.finish.position
        d.finish={position={f[1],f[2]},line={{f[1],f[2]-M.FINISH_BELOW},{f[1],f[2]+M.FINISH_ABOVE}},direction={e.finish.direction,0}}
    end
    if d.coins then d.schema=2 end
    d.medal_times=copy(e.medal_times)
    d.editor=copy(e);d.editor.compiled_revision=e.revision
    local valid,err=data.validate(d)
    if not valid then return nil,err end
    local blocked=M.blocked(e,e.start.position)
    if blocked then return nil,"START overlaps "..M.label(blocked):lower() end
    if test then
        local run=copy(d)
        run.spawn={test.position[1],test.position[2]};run.start_speed=test.speed
        return d,nil,run
    end
    return d
end
-- Temporary test start (R10): refused outside the bounds, inside geometry, beyond the start limit or
-- without a surface below ("surface" mode). Never changes the document.
function M.test_start(doc,p,mode)
    local e=doc.editor
    local pos={p[1],p[2]}
    if mode=="surface" then
        local y=M.surface(e,p)
        if not y then return nil,"no surface below the cursor" end
        pos[2]=y+M.CLEARANCE
    end
    local b=bounds(e)
    if pos[1]<=b[1] or pos[1]>=b[2] or pos[2]<=b[3] or pos[2]>=b[4] then return nil,"outside the level bounds" end
    if not data.start_allowed(pos) then return nil,"outside the "..data.START_LIMIT.." m start limit" end
    local blocked=M.blocked(e,pos)
    if blocked then return nil,"the vehicle would overlap "..M.label(blocked):lower() end
    return pos
end
-- Snapshot undo (R17): bounded copies of authoring data only; one entry per completed action.
-- Each entry carries the instance token of the document it belongs to (not its level id: two template
-- copies of one station share the id), so Undo/Redo across a document replacement is recognisable.
function M.history(limit) return {limit=limit or 100,undo={},redo={}} end
function M.record(h,doc,instance)
    h.undo[#h.undo+1]={doc=copy(doc),instance=instance};h.redo={}
    if #h.undo>h.limit then table.remove(h.undo,1) end
end
-- Returns the restored document and its instance token.
function M.step(h,doc,back,instance)
    local from,to=back and h.undo or h.redo,back and h.redo or h.undo
    if #from==0 then return nil end
    to[#to+1]={doc=copy(doc),instance=instance}
    local entry=table.remove(from)
    return entry.doc,entry.instance
end
require("main.terrain_perspective.look").document=M -- source-only callbacks avoid a Bob module cycle
return M
