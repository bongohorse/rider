-- #387: hulls, labels and hull vertices must be dense JSON lists before a level is admitted. An object
-- ({"1":…}) reads as empty and a null member ends ipairs early, so the obstacle or label would vanish
-- from the budget, physics and render while the import succeeds. Cases go through the import path
-- (custom.parse: JSON text -> json.decode -> station_data.validate) with a decoder that gives the
-- Defold json.decode shapes (tests/gameplay/lib/json.lua); the real engine import is the le1a Gym case.
-- #388 (coins, gems, fuel) adds its lists to CASES the same way.
local J=require 'tests.gameplay.lib.json'
json={decode=J.decode}
sys={get_save_file=function(app,name) return app..'/'..name end,get_engine_info=function() return {is_debug=true} end,
    load=function() return {} end,save=function() error('this suite never saves') end}
html5=nil
local data=require 'main.game.station_data'
local custom=require 'main.game.custom'
local budget=require 'main.game.terrain_budget'

-- The le1a sample "Kicker to platform" (one chain, one 4-vertex hull, two labels) with replaceable lists.
local HULL='{"vertices":[[13.7321,0.8],[21.7321,0.8],[21.7321,1.3],[13.7321,1.3]]}'
local HULL2='{"vertices":[[30,0.8],[32,0.8],[32,1.3],[30,1.3]]}'
local LABEL='{"position":[11.7321,3.2],"text":"Kicker 15 deg, 2 m gap"}'
local LABEL2='{"position":[17.7321,2.6],"text":"Platform"}'
local function level(hulls,labels)
    return '{"schema":1,"id":"kicker-platform","name":"Kicker to platform","units":"metres","spawn":[0,1.7],"start_speed":7,'
        ..'"run_in":8,"run_out":20,"bounds":[-8,68,-6,20],'
        ..'"chains":[[[70,0.8],[13.7321,0.8],[13.7321,-1.2],[11.7321,-1.2],[11.7321,1.8],[8,0.8],[-10,0.8]]],'
        ..'"hulls":'..hulls..',"labels":'..labels..'}'
end
local function count(t) local n=0;for _ in ipairs(t) do n=n+1 end;return n end
-- Admitted: the lists ipairs walks are the whole lists, and the budget counts exactly those members.
local function admitted(text,hulls,labels,label)
    local d,err=custom.parse(text)
    assert(d,label..': must be admitted, got '..tostring(err))
    local h,l=d.hulls or {},d.labels or {}
    assert(count(h)==hulls and #h==hulls and count(l)==labels and #l==labels,label..': admitted the wrong number of members')
    local r=budget.measure(d);local vertices=0
    for _,x in ipairs(h) do vertices=vertices+count(x.vertices) end
    assert(r.hull_vertices==vertices and r.labels==labels,label..': the budget counts other members than the level builds')
    return d
end

-- 1. Valid lists are unchanged: dense hulls/labels, empty arrays, empty objects (Defold decodes {} and []
-- alike; official courses ship "hulls":{}) and absent fields.
assert(custom.parse(assert(io.open('main/gym/samples/kicker-platform.json','rb')):read('*a')),'the le1a sample must import')
admitted(level('['..HULL..']','['..LABEL..','..LABEL2..']'),1,2,'dense hulls and labels')
admitted(level('['..HULL..','..HULL2..']','['..LABEL..']'),2,1,'two hulls')
admitted(level('[]','[]'),0,0,'empty arrays')
admitted(level('{}','{}'),0,0,'empty objects')
admitted((level('[]','[]'):gsub(',"hulls":%[%],"labels":%[%]','')),0,0,'no hulls and no labels')
-- A trailing null decodes to the shorter list (nothing after it to lose), like {} and [].
admitted(level('['..HULL..',null]','['..LABEL..',null]'),1,1,'trailing null')
print('PASS dense, empty-array, empty-object and absent hulls/labels are admitted and counted as built')

-- 2. Malformed lists are refused before import with the field, the cause and the first bad key or gap.
local CASES={
    {'object-shaped hulls (issue literal)',level('{"1":'..HULL..'}','[]'),'Invalid hulls: hulls is not a list (key "1")'},
    {'object-shaped hulls, name key',level('{"a":'..HULL..'}','[]'),'Invalid hulls: hulls is not a list (key "a")'},
    {'sparse hulls',level('['..HULL..',null,'..HULL2..']','[]'),'Invalid hulls: hulls has a gap at entry 2'},
    {'hulls starting with null',level('[null,'..HULL..']','[]'),'Invalid hulls: hulls has a gap at entry 1'},
    {'object-shaped labels',level('['..HULL..']','{"1":'..LABEL..'}'),'Invalid labels: labels is not a list (key "1")'},
    {'object-shaped labels, name key',level('['..HULL..']','{"first":'..LABEL..'}'),'Invalid labels: labels is not a list (key "first")'},
    {'sparse labels',level('['..HULL..']','['..LABEL..',null,'..LABEL2..']'),'Invalid labels: labels has a gap at entry 2'},
    {'object-shaped hull vertices',level('[{"vertices":{"1":[13.7321,0.8],"2":[21.7321,0.8],"3":[21.7321,1.3]}}]','[]'),
        {'Invalid hull vertices: hull 1 vertices is not a list (key "1")','Invalid hull vertices: hull 1 vertices is not a list (key "2")',
         'Invalid hull vertices: hull 1 vertices is not a list (key "3")'}},
    {'sparse hull vertices',level('['..HULL2..',{"vertices":[[13.7321,0.8],null,[21.7321,0.8],[21.7321,1.3],[13.7321,1.3]]}]','[]'),
        'Invalid hull vertices: hull 2 vertices has a gap at entry 2'},
    -- A key from the file is cut so the message stays one short line (data.CAUSE bytes of cause).
    {'long key',level('{"'..string.rep('k',200)..'":'..HULL..'}','[]'),'Invalid hulls: hulls is not a list (key "'..string.rep('k',17)..'...'},
    -- 17 bytes of key fit: xy, seven é and half of the eighth, which is dropped whole.
    {'long multi-byte key',level('['..HULL..']','{"xy'..string.rep('é',40)..'":'..LABEL..'}'),
        'Invalid labels: labels is not a list (key "xy'..string.rep('é',7)..'...'},
}
local function refused(d,expected,label,err)
    local ok=false
    for _,e in ipairs(type(expected)=='table' and expected or {expected}) do ok=ok or err==e end
    assert(d==nil and ok,label..': must be refused with "'..tostring(type(expected)=='table' and expected[1] or expected)..'", got '
        ..(d and 'an admitted level' or '"'..tostring(err)..'"'))
end
for _,c in ipairs(CASES) do
    local d,err=custom.parse(c[2])
    refused(d,c[3],c[1],err)
    assert(#err<=80,c[1]..': message longer than 80 bytes')
end
print('PASS object-shaped and sparse hulls, labels and hull vertices are refused with a short cause')

-- 3. Shapes JSON cannot write but a Lua caller can: a string key next to a numeric entry, a fractional key.
local base=assert(custom.parse(level('['..HULL..']','['..LABEL..']')))
local function mutated(field,value)
    local d=J.decode(level('['..HULL..']','['..LABEL..']'));d[field]=value
    return d
end
local hull,label=base.hulls[1],base.labels[1]
for _,c in ipairs({
    {'hulls',{hull,['2']=hull},'Invalid hulls: hulls is not a list (key "2")'},
    {'hulls',{hull,x=hull},'Invalid hulls: hulls is not a list (key "x")'},
    {'hulls',{hull,[2.5]=hull},'Invalid hulls: hulls is not a list (key 2.5)'},
    {'labels',{label,['1']=label},'Invalid labels: labels is not a list (key "1")'},
    {'labels',{[0]=label,label},'Invalid labels: labels is not a list (key 0)'},
    {'hulls',{{vertices={hull.vertices[1],hull.vertices[2],hull.vertices[3],x=1}}},'Invalid hull vertices: hull 1 vertices is not a list (key "x")'},
}) do
    local d,err=data.validate(mutated(c[1],c[2]))
    refused(d,c[3],c[1]..' '..c[3],err)
end
print('PASS a string or fractional key next to numeric entries is refused for hulls, labels and hull vertices')

-- 4. The existing limits and messages stay: 64 hulls load, 65 do not; 3-8 hull vertices; non-table fields.
local box='{"vertices":[[%d,0.8],[%d.5,0.8],[%d.5,1.3],[%d,1.3]]}'
local many={};for i=1,65 do many[i]=box:format(i,i,i,i) end
admitted(level('['..table.concat(many,',',1,64)..']','[]'),64,0,'64 hulls')
local _,err=custom.parse(level('['..table.concat(many,',')..']','[]'));assert(err=='Invalid hulls','65 hulls: '..tostring(err))
_,err=custom.parse(level('[{"vertices":[[13.7321,0.8],[21.7321,0.8]]}]','[]'));assert(err=='Invalid hull vertices','2 vertices: '..tostring(err))
_,err=custom.parse(level('[{"vertices":[]}]','[]'));assert(err=='Invalid hull vertices','0 vertices: '..tostring(err))
_,err=custom.parse(level('[{"vertices":[[0,0],[1,0],[2,0.1],[3,0.3],[4,0.6],[5,1],[6,1.5],[7,2.1],[8,2.8]]}]','[]'));assert(err=='Invalid hull vertices','9 vertices: '..tostring(err))
_,err=custom.parse(level('[{"vertices":"x"}]','[]'));assert(err=='Invalid hull vertices','string vertices: '..tostring(err))
_,err=custom.parse(level('"x"','[]'));assert(err=='Invalid hulls','string hulls: '..tostring(err))
_,err=custom.parse(level('[]','7'));assert(err=='Invalid labels','number labels: '..tostring(err))
_,err=custom.parse(level('[1]','[]'));assert(err=='Invalid hull vertices','number hull: '..tostring(err))
_,err=custom.parse(level('[]','[1]'));assert(err=='Invalid label','number label: '..tostring(err))
_,err=custom.parse(level('[{"vertices":[[13.7321,0.8],[21.7321,1.3],[21.7321,0.8]]}]','[]'));assert(err=='Hull must be convex CCW','clockwise hull: '..tostring(err))
print('PASS existing limits and messages: 64 hulls, 3-8 vertices, non-table fields and the convex CCW check')
