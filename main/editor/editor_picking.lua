-- Deterministic editor picking (#512). Read-only source and selection inputs; no GUI, input or editor singleton.
-- p/tol are metres. zoom preserves the existing screen-sized label/pickup hit boxes.
local doc_lib=require 'main.editor.editor_doc'
local edit=require 'main.editor.editor_edit'
local prefab=require 'main.editor.editor_prefab'
local mechanisms=require 'main.editor.editor_mechanisms'
local coins=require 'main.game.coin_data'
local geometry=require 'main.editor.editor_geometry'
local path,dist,seg_dist=doc_lib.path,geometry.dist,geometry.seg_dist
local M={}
-- Handles of a selected prefab (LE5a). A handle on the exit also selects that end (Connect/Disconnect).
local function prefab_handles(o)
    local list=prefab.handles(o)
    if doc_lib.terrain(o) then
        local pts=path(o)
        local e=pts[#pts]
        for _,h in ipairs(list) do if dist(h.p,e)<1e-9 then h.index=#pts end end
    end
    return list
end
-- Handles of a selected curve (LE5b): every anchor ("a<i>") and its tangents ("i<i>", "o<i>"; the open
-- ends have none). The first anchor of a connected start belongs to the upstream piece and is left out
-- (R4); an end anchor also selects that end (Connect/Disconnect).
local function curve_handles(e,o)
    local _,prev=doc_lib.links(e)
    local n,last=#o.anchors,#path(o)
    local list={}
    for i,a in ipairs(o.anchors) do
        if not (i==1 and prev[o.id]) then list[#list+1]={name="a"..i,p=a.p,label="anchor "..i,anchor=i,index=i==1 and 1 or i==n and last or nil} end
        -- A corner (LE5c) has no tangents; the open ends have none either.
        if i>1 and a.mode~="corner" then list[#list+1]={name="i"..i,p={a.p[1]+a["in"][1],a.p[2]+a["in"][2]},label="tangent in, anchor "..i,anchor=i,tangent=true} end
        if i<n and a.mode~="corner" then list[#list+1]={name="o"..i,p={a.p[1]+a.out[1],a.p[2]+a.out[2]},label="tangent out, anchor "..i,anchor=i,tangent=true} end
    end
    return list
end
function M.handles(e,o)
    if o.type=="curve" then return curve_handles(e,o) end
    if o.type=="prefab" then return prefab_handles(o) end
    return {}
end
M.prefab_handles=prefab_handles
-- Pick candidates under the cursor, best first (hover shows the first; Tab cycles; click picks the
-- shown one): handles of a selected prefab, line points (every point of a selected line, the ends of
-- every line and terrain prefab; a joint once, as its upstream piece's last point), START, FINISH,
-- labels, then lines, prefabs and hulls by edge distance.
function M.candidates(e,selected,p,tol,zoom)
    local _,prev=doc_lib.links(e)
    local list,seen={},{}
    local function add(c) if not seen[c.key] then seen[c.key]=true;list[#list+1]=c end end
    for _,o in ipairs(e.objects) do
        if not o.hidden and not o.locked and (o.type=="prefab" or o.type=="curve") and selected[o.id] then
            for _,h in ipairs(M.handles(e,o)) do
                local d=dist(p,h.p)
                if d<=tol then add({kind="handle",id=o.id,handle=h.name,label=h.label,index=h.index,anchor=h.anchor,d=d,rank=0,key="h:"..o.id..":"..h.name}) end
            end
        end
    end
    for _,o in ipairs(e.objects) do
        if not o.hidden and doc_lib.terrain(o) then
            local selected_line=selected[o.id] and o.type=="line"
            local pts=path(o)
            for i,q in ipairs(pts) do
                if (selected_line or i==1 or i==#pts) and math.abs(q[1]-p[1])<=tol and math.abs(q[2]-p[2])<=tol then
                    local d=dist(p,q)
                    if d<=tol then
                        local id,index=o.id,i
                        if i==1 and prev[o.id] and not edit.find(e,prev[o.id]).hidden then id=prev[o.id];index=#path(edit.find(e,id)) end
                        add({kind="vertex",id=id,index=index,d=d,rank=1,key="v:"..id..":"..index})
                    end
                end
            end
        end
    end
    local v,s=doc_lib.VEHICLE,e.start.position
    if p[1]>=s[1]+v[1] and p[1]<=s[1]+v[2] and p[2]>=s[2]+v[3] and p[2]<=s[2]+v[4] then add({kind="start",id="start",d=0,rank=2,key="start"}) end
    local f=e.finish
    if f and math.abs(p[1]-f.position[1])<=tol and p[2]>=f.position[2]-doc_lib.FINISH_BELOW and p[2]<=f.position[2]+doc_lib.FINISH_ABOVE then
        add({kind="finish",id="finish",d=math.abs(p[1]-f.position[1]),rank=2,key="finish"})
    end
    for _,o in ipairs(e.objects) do
        local d,segment
        -- A crate, plate or gate picks inside its body box and ranks with labels, so a thin plate on the
        -- ground is picked before the line under it (Tab reaches the line).
        if mechanisms.is(o) then d=mechanisms.distance(o,p)
        elseif o.type=='coin' then d=math.max(0,dist(p,o.position)-coins.radius(o)*math.max(1,.5/zoom))
        elseif o.type=="label" then
            -- The drawn text's box (LE6b): editor_view scales labels by max(1, 0.5 / zoom); the builtin
            -- font is about 7.9 x 14 units per character at scale 1 (1 unit = 1 cm).
            local k=math.max(1,0.5/zoom)/100
            local chars=select(2,o.text:gsub("[^\128-\191]",""))
            local dx=math.max(0,math.abs(p[1]-o.position[1])-chars*3.95*k)
            local dy=math.max(0,math.abs(p[2]-o.position[2])-7*k)
            d=math.sqrt(dx*dx+dy*dy)
        else
            local closed=doc_lib.outline(o)
            for _,pts in ipairs(closed and {closed} or doc_lib.parts(o)) do
                for i=2,#pts+(closed and 1 or 0) do
                    local q=seg_dist(p,pts[i-1],pts[(i-1)%#pts+1])
                    if not d or q<d then d,segment=q,i-1 end
                end
            end
        end
        if not o.hidden and d and d<=tol then add({kind="object",id=o.id,type=o.type,segment=segment,d=d,rank=(o.type=="label" or mechanisms.is(o)) and 3 or 4,key="o:"..o.id}) end
    end
    table.sort(list,function(a,b) if a.rank~=b.rank then return a.rank<b.rank end;if a.d~=b.d then return a.d<b.d end;return a.key<b.key end)
    return list
end
return M
