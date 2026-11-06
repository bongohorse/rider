-- #386: a Version History index whose `entries` or `garbage` field is not a dense array is rejected
-- fail-closed by the production module (main.editor.editor_versions on custom.slot_store): nothing is
-- listed, every write is refused, and no index slot or snapshot file is touched, also after a reload.
-- In the pinned engine (tests/engine/persistence) the index text goes through the real Defold
-- json.encode/json.decode and sys.serialize; only the file boundary (sys.load/sys.save, io.open,
-- os.remove) and the snapshot document parser are stubbed. Under plain LuaJIT (tools/gameplay/lua_tests.py)
-- there is no Defold json: each fixture then decodes to the shape the engine assertion below proves.
local engine_json=type(json)=='table' and json or nil
local real_sys=sys
local function copy(v)
    if type(v)~='table' then return v end
    local t={};for k,x in pairs(v) do t[k]=copy(x) end;return t
end
local function same(a,b)
    if type(a)~='table' or type(b)~='table' then return a==b end
    for k,v in pairs(a) do if not same(v,b[k]) then return false end end
    for k in pairs(b) do if a[k]==nil then return false end end
    return true
end
-- The seeded history (section 1): version 1 automatic and 2 named for level key 1, version 3 retired
-- (its files not yet removed), next id 4.
local E1='{"id":1,"key":1,"time":1,"name":"Automatic","named":false,"count":2}'
local E2='{"id":2,"key":1,"time":2,"name":"Named","named":true,"count":2}'
local function e1() return {id=1,key=1,time=1,name='Automatic',named=false,count=2} end
local function e2() return {id=2,key=1,time=2,name='Named',named=true,count=2} end
local function index_text(entries,garbage) return '{"format":1,"next":4,"entries":'..entries..',"garbage":'..garbage..'}' end
-- Malformed index texts, the Lua table Defold json.decode makes of each and the parse error H.index
-- reports with it (any one of causes: pairs order is unspecified).
local FIXTURES={
    {name='entries object with key "1" (#386 literal)',
        text='{"format":1,"next":3,"entries":{"1":{"id":1,"key":1,"time":1,"name":"A","named":true,"count":1}},"garbage":[]}',
        shape={format=1,next=3,entries={['1']={id=1,key=1,time=1,name='A',named=true,count=1}},garbage={}},
        causes={'entries is not a list (key "1")'}},
    {name='entries object with keys "1" and "2"',
        text=index_text('{"1":'..E1..',"2":'..E2..'}','[3]'),
        shape={format=1,next=4,entries={['1']=e1(),['2']=e2()},garbage={3}},
        causes={'entries is not a list (key "1")','entries is not a list (key "2")'}},
    {name='entries object with a name key',
        text=index_text('{"a":'..E1..'}','[3]'),
        shape={format=1,next=4,entries={a=e1()},garbage={3}},
        causes={'entries is not a list (key "a")'}},
    {name='entries array with a null hole',
        text=index_text('['..E1..',null,'..E2..']','[3]'),
        shape={format=1,next=4,entries={[1]=e1(),[3]=e2()},garbage={3}},
        causes={'entries has a gap at entry 2'}},
    {name='entries array starting with null',
        text=index_text('[null,'..E1..','..E2..']','[3]'),
        shape={format=1,next=4,entries={[2]=e1(),[3]=e2()},garbage={3}},
        causes={'entries has a gap at entry 1'}},
    {name='garbage object with key "1"',
        text=index_text('['..E1..','..E2..']','{"1":3}'),
        shape={format=1,next=4,entries={e1(),e2()},garbage={['1']=3}},
        causes={'garbage is not a list (key "1")'}},
    {name='garbage array starting with null',
        text=index_text('['..E1..','..E2..']','[null,3]'),
        shape={format=1,next=4,entries={e1(),e2()},garbage={[2]=3}},
        causes={'garbage has a gap at entry 1'}},
}
-- Valid controls: empty arrays, and empty objects (Defold decodes both to an empty table).
local EMPTY={name='empty arrays',text='{"format":1,"next":1,"entries":[],"garbage":[]}',shape={format=1,next=1,entries={},garbage={}}}
local EMPTY_OBJECT={name='empty objects',text='{"format":1,"next":1,"entries":{},"garbage":{}}',shape={format=1,next=1,entries={},garbage={}}}
local MODELS={EMPTY,EMPTY_OBJECT};for _,f in ipairs(FIXTURES) do MODELS[#MODELS+1]=f end
if engine_json then
    for _,f in ipairs(MODELS) do
        assert(same(engine_json.decode(f.text),f.shape),f.name..': Defold json.decode gives another shape than the fixture models')
    end
else
    local encoded,serial={},0
    json={encode=function(t) serial=serial+1;encoded['j'..serial]=copy(t);return 'j'..serial end,
        decode=function(s)
            if encoded[s] then return copy(encoded[s]) end
            for _,f in ipairs(MODELS) do if f.text==s then return copy(f.shape) end end
            error('no JSON model for '..s)
        end}
end
local files,writes={},{}
sys={get_save_file=function(app,name) return app..'/'..name end,get_engine_info=function() return {is_debug=true} end,
    load=function(path) return copy(files[path]) or {} end,
    save=function(path,t) writes[#writes+1]=path;files[path]=copy(t);return true end,
    serialize=function(t)
        if real_sys then return real_sys.serialize(t) end
        return string.rep('x',#t.text+64)
    end}
local real_open,real_remove=io.open,os.remove
io.open=function(path,...)
    if path:match('^rider/') then
        local t=files[path]
        return t~=nil and {seek=function() return #t.text+64 end,close=function() end} or nil
    end
    return real_open(path,...)
end
os.remove=function(path) writes[#writes+1]='remove '..path;files[path]=nil;return true end
html5=nil
-- The snapshot document parser (editor.lua passes the source validator); H.add only reads the object count.
local SNAP='{"snapshot":1}'
local function parse(text) if text==SNAP then return {editor={objects={{},{}}}} end;return nil,'not a snapshot' end
local versions=require 'main.editor.editor_versions'
print('version_index: '..(engine_json and 'Defold json.decode/encode and sys.serialize' or 'LuaJIT JSON model'))
local IA,IB='rider/custom-versions-a','rider/custom-versions-b'
local function version(id,s) return 'rider/custom-version-'..id..'-'..s end
-- A page (re)load: a fresh history with nothing cached.
local function page() return versions.create(parse) end
local function reset() files,writes={},{};return page() end
-- Runs H.update (one call per frame) until the transaction is done.
local function settle(H)
    for _=1,20 do if not H.busy() then break end;H.update() end
    assert(not H.busy() and not H.error,'version transaction did not finish: '..tostring(H.error))
end
local function ids(list) local t={};for i,v in ipairs(list) do t[i]=v.id end;table.sort(t);return table.concat(t,',') end
local function newest_slot() return files[IA].seq>files[IB].seq and IA or IB end
-- Seeds the history above through the production writes: both index slots name entries 1 and 2 and
-- retired 3, and all six snapshot files exist.
local function seed()
    local H=reset()
    assert(H.add(1,SNAP,'Automatic',false));settle(H)
    assert(H.add(1,SNAP,'Named',true));settle(H)
    assert(H.add(1,SNAP,'Automatic',false));settle(H)
    -- Retire 3; stop before the files are removed (the interrupted cleanup a reload retries).
    assert(H.remove(1,3));assert(H.busy())
    local a,b=json.decode(files[IA].text),json.decode(files[IB].text)
    assert(same(a,b) and a.next==4 and #a.entries==2 and same(a.garbage,{3}),'both index slots must hold the seeded index')
    for id=1,3 do assert(files[version(id,'a')] and files[version(id,'b')],'snapshot '..id..' must exist') end
    return page()
end
-- Every Version History operation on an unusable index: nothing listed, every write refused, no file
-- touched, and the same after a page reload.
local function refused(label,causes)
    local before=copy(files)
    writes={}
    for round=1,2 do
        local H=page()
        local idx,err,cause=H.index()
        assert(idx==nil,label..': the index must be rejected (round '..round..')')
        assert(err==versions.INDEX_UNREADABLE,label..': unexpected error '..tostring(err))
        local expected=false
        for _,c in ipairs(causes) do expected=expected or cause==c end
        assert(expected,label..': unexpected cause '..tostring(cause))
        local list,lerr=H.list(1)
        assert(#list==0 and lerr==err,label..': nothing may be listed')
        local bytes,berr=H.bytes()
        assert(bytes==nil and berr==err,label..': bytes must be refused')
        for _,named in ipairs({false,true}) do
            local ok,aerr=H.add(1,SNAP,named and 'Named' or 'Automatic',named)
            assert(not ok and aerr==err,label..': a '..(named and 'named' or 'automatic')..' snapshot must be refused: '..tostring(aerr))
        end
        assert(not H.remove(1,1) and not H.remove(1),label..': a delete must be refused')
        assert(not H.load(1,1),label..': an unlisted version must not open')
        H.update()
        assert(not H.busy() and not H.error,label..': nothing may be pending')
    end
    assert(#writes==0,label..': '..#writes..' file writes, first '..tostring(writes[1]))
    assert(same(files,before),label..': a stored index or snapshot file changed')
end

-- 1. Positive control: the seeded dense index (written by the real encoder) lists both versions; after a
-- reload the next add first finishes the retirement of 3 (its files go), then writes version 4.
local H=seed()
assert(H.index() and ids(H.list(1))=='1,2')
assert(H.add(1,SNAP,'Named 2',true));settle(H)
assert(files[version(3,'a')]==nil and files[version(3,'b')]==nil,'retired version 3 must be removed')
assert(files[version(4,'a')] and files[version(4,'b')])
H=page()
assert(ids(H.list(1))=='1,2,4' and #H.index().garbage==0 and H.load(1,4))
print('PASS a dense index lists, finishes a retirement, adds and reloads')

-- 2. Empty arrays and empty objects load as an empty history that accepts a first version.
for _,f in ipairs({EMPTY,EMPTY_OBJECT}) do
    H=reset()
    files[IA]={format=1,seq=1,text=f.text}
    assert(H.index() and #H.list(1)==0,f.name..' must load')
    assert(H.add(1,SNAP,'Automatic',false));settle(H)
    assert(ids(page().list(1))=='1',f.name..': the first version must be listed')
end
print('PASS empty arrays and empty objects load as an empty history')

-- 3. Per-level limits as before: the 11th automatic version retires the oldest one; the 11th named
-- version is refused.
H=reset()
for _=1,versions.MAX_AUTO+1 do assert(H.add(1,SNAP,'Automatic',false));settle(H) end
assert(#H.list(1)==versions.MAX_AUTO and ids(H.list(1)):match('^2,') and files[version(1,'a')]==nil,'the oldest automatic version must be retired')
for _=1,versions.MAX_NAMED do assert(H.add(1,SNAP,'Named',true));settle(H) end
local ok,err=H.add(1,SNAP,'Named',true)
assert(not ok and err:match('^10 named snapshots'),tostring(err))
assert(#page().list(1)==versions.MAX_AUTO+versions.MAX_NAMED)
print('PASS automatic versions are pruned and named versions are capped per level')

-- 4. A non-dense `entries` or `garbage` (object-shaped or with a JSON null hole) is rejected whether it
-- is the newest index slot next to a valid older slot or the only one; nothing is overwritten.
for _,f in ipairs(FIXTURES) do
    seed()
    files[newest_slot()].text=f.text
    refused(f.name..' in the newest slot',f.causes)
    seed()
    local slot=newest_slot()
    files[slot==IA and IB or IA]=nil;files[slot].text=f.text
    refused(f.name..' as the only slot',f.causes)
end
print('PASS object-shaped and holed entries/garbage are refused in the newest or only slot and keep every file')

-- 5. Dense entries and garbage up to 1280 load; 1281 are refused like any unusable index.
local function sized(n,field)
    local d={format=1,next=n+1,entries={},garbage={}}
    for i=1,n do
        -- 20 per level key: 10 automatic and 10 named.
        if field=='entries' then d.entries[i]={id=i,key=math.floor((i-1)/20)+1,time=i,name='V',named=i%2==0,count=1}
        else d.garbage[i]=i end
    end
    return json.encode(d,{encode_empty_table_as_object=false})
end
for _,field in ipairs({'entries','garbage'}) do
    for _,n in ipairs({versions.INDEX_MAX,versions.INDEX_MAX+1}) do
        H=reset()
        files[IA]={format=1,seq=1,text=sized(n,field)}
        if n<=versions.INDEX_MAX then
            local idx=H.index()
            assert(idx and #idx[field]==n,n..' '..field..' must load')
        else
            refused(n..' '..field,{field..' has more than '..versions.INDEX_MAX..' entries'})
        end
    end
end
print('PASS 1280 entries or retired ids load and 1281 are refused')

-- 6. Each index error fits the status bar "Save failed (versions: <error>)" whole. editor_ui.lua shortens
-- the status to width/(12*.57) characters in w-504-sx px, sx=112+title width (at most 160 px), and the
-- logical width w is never below 1280 (editor_ui.size), so the narrowest status shows 73 characters.
local STATUS_CHARS=math.floor((1280-504-(112+160))/(12*.57))
assert(STATUS_CHARS==73)
for _,e in ipairs({versions.INDEX_UNREADABLE,versions.INDEX_NEWER}) do
    local status='Save failed (versions: '..e..')'
    assert(#status<=STATUS_CHARS,'"'..status..'" ('..#status..' characters) is cut in the status bar')
    assert(e:match('kept unchanged$'),'"'..e..'" must say the index is kept unchanged')
end
-- Drift guard for the width math above (source files are not bundled into the engine run).
local function source(path) local f=real_open(path,'rb');if not f then return nil end;local t=f:read('*a');f:close();return t end
local ui,editor=source('main/editor/editor_ui.lua'),source('main/editor/editor.lua')
if ui and editor then
    for _,needle in ipairs({'local title_width=math.min(160,math.max(96,#d.title*10.5+4))','local sx=112+title_width',
        'text(sx,24,d.status,','C.active,12,w-504-sx)','math.floor(width/((size or 14)*.57))','math.min(1,math.max(1,w)/density/1280)'}) do
        assert(ui:find(needle,1,true),'editor_ui.lua changed the status width math: '..needle)
    end
    assert(editor:find('M.version_error="Save failed (versions: "..tostring(err)..")"',1,true),'editor.lua changed the versions status prefix')
else
    assert(engine_json,'the editor sources must be readable under LuaJIT')
end
print('PASS the Version History index errors fit the narrowest status bar')

io.open,os.remove=real_open,real_remove
