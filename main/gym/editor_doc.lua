-- Level editor source documents (level-editor contract R1-R4, R9, R10, R13, R16). Pure: no engine
-- calls besides json, metres throughout. The editor block is authoritative; Play recompiles from it.
local data=require "main.gym.station_data"
-- Version 2 (LE3) adds explicit connections and compiles each connected run into one chain.
-- Version 1 documents have no connections and open upgraded; their single lines compile unchanged.
local M={EDITOR_VERSION=2,COMPILER_VERSION=2}
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
-- Connected ends coincide (R4); the editor makes them exactly equal, JSON keeps them equal.
M.JOINT=1e-6
local function same(a,b,eps) return math.abs(a[1]-b[1])<=(eps or M.JOINT) and math.abs(a[2]-b[2])<=(eps or M.JOINT) end
M.same=same

-- Station JSON (built-in or custom, without editor block) -> editable lines/hulls/labels (R2).
local function from_station(d,id,name)
    local e={editor_version=M.EDITOR_VERSION,compiler_version=M.COMPILER_VERSION,revision=0,next_id=1,objects={},connections={},
        start={position={d.spawn[1],d.spawn[2]},speed=d.start_speed or 0}}
    for _,chain in ipairs(d.chains or {}) do
        -- Logical order runs left to right ("downstream" = right, LE3); the compiler orients chains.
        local list=points(chain)
        if list[1][1]>list[#list][1] then local r={};for i=#list,1,-1 do r[#r+1]=list[i] end;list=r end
        e.objects[#e.objects+1]={id=new_id(e),type="line",points=list}
    end
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
    if (e.editor_version~=1 and e.editor_version~=2) or e.compiler_version~=e.editor_version then
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
    -- Connections (R4, v2): exit (last point) of `from` to entry (first point) of `to`, ends coincide,
    -- each end used once, no loops. Version 1 has none.
    local conns=e.connections
    if e.editor_version==1 then
        if conns~=nil and (type(conns)~="table" or #conns>0) then return nil,"Connections need editor version 2" end
    elseif type(conns)~="table" or #conns>M.MAX_OBJECTS then return nil,"Missing or too many connections" end
    local lines,from,to={}, {}, {}
    for _,o in ipairs(e.objects) do if o.type=="line" then lines[o.id]=o end end
    for _,c in ipairs(conns or {}) do
        local a,b=type(c)=="table" and lines[c.from],type(c)=="table" and lines[c.to]
        if not a or not b or a==b then return nil,"Invalid connection" end
        if from[c.from] or to[c.to] then return nil,"Connection end used twice: "..c.from.." -> "..c.to end
        if not same(a.points[#a.points],b.points[1]) then return nil,"Connected ends do not meet: "..c.from.." -> "..c.to end
        from[c.from],to[c.to]=c.to,c.from
    end
    for id in pairs(from) do
        local n,seen=id,0
        while from[n] do n=from[n];seen=seen+1;if n==id or seen>M.MAX_OBJECTS then return nil,"Connections form a loop at "..id end end
    end
    -- Upgrade a supported version 1 document in place: same geometry, no connections.
    if e.editor_version==1 then e.editor_version,e.compiler_version,e.connections=2,2,{} end
    return doc
end

-- Connected runs (R4): lines linked exit -> entry, ordered from head to tail. Unconnected lines are
-- runs of one piece. Every line is in exactly one run (the validator rules out loops).
function M.links(e)
    local next,prev={},{}
    for _,c in ipairs(e.connections or {}) do next[c.from],prev[c.to]=c.to,c.from end
    return next,prev
end
function M.runs(e)
    local next,prev=M.links(e)
    local list={}
    for _,o in ipairs(e.objects) do
        if o.type=="line" and not prev[o.id] then
            local run,id={},o.id
            while id do run[#run+1]=id;id=next[id] end
            list[#list+1]=run
        end
    end
    return list
end
function M.lines(e) local t={};for _,o in ipairs(e.objects) do if o.type=="line" then t[o.id]=o end end;return t end
-- Merged run points (each joint once) and the line that owns each point.
function M.run_points(e,run,lines)
    lines=lines or M.lines(e)
    local pts,owner={}, {}
    for k,id in ipairs(run) do
        for i,p in ipairs(lines[id].points) do
            if k==1 or i>1 then pts[#pts+1]=p;owner[#pts]=id end
        end
    end
    return pts,owner
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
function M.problems(e)
    local errors,warnings={},{}
    local lines=M.lines(e)
    local runs=M.runs(e)
    local hulls=false
    for _,o in ipairs(e.objects) do hulls=hulls or o.type=="hull" end
    if #runs==0 and not hulls then errors[#errors+1]="No terrain yet: draw a line [D]." end
    local chains=0
    for _,run in ipairs(runs) do
        local pts,owner=M.run_points(e,run,lines)
        local name=#run>1 and "Run "..run[1].."-"..run[#run] or "Line "..run[1]
        if #pts>2048 then errors[#errors+1]=name.." has "..#pts.." points; the limit is 2048 per connected run." end
        local bad
        for i=2,#pts do
            local a,b=pts[i-1],pts[i]
            local dx,dy=b[1]-a[1],b[2]-a[2]
            if dx*dx+dy*dy<0.0001 then errors[#errors+1]="Line "..owner[i].." has points closer than 1 cm at "..at(b)..".";bad=true;break end
            local c=pts[i+1]
            if c then
                local ex,ey=c[1]-b[1],c[2]-b[2]
                local l=math.sqrt((dx*dx+dy*dy)*(ex*ex+ey*ey))
                if dx*ex+dy*ey<0 and math.abs(dx*ey-dy*ex)<=1e-6*l then
                    errors[#errors+1]="Line "..owner[i].." doubles back on itself at "..at(b)..".";bad=true;break
                end
            end
        end
        local one=M.one_sided(pts)
        if not bad and not one and #pts<=2048 then
            local s=self_cross(pts)
            if s then errors[#errors+1]=name.." crosses itself near "..at(pts[s])..": a run must not cross or close on itself." end
        end
        chains=chains+(one and 1 or 2)
    end
    if chains>32 then errors[#errors+1]=chains.." terrain chains (a run that turns back counts twice); the limit is 32. Connect pieces into runs [J]." end
    -- Ends that touch without a connection compile into two chains: a seam the wheels can bump on (A18).
    local next,prev=M.links(e)
    local ends={}
    for _,o in ipairs(e.objects) do
        if o.type=="line" then
            if not prev[o.id] then ends[#ends+1]={o.id,"start",o.points[1]} end
            if not next[o.id] then ends[#ends+1]={o.id,"end",o.points[#o.points]} end
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
            end
            j=j+1
        end
    end
    if not M.surface(e,e.start.position) then warnings[#warnings+1]="START has no terrain below it." end
    return errors,warnings
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
-- errors: the result of M.problems when the caller already has it (saves a second domain check).
function M.compile(doc,test,errors)
    local e=doc.editor
    local d={schema=1,units="metres",id=doc.id,name=doc.name,spawn={e.start.position[1],e.start.position[2]},start_speed=e.start.speed,
        run_in=0,run_out=0,bounds=bounds(e),chains={},hulls={},labels={},checkpoints={}}
    errors=errors or M.problems(e)
    if errors[1] then return nil,errors[1] end
    local lines=M.lines(e)
    -- A connected run compiles into one chain (R4, D8): no seams between its pieces. A run that
    -- turns back is marked two-sided; the station builder adds its reversed chain.
    local sides,two={},false
    for _,run in ipairs(M.runs(e)) do
        local chain=points((M.run_points(e,run,lines)))
        -- Solid side below the drawn line: the built-in stations run right to left.
        if chain[1][1]<chain[#chain][1] then
            local r={};for i=#chain,1,-1 do r[#r+1]=chain[i] end;chain=r
        end
        d.chains[#d.chains+1]=chain
        sides[#sides+1]=not M.one_sided(chain)
        two=two or sides[#sides]
    end
    if two then d.two_sided=sides end
    for _,o in ipairs(e.objects) do
        if o.type=="hull" then d.hulls[#d.hulls+1]={vertices=points(o.vertices)}
        elseif o.type=="label" then d.labels[#d.labels+1]={position={o.position[1],o.position[2]},text=o.text} end
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
