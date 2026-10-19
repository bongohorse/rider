-- Level editor source documents (level-editor contract R1-R3, R9, R10, R13, R16). Pure: no engine
-- calls besides json, metres throughout. The editor block is authoritative; Play recompiles from it.
local data=require "main.gym.station_data"
local M={EDITOR_VERSION=1,COMPILER_VERSION=1}
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
local function points(list) local out={};for i,p in ipairs(list) do out[i]={p[1],p[2]} end;return out end
local function new_id(e) local id="o"..e.next_id;e.next_id=e.next_id+1;return id end

-- Station JSON (built-in or custom, without editor block) -> editable lines/hulls/labels (R2).
local function from_station(d,id,name)
    local e={editor_version=M.EDITOR_VERSION,compiler_version=M.COMPILER_VERSION,revision=0,next_id=1,objects={},
        start={position={d.spawn[1],d.spawn[2]},speed=d.start_speed or 0}}
    for _,chain in ipairs(d.chains or {}) do e.objects[#e.objects+1]={id=new_id(e),type="line",points=points(chain)} end
    for _,h in ipairs(d.hulls or {}) do e.objects[#e.objects+1]={id=new_id(e),type="hull",vertices=points(h.vertices)} end
    for _,l in ipairs(d.labels or {}) do e.objects[#e.objects+1]={id=new_id(e),type="label",position={l.position[1],l.position[2]},text=l.text} end
    if type(d.finish)=="table" and point(d.finish.position) and type(d.finish.direction)=="table" then
        e.finish={position={d.finish.position[1],d.finish.position[2]},direction=d.finish.direction[1]<0 and -1 or 1}
    end
    return {schema=1,units="metres",id=id,name=name,editor=e}
end
-- R3: a template copy is a generic custom level. It keeps only geometry, labels and the start;
-- kind, sections, markers and every other measurement field are dropped by construction.
function M.template(d)
    local name=d.name.." copy"
    if #name>64 then name=d.name:sub(1,59).." copy" end
    return from_station(d,"my-"..d.id,name)
end
-- Opening a custom level: its own editor block if supported, otherwise its compiled geometry (R2).
function M.open_level(d)
    if d.editor~=nil then
        local doc={schema=1,units="metres",id=d.id,name=d.name,editor=copy(d.editor)}
        local ok,err,unsupported=M.validate(doc)
        if not ok then return nil,err,unsupported end
        return doc
    end
    return from_station(d,d.id,d.name)
end

-- R16 source-document validator: structure, versions, finite/bounded input, unique stable ids.
-- Returns nil, message, unsupported (true when only the version is unknown: keep the data untouched).
function M.validate(doc)
    if type(doc)~="table" or doc.schema~=1 or doc.units~="metres" then return nil,"Unsupported document schema/units" end
    if type(doc.id)~="string" or not doc.id:match("^[a-z][a-z0-9%-]*$") or #doc.id>64 then return nil,"Invalid level id" end
    if type(doc.name)~="string" or #doc.name>64 then return nil,"Level name is limited to 64 bytes" end
    local e=doc.editor
    if type(e)~="table" then return nil,"Missing editor block" end
    if e.editor_version~=M.EDITOR_VERSION or e.compiler_version~=M.COMPILER_VERSION then
        return nil,"Unsupported editor version "..tostring(e.editor_version).."/compiler "..tostring(e.compiler_version),true
    end
    if type(e.revision)~="number" or e.revision<0 or e.revision%1~=0 or type(e.next_id)~="number" or e.next_id<1 or e.next_id%1~=0 then return nil,"Invalid editor revision" end
    if type(e.objects)~="table" or #e.objects>M.MAX_OBJECTS then return nil,"Missing or too many editor objects" end
    local ids,total={},0
    for _,o in ipairs(e.objects) do
        if type(o)~="table" or type(o.id)~="string" then return nil,"Invalid editor object" end
        local n=tonumber(o.id:match("^o(%d+)$"))
        if not n or n>=e.next_id then return nil,"Invalid object id "..o.id end
        if ids[o.id] then return nil,"Duplicate object id "..o.id end
        ids[o.id]=true
        local list=o.type=="line" and o.points or o.type=="hull" and o.vertices
        if o.type=="label" then
            if not point(o.position) or type(o.text)~="string" or #o.text>64 then return nil,"Invalid label "..o.id end
        elseif type(list)=="table" then
            if #list<(o.type=="line" and 2 or 3) or #list>(o.type=="line" and M.MAX_POINTS or 8) then return nil,"Invalid point count in "..o.id end
            for _,p in ipairs(list) do if not point(p) then return nil,"Invalid point in "..o.id end end
            total=total+#list
        else return nil,"Unknown object type in "..o.id end
    end
    if total>M.MAX_TOTAL_POINTS then return nil,"Too many points in the document" end
    local s=e.start
    if type(s)~="table" or not point(s.position) or not finite(s.speed) or math.abs(s.speed)>30 then return nil,"Invalid START" end
    if e.finish~=nil and (type(e.finish)~="table" or not point(e.finish.position) or (e.finish.direction~=1 and e.finish.direction~=-1)) then return nil,"Invalid FINISH" end
    if e.compiled_revision~=nil and (type(e.compiled_revision)~="number" or e.compiled_revision>e.revision) then return nil,"Invalid compiled revision" end
    return doc
end

-- Geometry helpers (metres).
local function each_segment(e,fn)
    for _,o in ipairs(e.objects) do
        if o.type=="line" then for i=2,#o.points do fn(o.points[i-1],o.points[i],o) end
        elseif o.type=="hull" then for i,p in ipairs(o.vertices) do fn(p,o.vertices[i%#o.vertices+1],o) end end
    end
end
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
    for _,o in ipairs(e.objects) do if o.type=="hull" and inside_hull(o.vertices,p) then return o end end
end
-- Highest terrain/hull edge directly below p (R10 "start on surface").
function M.surface(e,p)
    local best
    each_segment(e,function(a,b)
        local lo,hi=math.min(a[1],b[1]),math.max(a[1],b[1])
        if hi-lo<1e-9 or p[1]<lo or p[1]>hi then return end
        local y=a[2]+(b[2]-a[2])*(p[1]-a[1])/(b[1]-a[1])
        if y<=p[2] and (not best or y>best) then best=y end
    end)
    return best
end

-- R13: bounds from terrain, hulls, labels, START (vehicle box) and FINISH segment plus a margin.
local function bounds(e)
    local b={math.huge,-math.huge,math.huge,-math.huge}
    local function add(x,y) b[1]=math.min(b[1],x);b[2]=math.max(b[2],x);b[3]=math.min(b[3],y);b[4]=math.max(b[4],y) end
    -- Both ends of every edge: an open line's last point is no edge's start.
    each_segment(e,function(a,b) add(a[1],a[2]);add(b[1],b[2]) end)
    for _,o in ipairs(e.objects) do if o.type=="label" then add(o.position[1],o.position[2]) end end
    local s=e.start.position
    add(s[1]+M.VEHICLE[1],s[2]+M.VEHICLE[3]);add(s[1]+M.VEHICLE[2],s[2]+M.VEHICLE[4])
    if e.finish then local f=e.finish.position;add(f[1],f[2]-M.FINISH_BELOW);add(f[1],f[2]+M.FINISH_ABOVE) end
    return {b[1]-M.MARGIN,b[2]+M.MARGIN,b[3]-M.MARGIN,b[4]+M.HEADROOM}
end
M.bounds=bounds
-- Compiler (R1): writes every field the station validator requires from the editor sources.
-- A test start replaces only the run's spawn and speed; bounds always come from the sources.
function M.compile(doc,test)
    local e=doc.editor
    local d={schema=1,units="metres",id=doc.id,name=doc.name,spawn={e.start.position[1],e.start.position[2]},start_speed=e.start.speed,
        run_in=0,run_out=0,bounds=bounds(e),chains={},hulls={},labels={},checkpoints={}}
    for _,o in ipairs(e.objects) do
        if o.type=="line" then
            local chain=points(o.points)
            -- Solid side below the drawn line: the built-in stations run right to left.
            if chain[1][1]<chain[#chain][1] then
                local r={};for i=#chain,1,-1 do r[#r+1]=chain[i] end;chain=r
            end
            d.chains[#d.chains+1]=chain
        elseif o.type=="hull" then d.hulls[#d.hulls+1]={vertices=points(o.vertices)}
        else d.labels[#d.labels+1]={position={o.position[1],o.position[2]},text=o.text} end
    end
    if e.finish then
        local f=e.finish.position
        d.finish={position={f[1],f[2]},line={{f[1],f[2]-M.FINISH_BELOW},{f[1],f[2]+M.FINISH_ABOVE}},direction={e.finish.direction,0}}
    end
    d.editor=copy(e);d.editor.compiled_revision=e.revision
    local valid,err=data.validate(d)
    if not valid then return nil,err end
    local blocked=M.blocked(e,e.start.position)
    if blocked then return nil,"START overlaps "..blocked.type.." "..blocked.id end
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
    if blocked then return nil,"the vehicle would overlap "..blocked.type.." "..blocked.id end
    return pos
end
-- Snapshot undo (R17): bounded copies of authoring data only; one entry per completed action.
function M.history(limit) return {limit=limit or 100,undo={},redo={}} end
function M.record(h,doc)
    h.undo[#h.undo+1]=copy(doc);h.redo={}
    if #h.undo>h.limit then table.remove(h.undo,1) end
end
function M.step(h,doc,back)
    local from,to=back and h.undo or h.redo,back and h.redo or h.undo
    if #from==0 then return nil end
    to[#to+1]=copy(doc)
    return table.remove(from)
end
return M
