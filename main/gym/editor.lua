-- Loader-side level editor state (contract R15): document, Undo history, selection and editor camera
-- live here, outside the proxied world, so a world reload for Play or Edit cannot lose them.
-- Defold 1.14 runs every script in one Lua context: the edit world reads this module directly.
local doc_lib=require "main.gym.editor_doc"
local custom=require "main.gym.custom"
local socket=require "socket"
-- selection: primary id (or "start"/"finish"); selected: set of selected object ids (multi-select, LE3);
-- vertex: {id,index} of the selected line point or prefab end; preview_objects: moved or reshaped copies
-- of objects during a drag (not committed). prefab_kind: the type the Prefab tool places (LE5a).
-- anchor: {id, i} of the selected curve anchor (LE5b).
-- points: the multi-point selection (LE5d), "id:i" -> {id, i}: two or more points of selected lines and
-- curves (a curve point by its anchor index, a joint as its upstream piece's last point). Empty: whole
-- objects, or the single point in vertex/anchor (LE5c behaviour unchanged).
-- vertex2: a second free end picked with Shift+click for Connect (LE3b); opened is the instance token of
-- the current document (a new one per open, restored with Undo/Redo entries) so tools can drop state
-- that belonged to another document, even one with the same level id.
-- keys: My levels storage key per document instance (LE4); an instance without a key is an unsaved copy
-- (a template, an opened file) that gets a key at its first completed edit (store). clipboard: copied
-- authoring objects; it survives opening another level. conflict: a pending R1 choice for the open level.
-- behind: instances whose latest state is not fully saved (a failed draft or My levels write, or a My levels
-- copy older than the draft); they are saved again before another document becomes current.
-- show_bounds: the R13 bounds are drawn (LE6, view only). last_test: {position, instance} of the last test
-- start that reached a drive-ready run (LE6); it belongs to that document instance only.
-- unsynced: the last browser-storage (IndexedDB) sync failed, so saves since the last good sync may not
-- survive a reload; set until a later sync succeeds.
local M={keys={},store={},behind={},clipboard=nil,conflict=nil,mode="play",tool="select",prefab_kind="flat",test_mode="surface",test_speed=0,selection=nil,selected={},points={},vertex=nil,vertex2=nil,grid=true,opened=0,instances=0,
    camera={x=0,y=2,zoom=0.2},geometry_version=0,view_version=0,shape_version=0,status="",message="",problem=nil,errors={},warnings={},error_at={},warning_at={},
    show_bounds=false,last_test=nil}
local function parse_draft(text)
    local ok,d=pcall(json.decode,text)
    if not ok or type(d)~="table" then return nil,"Draft is not valid JSON" end
    return doc_lib.validate(d)
end
local function drafts() return custom.drafts(parse_draft) end
local function library() return custom.library(parse_draft) end
M.library=library
function M.key() return M.keys[M.opened] end
local function touch(geometry)
    M.view_version=M.view_version+1
    if geometry then M.geometry_version,M.shape_version=M.geometry_version+1,M.shape_version+1 end
end
-- Live validation (LE3): every Play-blocking error and the non-blocking warnings, after each action.
-- Each message may have a target (LE6 jump-to-problem): error_at[i] / warning_at[i] =
-- {ids, at, start} (editor_doc.problems), resolved by stable id when a row is clicked.
local function check()
    local e=M.doc.editor
    local errors,warnings,error_at,warning_at=doc_lib.problems(e)
    local level,err=doc_lib.compile(M.doc,nil,errors)
    if err and errors[1]~=err then
        errors[#errors+1]=err
        -- Compile errors about START (its clearance, the start limit) point at START and what it overlaps.
        local s=e.start.position
        local blocked=err:match("^START overlaps") and doc_lib.blocked(e,s)
        if blocked or err:match("^Start is limited") then error_at[#errors]={start=true,ids=blocked and {blocked.id} or nil,at={s[1],s[2]}} end
    end
    M.problem,M.errors,M.warnings=errors[1],errors,warnings
    M.error_at,M.warning_at=error_at,warning_at
    -- Physical chains: a two-sided run counts twice (as towards the 32-chain limit).
    M.chains=0
    for i=1,level and #level.chains or 0 do M.chains=M.chains+(level.two_sided and level.two_sided[i] and 2 or 1) end
end
-- Selection is resolved by stable id after every change (R17).
local function resolve_selection()
    local e=M.doc.editor
    local ids={}
    for _,o in ipairs(e.objects) do ids[o.id]=o end
    for id in pairs(M.selected) do if not ids[id] then M.selected[id]=nil end end
    local s=M.selection
    if s~="start" and not (s=="finish" and e.finish) and not ids[s] then M.selection=next(M.selected) end
    -- A curve's or prefab's end is its first or last point; the last index follows its sample count.
    for _,x in ipairs({M.vertex,M.vertex2}) do
        local o=ids[x.id]
        if o and o.type~="line" and doc_lib.terrain(o) and x.index>1 then x.index=#doc_lib.path(o) end
    end
    local v=M.vertex
    if v and not (ids[v.id] and doc_lib.terrain(ids[v.id]) and v.index<=#doc_lib.path(ids[v.id]) and M.selection==v.id) then M.vertex=nil end
    local v2=M.vertex2
    local o2=v2 and ids[v2.id]
    if not M.vertex or not (o2 and doc_lib.terrain(o2) and (v2.index==1 or v2.index==#doc_lib.path(o2))) then M.vertex2=nil end
    local a=M.anchor
    if a and not (ids[a.id] and ids[a.id].type=="curve" and a.i<=#ids[a.id].anchors and M.selection==a.id) then M.anchor=nil end
    -- Points (LE5d) stay only on selected lines and curves (a joint also when its downstream piece is
    -- selected), by index: a line that became a curve keeps them.
    local downstream=doc_lib.links(e)
    local n=0
    for k,p in pairs(M.points) do
        local o=ids[p.id]
        local count=o and (o.type=="line" and #o.points or o.type=="curve" and #o.anchors)
        local held=M.selected[p.id] or (count and p.i==count and downstream[p.id] and M.selected[downstream[p.id]])
        if not (held and count and p.i<=count) then M.points[k]=nil else n=n+1 end
    end
    if n==1 then
        -- One point left: it becomes the single (LE5c) selection, as after a Shift+click.
        local _,p=next(M.points)
        local o=ids[p.id]
        M.points,M.selection,M.vertex2={},p.id,nil
        if o.type=="line" then M.vertex,M.anchor={id=p.id,index=p.i},nil
        else
            M.anchor={id=p.id,i=p.i}
            M.vertex=(p.i==1 or p.i==#o.anchors) and {id=p.id,index=p.i==1 and 1 or #doc_lib.path(o)} or nil
        end
    elseif n<2 then M.points={} end
end
-- Saves the current document now when it has unsaved changes, a failed or lagging save, a failed
-- storage sync or no key yet although it belongs in My levels. Called before another document becomes
-- current, so a pending autosave never lands in the new one. False while anything is not saved: a
-- failed sync is retried by the save, but its result arrives only later.
function M.flush()
    if M.doc and (M.dirty or M.behind[M.opened] or M.unsynced or (M.store[M.opened] and not M.key())) then
        return M.save_draft() and not M.unsynced
    end
    return true
end
-- Before another document becomes current: the outgoing one must be saved, otherwise the next autosave
-- would replace its draft and its edits would live only in Undo. A refused switch can be repeated
-- within 10 s to continue anyway (e.g. browser storage unavailable).
function M.leave()
    if M.flush() then M.refused_at=nil;return true end
    local now=socket.gettime()
    if M.refused_at and now-M.refused_at<=10 then M.refused_at=nil;return true end
    M.refused_at=now
    local why=M.behind[M.opened] and M.status or "browser storage sync failed; the save was retried"
    M.message="Not switched: the open level could not be saved ("..why.."). Repeat within 10 s to continue anyway; its edits stay in Undo."
    return false
end
-- Open a document as the current one. keep=true records the previous document as an Undo step.
-- opts.key: its My levels key; opts.store: save it to My levels from the first autosave (New, Import);
-- opts.saved: it was read from storage unchanged (a reload), so the status starts as Saved.
-- Returns nil when the outgoing document could not be saved (M.leave; message set), true otherwise.
function M.open(doc,keep,opts)
    opts=opts or {}
    if M.doc and not M.leave() then return nil end
    if keep and M.doc then
        doc_lib.record(M.history,M.doc,M.opened)
        local e=doc.editor
        local played=e.compiled_revision==e.revision
        e.revision=math.max(e.revision,M.doc.editor.revision+1)
        -- Opening an already played level unchanged keeps it played.
        if played then e.compiled_revision=e.revision end
    else M.history=doc_lib.history() end
    M.doc=doc;M.selection,M.selected,M.points,M.vertex,M.vertex2,M.anchor=nil,{},{},nil,nil,nil
    -- Every opened document is a new instance; tokens are never reused (Undo may restore an older one).
    M.instances=M.instances+1;M.opened=M.instances
    M.keys[M.opened],M.store[M.opened],M.behind[M.opened]=opts.key,opts.store or nil,opts.behind or nil
    M.conflict=nil
    M.changed_at=socket.gettime()
    local s=doc.editor.start.position
    -- A new document starts with START near the left of an overview (about 60 m wide at 1280 px).
    M.camera={x=s[1]+20,y=s[2]+4,zoom=0.2}
    if keep then M.dirty,M.dirty_at,M.status=true,socket.gettime(),"Unsaved";M.changed_at=M.dirty_at
    else M.status=opts.saved and "Saved" or "" end
    check();touch(true)
    return true
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
    M.store[M.opened]=true
    doc_lib.record(M.history,before,M.opened)
    M.doc.editor.revision=before.editor.revision+1
    M.dirty,M.dirty_at,M.status=true,socket.gettime(),"Unsaved";M.changed_at=M.dirty_at
    resolve_selection();check();touch(geometry)
    return true
end
-- Returns false (nothing to step) or nil, "refused" when crossing into another document is refused.
function M.undo(back)
    local stack=back and M.history.undo or M.history.redo
    local target=stack[#stack]
    if target and target.instance~=M.opened and not M.leave() then return nil,"refused" end
    local revision,next_id=M.doc.editor.revision,M.doc.editor.next_id
    local restored,instance=doc_lib.step(M.history,M.doc,back,M.opened)
    if not restored then return false end
    local geometry=json.encode(restored.editor.objects)~=json.encode(M.doc.editor.objects)
    -- Undo/Redo across a template or level replacement swaps document instances (whatever their level
    -- id): the restored entry's token becomes current, so tools drop state of the other instance.
    M.opened=instance
    M.doc=restored
    -- Revisions and ids stay monotonic: an undone state is a new revision, ids are never reused.
    M.doc.editor.revision=revision+1;M.doc.editor.next_id=math.max(next_id,M.doc.editor.next_id)
    M.dirty,M.dirty_at,M.status=true,socket.gettime(),"Unsaved";M.changed_at=M.dirty_at
    -- A point index may now name another point (e.g. an undone Connect reversed a run): keep the line only.
    M.vertex,M.vertex2,M.anchor,M.points=nil,nil,nil,{}
    resolve_selection();check();touch(geometry)
    return true
end
-- The last launched test start of the current document (LE6 navigation), or nil.
function M.last_test_start()
    local t=M.last_test
    return t and t.instance==M.opened and t.position or nil
end
function M.new_id()
    local e=M.doc.editor
    local id="o"..e.next_id;e.next_id=e.next_id+1;return id
end
function M.select(id,vertex)
    M.selection,M.vertex,M.vertex2,M.selected,M.anchor,M.points=id,vertex,nil,{},nil,{}
    if id and id~="start" and id~="finish" then M.selected[id]=true end
    touch()
end
-- Shift+click adds or removes one object (START/FINISH stay single selections).
function M.toggle(id)
    if M.selection=="start" or M.selection=="finish" then M.selection=nil end
    M.selected[id]=not M.selected[id] or nil
    M.vertex,M.vertex2,M.anchor,M.points=nil,nil,nil,{}
    if M.selected[id] then M.selection=id elseif M.selection==id then M.selection=next(M.selected) end
    touch()
end
-- The multi-point selection (LE5d) in document order: {id, i} for each point.
function M.point_list()
    local list={}
    for _,o in ipairs(M.doc.editor.objects) do
        local here={}
        for _,p in pairs(M.points) do if p.id==o.id then here[#here+1]=p end end
        table.sort(here,function(a,b) return a.i<b.i end)
        for _,p in ipairs(here) do list[#list+1]={id=p.id,i=p.i} end
    end
    return list
end
function M.point_count() local n=0;for _ in pairs(M.points) do n=n+1 end;return n end
function M.selected_ids()
    local list={}
    for _,o in ipairs(M.doc.editor.objects) do if M.selected[o.id] then list[#list+1]=o.id end end
    return list
end
-- Shapes during a drag: changed copies of objects by id, drawn by the edit world, never committed until
-- the drag ends. shape: every point (entry to exit); parts: the open polylines; outline: a closed one.
function M.set_preview(objects) M.preview_objects=objects;M.shape_version=M.shape_version+1;touch() end
local function current(o) return M.preview_objects and M.preview_objects[o.id] or o end
function M.shape(o) return doc_lib.path(current(o)) end
function M.parts(o) return doc_lib.parts(current(o)) end
function M.outline(o) return doc_lib.outline(current(o)) end
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
-- An edited document is also saved to My levels under its key (LE4). Both use slot pairs, so a failed
-- save keeps the previous good copy of the draft and of the level.
function M.save_draft()
    -- Until every write below succeeds the document counts as behind: a switch retries it first.
    M.dirty=false;M.behind[M.opened]=true
    local text=json.encode(M.doc,{encode_empty_table_as_object=false})
    local stored=M.store[M.opened] or M.key()
    local kerr
    if stored and not M.key() then
        -- Never below a key this page already uses (a draft's key may have no saved level yet).
        local top=0
        for _,k in pairs(M.keys) do top=math.max(top,k) end
        M.keys[M.opened],kerr=library().new_key(top)
    end
    -- The draft names its level's key; 0 marks an unsaved copy (drafts saved before LE4 have no key).
    local seq,err=drafts().save(text,M.key() or 0)
    if not seq then M.status="Save failed ("..tostring(err)..")";return false end
    if kerr then M.status="Save failed (My levels: "..tostring(kerr)..")";return false end
    if stored then
        local ok,lerr=library().save(M.key(),text,M.doc.id,M.doc.name)
        if not ok then M.status="Save failed (My levels: "..tostring(lerr)..")";return false end
    end
    M.behind[M.opened]=nil
    M.status="Saving...";M.syncing=true
    return true
end
function M.sync()
    if not M.syncing then return end
    local state=custom.sync_state()
    if state=="syncing" then return end
    M.syncing=false
    -- A good sync persists every file written before it, so it also clears an earlier failure.
    M.unsynced=state=="failed" or nil
    if M.dirty then return end -- a newer action is waiting for its own save
    M.status=state=="saved" and "Saved" or state=="session" and "Saved for this session only" or "Save failed (browser storage sync)"
end
-- Newest draft: {doc} or {unsupported=message}; nil without a draft.
function M.saved_draft()
    local d=drafts().newest()
    if not d then return nil end
    if d.unsupported then return {unsupported=d.unsupported,text=d.text,slot=d.slot} end
    return {doc=d.doc,text=d.text,slot=d.slot,seq=d.seq,time=d.time,key=d.key}
end
function M.draft_store() return drafts() end
-- True when the My levels copy of key differs from the draft text (its last level save failed).
function M.library_behind(key,text)
    if not library().has(key) then return true end
    local s=library().store(key).restore()
    return not s or s.text~=text
end
-- Compile for Play: the level (START) and, for a test start, the temporary run.
function M.compile(test)
    return doc_lib.compile(M.doc,test)
end
return M
