-- #382: a My levels index whose `levels` field is not a dense array is rejected fail-closed by the
-- production library (main.game.custom): it is not listed, blocks every write and keeps all files.
-- In the pinned engine (tests/engine/persistence) the index text goes through the real Defold
-- json.encode/json.decode and the level document through custom.parse; only the file boundary
-- (sys.load/sys.save, io.open, os.remove) is stubbed. Under plain LuaJIT (tools/gameplay/lua_tests.py)
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
local function entry(key,id) return {key=key,id=id or 'straight',name='A',time=1} end
-- Malformed index texts and the Lua table Defold json.decode makes of each. One real level (key 1) exists.
local FIXTURES={
    {name='object with key "1" (#382 literal)',
        text='{"format":1,"next":3,"levels":{"1":{"key":1,"id":"straight","name":"A","time":1}}}',
        shape={format=1,next=3,levels={['1']=entry(1)}}},
    {name='object with a name key',
        text='{"format":1,"next":3,"levels":{"a":{"key":1,"id":"straight","name":"A","time":1}}}',
        shape={format=1,next=3,levels={a=entry(1)}}},
    {name='object with keys "1" and "2"',
        text='{"format":1,"next":3,"levels":{"1":{"key":1,"id":"straight","name":"A","time":1},"2":{"key":2,"id":"b","name":"A","time":1}}}',
        shape={format=1,next=3,levels={['1']=entry(1),['2']=entry(2,'b')}}},
    {name='array with a null hole',
        text='{"format":1,"next":3,"levels":[{"key":1,"id":"straight","name":"A","time":1},null,{"key":2,"id":"b","name":"A","time":1}]}',
        shape={format=1,next=3,levels={[1]=entry(1),[3]=entry(2,'b')}}},
    {name='array starting with null',
        text='{"format":1,"next":3,"levels":[null,{"key":1,"id":"straight","name":"A","time":1}]}',
        shape={format=1,next=3,levels={[2]=entry(1)}}},
}
-- Valid control: an empty array (an empty object decodes the same).
local EMPTY={name='empty array',text='{"format":1,"next":1,"levels":[]}',shape={format=1,next=1,levels={}}}
local MODELS={EMPTY};for _,f in ipairs(FIXTURES) do MODELS[#MODELS+1]=f end
local LEVEL,parse
if engine_json then
    LEVEL=assert(real_sys.load_resource('/main/game/stations/straight.json'),'missing straight.json')
    for _,f in ipairs(MODELS) do
        assert(same(engine_json.decode(f.text),f.shape),f.name..': Defold json.decode gives another shape than the fixture models')
    end
else
    local file=assert(io.open('main/game/stations/straight.json','rb'));LEVEL=file:read('*a');file:close()
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
    save=function(path,t) writes[#writes+1]=path;files[path]=copy(t);return true end}
local real_open,real_remove=io.open,os.remove
io.open=function(path,...)
    if path:match('^rider/') then return files[path]~=nil and {close=function() end} or nil end
    return real_open(path,...)
end
os.remove=function(path) writes[#writes+1]='remove '..path;files[path]=nil;return true end
html5=nil
local custom=require 'main.game.custom'
if engine_json then
    parse=custom.parse
else
    parse=function(text) if text==LEVEL then return {text=text} end;return nil,'not the seeded level' end
end
assert(parse(LEVEL),'the seeded level must be a valid custom level')
print('my_levels_index: '..(engine_json and 'Defold json.decode, custom.parse' or 'LuaJIT JSON model, stub level parse'))
local IA,IB='rider/custom-index-a','rider/custom-index-b'
local function page() custom.lib=nil;return custom.library(parse) end
local function reset() files,writes={},{};return page() end
-- custom.parse returns the decoded level, the LuaJIT stand-in the text.
local function is_level(d) return type(d)=='table' and (d.text==LEVEL or d.id=='straight') end
local function listed(L,key) for _,l in ipairs(L.list()) do if l.key==key then return l end end end
-- A real level saved twice under key 1: index slots a (seq 1) and b (seq 2), level slots a and b.
local function seed()
    local L=reset()
    local key=assert(L.new_key())
    assert(key==1 and L.save(key,LEVEL,'straight','A') and L.save(key,LEVEL,'straight','A'))
    assert(files[IA].seq==1 and files[IB].seq==2 and files['rider/custom-doc-1-a'] and files['rider/custom-doc-1-b'])
    return page()
end
-- Every My levels operation on an unusable index: nothing listed, every write refused, no file touched,
-- and the same after a page reload. The seeded level itself still opens by its key.
local function refused(label)
    local before=copy(files)
    writes={}
    for round=1,2 do
        local L=page()
        local idx,err=L.index()
        assert(idx==nil,label..': the index must be rejected (round '..round..')')
        assert(type(err)=='string' and err:match('cannot be read') and err:match('kept unchanged'),label..': unclear error '..tostring(err))
        assert(#L.list()==0 and not L.has(1),label..': nothing may be listed')
        local key,kerr=L.new_key()
        assert(not key and kerr==err,label..': new_key must be refused: '..tostring(key))
        local seq,serr=L.save(1,LEVEL,'straight','B')
        assert(not seq and serr==err,label..': a save must be refused: '..tostring(serr))
        seq=L.save(2,LEVEL,'other','C')
        assert(not seq,label..': a save under a new key must be refused')
        local removed=L.remove(1)
        assert(not removed,label..': a delete must be refused')
        if files['rider/custom-doc-1-b'] then assert(is_level(L.load(1)),label..': the seeded level must still open') end
    end
    assert(#writes==0,label..': '..#writes..' file writes, first '..tostring(writes[1]))
    assert(same(files,before),label..': a stored index or level file changed')
end

-- 1. Positive control: a dense index (written by the real encoder) lists and saves the seeded level, and
-- an empty array loads as an empty library.
local L=seed()
assert(L.index() and #L.list()==1 and listed(L,1).name=='A' and is_level(L.load(1)))
assert(L.save(1,LEVEL,'straight','Renamed')==3 and listed(page(),1).name=='Renamed')
reset()
files[IA]={format=1,seq=1,text=EMPTY.text}
L=page()
assert(L.index() and #L.list()==0 and L.new_key()==1)
print('PASS a dense index and an empty array load; the seeded level lists, saves and reloads')

-- 2. Dense indexes with 1 and 64 entries load; 65 entries are refused like any unusable index.
for _,n in ipairs({1,64,65}) do
    reset()
    local index={format=1,next=n+1,levels={}}
    for i=1,n do index.levels[i]=entry(i,'level-'..i) end
    files[IA]={format=1,seq=1,text=json.encode(index)}
    L=page()
    if n<=custom.LIBRARY_MAX then
        assert(L.index() and #L.list()==n and listed(L,n).id=='level-'..n,n..' entries must load')
    else
        refused(n..' entries')
    end
end
print('PASS dense indexes with 1 and 64 entries load and 65 entries are refused')

-- 3. A non-dense `levels` (object-shaped or with a JSON null hole) is rejected whether it is the only
-- index slot or the newest one next to a valid older slot; no index or level file is overwritten.
for _,f in ipairs(FIXTURES) do
    seed()
    files[IB].text=f.text
    refused(f.name..' in the newest slot')
    seed()
    files[IA]=nil;files[IB].text=f.text
    refused(f.name..' as the only slot')
end
print('PASS object-shaped and holed level lists are refused in the newest or only slot and keep every file')

-- 4. The reason reaches the error shown in My levels.
seed()
files[IB].text=FIXTURES[1].text
local _,err=page().index()
assert(err:match('levels is not a list'),'the error must name the malformed field: '..tostring(err))
files[IB].text=FIXTURES[4].text
_,err=page().index()
assert(err:match('levels has a gap at entry 2'),'the error must name the hole: '..tostring(err))
print('PASS the My levels error names the malformed levels field')

io.open,os.remove=real_open,real_remove
