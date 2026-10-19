-- Level editor edit operations (LE3; contract R4, R5, R16, R17). Pure: they change the editor block
-- of a document copy in place; the caller validates and commits the result as one Undo step.
local doc_lib=require "main.gym.editor_doc"
local M={}
local function find(e,id) for i,o in ipairs(e.objects) do if o.id==id then return o,i end end end
M.find=find
local function new_id(e) local id="o"..e.next_id;e.next_id=e.next_id+1;return id end
local function shift(p,d) p[1],p[2]=p[1]+d[1],p[2]+d[2] end
local function translate_object(o,d)
    if o.type=="label" then shift(o.position,d)
    else for _,p in ipairs(o.type=="line" and o.points or o.vertices) do shift(p,d) end end
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
        for _,m in ipairs(o and (o.type=="line" and M.run_of(e,id) or {id}) or {}) do
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
    if index==1 and prev[id] then local u=find(e,prev[id]);return u.id,#u.points end
    return id,index
end
function M.joint(e,id,index)
    local o=find(e,id)
    local next,prev=doc_lib.links(e)
    return (index==1 and prev[id]) or (index==#o.points and next[id]) or nil
end
-- A point edit changes one piece (R4): its entry stays fixed; when its exit moves, the whole
-- downstream run is translated by the same displacement. Upstream pieces never move.
-- Returns the ids of every changed line.
function M.move_vertex(e,id,index,p)
    id,index=M.owner(e,id,index)
    local o=find(e,id)
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
        if n then n.points[1]={p[1],p[2]} end
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
    local set={}
    for _,id in ipairs(run) do
        set[id]=true
        local o=find(e,id)
        local r={};for i=#o.points,1,-1 do r[#r+1]=o.points[i] end
        o.points=r
    end
    for _,c in ipairs(e.connections) do if set[c.from] then c.from,c.to=c.to,c.from end end
end
-- Logical order runs left to right where the ends allow it, so "downstream" means to the right.
function M.orient(e,id)
    local run=M.run_of(e,id)
    local head,tail=find(e,run[1]),find(e,run[#run])
    if head.points[1][1]>tail.points[#tail.points][1] then reverse_run(e,run);return true end
end
-- Free and connected line ends: {id, index, p, free}.
function M.ends(e)
    local next,prev=doc_lib.links(e)
    local list={}
    for _,o in ipairs(e.objects) do
        if o.type=="line" then
            list[#list+1]={id=o.id,index=1,p=o.points[1],free=not prev[o.id]}
            list[#list+1]={id=o.id,index=#o.points,p=o.points[#o.points],free=not next[o.id]}
        end
    end
    return list
end
-- Connect free end a to free end b (R4, R5). a's whole run moves so both ends meet exactly; runs are
-- reversed as needed so the connection always links an exit to an entry. Refuses loops.
function M.connect(e,a,b)
    local oa,ob=find(e,a.id),find(e,b.id)
    if not oa or not ob or oa.type~="line" or ob.type~="line" then return nil,"Only line ends can be connected" end
    local a_first,b_first=a.index==1,b.index==1
    if (not a_first and a.index~=#oa.points) or (not b_first and b.index~=#ob.points) then return nil,"Only line ends can be connected" end
    if M.joint(e,a.id,a.index) or M.joint(e,b.id,b.index) then return nil,"Only free ends can be connected" end
    local run=M.run_of(e,a.id)
    for _,id in ipairs(run) do if id==b.id then return nil,"Connecting these ends would close a loop" end end
    local pa,pb=oa.points[a.index],ob.points[b.index]
    M.translate(e,{a.id},{pb[1]-pa[1],pb[2]-pa[2]})
    oa.points[a.index]={pb[1],pb[2]}
    if a_first==b_first then reverse_run(e,run);a_first=not a_first end
    e.connections[#e.connections+1]=a_first and {from=b.id,to=a.id} or {from=a.id,to=b.id}
    M.orient(e,a.id)
    return true
end
function M.disconnect(e,id,index)
    if not M.joint(e,id,index) then return nil,"The point is not a connection" end
    id=M.owner(e,id,index)
    for i,c in ipairs(e.connections) do
        if c.from==id then table.remove(e.connections,i);return c.to end
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
return M
