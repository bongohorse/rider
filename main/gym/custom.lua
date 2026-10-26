-- Loader-side owner of imported custom levels (level-editor contract R14).
-- Defold 1.14 runs every script in one Lua context, so this module outlives
-- proxied world reloads. The world receives only a snapshot id + generation.
local data=require "main.gym.station_data"
local M={limit=256*1024}
local snapshots,serial={},0
-- Two alternating save slots: a write only ever replaces the older slot, so a
-- failed save (HTML5 sys.save truncates/unlinks its target) keeps the last good one.
local APP,SLOTS="rider",{"custom-level-a","custom-level-b"}
local function copy(v)
    if type(v)~="table" then return v end
    local t={};for k,x in pairs(v) do t[k]=copy(x) end;return t
end
function M.parse(text)
    if type(text)~="string" or text=="" then return nil,"The level file is empty" end
    if #text>M.limit then return nil,"The level file is larger than 256 KiB" end
    local ok,d=pcall(json.decode,text)
    if not ok or type(d)~="table" then return nil,"The level file is not valid JSON" end
    local valid,err,unsupported=data.validate(d)
    if not valid then return nil,err,unsupported end
    if d.kind~=nil then return nil,"Custom levels cannot use station kind \""..tostring(d.kind).."\"" end
    return d
end
function M.freeze(d,text)
    serial=serial+1
    local id="s"..serial
    snapshots[id]={doc=copy(d),text=text}
    return id
end
-- Readers get a copy: the loader-owned snapshot never changes while loads read it.
function M.read(id)
    local s=snapshots[id]
    return s and copy(s.doc)
end
function M.text(id) return snapshots[id] and snapshots[id].text end
-- Loader-internal read-only access (no copy); worlds always use M.read.
function M.peek(id) return snapshots[id] and snapshots[id].doc end
function M.retain(keep)
    for id in pairs(snapshots) do if not keep[id] then snapshots[id]=nil end end
end
function M.count() local n=0;for _ in pairs(snapshots) do n=n+1 end;return n end
-- parse(text) -> doc | nil, error, unsupported. An unsupported slot (unknown editor version) is never
-- overwritten: its original text stays as it is (contract R1).
local function store(slots,parse)
    local S={}
    local protection
    local function raw(i)
        local ok,t=pcall(sys.load,sys.get_save_file(APP,slots[i]))
        if ok and type(t)=="table" and t.format==1 and type(t.seq)=="number" and type(t.text)=="string" then return t end
    end
    local function slot(i)
        local t=raw(i)
        if not t then return nil end
        local d,err,unsupported=parse(t.text)
        -- time (os.time of the save) orders a draft against the level save; older saves have none.
        -- key: the My levels entry a draft belongs to (LE4); drafts saved before LE4 have none.
        if d then return {seq=t.seq,text=t.text,doc=d,slot=i,time=t.time or 0,key=t.key} end
        if unsupported then return {seq=t.seq,text=t.text,slot=i,unsupported=err} end
    end
    S.slot=slot
    -- True when a slot file exists, readable or not (an unreadable store is never treated as empty):
    -- sys.load returns an empty table for a missing file and fails or returns other data for anything else.
    function S.exists()
        for i=1,2 do
            local ok,t=pcall(sys.load,sys.get_save_file(APP,slots[i]))
            if not ok or type(t)~="table" or next(t)~=nil then return true end
        end
        return false
    end
    -- Newest slot, which may be unsupported; callers must not open an unsupported one.
    function S.newest()
        local a,b=slot(1),slot(2)
        if a and b then return a.seq>b.seq and a or b end
        return a or b
    end
    -- Admission only: immutable version files need one future-format check per write generation.
    -- Keep load/restore uncached, and invalidate even failed writes (which may truncate a slot).
    function S.protected()
        if protection==nil then local newest=S.newest();protection=newest and newest.unsupported or false end
        return protection
    end
    local function latest_valid(a,b)
        a,b=a and not a.unsupported and a,b and not b.unsupported and b
        return a and b and (a.seq>b.seq and a or b) or a or b
    end
    -- Newest valid slot. A newer slot that no longer validates (e.g. a start beyond today's limit) is
    -- reported as skipped (or as the error when nothing valid is left), never silently hidden.
    function S.restore()
        local a,b=slot(1),slot(2)
        local best=latest_valid(a,b)
        for i=1,2 do
            local t=raw(i)
            if t and (not best or t.seq>best.seq) then
                local _,err,unsupported=parse(t.text)
                if not unsupported then
                    if best then best.skipped=err else return nil,err end
                end
            end
        end
        return best
    end
    function S.save(text,key)
        protection=nil
        -- One fresh pair supplies both target selection and sequence; readback stays mandatory.
        local a,b=slot(1),slot(2)
        local current=latest_valid(a,b)
        local seq=math.max(a and a.seq or 0,b and b.seq or 0)+1
        local target=current and 3-current.slot or 1
        local held=target==1 and a or b
        if held and held.unsupported then target=current and current.slot or 3-target end
        held=target==1 and a or b
        if held and held.unsupported then return nil,"Both save slots hold data from a newer version" end
        local ok,err=pcall(sys.save,sys.get_save_file(APP,slots[target]),{format=1,seq=seq,text=text,time=os.time(),key=key})
        if not ok then return nil,tostring(err) end
        local back=slot(target)
        if not back or back.seq~=seq or back.text~=text then return nil,"Saved data could not be read back" end
        return seq
    end
    -- Debug only: write raw text into a slot, bypassing validation (version-rejection tests).
    function S.debug_write(i,seq,text,time)
        assert(sys.get_engine_info().is_debug,"Raw save writes require debug engine")
        protection=nil
        sys.save(sys.get_save_file(APP,slots[i]),{format=1,seq=seq,text=text,time=time})
    end
    function S.bytes()
        local paths={}
        for _,name in ipairs(slots) do paths[#paths+1]=sys.get_save_file(APP,name) end
        -- HTML5 metadata avoids read-only closes that the pinned loader turns into full syncs.
        -- Keep native io and the existing io fallback when a slot is missing/unstatable.
        if html5 then
            local n=tonumber(html5.run("window.riderCustom.fileBytes("..json.encode(paths)..")"))
            if n then return n end
        end
        local n=0
        for _,path in ipairs(paths) do local f=io.open(path,"rb");if f then n=n+f:seek("end");f:close() end end
        return n
    end
    -- Exact pinned serializer size, including the slot wrapper; no temporary save is needed.
    function S.cost(text)
        return #sys.serialize({format=1,seq=1,text=text,time=os.time()})
    end
    function S.remove()
        protection=nil
        for _,name in ipairs(slots) do
            local path=sys.get_save_file(APP,name);local f=io.open(path,"rb")
            if f then
                f:close();local ok,err=os.remove(path);if not ok then return nil,err end
                -- Read-only closes no longer schedule persistence; include successful/partial deletes.
                if html5 then html5.run("Module.persistentSync()") end
            end
        end
        return true
    end
    return S
end
M.slot_store=store
M.level=store(SLOTS,function(text) return M.parse(text) end)
function M.restore() return M.level.restore() end
-- key: the My levels entry the level was played from (LE4), nil for an imported file.
function M.save(text,key) return M.level.save(text,key) end
-- Editor drafts (LE2) live in their own slot pair; a draft may be unplayable (R9).
function M.drafts(parse) M.draft=M.draft or store({"custom-draft-a","custom-draft-b"},parse);return M.draft end
-- My levels (LE4): a small index plus one slot pair per level ("custom-doc-<key>-a/-b"), keyed by a
-- storage key that is never reused, so level ids need not be unique and an import never overwrites.
-- The index ({format, next, levels={key, id, name, time}}) is a slot pair too. One editor tab at a
-- time: the index is read once per page and then kept in memory.
M.LIBRARY_MAX=64
local function parse_index(text)
    local ok,d=pcall(json.decode,text)
    if not ok or type(d)~="table" then return nil,"The level index is not valid JSON" end
    if d.format~=1 then return nil,"Unsupported level index format "..tostring(d.format),true end
    if type(d.next)~="number" or d.next<1 or d.next%1~=0 or type(d.levels)~="table" or #d.levels>M.LIBRARY_MAX then return nil,"Invalid level index" end
    local seen={}
    for _,l in ipairs(d.levels) do
        if type(l)~="table" or type(l.key)~="number" or l.key<1 or l.key%1~=0 or l.key>=d.next or seen[l.key]
            or type(l.id)~="string" or type(l.name)~="string" or type(l.time)~="number" then return nil,"Invalid level index entry" end
        seen[l.key]=true
    end
    return d
end
function M.library(parse)
    if M.lib then return M.lib end
    local L={}
    local index=store({"custom-index-a","custom-index-b"},parse_index)
    local docs,cached,reserved={},nil,0
    local function doc_store(key)
        docs[key]=docs[key] or store({"custom-doc-"..key.."-a","custom-doc-"..key.."-b"},parse)
        return docs[key]
    end
    L.store=doc_store
    -- The index, or nil and why it cannot be used: index files that exist but cannot be read, or whose
    -- newest slot is unsupported or invalid (e.g. written by a newer build), are kept unchanged and block
    -- every library write, so no level drops out of the list and no storage key is handed out twice.
    function L.index()
        if cached then return cached end
        local newest=index.newest()
        local r=index.restore()
        if newest and newest.unsupported then return nil,"the My levels index is from a newer version; it is kept unchanged" end
        if r and not r.skipped then cached=r.doc
        elseif r or index.exists() then return nil,"the My levels index cannot be read; it is kept unchanged"
        else cached={format=1,next=1,levels={}} end
        return cached
    end
    function L.has(key)
        local idx=L.index()
        for _,l in ipairs(idx and idx.levels or {}) do if l.key==key then return true end end
        return false
    end
    -- Entries newest first.
    function L.list()
        local idx=L.index()
        local list={}
        for _,l in ipairs(idx and idx.levels or {}) do list[#list+1]={key=l.key,id=l.id,name=l.name,time=l.time} end
        table.sort(list,function(a,b) if a.time~=b.time then return a.time>b.time end;return a.key>b.key end)
        return list
    end
    -- A key for a level that is saved for the first time, or nil, error while the index is unusable.
    -- Unique within this page even before saving, never below keep (e.g. a draft's key), and never a key
    -- whose files exist (a level saved before its index entry was written).
    function L.new_key(keep)
        local idx,err=L.index()
        if not idx then return nil,err end
        local k=math.max(reserved+1,idx.next,(keep or 0)+1)
        while doc_store(k).exists() do k=k+1 end
        reserved=k
        return k
    end
    -- Saves a level document under its key and updates its index entry (created on the first save).
    function L.save(key,text,id,name)
        local idx,err=L.index()
        if not idx then return nil,err end
        local next={format=1,next=math.max(idx.next,key+1),levels={}}
        local found
        for i,l in ipairs(idx.levels) do
            next.levels[i]={key=l.key,id=l.id,name=l.name,time=l.time}
            if l.key==key then found=next.levels[i] end
        end
        if not found then
            if #next.levels>=M.LIBRARY_MAX then return nil,"My levels is full ("..M.LIBRARY_MAX.." levels); delete a level first" end
            found={key=key};next.levels[#next.levels+1]=found
        end
        local seq,serr=doc_store(key).save(text)
        if not seq then return nil,serr end
        found.id,found.name,found.time=id,name,os.time()
        local ok,ierr=index.save(json.encode(next))
        if not ok then return nil,"level index: "..tostring(ierr) end
        cached=next
        return seq
    end
    -- doc, or nil, error, unsupported (an unsupported newest slot is never opened or overwritten).
    function L.load(key)
        local s=doc_store(key)
        local newest=s.newest()
        if newest and newest.unsupported then return nil,newest.unsupported,true end
        local r,err=s.restore()
        if not r then return nil,err or "no saved data" end
        return r.doc
    end
    -- Removes the index entry first, then the level's files (HTML5 syncs the removal with the next save).
    function L.remove(key)
        local idx,err=L.index()
        if not idx then return nil,err end
        local next={format=1,next=idx.next,levels={}}
        for _,l in ipairs(idx.levels) do if l.key~=key then next.levels[#next.levels+1]={key=l.key,id=l.id,name=l.name,time=l.time} end end
        local ok,ierr=index.save(json.encode(next))
        if not ok then return nil,"level index: "..tostring(ierr) end
        cached=next
        for _,s in ipairs({"a","b"}) do pcall(os.remove,sys.get_save_file(APP,"custom-doc-"..key.."-"..s)) end
        docs[key]=nil
        return true
    end
    M.lib=L
    return L
end
function M.init()
    if html5 then html5.run(assert(sys.load_resource("/main/gym/custom.js"),"Missing custom level helper")) end
end
function M.take()
    if not html5 then return nil end
    local request=html5.run("window.riderCustom.take()")
    if request=="" then return nil end
    local ok,r=pcall(json.decode,request)
    if ok and type(r)=="table" then return r end
    return {request=tonumber(html5.run("window.riderCustom.request")),text=""}
end
function M.notify(request,state,message)
    if html5 then html5.run("window.riderCustom.result("..json.encode({request=request,state=state,message=message})..")") end
end
-- editor=true: the level editor's own Import (LE4); the page entry points stay off while editing.
function M.open(message,editor)
    if html5 then html5.run("window.riderCustom.open("..json.encode(message or "")..","..tostring(editor==true)..")") end
end
-- MEM->IndexedDB sync status from the pinned dmloader; sys.save itself only proves the in-memory write.
function M.sync_state() return html5 and html5.run("window.riderCustom.syncState()") or "saved" end
return M
