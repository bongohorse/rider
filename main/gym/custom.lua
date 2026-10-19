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
    local valid,err=data.validate(d)
    if not valid then return nil,err end
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
    local function raw(i)
        local ok,t=pcall(sys.load,sys.get_save_file(APP,slots[i]))
        if ok and type(t)=="table" and t.format==1 and type(t.seq)=="number" and type(t.text)=="string" then return t end
    end
    local function slot(i)
        local t=raw(i)
        if not t then return nil end
        local d,err,unsupported=parse(t.text)
        -- time (os.time of the save) orders a draft against the level save; older saves have none.
        if d then return {seq=t.seq,text=t.text,doc=d,slot=i,time=t.time or 0} end
        if unsupported then return {seq=t.seq,text=t.text,slot=i,unsupported=err} end
    end
    S.slot=slot
    -- Newest slot, which may be unsupported; callers must not open an unsupported one.
    function S.newest()
        local a,b=slot(1),slot(2)
        if a and b then return a.seq>b.seq and a or b end
        return a or b
    end
    -- Newest valid slot. A newer slot that no longer validates (e.g. a start beyond today's limit) is
    -- reported as skipped (or as the error when nothing valid is left), never silently hidden.
    function S.restore()
        local a,b=slot(1),slot(2)
        a,b=a and not a.unsupported and a,b and not b.unsupported and b
        local best=a and b and (a.seq>b.seq and a or b) or a or b
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
    function S.save(text)
        local current=S.restore()
        local a,b=slot(1),slot(2)
        local seq=math.max(a and a.seq or 0,b and b.seq or 0)+1
        local target=current and 3-current.slot or 1
        local held=target==1 and a or b
        if held and held.unsupported then target=current and current.slot or 3-target end
        held=target==1 and a or b
        if held and held.unsupported then return nil,"Both save slots hold data from a newer version" end
        if html5 then html5.run("window.riderCustom.watchSync()") end
        local ok,err=pcall(sys.save,sys.get_save_file(APP,slots[target]),{format=1,seq=seq,text=text,time=os.time()})
        if not ok then return nil,tostring(err) end
        local back=slot(target)
        if not back or back.seq~=seq or back.text~=text then return nil,"Saved data could not be read back" end
        return seq
    end
    -- Debug only: write raw text into a slot, bypassing validation (version-rejection tests).
    function S.debug_write(i,seq,text,time)
        assert(sys.get_engine_info().is_debug,"Raw save writes require debug engine")
        sys.save(sys.get_save_file(APP,slots[i]),{format=1,seq=seq,text=text,time=time})
    end
    return S
end
M.level=store(SLOTS,function(text) return M.parse(text) end)
function M.restore() return M.level.restore() end
function M.save(text) return M.level.save(text) end
-- Editor drafts (LE2) live in their own slot pair; a draft may be unplayable (R9).
function M.drafts(parse) M.draft=M.draft or store({"custom-draft-a","custom-draft-b"},parse);return M.draft end
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
function M.open(message)
    if html5 then html5.run("window.riderCustom.open("..json.encode(message or "")..")") end
end
-- MEM->IndexedDB sync status from the pinned dmloader; sys.save itself only proves the in-memory write.
function M.sync_state() return html5 and html5.run("window.riderCustom.syncState()") or "saved" end
return M
