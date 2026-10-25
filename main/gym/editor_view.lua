-- Mesh edit world: source handles/storage stay loader-owned; no terrain physics or follow camera.
local editor=require "main.gym.editor"
local doc=require "main.gym.editor_doc"
local lines=require "main.gym.editor_lines"
local terrain=require "main.gym.editor_terrain"
local residency=require "main.gym.terrain_residency"
local socket=require "socket"
local M={}
local SELECTED,HOVER=vmath.vector4(1,0.7765,0.4275,1),vmath.vector4(0.8353,0.9529,0.9137,1)
local START,BLOCKED=vmath.vector4(.4,.75,1,1),vmath.vector4(1,.35,.3,1)
local function copy(p) local t={};for i,q in ipairs(p) do t[i]={q[1],q[2]} end;return t end
local function changed(a,b)
    if not a or #a~=#b then return true end
    for i,p in ipairs(a) do if p[1]~=b[i][1] or p[2]~=b[i][2] then return true end end
end
local function remove(v,r)
    local dead={};for _,id in ipairs(r.ids) do dead[id]=true;go.delete(id) end
    for _,key in ipairs({"gos","line_ids","label_ids"}) do
        local t={};for _,id in ipairs(v[key]) do if not dead[id] then t[#t+1]=id end end;v[key]=t
    end
    v.sprites,v.labels=v.sprites-r.sprites,v.labels-r.labels
end
local function objects(v,e)
    local seen={}
    local scale=sys.get_config_number("physics.scale",.01)
    for _,o in ipairs(e.objects) do
        local id=o.id;seen[id]=true
        local shown=editor.preview_objects and editor.preview_objects[id] or o
        local pts=editor.shape(o)
        local r=v.records[id]
        if r and (r.type~=o.type or r.terrain~=doc.terrain(o) or #r.points~=#pts) then remove(v,r);r=nil end
        if not r then
            r={ids={},sprites=0,labels=0,type=o.type,terrain=doc.terrain(o),points=copy(pts)}
            if o.type=="label" then
                local label_id=require("main.gym.stations").marker(o.position,o.text)
                lines.count(v,{label_id},true);r.ids={label_id};r.labels=1
            elseif not r.terrain then r.ids=lines.draw(v,shown);r.sprites=#r.ids end
            v.records[id]=r;v.zoom=nil
        elseif changed(r.points,pts) then
            if o.type=="label" then go.set_position(vmath.vector3(pts[1][1]/scale,pts[1][2]/scale,0),r.ids[1])
            elseif not r.terrain then for i,go_id in ipairs(r.ids) do lines.place_line(go_id,pts[i],pts[i%#pts+1],scale) end end
            r.points=copy(pts)
        end
        if o.type=="label" then
            local p=editor.label_preview
            local text=p and p.id==id and p.text or o.text
            if r.text~=text then label.set_text(msg.url(nil,r.ids[1],"label"),text);r.text=text end
            v.label_text[id]=text
        end
        local hidden=o.hidden or false
        if r.hidden~=hidden then
            for _,go_id in ipairs(r.ids) do msg.post(msg.url(nil,go_id,o.type=="label" and "label" or "sprite"),hidden and "disable" or "enable") end
            r.hidden=hidden
        end
        v.hidden[id]=hidden
        if o.type~="label" and not r.terrain then
            local colour=editor.selected[id] and SELECTED or editor.hover_object==id and HOVER or require("main.gym.stations").TERRAIN_TINT
            if r.tint~=colour then lines.tint(r.ids,colour);r.tint=colour end
        end
    end
    for id,r in pairs(v.records) do if not seen[id] then remove(v,r);v.records[id],v.hidden[id],v.label_text[id]=nil,nil,nil end end
end
local function markers(v,e)
    local preview=editor.preview
    local p=preview and preview.target=="start" and preview.position or e.start.position
    lines.move(v.start,p)
    local f=e.finish and {position=preview and preview.target=="finish" and preview.position or e.finish.position,direction=e.finish.direction}
    if v.finish and (not f or f.direction~=v.finish.direction) then remove(v,{ids=v.finish.ids,sprites=1,labels=1});v.finish=nil end
    if f and not v.finish then v.finish=lines.finish_marker(v,f) end
    if f then lines.move(v.finish,f.position) end
    local blocked=doc.blocked(e,p)
    lines.tint({unpack(v.start.ids,1,#v.start.ids-1)},editor.selection=="start" and SELECTED or blocked and BLOCKED or START)
    if v.finish then lines.tint({v.finish.ids[1]},editor.selection=="finish" and SELECTED or require("main.gym.stations").FINISH_TINT) end
end
local function counts(self)
    local v=self.view;local last=v.mesh.last_geometry or {chunks=0,buffer_bytes=0}
    editor.view_counts={sprites=v.sprites,labels=v.labels,objects=#editor.doc.editor.objects,generation=self.session_generation,simplified=false,
        meshes=last.chunks,mesh_bytes=last.buffer_bytes,allocated_meshes=last.allocated,allocated_mesh_bytes=last.allocated_bytes}
end
local function publish(self,elapsed)
    if html5 and sys.get_engine_info().is_debug then
        local v=self.view;local entries={}
        for _,e in ipairs(v.mesh.entries) do entries[#entries+1]={key=e.key,path=e.path,vertices=e.geometry and e.geometry.vertices or 0,first=e.points[1],last=e.points[#e.points]} end
        html5.run("window.riderEditorMesh="..json.encode({generation=self.session_generation,opened=v.opened,revision=editor.doc.editor.revision,
            shape_version=editor.shape_version,updates=v.mesh.updates,uploads=v.mesh.uploads,last=v.mesh.last_geometry,elapsed_ms=elapsed,entries=entries}))
    end
end
local function admitted(self)
    if self.admission_doc~=editor.doc or self.admission_shape~=editor.shape_version then
        self.admission_doc,self.admission_shape=editor.doc,editor.shape_version
        self.admission_ok=terrain.admitted(editor.doc.editor)
    end
    return self.admission_ok
end
function M.build(self)
    if not admitted(self) then lines.build(self);self.view.line_mode=true;return end
    local v={gos={},line_ids={},label_ids={},sprites=0,labels=0,records={},label_text={},hidden={},mesh=terrain.create(),opened=editor.opened}
    self.view=v
    editor.display_note=nil;editor.drawn_labels=v.label_text;editor.hidden_objects=v.hidden
    v.start=lines.start_marker(v,editor.doc.editor.start.position)
    M.refresh(self,true)
end
function M.final(self,remove_objects)
    local v=self.view
    if not v then return end
    if v.mesh then terrain.final(v.mesh,remove_objects) end
    if remove_objects then for _,id in ipairs(v.gos) do go.delete(id) end end
    self.view=nil
end
function M.refresh(self,force)
    local v=self.view;local e=editor.doc.editor;local now=socket.gettime()
    local live=editor.label_preview and editor.label_preview.id.."\0"..editor.label_preview.text or ""
    local dirty=force or v.shape~=editor.shape_version or v.drawn~=editor.view_version or v.label_preview~=live
    if not dirty then return end
    if not force and editor.preview_objects and v.updated and now-v.updated<.033 then return end
    local style={}
    for _,o in ipairs(e.objects) do
        if doc.terrain(o) then style[#style+1]=o.id..(o.hidden and "h" or "v")..(editor.selected[o.id] and "s" or "n")..(editor.hover_object==o.id and "o" or "n") end
    end
    local style_key=table.concat(style,"|")
    local mesh_dirty=force or v.shape~=editor.shape_version or v.mesh_revision~=e.revision or v.style_key~=style_key
    local started=socket.gettime()
    local ok,result,err=true,true,nil
    if mesh_dirty then ok,result,err=pcall(terrain.update,v.mesh,e,editor.preview_objects,editor.selected,editor.hover_object,self.session_generation,residency.viewport(editor.camera)) end
    if not ok then err="Mesh preview unavailable: "..tostring(result);result=nil end
    if not result then
        print("EDITOR_MESH_FALLBACK "..tostring(err));M.final(self,true);self.editor_rebuild=true;self.editor_fallback=err;return
    end
    objects(v,e);markers(v,e)
    v.shape,v.drawn,v.label_preview,v.updated=editor.shape_version,editor.view_version,live,now
    v.mesh_revision,v.style_key=e.revision,style_key
    counts(self);if mesh_dirty then publish(self,(socket.gettime()-started)*1000) end
    return mesh_dirty
end
function M.update(self)
    local built=false
    if self.editor_rebuild then
        self.editor_rebuild=nil
        if self.editor_fallback then
            lines.build(self);self.view.line_mode=true;self.view.capacity_shape=editor.shape_version
            editor.display_note=self.editor_fallback;self.editor_fallback=nil
        else M.build(self);built=true end
    end
    local v=self.view;if not v then return end
    if v.opened~=editor.opened then
        local now=socket.gettime()
        if not v.reload_requested or now-v.reload_requested>.5 then
            v.reload_requested=now;msg.post("main:/loader#script","editor_reload")
        end
        return
    end
    local mode=admitted(self) and v.capacity_shape~=editor.shape_version
    if mode==(v.line_mode==true) then M.final(self,true);self.editor_rebuild=true;return end
    if v.line_mode then lines.update(self);return end
    local scale=sys.get_config_number("physics.scale",.01);local c=editor.camera
    go.set_position(vmath.vector3(c.x/scale,c.y/scale,500),"/camera")
    go.set("/camera#camera","orthographic_zoom",c.zoom)
    editor.screen=lines.mapping(c);editor.screen.opened=v.opened
    local refreshed=M.refresh(self)
    if self.view then
        -- A source/style refresh already applied residency; keep one speculative budget per frame.
        if not refreshed and not built then
            local ok,err=pcall(terrain.resident,v.mesh,self.session_generation,residency.viewport(c))
            if not ok then
                print("EDITOR_MESH_FALLBACK "..tostring(err));M.final(self,true);self.editor_rebuild=true;self.editor_fallback=tostring(err);return
            end
        end
        counts(self);lines.readable(self.view,c.zoom)
    end
end
return M
