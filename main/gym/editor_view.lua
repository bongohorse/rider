-- Edit-mode world (R15): no vehicle, no terrain physics, no follow camera or FINISH evaluation.
-- It draws the loader-owned source document with release-capable sprites/labels and moves the camera
-- to the editor view. Geometry changes reload this world; markers and selection update in place.
local editor=require "main.gym.editor"
local doc_lib=require "main.gym.editor_doc"
local stations=require "main.gym.stations"
local M={}
local SELECTED=vmath.vector4(1,0.95,0.35,1)
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
    for _,id in ipairs(v.label_ids) do if go.exists(id) then go.set_scale(vmath.vector3(size,size,1),id) end end
end
local function outline(v,list,closed)
    local ids={}
    for i=2,#list do ids[#ids+1]=stations.line(list[i-1],list[i],2) end
    if closed then ids[#ids+1]=stations.line(list[#list],list[1],2) end
    count(v,ids)
    return ids
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
local function tint(ids,colour)
    for _,id in ipairs(ids) do
        local url=msg.url(nil,id,"sprite")
        if go.exists(id) then pcall(go.set,url,"tint",colour) end
    end
end
function M.build(self)
    local v={gos={},line_ids={},label_ids={},sprites=0,labels=0,objects={},geometry=editor.geometry_version}
    local e=editor.doc.editor
    for _,o in ipairs(e.objects) do
        if o.type=="line" then v.objects[o.id]=outline(v,o.points)
        elseif o.type=="hull" then v.objects[o.id]=outline(v,o.vertices,true)
        else
            local id=stations.marker(o.position,o.text);count(v,{id},true);v.objects[o.id]={}
        end
    end
    v.start=start_marker(v,e.start.position)
    if e.finish then v.finish=finish_marker(v,e.finish) end
    self.view=v
    editor.view_counts={sprites=v.sprites,labels=v.labels,objects=#e.objects,generation=self.session_generation}
end
-- Screen mapping for the loader GUI: canvas pixels of the world origin and pixels per metre.
local function mapping()
    local scale=sys.get_config_number("physics.scale",0.01)
    local o=camera.world_to_screen(vmath.vector3(0,0,0),"/camera#camera")
    local u=camera.world_to_screen(vmath.vector3(1/scale,1/scale,0),"/camera#camera")
    return {ox=o.x,oy=o.y,ppm_x=u.x-o.x,ppm_y=u.y-o.y}
end
function M.update(self)
    local v=self.view
    if not v then return end
    local scale=sys.get_config_number("physics.scale",0.01)
    local c=editor.camera
    go.set_position(vmath.vector3(c.x/scale,c.y/scale,500),"/camera")
    go.set("/camera#camera","orthographic_zoom",c.zoom)
    editor.screen=mapping()
    readable(v,c.zoom)
    -- A geometry change (delete, Undo/Redo, template) reloads this world through the loader once.
    if editor.geometry_version~=v.geometry then
        if not v.reload_requested then
            v.reload_requested=true
            msg.post("main:/loader#script","editor_reload")
        end
        return
    end
    local e=editor.doc.editor
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
        for id,ids in pairs(v.objects) do tint(ids,id==editor.selection and SELECTED or stations.TERRAIN_TINT) end
        local blocked=doc_lib.blocked(e,start)
        tint({unpack(v.start.ids,1,#v.start.ids-1)},editor.selection=="start" and SELECTED or blocked and BLOCKED_TINT or START_TINT)
        if v.finish then tint({v.finish.ids[1]},editor.selection=="finish" and SELECTED or stations.FINISH_TINT) end
        editor.view_counts={sprites=v.sprites,labels=v.labels,objects=#e.objects,generation=self.session_generation}
    end
end
return M
