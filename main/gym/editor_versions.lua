-- A3: immutable source snapshots, paired index and deferred garbage collection.
-- Never remove a retired file until BOTH index slots and their browser sync succeeded.
local custom=require "main.gym.custom"
local M={MAX_AUTO=10,MAX_NAMED=10,CAP=16*1024*1024}
local function copy(v) if type(v)~="table" then return v end;local t={};for k,x in pairs(v) do t[k]=copy(x) end;return t end
function M.create(parse)
    local H={generation=0}
    local cached,pending,stores
    stores={}
    local function version(id)
        if not stores[id] then stores[id]=custom.slot_store({"custom-version-"..id.."-a","custom-version-"..id.."-b"},parse) end
        return stores[id]
    end
    local function integer(n) return type(n)=="number" and n>0 and n%1==0 and n<2^40 end
    local function index_parse(text)
        local ok,d=pcall(json.decode,text)
        if #text>512*1024 or not ok or type(d)~="table" then return nil,"Unreadable version index" end
        if d.format~=1 then return nil,"Unsupported version index",true end
        if not integer(d.next) or type(d.entries)~="table" or #d.entries>1280 or type(d.garbage)~="table" or #d.garbage>1280 then return nil,"Invalid version index" end
        local seen,counts={},{}
        for _,v in ipairs(d.entries) do
            if type(v)~="table" or not integer(v.id) or v.id>=d.next or seen[v.id] or not integer(v.key)
                or not integer(v.time) or type(v.name)~="string" or #v.name>64
                or type(v.named)~="boolean" or type(v.count)~="number" or v.count<0 or v.count%1~=0 then return nil,"Invalid version entry" end
            seen[v.id]=true
            local k=v.key..(v.named and ":named" or ":auto");counts[k]=(counts[k] or 0)+1
            if counts[k]>10 then return nil,"Invalid version count" end
        end
        for _,id in ipairs(d.garbage) do if not integer(id) or id>=d.next or seen[id] then return nil,"Invalid retired version" end;seen[id]=true end
        return d
    end
    local index=custom.slot_store({"custom-versions-a","custom-versions-b"},index_parse)
    function H.index()
        if cached then return cached end
        local newest=index.newest();local r=index.restore()
        if newest and newest.unsupported then return nil,"Version index from a newer editor; kept unchanged" end
        if r and not r.skipped then cached=r.doc
        elseif r or index.exists() then return nil,"Version index cannot be read; kept unchanged"
        else cached={format=1,next=1,entries={},garbage={}} end
        return cached
    end
    function H.list(key)
        local idx,err=H.index();local list={}
        for _,v in ipairs(idx and idx.entries or {}) do if v.key==key then list[#list+1]=copy(v) end end
        table.sort(list,function(a,b) if a.time~=b.time then return a.time>b.time end;return a.id>b.id end)
        return list,err
    end
    function H.bytes()
        local idx,err=H.index();if not idx then return nil,err end
        local n=index.bytes()
        for _,v in ipairs(idx.entries) do n=n+version(v.id).bytes() end
        for _,id in ipairs(idx.garbage) do n=n+version(id).bytes() end
        return n
    end
    local function write_index(next)
        local text=json.encode(next,{encode_empty_table_as_object=false})
        -- Account for both index slots at the larger of old/new size during a transaction.
        local bytes,seen=0,{}
        -- Count the union, including an orphan recovered into the next garbage registry.
        for _,idx in ipairs({cached,next}) do
            for _,v in ipairs(idx.entries) do if not seen[v.id] then seen[v.id]=true;bytes=bytes+version(v.id).bytes() end end
            for _,id in ipairs(idx.garbage) do if not seen[id] then seen[id]=true;bytes=bytes+version(id).bytes() end end
        end
        if bytes+math.max(index.bytes(),2*index.cost(text))>M.CAP then return nil,"Version storage is full (16 MiB); delete named versions" end
        local ok,err=index.save(text)
        if not ok then return nil,err end
        cached=next;H.generation=H.generation+1
        return text
    end
    local function begin(next,done)
        local text,err=write_index(next)
        if not text then return nil,err end
        pending={text=text,phase="first",done=done};return true
    end
    function H.busy() return pending~=nil end
    -- Called once per frame. Reads are cached, so they cannot perpetually restart IndexedDB sync.
    function H.update()
        if not pending then return end
        local state=custom.sync_state();if state=="syncing" then return end
        local p=pending
        local function fail(err) pending=nil;H.error="Save failed (versions: "..tostring(err)..")";H.generation=H.generation+1 end
        if state=="failed" then fail("browser storage sync");return end
        if p.phase=="first" then
            local ok,err=index.save(p.text);if not ok then fail(err);return end
            p.phase="second";return
        end
        if p.phase=="second" then
            -- Both persisted index slots no longer refer to these files. A failed removal is retried
            -- from the persisted garbage list; no named/live snapshot is ever garbage-collected.
            for _,id in ipairs(cached.garbage) do local ok,err=version(id).remove();if not ok then fail(err);return end end
            if #cached.garbage>0 then
                local next=copy(cached);next.garbage={}
                local text,err=write_index(next);if not text then fail(err);return end
                p.text,p.phase=text,"clean_first";return
            end
        elseif p.phase=="clean_first" then
            local ok,err=index.save(p.text);if not ok then fail(err);return end
            p.phase="clean_second";return
        end
        pending=nil;H.error=nil;H.generation=H.generation+1
        if p.done then p.done() end
    end
    function H.load(key,id)
        local found
        for _,v in ipairs(H.list(key)) do if v.id==id then found=true end end
        if not found then return nil,"Version is no longer listed" end
        local s=version(id);local newest=s.newest()
        if newest and newest.unsupported then return nil,newest.unsupported.."; original kept unchanged" end
        local r,err=s.restore();return r and r.doc,err or (not r and "No valid version data" or nil)
    end
    local function retire(next,predicate)
        local kept={}
        for _,v in ipairs(next.entries) do if predicate(v) then next.garbage[#next.garbage+1]=v.id else kept[#kept+1]=v end end
        next.entries=kept
    end
    function H.remove(key,id,done)
        if pending then return nil,"Version storage is busy; wait for Saving to finish" end
        local idx,err=H.index();if not idx then return nil,err end
        local next=copy(idx);retire(next,function(v) return v.key==key and (id==nil or id==v.id) end)
        return begin(next,done)
    end
    -- on_done only runs after acknowledged browser sync (or native/session-only completion).
    function H.add(key,text,name,named,done)
        if pending then return nil,"Version storage is busy; try again after Saving" end
        H.error=nil
        if not integer(key) then return nil,"Save the level before creating versions" end
        if #text>custom.limit then return nil,"Version exceeds 256 KiB" end
        local doc,err=parse(text);if not doc then return nil,err end
        if type(name)~="string" or #name>64 or name:find("[%z\1-\31\127]") or (named and name:match("^%s*$")) then return nil,"Snapshot name must be 1–64 bytes" end
        local idx,ierr=H.index();if not idx then return nil,ierr end
        -- Recover interrupted cleanup before new allocations. The operation is retried after sync.
        if #idx.garbage>0 then return begin(copy(idx),function() local ok,e=H.add(key,text,name,named,done);if not ok then H.error="Save failed (versions: "..tostring(e)..")" end end) end
        local count,automatic=0,{}
        for _,v in ipairs(idx.entries) do
            if v.key==key and v.named==named then count=count+1 end
            if not v.named and not version(v.id).protected() then automatic[#automatic+1]=v end
        end
        if named and count>=M.MAX_NAMED then return nil,"10 named snapshots per level; delete one first" end
        table.sort(automatic,function(a,b) if a.time~=b.time then return a.time<b.time end;return a.id<b.id end)
        local next=copy(idx)
        local victim
        if not named and count>=M.MAX_AUTO then
            for _,v in ipairs(automatic) do if v.key==key then victim=v;break end end
        end
        local id=next.next
        -- Skip an orphan left by an interrupted write; its bytes are registered for cleanup first.
        if version(id).exists() then
            if (version(id).newest() or {}).unsupported then return nil,"Unindexed version from a newer editor; kept unchanged" end
            next.next=id+1;next.garbage[#next.garbage+1]=id
            return begin(next,function() local ok,e=H.add(key,text,name,named,done);if not ok then H.error="Save failed (versions: "..tostring(e)..")" end end)
        end
        local entry={id=id,key=key,time=os.time(),name=name,named=named,count=#doc.editor.objects}
        next.entries[#next.entries+1]=entry;next.next=id+1
        if not named and count>=M.MAX_AUTO and not victim then return nil,"Automatic versions are protected by a newer editor; kept unchanged" end
        -- Plan the entire oldest-first prefix before syncing. Reclaiming many tiny versions one by
        -- one otherwise needs dozens of IndexedDB acknowledgements before one large version fits.
        local selected,freed,chosen={},0,0
        local used=H.bytes()-index.bytes()
        local pair=2*version(id).cost(text)
        local function choose(v)
            if selected[v.id] then return end
            selected[v.id]=true;chosen=chosen+1;freed=freed+version(v.id).bytes()
        end
        local function peak()
            local proposed={format=1,next=next.next,entries={},garbage={}}
            for _,v in ipairs(next.entries) do if not selected[v.id] then proposed.entries[#proposed.entries+1]=v end end
            return used-freed+pair+2*index.cost(json.encode(proposed))
        end
        if victim then choose(victim) end
        if peak()>M.CAP then
            for _,v in ipairs(automatic) do choose(v);if peak()<=M.CAP then break end end
        end
        if peak()>M.CAP then return nil,"Version storage is full (16 MiB); named/protected snapshots leave insufficient room. Level still saves normally" end
        if chosen>0 then
            local pruned=copy(idx);retire(pruned,function(v) return selected[v.id] end)
            return begin(pruned,function() local ok,e=H.add(key,text,name,named,done);if not ok then H.error="Save failed (versions: "..tostring(e)..")" end end)
        end
        -- Immutable versions get two independently readable slots. The index is published last.
        local a,aerr=version(id).save(text);if not a then return nil,aerr end
        local b,berr=version(id).save(text);if not b then return nil,berr end
        return begin(next,done)
    end
    H.store=version -- also used by the debug-only failure/compatibility protocol
    return H
end
return M
