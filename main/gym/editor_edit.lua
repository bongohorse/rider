-- Level editor edit operations (LE3; contract R4, R5, R16, R17). Pure: they change the editor block
-- of a document copy in place; the caller validates and commits the result as one Undo step.
local doc_lib=require "main.gym.editor_doc"
local prefab=require "main.gym.editor_prefab"
local M={}
local function find(e,id) for i,o in ipairs(e.objects) do if o.id==id then return o,i end end end
M.find=find
local function new_id(e) local id="o"..e.next_id;e.next_id=e.next_id+1;return id end
local function shift(p,d) p[1],p[2]=p[1]+d[1],p[2]+d[2] end
local function translate_object(o,d)
    if o.type=="label" then shift(o.position,d)
    elseif o.type=="prefab" then shift(o.at,d)
    elseif o.type=="curve" then for _,a in ipairs(o.anchors) do shift(a.p,d) end
    else for _,p in ipairs(o.type=="line" and o.points or o.vertices) do shift(p,d) end end
end
M.translate_object=translate_object
local path=doc_lib.path
-- Places a piece's entry exactly on p (keeps a joint exactly equal after a translation).
local function set_entry(o,p)
    if o.type=="line" then o.points[1]={p[1],p[2]} elseif o.type=="curve" then o.anchors[1].p={p[1],p[2]} else o.at={p[1],p[2]} end
end
-- A piece's end (index 1 or its last path point) placed exactly on p.
local function set_end(o,first,p)
    if o.type=="line" then o.points[first and 1 or #o.points]={p[1],p[2]}
    elseif o.type=="curve" then o.anchors[first and 1 or #o.anchors].p={p[1],p[2]}
    elseif first then o.at={p[1],p[2]} end
end
-- A curve run backwards: anchors reversed, each anchor's tangents swapped (same shape).
local function reverse_curve(o)
    local r={}
    for i=#o.anchors,1,-1 do local a=o.anchors[i];r[#r+1]={p=a.p,["in"]=a.out,out=a["in"],mode=a.mode} end
    o.anchors=r
end
-- A run containing a prefab keeps its direction: prefabs always run left to right.
local function fixed(e,run)
    for _,id in ipairs(run) do if find(e,id).type=="prefab" then return true end end
end
-- The run containing a line, head to tail.
function M.run_of(e,id)
    local next,prev=doc_lib.links(e)
    local head,guard=id,0
    while prev[head] and guard<=#e.objects do head,guard=prev[head],guard+1 end
    local run,n={},head
    while n and #run<=#e.objects do run[#run+1]=n;n=next[n] end
    return run
end
-- Every object a translation moves, each once: a line brings its whole connected run (R4, R17).
function M.closure(e,ids)
    local set,list={},{}
    for _,id in ipairs(ids) do
        local o=find(e,id)
        for _,m in ipairs(o and (doc_lib.terrain(o) and M.run_of(e,id) or {id}) or {}) do
            if not set[m] then set[m]=true;list[#list+1]=m end
        end
    end
    return list,set
end
function M.translate(e,ids,d)
    local list=M.closure(e,ids)
    for _,id in ipairs(list) do translate_object(find(e,id),d) end
    return list
end
function M.downstream(e,id)
    local next=doc_lib.links(e)
    local list,n={},next[id]
    while n and #list<=#e.objects do list[#list+1]=n;n=next[n] end
    return list
end
-- A joint belongs to its upstream piece: (downstream piece, 1) -> (upstream piece, last).
function M.owner(e,id,index)
    local _,prev=doc_lib.links(e)
    if index==1 and prev[id] then local u=find(e,prev[id]);return u.id,#path(u) end
    return id,index
end
function M.joint(e,id,index)
    local o=find(e,id)
    local next,prev=doc_lib.links(e)
    return (index==1 and prev[id]) or (index==#path(o) and next[id]) or nil
end
-- A point edit changes one piece (R4): its entry stays fixed; when its exit moves, the whole
-- downstream run is translated by the same displacement. Upstream pieces never move.
-- Returns the ids of every changed line.
function M.move_vertex(e,id,index,p)
    id,index=M.owner(e,id,index)
    local o=find(e,id)
    -- A prefab changes through its parameters (set_params), never point by point.
    if o.type~="line" then return {} end
    local q=o.points[index]
    local d={p[1]-q[1],p[2]-q[2]}
    o.points[index]={p[1],p[2]}
    local moved={id}
    if index==#o.points then
        for _,m in ipairs(M.downstream(e,id)) do
            local n=find(e,m)
            translate_object(n,d);moved[#moved+1]=m
        end
        -- Keep the joint exactly equal (translation can round differently).
        local n=moved[2] and find(e,moved[2])
        if n then set_entry(n,p) end
    end
    return moved
end
function M.insert_point(e,id,segment,p)
    local o=find(e,id)
    if not o or o.type~="line" or segment<1 or segment>=#o.points then return nil,"No segment to insert into" end
    table.insert(o.points,segment+1,{p[1],p[2]})
    return segment+1
end
-- Deleting an inner point joins its neighbours; deleting a free end shortens the line.
function M.delete_point(e,id,index)
    local o=find(e,id)
    if o.type~="line" then return nil,"A prefab keeps its shape: change its values in the panel, or delete the whole prefab" end
    if M.joint(e,id,index) then return nil,"The point is a connection; disconnect it first [J]" end
    if #o.points<=2 then return nil,"A line needs two points; select the line and delete it instead" end
    table.remove(o.points,index)
    return true
end
-- Split at an inner point: two pieces, connected (a split never creates a seam).
function M.split(e,id,index)
    local o,pos=find(e,id)
    if not o or o.type~="line" or index<=1 or index>=#o.points then return nil,"Split needs a point inside a line" end
    local b={id=new_id(e),type="line",points={}}
    for i=index,#o.points do b.points[#b.points+1]={o.points[i][1],o.points[i][2]} end
    for i=#o.points,index+1,-1 do o.points[i]=nil end
    for _,c in ipairs(e.connections) do if c.from==id then c.from=b.id end end
    e.connections[#e.connections+1]={from=id,to=b.id}
    table.insert(e.objects,pos+1,b)
    return b.id
end
local function reverse_run(e,run)
    if fixed(e,run) then return nil end
    local set={}
    for _,id in ipairs(run) do
        set[id]=true
        local o=find(e,id)
        if o.type=="curve" then reverse_curve(o)
        else local r={};for i=#o.points,1,-1 do r[#r+1]=o.points[i] end;o.points=r end
    end
    for _,c in ipairs(e.connections) do if set[c.from] then c.from,c.to=c.to,c.from end end
    return true
end
-- Logical order runs left to right where the ends allow it, so "downstream" means to the right.
-- A run with a prefab keeps its order (prefabs run left to right).
function M.orient(e,id)
    local run=M.run_of(e,id)
    local head,tail=find(e,run[1]),find(e,run[#run])
    if doc_lib.entry(head)[1]>doc_lib.exit(tail)[1] then return reverse_run(e,run) end
end
-- Free and connected ends of lines and terrain prefabs: {id, index, p, free}.
function M.ends(e)
    local next,prev=doc_lib.links(e)
    local list={}
    for _,o in ipairs(e.objects) do
        if doc_lib.terrain(o) then
            local pts=path(o)
            list[#list+1]={id=o.id,index=1,p=pts[1],free=not prev[o.id]}
            list[#list+1]={id=o.id,index=#pts,p=pts[#pts],free=not next[o.id]}
        end
    end
    return list
end
-- Connect free end a to free end b (R4, R5). a's whole run moves so both ends meet exactly; runs are
-- reversed as needed so the connection always links an exit to an entry. Refuses loops.
-- A prefab's ends connect like line ends; a run with a prefab is never reversed (the other run is, or the
-- connection is refused when both have one).
function M.connect(e,a,b)
    local oa,ob=find(e,a.id),find(e,b.id)
    if not oa or not ob or not doc_lib.terrain(oa) or not doc_lib.terrain(ob) then return nil,"Only line and prefab ends can be connected" end
    local a_first,b_first=a.index==1,b.index==1
    if (not a_first and a.index~=#path(oa)) or (not b_first and b.index~=#path(ob)) then return nil,"Only line and prefab ends can be connected" end
    if M.joint(e,a.id,a.index) or M.joint(e,b.id,b.index) then return nil,"Only free ends can be connected" end
    local run=M.run_of(e,a.id)
    for _,id in ipairs(run) do if id==b.id then return nil,"Connecting these ends would close a loop" end end
    if a_first==b_first and fixed(e,run) and fixed(e,M.run_of(e,b.id)) then
        return nil,"Both runs contain prefabs, which always run left to right: connect an exit (right end) to an entry (left end)"
    end
    local pa,pb=path(oa)[a.index],path(ob)[b.index]
    pb={pb[1],pb[2]}
    M.translate(e,{a.id},{pb[1]-pa[1],pb[2]-pa[2]})
    -- The joint is exact: a line end takes the other end's position (a prefab's derived exit differs
    -- from it at most by rounding).
    if oa.type~="prefab" then set_end(oa,a_first,pb)
    elseif a_first then oa.at=pb
    elseif ob.type~="prefab" then set_end(ob,b_first,path(oa)[a.index]) end
    if a_first==b_first then
        if reverse_run(e,run) then a_first=not a_first else reverse_run(e,M.run_of(e,b.id));b_first=not b_first end
    end
    e.connections[#e.connections+1]=a_first and {from=b.id,to=a.id} or {from=a.id,to=b.id}
    M.orient(e,a.id)
    return true
end
-- Connect two separated free ends (LE3b): a new two-point piece bridges them, connected at both
-- ends; neither end moves. Ends of the same run would close a loop and are refused.
function M.bridge(e,a,b)
    local oa,ob=find(e,a.id),find(e,b.id)
    if not oa or not ob or not doc_lib.terrain(oa) or not doc_lib.terrain(ob) then return nil,"Only line and prefab ends can be connected" end
    if (a.index~=1 and a.index~=#path(oa)) or (b.index~=1 and b.index~=#path(ob)) then return nil,"Only line and prefab ends can be connected" end
    if M.joint(e,a.id,a.index) or M.joint(e,b.id,b.index) then return nil,"Only free ends can be connected" end
    for _,id in ipairs(M.run_of(e,a.id)) do if id==b.id then return nil,"Connecting these ends would close a loop" end end
    local pa,pb=path(oa)[a.index],path(ob)[b.index]
    if (pa[1]-pb[1])^2+(pa[2]-pb[2])^2<0.0001 then return nil,"The ends touch; Connect joins them directly" end
    local id,note=M.add_line(e,{{pa[1],pa[2]},{pb[1],pb[2]}},{id=a.id,index=a.index},{id=b.id,index=b.index})
    if not id then return nil,note end
    if note then return nil,note end
    return id
end
function M.disconnect(e,id,index)
    if not M.joint(e,id,index) then return nil,"The point is not a connection" end
    id=M.owner(e,id,index)
    for i,c in ipairs(e.connections) do
        if c.from==id then
            table.remove(e.connections,i)
            -- A remaining run without prefabs may now run right to left: orient both halves again.
            M.orient(e,id);M.orient(e,c.to)
            return c.to
        end
    end
    return nil,"The point is not a connection"
end
function M.remove(e,ids)
    local set={};for _,id in ipairs(ids) do set[id]=true end
    for i=#e.objects,1,-1 do if set[e.objects[i].id] then table.remove(e.objects,i) end end
    for i=#e.connections,1,-1 do
        local c=e.connections[i]
        if set[c.from] or set[c.to] then table.remove(e.connections,i) end
    end
end
-- A drawn polyline becomes one new piece. Starting or finishing on a free end, which the editor shows
-- as a connect preview, connects it there (R5: deliberate placement confirms). Returns id, note.
function M.add_line(e,pts,first,last)
    local clean={}
    for _,p in ipairs(pts) do
        local q=clean[#clean]
        if not q or (p[1]-q[1])^2+(p[2]-q[2])^2>=0.0001 then clean[#clean+1]={p[1],p[2]} end
    end
    if #clean<2 then return nil,"A line needs two points at least 1 cm apart" end
    local o={id=new_id(e),type="line",points=clean}
    e.objects[#e.objects+1]=o
    local finish,note=clean[#clean]
    if first then
        local ok,err=M.connect(e,{id=o.id,index=1},first)
        if not ok then return nil,err end
    end
    if last then
        -- The first connection may have reversed the new piece: find the drawn last point again.
        local index=o.points[1]==finish and 1 or #o.points
        local ok,err=M.connect(e,{id=o.id,index=index},last)
        if not ok then note="End not connected: "..err end
    end
    M.orient(e,o.id)
    return o.id,note
end
-- Copy/paste (R17, LE4). The clipboard holds authoring data only: the copied objects and the
-- connections between them. Paste allocates new ids, keeps those internal connections and drops every
-- connection to an object outside the copy. START and FINISH are singletons and never copied.
function M.copy(e,ids)
    local set={};for _,id in ipairs(ids) do set[id]=true end
    local clip={objects={},connections={}}
    for _,o in ipairs(e.objects) do if set[o.id] then clip.objects[#clip.objects+1]=doc_lib.copy(o) end end
    for _,c in ipairs(e.connections) do
        if set[c.from] and set[c.to] then clip.connections[#clip.connections+1]={from=c.from,to=c.to} end
    end
    return clip
end
-- Bounding box {x0,x1,y0,y1} of a list of objects.
function M.bbox(objects)
    local b={math.huge,-math.huge,math.huge,-math.huge}
    for _,o in ipairs(objects) do
        for _,p in ipairs(path(o)) do
            b[1],b[2],b[3],b[4]=math.min(b[1],p[1]),math.max(b[2],p[1]),math.min(b[3],p[2]),math.max(b[4],p[2])
        end
    end
    return b
end
-- Pastes the clipboard moved by d; returns the new ids in clipboard order. Connected ends get the same
-- displacement, so they stay exactly equal.
function M.paste(e,clip,d)
    local map,ids={},{}
    for _,o in ipairs(clip.objects) do
        local n=doc_lib.copy(o)
        n.id=new_id(e);map[o.id]=n.id
        translate_object(n,d)
        e.objects[#e.objects+1]=n;ids[#ids+1]=n.id
    end
    for _,c in ipairs(clip.connections) do e.connections[#e.connections+1]={from=map[c.from],to=map[c.to]} end
    return ids
end
-- A prefab parameter change (R4): the entry stays fixed and the whole downstream run moves by the
-- displacement of the exit; upstream pieces never move. Invalid parameters are refused unchanged.
-- Returns the ids of every changed object.
function M.set_params(e,id,params)
    local o=find(e,id)
    if not o or o.type~="prefab" then return nil,"Select a prefab first" end
    local ok,err=prefab.check(o.kind,params)
    if not ok then return nil,prefab.name(o.kind).." "..id..": "..err end
    local before=doc_lib.exit(o)
    o.params=params
    local moved={id}
    if doc_lib.terrain(o) then
        local after=doc_lib.exit(o)
        local d={after[1]-before[1],after[2]-before[2]}
        local down=M.downstream(e,id)
        for _,m in ipairs(down) do translate_object(find(e,m),d);moved[#moved+1]=m end
        if down[1] then set_entry(find(e,down[1]),after) end
    end
    return moved
end
-- Deliberate placement of a prefab (R5): its entry at `at`. first: a free exit at the entry, last: a free
-- entry at its exit; the editor shows either as a connect preview, and placing confirms it.
function M.add_prefab(e,kind,params,at,first,last)
    local ok,err=prefab.check(kind,params)
    if not ok then return nil,prefab.name(kind)..": "..err end
    local o={id=new_id(e),type="prefab",kind=kind,at={at[1],at[2]},params=params}
    e.objects[#e.objects+1]=o
    if first then
        local done,cerr=M.connect(e,{id=o.id,index=1},first)
        if not done then return nil,cerr end
    end
    if last then
        local done,cerr=M.connect(e,{id=o.id,index=#path(o)},last)
        if not done then return nil,cerr end
    end
    return o.id
end
-- Mirror (LE5a): a horizontally mirrored copy of the objects beside them (side 1: right, -1: left), at
-- least 1 m apart, the offset a multiple of 0.5 m. The originals are unchanged. The copy gets new ids
-- and keeps only the connections between the copied objects; each is reversed, because the mirrored
-- run again runs left to right (lines reversed, prefabs mirrored by their parameters).
function M.mirror(e,ids,side)
    local clip=M.copy(e,ids)
    local b=M.bbox(clip.objects)
    -- The axis is rounded to the 0.5 m grid (a Kicker's length is not), so on-grid points stay on it.
    local c2=math.floor((b[1]+b[2])*2+0.5)/2
    local function reflect(list)
        local r={};for i=#list,1,-1 do r[#r+1]={c2-list[i][1],list[i][2]} end;return r
    end
    local objects={}
    for i,o in ipairs(clip.objects) do
        local n=doc_lib.copy(o)
        if o.type=="line" then n.points=reflect(o.points)
        elseif o.type=="hull" then n.vertices=reflect(o.vertices) -- reversed order keeps it counter-clockwise
        elseif o.type=="label" then n.position={c2-o.position[1],o.position[2]}
        elseif o.type=="curve" then n=M.mirror_curve(o,c2)
        else n=prefab.mirror(o,c2) end
        objects[i]=n
    end
    local mirrored={objects=objects,connections={}}
    for _,c in ipairs(clip.connections) do mirrored.connections[#mirrored.connections+1]={from=c.to,to=c.from} end
    -- The mirrored copy spans c2-b[2]..c2-b[1]; it moves until it is at least 1 m clear of the original.
    local shift=side>0 and math.ceil((b[2]+1-(c2-b[2]))*2)/2 or -math.ceil(((c2-b[1])-(b[1]-1))*2)/2
    return M.paste(e,mirrored,{shift,0})
end
-- Curves (LE5b). A shape change follows R4 like a prefab change: the exit displacement moves the whole
-- downstream run; the entry may only move while it is free (a joint belongs to the upstream piece).
-- anchors: the new anchor list. Returns the ids of every changed object.
function M.set_anchors(e,id,anchors)
    local o=find(e,id)
    if not o or o.type~="curve" then return nil,"Select a curve first" end
    local _,prev=doc_lib.links(e)
    local entry=o.anchors[1].p
    if prev[id] and not doc_lib.same(anchors[1].p,entry,0) then return nil,"The curve's start is a connection; disconnect it first [J]" end
    local before=doc_lib.exit(o)
    o.anchors=anchors
    local after=doc_lib.exit(o)
    local d={after[1]-before[1],after[2]-before[2]}
    local moved={id}
    local down=M.downstream(e,id)
    for _,m in ipairs(down) do translate_object(find(e,m),d);moved[#moved+1]=m end
    if down[1] then set_entry(find(e,down[1]),after) end
    return moved
end
-- Automatic tangents for clicked anchors (Catmull-Rom, a third of the neighbour distance), mode smooth;
-- the ends point at their neighbour.
function M.auto_anchors(pts)
    local list={}
    for i,p in ipairs(pts) do
        local a,b=pts[i-1] or p,pts[i+1] or p
        local tx,ty=(b[1]-a[1])/6,(b[2]-a[2])/6
        if i==1 or i==#pts then tx,ty=tx*2,ty*2 end
        list[i]={p={p[1],p[2]},["in"]={-tx,-ty},out={tx,ty},mode="smooth"}
    end
    list[1]["in"]={0,0};list[#list].out={0,0}
    return list
end
-- A drawn curve (Curve tool): one new piece, connected where it starts or ends on a free end (R5).
function M.add_curve(e,pts,first,last)
    local clean={}
    for _,p in ipairs(pts) do
        local q=clean[#clean]
        if not q or (p[1]-q[1])^2+(p[2]-q[2])^2>=0.0001 then clean[#clean+1]={p[1],p[2]} end
    end
    if #clean<2 then return nil,"A curve needs two anchors at least 1 cm apart" end
    local o={id=new_id(e),type="curve",anchors=M.auto_anchors(clean)}
    e.objects[#e.objects+1]=o
    local finish,note=clean[#clean]
    if first then
        local ok,err=M.connect(e,{id=o.id,index=1},first)
        if not ok then return nil,err end
    end
    if last then
        local p=o.anchors[1].p
        local index=(p[1]==finish[1] and p[2]==finish[2]) and 1 or #path(o)
        local ok,err=M.connect(e,{id=o.id,index=index},last)
        if not ok then note="End not connected: "..err end
    end
    M.orient(e,o.id)
    return o.id,note
end
-- de Casteljau split of segment i at t: an anchor inserted on the curve, the shape unchanged.
function M.insert_anchor(e,id,i,t)
    local o=find(e,id)
    if not o or o.type~="curve" or i<1 or i>=#o.anchors then return nil,"No curve segment to insert into" end
    local a,b=o.anchors[i],o.anchors[i+1]
    local p0,p3=a.p,b.p
    local p1,p2={p0[1]+a.out[1],p0[2]+a.out[2]},{p3[1]+b["in"][1],p3[2]+b["in"][2]}
    local function lerp(u,v) return {u[1]+(v[1]-u[1])*t,u[2]+(v[2]-u[2])*t} end
    local q0,q1,q2=lerp(p0,p1),lerp(p1,p2),lerp(p2,p3)
    local r0,r1=lerp(q0,q1),lerp(q1,q2)
    local m=lerp(r0,r1)
    a.out={q0[1]-p0[1],q0[2]-p0[2]}
    b["in"]={q2[1]-p3[1],q2[2]-p3[2]}
    table.insert(o.anchors,i+1,{p=m,["in"]={r0[1]-m[1],r0[2]-m[2]},out={r1[1]-m[1],r1[2]-m[2]},mode="smooth"})
    return i+1
end
-- Deleting an anchor: an inner one joins its neighbours (their tangents stay); an end shortens the curve.
function M.delete_anchor(e,id,i)
    local o=find(e,id)
    if not o or o.type~="curve" then return nil,"Select a curve anchor first" end
    local next,prev=doc_lib.links(e)
    if (i==1 and prev[id]) or (i==#o.anchors and next[id]) then return nil,"The anchor is a connection; disconnect it first [J]" end
    if #o.anchors<=2 then return nil,"A curve needs two anchors; select the curve and delete it instead" end
    table.remove(o.anchors,i)
    if i==1 then o.anchors[1]["in"]={0,0} end
    if i>#o.anchors then o.anchors[#o.anchors].out={0,0} end
    return true
end
-- Split a curve at an inner anchor: two connected curves (no seam).
function M.split_curve(e,id,i)
    local o,pos=find(e,id)
    if not o or o.type~="curve" or i<=1 or i>=#o.anchors then return nil,"Split needs an anchor inside a curve" end
    local b={id=new_id(e),type="curve",anchors={}}
    for k=i,#o.anchors do b.anchors[#b.anchors+1]=doc_lib.copy(o.anchors[k]) end
    b.anchors[1]["in"]={0,0}
    for k=#o.anchors,i+1,-1 do o.anchors[k]=nil end
    o.anchors[i].out={0,0}
    for _,c in ipairs(e.connections) do if c.from==id then c.from=b.id end end
    e.connections[#e.connections+1]={from=id,to=b.id}
    table.insert(e.objects,pos+1,b)
    return b.id
end
-- A curve's mirror image: anchors reflected and reversed, tangents swapped with their x negated.
function M.mirror_curve(o,c2)
    local n={id=o.id,type="curve",anchors={}}
    for i=#o.anchors,1,-1 do
        local a=o.anchors[i]
        n.anchors[#n.anchors+1]={p={c2-a.p[1],a.p[2]},["in"]={-a.out[1],a.out[2]},out={-a["in"][1],a["in"][2]},mode=a.mode}
    end
    return n
end
return M
