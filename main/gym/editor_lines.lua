-- Edit-mode world (R15): no vehicle, no terrain physics, no follow camera or FINISH evaluation.
-- It draws the loader-owned source document with release-capable sprites/labels and moves the camera
-- to the editor view. Moves, drags and Undo of moves update sprites in place; a structural change
-- (objects or point counts) reloads this world. Grid, handles and previews are GUI overlays
-- (editor.gui), so editing never takes sprites from the level (R7).
local editor=require "main.gym.editor"
local doc_lib=require "main.gym.editor_doc"
local stations=require "main.gym.stations"
local socket=require "socket"
local M={}
local SELECTED=vmath.vector4(1,0.7765,0.4275,1)
local COIN_TINT=vmath.vector4(1,1,1,1)
local HOVER=vmath.vector4(0.8353,0.9529,0.9137,1)
local START_TINT,BLOCKED_TINT=vmath.vector4(0.4,0.75,1,1),vmath.vector4(1,0.35,0.3,1)
-- Lines and labels keep a readable screen size at any editor zoom (world-sized at zoom 1).
local function count(v,ids,label)
    for _,id in ipairs(ids) do
        v.gos[#v.gos+1]=id
        if label then v.label_ids[#v.label_ids+1]=id else v.line_ids[#v.line_ids+1]=id end
    end
    if label then v.labels=v.labels+1 else v.sprites=v.sprites+#ids end
    v.zoom=nil
end
local function readable(v,zoom)
    if v.zoom==zoom then return end
    v.zoom=zoom
    local width,size=math.max(0.5,1/zoom)/2,math.max(1,0.5/zoom)
    for _,id in ipairs(v.line_ids) do if go.exists(id) then go.set(id,"scale.y",width) end end
    for _,id in ipairs(v.coin_ids or {}) do if go.exists(id) then go.set_scale(vmath.vector3(size,size,1),id) end end
    for _,id in ipairs(v.label_ids) do if go.exists(id) then go.set_scale(vmath.vector3(size,size,1),id) end end
end
-- Sprite budget (R7, LE3b): the source validator allows more points than the sprite and game-object pools can draw
-- one per segment. The budget is checked before building: while the document fits, every segment
-- has its own sprite; above it each object keeps at least one sprite and the rest are shared out in
-- proportion, each sprite spanning consecutive points. Display only: geometry, handles, picking and
-- snapping use every point, and Play stays blocked by the station validator.
-- Every line sprite and label is its own game object, so the world's instance limit counts too: the
-- 4 objects of world.collection, START (4 sprites + label), FINISH (sprite + label), labels and spare.
-- The reserve also covers a FINISH flip, which creates its 2 new objects before the deleted ones are
-- freed at the end of the frame.
-- A prefab is drawn part by part (never across a Kicker + landing gap); each further part may need one
-- sprite more than its share, which the limit reserves.
local RESERVE,WORLD_OBJECTS=12,4
local function segments(o)
    if o.type=='coin' then return 1,1 end
    local closed=doc_lib.outline(o)
    if closed then return #closed,1 end
    local c,parts=0,doc_lib.parts(o)
    for _,part in ipairs(parts) do c=c+#part-1 end
    return c,#parts
end
local function allocation(e)
    local counts,total,n,labels,extra={},0,0,0,0
    for _,o in ipairs(e.objects) do
        if o.type~="label" then
            local c,parts=segments(o)
            counts[o.id]=c;total,n,extra=total+c,n+1,extra+parts-1
        else labels=labels+1 end
    end
    local limit=math.min(sys.get_config_int("sprite.max_count",1024)-RESERVE,
        sys.get_config_int("collection.max_instances",1024)-WORLD_OBJECTS-labels-RESERVE)-extra
    if total<=limit then return counts end
    local k={}
    for id,c in pairs(counts) do k[id]=1+math.floor((c-1)*(limit-n)/(total-n)) end
    return k,{segments=total,sprites=limit}
end
-- Sprites for an outline; sprite j spans points ranges[j] = {i0, i1, part} (a closed outline wraps to
-- its first point). ids and ranges are appended to the given lists.
local function outline(v,list,closed,k,part,ids,ranges)
    local n=#list-1+(closed and 1 or 0)
    k=math.min(k or n,n)
    ids,ranges=ids or {},ranges or {}
    local new={}
    for j=1,k do
        local i0,i1=math.floor((j-1)*n/k)+1,math.floor(j*n/k)+1
        new[j]=stations.line(list[i0],list[i1] or list[1],2);ids[#ids+1]=new[j];ranges[#ranges+1]={i0,i1,part or 1}
    end
    count(v,new)
    return ids,ranges
end
-- Sprites for an object: a closed outline (hull, Platform) or each open part (line, terrain prefab),
-- k sprites shared out by segments, at least one per part.
local function draw(v,o,k)
    if o.type=='coin' then
        local id=require('main.gym.coin_visual').create(o.position)
        v.gos[#v.gos+1]=id;v.coin_ids=v.coin_ids or {};v.coin_ids[#v.coin_ids+1]=id
        v.sprites=v.sprites+1;v.zoom=nil;return {id},{}
    end
    local closed=doc_lib.outline(o)
    if closed then return outline(v,closed,true,k) end
    local parts=doc_lib.parts(o)
    if #parts==1 then return outline(v,parts[1],false,k) end
    local total=segments(o)
    local ids,ranges={},{}
    for i,part in ipairs(parts) do outline(v,part,false,math.max(1,math.floor((k or total)*(#part-1)/total)),i,ids,ranges) end
    return ids,ranges
end
-- START: the upright vehicle box at the start position (same box as the clearance check).
local function start_marker(v,p)
    local b=doc_lib.VEHICLE
    local corners={{p[1]+b[1],p[2]+b[3]},{p[1]+b[2],p[2]+b[3]},{p[1]+b[2],p[2]+b[4]},{p[1]+b[1],p[2]+b[4]}}
    local m={position={p[1],p[2]},ids=outline(v,corners,true)}
    local text=stations.marker({p[1],p[2]+b[4]+0.35},"START")
    m.ids[#m.ids+1]=text;count(v,{text},true)
    return m
end
local function finish_marker(v,f)
    local p=f.position
    local ids={stations.line({p[1],p[2]-doc_lib.FINISH_BELOW},{p[1],p[2]+doc_lib.FINISH_ABOVE},3,stations.FINISH_TINT)}
    count(v,ids)
    local text=stations.marker({p[1],p[2]+doc_lib.FINISH_ABOVE+0.3},f.direction<0 and "<- FINISH" or "FINISH ->")
    ids[#ids+1]=text;count(v,{text},true)
    return {position={p[1],p[2]},direction=f.direction,ids=ids}
end
local function move(m,p)
    local scale=sys.get_config_number("physics.scale",0.01)
    local dx,dy=(p[1]-m.position[1])/scale,(p[2]-m.position[2])/scale
    if dx==0 and dy==0 then return end
    for _,id in ipairs(m.ids) do go.set_position(go.get_position(id)+vmath.vector3(dx,dy,0),id) end
    m.position={p[1],p[2]}
end
local function points(list) local t={};for i,p in ipairs(list) do t[i]={p[1],p[2]} end;return t end
-- Same transform as stations.line (sprite 4 x 4 units); the readable width stays as set.
local function place_line(id,a,b,scale)
    local dx,dy=(b[1]-a[1])/scale,(b[2]-a[2])/scale
    go.set_position(vmath.vector3((a[1]+b[1])/2/scale,(a[2]+b[2])/2/scale,0),id)
    go.set_rotation(vmath.quat_rotation_z(math.atan2(dy,dx)),id)
    go.set(id,"scale.x",math.sqrt(dx*dx+dy*dy)/4)
end
local function changed(a,b)
    if #a~=#b then return true end
    for i,p in ipairs(a) do if p[1]~=b[i][1] or p[2]~=b[i][2] then return true end end
end
-- Places the sprites of one part over a list whose point count differs from the drawn one (a curve or
-- Bump/wave preview during a drag): the sprites are shared out over the new segments like a simplified
-- display; spare sprites shrink to nothing. The committed change reloads the world (signature).
local function respread(ids,list,scale)
    local n=#list-1
    local k=#ids
    for j,id in ipairs(ids) do
        if j>n then go.set(id,"scale.x",0)
        else
            local i0,i1=math.floor((j-1)*n/math.min(k,n))+1,math.floor(j*n/math.min(k,n))+1
            place_line(id,list[i0],list[i1],scale)
        end
    end
end
-- Redraw moved shapes (drag previews, committed moves, Undo of moves, prefab parameter changes)
-- without a world reload while the point counts stay; otherwise see respread.
local function refresh(v,e)
    local scale=sys.get_config_number("physics.scale",0.01)
    for _,o in ipairs(e.objects) do
        local pts=editor.shape(o)
        if changed(pts,v.shapes[o.id]) then
            if o.type=='coin' then require('main.gym.coin_visual').position(v.objects[o.id][1],pts[1])
            elseif o.type=="label" then
                go.set_position(vmath.vector3(pts[1][1]/scale,pts[1][2]/scale,0),v.labels_by[o.id])
            else
                local closed=editor.outline(o)
                local lists=closed and {closed} or editor.parts(o)
                local ranges=v.ranges[o.id]
                if not closed and #lists==1 and #lists[1]~=v.counts[o.id] then respread(v.objects[o.id],lists[1],scale)
                else
                    for i,id in ipairs(v.objects[o.id]) do
                        local r=ranges[i];local list=lists[r[3]]
                        place_line(id,list[r[1]],list[r[2]] or list[1],scale)
                    end
                end
            end
            v.shapes[o.id]=points(pts)
        end
    end
end
local function tint(ids,colour)
    for _,id in ipairs(ids) do
        local url=msg.url(nil,id,"sprite")
        if go.exists(id) then pcall(go.set,url,"tint",colour) end
    end
end
-- Structure of the drawn document: object ids, types and point counts (label texts, prefab types; a
-- Kicker + landing's direction swaps its parts, so a flip reloads; a curve or Bump/wave whose sample
-- count changed reloads too).
local function signature(e)
    local t={}
    for _,o in ipairs(e.objects) do
        t[#t+1]=o.id..o.type..(o.type=="label" and "\0"..o.text or (o.type=="prefab" or o.type=="curve") and (o.kind or "curve")..(o.params and o.params.facing or "")..#doc_lib.path(o) or o.type=="coin" and 1 or #(o.points or o.vertices))
    end
    return table.concat(t,"|")
end
function M.build(self)
    local v={gos={},line_ids={},label_ids={},sprites=0,labels=0,objects={},ranges={},counts={},labels_by={},label_text={},live="",shapes={},tints={},hidden={},geometry=editor.geometry_version}
    local e=editor.doc.editor
    local k,simplified=allocation(e)
    editor.display_note=simplified and string.format("Display simplified: %d segments exceed the editor's budget of %d line sprites. Geometry and handles are exact; see Problems for the limiting Play resource.",
        simplified.segments,simplified.sprites) or nil
    for _,o in ipairs(e.objects) do
        if o.type~="label" then v.objects[o.id],v.ranges[o.id]=draw(v,o,k[o.id]);v.counts[o.id]=#doc_lib.path(o)
        else
            local id=stations.marker(o.position,o.text);count(v,{id},true);v.objects[o.id]={};v.labels_by[o.id]=id;v.label_text[o.id]=o.text
        end
        v.shapes[o.id]=points(editor.shape(o))
    end
    v.signature=signature(e)
    editor.drawn_labels=v.label_text
    editor.hidden_objects=v.hidden
    v.start=start_marker(v,e.start.position)
    if e.finish then v.finish=finish_marker(v,e.finish) end
    v.opened=editor.opened
    self.view=v
    editor.view_counts={sprites=v.sprites,labels=v.labels,objects=#e.objects,generation=self.session_generation,simplified=editor.display_note~=nil}
end
-- Screen mapping for the loader GUI: canvas pixels of the world origin and pixels per metre.
-- It also records the camera it was measured with, so the GUI can follow camera moves without lag.
local function mapping(c)
    local scale=sys.get_config_number("physics.scale",0.01)
    local o=camera.world_to_screen(vmath.vector3(0,0,0),"/camera#camera")
    local u=camera.world_to_screen(vmath.vector3(1/scale,1/scale,0),"/camera#camera")
    return {ox=o.x,oy=o.y,ppm_x=u.x-o.x,ppm_y=u.y-o.y,cx=c.x,cy=c.y,zoom=c.zoom}
end
function M.update(self)
    local v=self.view
    if not v then return end
    local scale=sys.get_config_number("physics.scale",0.01)
    local c=editor.camera
    go.set_position(vmath.vector3(c.x/scale,c.y/scale,500),"/camera")
    go.set("/camera#camera","orthographic_zoom",c.zoom)
    editor.screen=mapping(c);editor.screen.opened=v.opened
    readable(v,c.zoom)
    local e=editor.doc.editor
    -- A structural change (new or deleted objects or points, template) reloads this world through the
    -- loader once; moves keep the world and only update transforms.
    if editor.geometry_version~=v.geometry then
        if signature(e)~=v.signature then
            -- The loader ignores a reload while it is still loading this world: ask again after 0.5 s.
            local now=socket.gettime()
            if not v.reload_requested or now-v.reload_requested>0.5 then
                v.reload_requested=now
                msg.post("main:/loader#script","editor_reload")
            end
            return
        end
        v.geometry,v.shape=editor.geometry_version,nil
    end
    if v.shape~=editor.shape_version then v.shape=editor.shape_version;refresh(v,e) end
    -- A label being typed shows the field's text (LE6b drive test); otherwise, as after Esc, its own. The
    -- committed text changes the signature, so the reload above draws it from the document.
    -- Hide only render components of this physics-free Edit world; allocation and compiled geometry
    -- stay unchanged. Component messages apply after dispatch, including newly created objects.
    for _,o in ipairs(e.objects) do
        local hidden=o.hidden or false
        if v.hidden[o.id]~=hidden then
            v.hidden[o.id]=hidden
            local component=o.type=="label" and "label" or "sprite"
            local ids=o.type=="label" and {v.labels_by[o.id]} or v.objects[o.id]
            for _,id in ipairs(ids) do msg.post(msg.url(nil,id,component),hidden and "disable" or "enable") end
        end
    end
    local p=editor.label_preview
    local live=p and p.id.."\0"..p.text or ""
    if live~=v.live then
        v.live=live
        for _,o in ipairs(e.objects) do
            local t=o.type=="label" and (p and p.id==o.id and p.text or o.text)
            if t and v.label_text[o.id]~=t then v.label_text[o.id]=t;label.set_text(msg.url(nil,v.labels_by[o.id],"label"),t) end
        end
    end
    local preview=editor.preview
    local start=preview and preview.target=="start" and preview.position or e.start.position
    move(v.start,start)
    local finish=e.finish and {position=preview and preview.target=="finish" and preview.position or e.finish.position,direction=e.finish.direction}
    if v.finish and (not finish or finish.direction~=v.finish.direction) then
        for _,id in ipairs(v.finish.ids) do go.delete(id) end
        v.sprites,v.labels,v.finish=v.sprites-1,v.labels-1,nil
    end
    if finish and not v.finish then v.finish=finish_marker(v,finish) end
    if finish then move(v.finish,finish.position) end
    if v.drawn~=editor.view_version then
        v.drawn=editor.view_version
        -- Only objects whose highlight changed are re-tinted (hover changes on mouse moves).
        for id,ids in pairs(v.objects) do
            local state=editor.selected[id] and SELECTED or editor.hover_object==id and HOVER or stations.TERRAIN_TINT
            if v.tints[id]~=state then v.tints[id]=state;tint(ids,state) end
        end
        local blocked=doc_lib.blocked(e,start)
        tint({unpack(v.start.ids,1,#v.start.ids-1)},editor.selection=="start" and SELECTED or blocked and BLOCKED_TINT or START_TINT)
        if v.finish then tint({v.finish.ids[1]},editor.selection=="finish" and SELECTED or stations.FINISH_TINT) end
        editor.view_counts={sprites=v.sprites,labels=v.labels,objects=#e.objects,generation=self.session_generation,simplified=editor.display_note~=nil}
    end
end
-- Shared source-marker/outline helpers; the mesh view keeps the same editor affordances.
M.count,M.readable,M.draw,M.start_marker,M.finish_marker=count,readable,draw,start_marker,finish_marker
M.move,M.place_line,M.tint,M.mapping=move,place_line,tint,mapping
return M
