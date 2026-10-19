-- Loader-side level editor state (contract R15): document, Undo history, selection and editor camera
-- live here, outside the proxied world, so a world reload for Play or Edit cannot lose them.
-- Defold 1.14 runs every script in one Lua context: the edit world reads this module directly.
local doc_lib=require "main.gym.editor_doc"
local custom=require "main.gym.custom"
local socket=require "socket"
local M={mode="play",tool="select",test_mode="surface",test_speed=0,selection=nil,
    camera={x=0,y=2,zoom=0.2},geometry_version=0,view_version=0,status="",message="",problem=nil}
local function parse_draft(text)
    local ok,d=pcall(json.decode,text)
    if not ok or type(d)~="table" then return nil,"Draft is not valid JSON" end
    return doc_lib.validate(d)
end
local function drafts() return custom.drafts(parse_draft) end
local function touch(geometry)
    M.view_version=M.view_version+1
    if geometry then M.geometry_version=M.geometry_version+1 end
end
local function check()
    local _,err=doc_lib.compile(M.doc)
    M.problem=err
end
local function resolve_selection()
    local s=M.selection
    if s=="start" or (s=="finish" and M.doc.editor.finish) then return end
    for _,o in ipairs(M.doc.editor.objects) do if o.id==s then return end end
    M.selection=nil
end
-- Open a document as the current one. keep=true records the previous document as an Undo step.
function M.open(doc,keep)
    if keep and M.doc then
        doc_lib.record(M.history,M.doc)
        local e=doc.editor
        e.revision=math.max(e.revision,M.doc.editor.revision+1)
    else M.history=doc_lib.history() end
    M.doc=doc;M.selection=nil
    local s=doc.editor.start.position
    -- A new document starts with START near the left of an overview (about 60 m wide at 1280 px).
    M.camera={x=s[1]+20,y=s[2]+4,zoom=0.2}
    if keep then M.dirty,M.dirty_at,M.status=true,socket.gettime(),"Unsaved" end
    check();touch(true)
end
-- One completed action = one history entry and one revision (R12, R17).
function M.commit(fn,geometry)
    local before=doc_lib.copy(M.doc)
    fn(M.doc.editor,M.doc)
    M.message=""
    doc_lib.record(M.history,before)
    M.doc.editor.revision=before.editor.revision+1
    M.dirty,M.dirty_at,M.status=true,socket.gettime(),"Unsaved"
    resolve_selection();check();touch(geometry)
end
function M.undo(back)
    local revision,next_id=M.doc.editor.revision,M.doc.editor.next_id
    local restored=doc_lib.step(M.history,M.doc,back)
    if not restored then return false end
    local geometry=json.encode(restored.editor.objects)~=json.encode(M.doc.editor.objects)
    M.doc=restored
    -- Revisions and ids stay monotonic: an undone state is a new revision, ids are never reused.
    M.doc.editor.revision=revision+1;M.doc.editor.next_id=math.max(next_id,M.doc.editor.next_id)
    M.dirty,M.dirty_at,M.status=true,socket.gettime(),"Unsaved"
    resolve_selection();check();touch(geometry)
    return true
end
function M.new_id()
    local e=M.doc.editor
    local id="o"..e.next_id;e.next_id=e.next_id+1;return id
end
function M.select(id) if M.selection~=id then M.selection=id;touch() end end
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
    return {doc=d.doc,slot=d.slot,seq=d.seq}
end
function M.draft_store() return drafts() end
-- Compile for Play: the level (START) and, for a test start, the temporary run.
function M.compile(test)
    return doc_lib.compile(M.doc,test)
end
return M
