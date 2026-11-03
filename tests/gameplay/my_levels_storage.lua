-- #409: run the production My levels storage (main.game.custom) under injected file failures.
-- Only the Defold file boundary (sys.load/sys.save, io.open, os.remove) and json are stubbed.
-- A file table here stands for the bytes on disk; a write always stores a fresh copy.
local files,save_fault,remove_fault,load_fault={},nil,nil,nil
local doc_probes,HANG=0,10000
local function copy(v)
    if type(v)~='table' then return v end
    local t={};for k,x in pairs(v) do t[k]=copy(x) end;return t
end
local encoded,serial={},0
json={encode=function(t) serial=serial+1;encoded['j'..serial]=copy(t);return 'j'..serial end,
    decode=function(s) assert(encoded[s],'bad JSON');return copy(encoded[s]) end}
sys={get_save_file=function(app,name) return app..'/'..name end,get_engine_info=function() return {is_debug=true} end,
    load=function(path)
        if path:match('custom%-doc%-') then
            doc_probes=doc_probes+1
            -- Hang guard only: lets an unbounded key scan end so the assertion below can report it.
            if doc_probes>HANG then return {} end
        end
        if (load_fault and load_fault(path))=='throw' then error('injected unreadable '..path) end
        return copy(files[path]) or {}
    end,
    save=function(path,t)
        local fault=save_fault and save_fault(path)
        -- HTML5 sys.save truncates/unlinks its target on a write error.
        if fault=='fail' then files[path]=nil;error('injected write failure '..path) end
        if fault=='lost' then return true end -- reported written, never stored: readback must catch it
        files[path]=copy(t);return true
    end}
local real_open,real_remove=io.open,os.remove
io.open=function(path,...)
    if path:match('^rider/') then return files[path]~=nil and {close=function() end} or nil end
    return real_open(path,...)
end
os.remove=function(path)
    local fault=remove_fault and remove_fault(path)
    if fault=='throw' then error('injected remove exception '..path) end
    if fault=='refuse' then return nil,path..': Permission denied',13 end
    files[path]=nil;return true
end
html5=nil
local custom=require 'main.game.custom'
local function parse(text) return {text=text} end
-- A page reload: the index, its keys and the per-level stores are read afresh from the files.
local function page() custom.lib=nil;return custom.library(parse) end
local function reset() files={};save_fault,remove_fault,load_fault=nil,nil,nil;doc_probes=0;return page() end
local function doc(key,s) return files['rider/custom-doc-'..key..'-'..s] end
local function entry(L,key) for _,l in ipairs(L.list()) do if l.key==key then return l end end end
local function index_fault(kind) return function(path) if path:match('custom%-index%-') then return kind end end end
-- n saves of one level; two leave the newest copy in slot b, three in slot a.
local function saves(L,name,n)
    local key=assert(L.new_key())
    for i=1,n do assert(L.save(key,name..i,'id',name)) end
    local newest,older=n%2==1 and 'a' or 'b',n%2==1 and 'b' or 'a'
    assert(doc(key,newest).text==name..n and doc(key,older).text==name..(n-1))
    return key
end
local function two_saves(L,name) return saves(L,name,2) end

-- 1. Delete. Positive control: both files and the entry go, also after a reload.
local L=reset()
local k=two_saves(L,'A')
assert(L.remove(k)==true)
assert(not doc(k,'a') and not doc(k,'b') and not entry(L,k))
L=page();assert(not entry(L,k) and not L.load(k))
print('PASS normal two-slot delete removes both files and the entry, also after reload')

-- A file that stays (removal refused or thrown, older or newer slot) is reported, never acknowledged.
-- The entry stays listed for a retry and opens as its newest copy, never an older one: the older slot
-- goes first, whether the newest copy is in slot b (two saves) or slot a (three saves).
for _,n in ipairs({2,3}) do
for _,slot in ipairs({'a','b'}) do
    for _,fault in ipairs({'refuse','throw'}) do
        L=reset();k=saves(L,'A',n)
        remove_fault=function(path) if path=='rider/custom-doc-'..k..'-'..slot then return fault end end
        local ok,err=L.remove(k)
        assert(not ok and type(err)=='string','a delete whose slot '..slot..' stays ('..fault..') reported success')
        assert(doc(k,slot),'the injected failure must keep its file')
        for _,lib in ipairs({L,page()}) do
            assert(entry(lib,k),'a partly deleted level must stay listed for a retry')
            assert(lib.load(k).text=='A'..n,'a partly deleted level ('..n..' saves, slot '..slot..' stays) must open as its newest copy')
        end
        remove_fault=nil;L=page()
        assert(L.remove(k)==true,'the retried delete must succeed')
        assert(not doc(k,'a') and not doc(k,'b') and not entry(L,k) and not entry(page(),k))
    end
end
end
print('PASS a delete whose file stays is reported, keeps the newest copy listed and retries cleanly')

-- A failed index write during a delete is reported and keeps the entry; the retry completes it.
L=reset();k=two_saves(L,'A')
save_fault=index_fault('fail')
local ok,derr=L.remove(k)
assert(not ok and tostring(derr):match('entry could not be removed'),'a failed index write must be reported: '..tostring(derr))
save_fault=nil;L=page()
assert(entry(L,k),'a failed index write must keep the entry')
assert(L.remove(k)==true and not entry(page(),k) and not doc(k,'a') and not doc(k,'b'))
print('PASS a failed index write during delete is reported and the retry completes it')

-- An index that refuses every write (its older slot holds newer-version data) is checked first: the delete
-- is refused with the cause, deletes nothing and leaves no listed level without files.
L=reset();k=two_saves(L,'A')
local future_index=files['rider/custom-index-a']
future_index.text=json.encode({format=2,next=9,levels={}})
L=page()
assert(entry(L,k),'the newest index slot is valid and lists the level')
ok,derr=L.remove(k)
assert(not ok and tostring(derr):match('newer Rider version') and tostring(derr):match('not deleted'),'the refusal must name its cause: '..tostring(derr))
assert(doc(k,'a') and doc(k,'b') and entry(page(),k) and page().load(k).text=='A2','nothing may be deleted')
assert(files['rider/custom-index-a']==future_index,'the newer-version index slot must stay unchanged')
print('PASS a delete against an index with newer-version data is refused with its cause and deletes nothing')

-- 2. Save order. Positive control: valid saves alternate the document slots and update the entry.
L=reset();k=assert(L.new_key())
assert(L.save(k,'A','id','Name A')==1 and L.save(k,'B','id','Name B')==2 and L.save(k,'C','id','Name C')==3)
assert(doc(k,'a').text=='C' and doc(k,'b').text=='B')
L=page();assert(L.load(k).text=='C' and entry(L,k).name=='Name C')
print('PASS valid My levels saves alternate slots and update the entry')

-- A failed (or unreadable) index write never leaves the new document visible under the old entry, and a
-- first save never leaves level files without an index entry.
for _,fault in ipairs({'fail','lost'}) do
    L=reset();k=assert(L.new_key());assert(L.save(k,'A','id','Name A'))
    save_fault=index_fault(fault)
    local seq,err=L.save(k,'B','id','Name B')
    assert(not seq and tostring(err):match('level index'),'a failed index write must fail the save')
    save_fault=nil
    for _,lib in ipairs({L,page()}) do
        assert(entry(lib,k).name=='Name A','the index must keep the old entry')
        assert(lib.load(k).text=='A','a failed save ('..fault..') published the new document under the old entry')
    end
    L=page();local n=assert(L.new_key())
    save_fault=index_fault(fault)
    assert(not L.save(n,'C','id','Name C'))
    save_fault=nil
    assert(not doc(n,'a') and not doc(n,'b'),'a first save ('..fault..') left level files without an index entry')
    assert(not entry(page(),n))
    -- The next save succeeds and publishes both.
    L=page();assert(L.save(k,'B','id','Name B'));assert(L.load(k).text=='B' and entry(L,k).name=='Name B')
    L=page();assert(L.load(k).text=='B' and entry(L,k).name=='Name B')
end
print('PASS a failed or unreadable index write withdraws the new document; the retry publishes both')

-- When the withdrawal fails too, the error says so instead of hiding the published copy.
L=reset();k=assert(L.new_key());assert(L.save(k,'A','id','Name A'))
save_fault=index_fault('fail')
remove_fault=function(path) if path:match('custom%-doc%-') then return 'refuse' end end
local seq,err=L.save(k,'B','id','Name B')
assert(not seq and tostring(err):match('level index') and tostring(err):match('rolled back'),'a failed rollback must be reported: '..tostring(err))
print('PASS a failed rollback is reported with the index error')

-- 3. Key search. Positive control: occupied and unreadable keys are skipped, the first free key is used.
L=reset()
files['rider/custom-doc-1-a']={format=1,seq=1,text='orphan'}
load_fault=function(path) if path:match('custom%-doc%-2%-') then return 'throw' end end
assert(L.new_key()==3,'occupied/unreadable keys must be skipped, the first free key used')
print('PASS new_key skips occupied and unreadable keys and returns the first free key')

-- Storage that cannot be read for any key gives a storage error after a bounded scan.
L=reset()
load_fault=function(path) if path:match('custom%-doc%-') then return 'throw' end end
local key,kerr=L.new_key()
assert(doc_probes<1000,'new_key probed '..doc_probes..' unreadable level files without giving up')
assert(not key and type(kerr)=='string','unreadable storage must give a storage error, not key '..tostring(key))
-- Readable again: the same page hands out a key, and nothing was written meanwhile.
load_fault=nil
assert(next(files)==nil and L.new_key()==1)
print('PASS new_key gives a bounded storage error for unreadable storage and recovers afterwards')

io.open,os.remove=real_open,real_remove
