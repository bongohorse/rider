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
function M.retain(keep)
    for id in pairs(snapshots) do if not keep[id] then snapshots[id]=nil end end
end
function M.count() local n=0;for _ in pairs(snapshots) do n=n+1 end;return n end
local function slot(i)
    local ok,t=pcall(sys.load,sys.get_save_file(APP,SLOTS[i]))
    if not ok or type(t)~="table" or t.format~=1 or type(t.seq)~="number" or type(t.text)~="string" then return nil end
    local d=M.parse(t.text)
    return d and {seq=t.seq,text=t.text,doc=d,slot=i}
end
function M.restore()
    local a,b=slot(1),slot(2)
    if a and b then return a.seq>b.seq and a or b end
    return a or b
end
function M.save(text)
    local current=M.restore()
    local target=current and 3-current.slot or 1
    local seq=(current and current.seq or 0)+1
    if html5 then html5.run("window.riderCustom.watchSync()") end
    local ok,err=pcall(sys.save,sys.get_save_file(APP,SLOTS[target]),{format=1,seq=seq,text=text})
    if not ok then return nil,tostring(err) end
    local back=slot(target)
    if not back or back.seq~=seq or back.text~=text then return nil,"Saved level could not be read back" end
    return seq
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
function M.open(message)
    if html5 then html5.run("window.riderCustom.open("..json.encode(message or "")..")") end
end
-- MEM->IndexedDB sync status from the pinned dmloader; sys.save itself only proves the in-memory write.
function M.sync_state() return html5 and html5.run("window.riderCustom.syncState()") or "saved" end
return M
