-- Loader-side level editor state (contract R15): document, Undo history, selection and editor camera
-- live here, outside the proxied world, so a world reload for Play or Edit cannot lose them.
-- Defold 1.14 runs every script in one Lua context: the edit world reads this module directly.
local doc_lib=require "main.gym.editor_doc"
local custom=require "main.gym.custom"
local socket=require "socket"
-- selection: primary id (or "start"/"finish"); selected: set of selected object ids (multi-select, LE3);
-- vertex: {id,index} of the selected line point; preview_points: shapes during a drag (not committed).
-- vertex2: a second free end picked with Shift+click for Connect (LE3b); opened counts document
-- replacements (template, other level) so tools can drop state that belonged to the old document.
local M={mode="play",tool="select",test_mode="surface",test_speed=0,selection=nil,selected={},vertex=nil,vertex2=nil,grid=true,opened=0,
    camera={x=0,y=2,zoom=0.2},geometry_version=0,view_version=0,shape_version=0,status="",message="",problem=nil,errors={},warnings={}}
local function parse_draft(text)
    local ok,d=pcall(json.decode,text)
    if not ok or type(d)~="table" then return nil,"Draft is not valid JSON" end
    return doc_lib.validate(d)
end
local function drafts() return custom.drafts(parse_draft) end
local function touch(geometry)
    M.view_version=M.view_version+1
    if geometry then M.geometry_version,M.shape_version=M.geometry_version+1,M.shape_version+1 end
end
-- Live validation (LE3): every Play-blocking error and the non-blocking warnings, after each action.
local function check()
    local errors,warnings=doc_lib.problems(M.doc.editor)
    local level,err=doc_lib.compile(M.doc)
    if err and errors[1]~=err then errors[#errors+1]=err end
    M.problem,M.errors,M.warnings=errors[1],errors,warnings
    M.chains=level and #level.chains or 0
end
-- Selection is resolved by stable id after every change (R17).
local function resolve_selection()
    local e=M.doc.editor
    local ids={}
    for _,o in ipairs(e.objects) do ids[o.id]=o end
    for id in pairs(M.selected) do if not ids[id] then M.selected[id]=nil end end
    local s=M.selection
    if s~="start" and not (s=="finish" and e.finish) and not ids[s] then M.selection=next(M.selected) end
    local v=M.vertex
    if v and not (ids[v.id] and ids[v.id].type=="line" and v.index<=#ids[v.id].points and M.selection==v.id) then M.vertex=nil end
    if not M.vertex then M.vertex2=nil end
end
-- Open a document as the current one. keep=true records the previous document as an Undo step.
function M.open(doc,keep)
    if keep and M.doc then
        doc_lib.record(M.history,M.doc)
        local e=doc.editor
        local played=e.compiled_revision==e.revision
        e.revision=math.max(e.revision,M.doc.editor.revision+1)
        -- Opening an already played level unchanged keeps it played.
        if played then e.compiled_revision=e.revision end
    else M.history=doc_lib.history() end
    M.doc=doc;M.selection,M.selected,M.vertex,M.vertex2=nil,{},nil,nil
    M.opened=M.opened+1
    M.changed_at=socket.gettime()
    local s=doc.editor.start.position
    -- A new document starts with START near the left of an overview (about 60 m wide at 1280 px).
    M.camera={x=s[1]+20,y=s[2]+4,zoom=0.2}
    if keep then M.dirty,M.dirty_at,M.status=true,socket.gettime(),"Unsaved";M.changed_at=M.dirty_at end
    check();touch(true)
end
-- One completed action = one history entry and one revision (R12, R17). fn may refuse with nil, err;
-- a result that fails the source validator (R16) is refused too. Either way nothing changes.
function M.commit(fn,geometry)
    local before=doc_lib.copy(M.doc)
    local _,err=fn(M.doc.editor,M.doc)
    if not err then
        local valid,verr=doc_lib.validate(M.doc)
        if not valid then err="Edit refused: "..verr end
    end
    if err then M.doc=before;M.message=err;touch();return nil,err end
    M.message=""
    doc_lib.record(M.history,before)
    M.doc.editor.revision=before.editor.revision+1
    M.dirty,M.dirty_at,M.status=true,socket.gettime(),"Unsaved";M.changed_at=M.dirty_at
    resolve_selection();check();touch(geometry)
    return true
end
function M.undo(back)
    local revision,next_id=M.doc.editor.revision,M.doc.editor.next_id
    local restored=doc_lib.step(M.history,M.doc,back)
    if not restored then return false end
    local geometry=json.encode(restored.editor.objects)~=json.encode(M.doc.editor.objects)
    M.doc=restored
    -- Revisions and ids stay monotonic: an undone state is a new revision, ids are never reused.
    M.doc.editor.revision=revision+1;M.doc.editor.next_id=math.max(next_id,M.doc.editor.next_id)
    M.dirty,M.dirty_at,M.status=true,socket.gettime(),"Unsaved";M.changed_at=M.dirty_at
    -- A point index may now name another point (e.g. an undone Connect reversed a run): keep the line only.
    M.vertex,M.vertex2=nil,nil
    resolve_selection();check();touch(geometry)
    return true
end
function M.new_id()
    local e=M.doc.editor
    local id="o"..e.next_id;e.next_id=e.next_id+1;return id
end
function M.select(id,vertex)
    M.selection,M.vertex,M.vertex2,M.selected=id,vertex,nil,{}
    if id and id~="start" and id~="finish" then M.selected[id]=true end
    touch()
end
-- Shift+click adds or removes one object (START/FINISH stay single selections).
function M.toggle(id)
    if M.selection=="start" or M.selection=="finish" then M.selection=nil end
    M.selected[id]=not M.selected[id] or nil
    M.vertex,M.vertex2=nil,nil
    if M.selected[id] then M.selection=id elseif M.selection==id then M.selection=next(M.selected) end
    touch()
end
function M.selected_ids()
    local list={}
    for _,o in ipairs(M.doc.editor.objects) do if M.selected[o.id] then list[#list+1]=o.id end end
    return list
end
-- Shapes during a drag: drawn by the edit world, never committed until the drag ends.
function M.set_preview(points) M.preview_points=points;M.shape_version=M.shape_version+1;touch() end
function M.shape(o)
    local p=M.preview_points and M.preview_points[o.id]
    return p or o.type=="line" and o.points or o.type=="hull" and o.vertices or {o.position}
end
-- Screen mapping for the GUI, extrapolated to the current camera: the edit world measures it once per
-- frame, the GUI may run first in a frame, and the camera centre stays at the same pixel.
function M.map()
    local s,c=M.screen,M.camera
    if not s then return nil end
    local k=c.zoom/s.zoom
    local px,py=s.ppm_x*k,s.ppm_y*k
    local cx,cy=s.ox+s.cx*s.ppm_x,s.oy+s.cy*s.ppm_y
    return {ox=cx-c.x*px,oy=cy-c.y*py,ppm_x=px,ppm_y=py}
end
function M.touch() touch() end
-- Drafts: autosaved after completed actions; the status reflects the last save and the HTML5 sync.
function M.save_draft()
    M.dirty=false
    local seq,err=drafts().save(json.encode(M.doc,{encode_empty_table_as_object=false}))
    if not seq then M.status="Save failed ("..tostring(err)..")";return false end
    M.status="Saving...";M.syncing=true
    return true
end
function M.sync()
    if not M.syncing then return end
    local state=custom.sync_state()
    if state=="syncing" then return end
    M.syncing=false
    if M.dirty then return end -- a newer action is waiting for its own save
    M.status=state=="saved" and "Saved" or state=="session" and "Saved for this session only" or "Save failed (browser storage sync)"
end
-- Newest draft: {doc} or {unsupported=message}; nil without a draft.
function M.saved_draft()
    local d=drafts().newest()
    if not d then return nil end
    if d.unsupported then return {unsupported=d.unsupported,text=d.text,slot=d.slot} end
    return {doc=d.doc,slot=d.slot,seq=d.seq,time=d.time}
end
function M.draft_store() return drafts() end
-- Compile for Play: the level (START) and, for a test start, the temporary run.
function M.compile(test)
    return doc_lib.compile(M.doc,test)
end
return M
